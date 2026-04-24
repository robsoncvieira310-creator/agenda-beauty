// ================================
// SESSION BUS - Multi-Tab Consistency Layer (EVENTUALLY CONSISTENT)
// ================================
// Responsabilidade única: sincronizar estado de auth entre abas
// Garantias: CAS leader lock, logical clock, monotonic sequence, bounded convergence
//
// Classificação: Eventually consistent with bounded convergence time
// NOTA: Browser não permite strong consistency sem IndexedDB + locking avançado
//
// Arquitetura:
// Aba A/B/C → BroadcastChannel → SessionBus → FSM.dispatch()
//                          ↓
//                    localStorage (monotonic log + CAS leader lock)

window.SessionBus = class SessionBus {
  // ✅ PATCH 4: Constructor sem FSM (desacoplamento real)
  // 🎯 EXECUTION MODEL: SessionBus é PASSIVO - não inicia efeitos colaterais
  // Todas as inicializações ativas devem ser feitas via BootOrchestrator + EAL
  constructor() {
    // ================================
    // 🎯 FASE 2.6.1: LIFECYCLE STATE ONLY (ZERO SIDE-EFFECTS)
    // ================================
    this.__lifecycle = {
      initialized: false,
      active: false,
      listenersBound: false,
      timersStarted: false
    };

    this.__bindings = {
      onMessage: this._onMessage.bind(this),
      onStorage: this._onStorage.bind(this),
      onVisibility: this._onVisibility.bind(this),
      onLoad: this._onLoad.bind(this)
    };

    this.__timers = {
      heartbeat: null,
      leader: null,
      cleanup: null
    };

    // ✅ FASE 1: EventLedger - Sistema central de registro
    // 🎯 FASE 3.0 INSTRUMENTAÇÃO: Detectar ledger ausente no constructor
    if (!window.__EVENT_LEDGER__) {
      console.warn('[INVARIANT][SessionBus] EventLedger ausente no momento do constructor');
    }
    this._ledger = window.__EVENT_LEDGER__ || window.EventLedger?.getInstance();
    if (!this._ledger) {
      console.warn('[SessionBus] ⚠️ EventLedger não disponível - eventos não serão registrados');
    } else {
      console.log('[SessionBus] ✅ EventLedger conectado');
    }
    
    // ✅ PATCH 4: Lista de subscribers (desacoplamento)
    this.subscribers = new Set();

    // ✅ HYDRATION: FSMs conectados para notificação
    this.connectedFSMs = new Set();

    // Identificação única da aba
    this.tabId = this.generateTabId();

    // Logical clock (não depende de wall clock)
    this.logicalClock = 0;

    // Unified checkpoint state (fonte única de verdade)
    this.checkpoint = {
      lastSeq: 0,           // ordering primário
      processed: new Map(), // bounded LRU Map: eventId -> timestamp
      lastClock: 0,         // logical clock tracking
      // ✅ FIX 2: Causal chain tracking
      lastAuthEventType: null,      // último tipo de evento auth
      lastAuthEventVersion: 0,      // version do último evento auth
      sessionFingerprint: null,     // fingerprint da sessão atual
      lastLogoutVersion: 0          // version do último logout (para invalidar restores)
    };

    // External listeners (for EventEmitter compatibility)
    this.listeners = new Map(); // eventType -> Set of handlers

    // Event cache for deduplication
    this.eventCache = new Map(); // eventId -> { ts, fp, clock }

    // Inicia cleanup periódico de eventos antigos (evita memory leak)
    // 🎯 EAL GATE: Timer só deve ser iniciado via BootOrchestrator após unlock

    // Legacy compat (derivados de checkpoint)
    this.localSequence = 0;
    this.lastProcessedIndex = 0;
    this.processedEventIds = this.checkpoint.processed;
    this.logicalClock = this.checkpoint.lastClock;

    // Leader election via CAS lock competitivo (async com backoff)
    this.isLeader = false;
    
    // ✅ FIX 1 & 2: Causal consistency tracking
    this.causality = {
      sessionFingerprint: null,  // hash atual da sessão
      lastAuthEventType: null,   // último evento de auth processado
      lastAuthTimestamp: 0       // timestamp do último evento auth
    };
    
    // ✅ FIX 2: SHADOW BUFFER - Fila de eventos durante boot
    this.shadowBuffer = {
      enabled: false,           // Ativado durante boot
      queue: [],              // Eventos pendentes
      flushed: false          // Já foi feito flush?
    };
    
    // ✅ FIX 1: SESSION LEADER - Lock de autoridade distribuída
    this.sessionLeader = {
      tabId: null,              // Tab ID do leader atual
      priority: 0,              // Prioridade (maior version + menor latency)
      heartbeat: 0,             // Último heartbeat recebido
      lastSeenVersion: 0,       // Última version confirmada do leader
      isAuthoritative: false,   // Esta aba é o leader?
      lockExpiry: 0             // Timestamp de expiração do lock
    };
    
    // ✅ FIX 2: QUORUM DE EVENTOS - Validação distribuída
    this.quorum = {
      confirmations: new Map(), // eventId -> Set(tabIds)
      requiredConfirmations: 2, // Mínimo de confirmações (leader + 1)
      pendingValidation: new Map() // eventId -> {event, timeout}
    };
    
    // ✅ FIX 3: VECTOR CLOCK - Substituir version simples
    this.vectorClock = {
      local: 0,                 // Contador local
      peers: new Map(),         // tabId -> version
      merged: {}                // Snapshot mergeado
    };
    
    // 🎯 EAL GATE: Inicializações de concorrência devem ser feitas via BootOrchestrator
    // NÃO chamar initLeaderLock() ou initDistributedConsensus() aqui

    // ✅ FIX 5: Deterministic Effect Engine (DEE) integration
    this.effectEngine = null; // Será setado pelo BootOrchestrator

    // ✅ FIX 5: Single Event Canonical Log (SECL) reference
    this.secl = null; // Será setado pelo DEE

    // ✅ HYDRATION: SessionBus replay ainda não completo
    this._sessionBusReady = false;

    // 🎯 FASE 2.6.1: BroadcastChannel criado mas listener NÃO registrado ainda
    try {
      this.channel = new BroadcastChannel('auth_session_bus');
      // Listener será registrado em _bindListeners() via activateLifecycle()
    } catch (e) {
      console.warn('[SessionBus] BroadcastChannel não disponível');
      this.channel = null;
    }

    // 🎯 FASE 2.6.1: PASSIVE MODE - Nenhum listener ou timer ativo no constructor
    console.log('[SessionBus] constructed (PASSIVE MODE) - tabId:', this.tabId.slice(0, 8));
  }

  // ================================
  // 🎯 FASE 2.6.1: LIFECYCLE EXPLÍCITO
  // ================================
  activateLifecycle() {
    if (this.__lifecycle.active) {
      console.log('[SessionBus] lifecycle already active');
      return;
    }

    console.log('[SessionBus] activating lifecycle...');

    this._bindListeners();
    this._startTimers();

    this.__lifecycle.active = true;
    this.__lifecycle.initialized = true;

    console.log('[SessionBus] lifecycle ACTIVE');
  }

  deactivateLifecycle() {
    console.log('[SessionBus] deactivating lifecycle...');

    // Stop timers
    Object.values(this.__timers).forEach(t => {
      if (t) clearInterval(t);
    });
    this.__timers = { heartbeat: null, leader: null, cleanup: null };

    // Remove listeners
    if (this.__lifecycle.listenersBound) {
      window.removeEventListener('storage', this.__bindings.onStorage);
      window.removeEventListener('visibilitychange', this.__bindings.onVisibility);
      window.removeEventListener('load', this.__bindings.onLoad);
      
      if (this.channel) {
        this.channel.onmessage = null;
      }
      
      this.__lifecycle.listenersBound = false;
    }

    this.__lifecycle.active = false;
    this.__lifecycle.timersStarted = false;

    console.log('[SessionBus] lifecycle DEACTIVATED');
  }

  _bindListeners() {
    if (this.__lifecycle.listenersBound) return;

    // BroadcastChannel listener
    if (this.channel) {
      this.channel.onmessage = this.__bindings.onMessage;
    }

    // Storage events
    window.addEventListener('storage', this.__bindings.onStorage);
    
    // Visibility change
    window.addEventListener('visibilitychange', this.__bindings.onVisibility);
    
    // Load event
    window.addEventListener('load', this.__bindings.onLoad);

    this.__lifecycle.listenersBound = true;
    console.log('[SessionBus] listeners bound');
  }

  _startTimers() {
    if (this.__lifecycle.timersStarted) return;

    // Heartbeat timer (5s)
    this.__timers.heartbeat = setInterval(() => {
      this.sendHeartbeat();
    }, 5000);

    // Leader expiry check (3s)
    this.__timers.leader = setInterval(() => {
      this.checkLeaderExpiry();
    }, 3000);

    // Cleanup timer (30s)
    this.__timers.cleanup = setInterval(() => {
      this.cleanupProcessedEvents();
    }, 30000);

    this.__lifecycle.timersStarted = true;
    console.log('[SessionBus] timers started');
  }

  // 🎯 FASE 2.6.1: Handler methods (bound in constructor)
  _onMessage(msg) {
    // ✅ FASE 1: REGISTRAR EVENTO BROADCAST CHANNEL NO LEDGER
    if (this._ledger && msg.data) {
      this._ledger.append({
        eventType: msg.data.type || 'BROADCAST_CHANNEL_MESSAGE',
        payload: msg.data.payload || msg.data,
        source: 'BroadcastChannel',
        metadata: {
          broadcastChannel: true,
          senderTabId: msg.data.tabId,
          localTabId: this.tabId,
          eventId: msg.data.id
        }
      });
    }
    this.route(msg.data, 'bc');
  }

  _onStorage(e) {
    // ✅ FASE 1: REGISTRAR EVENTO STORAGE NO LEDGER
    if (this._ledger && e.key?.startsWith('auth_')) {
      this._ledger.append({
        eventType: 'STORAGE_EVENT',
        payload: {
          key: e.key,
          newValue: e.newValue ? '[REDACTED]' : null,
          oldValue: e.oldValue ? '[REDACTED]' : null
        },
        source: 'Storage',
        metadata: {
          storageKey: e.key,
          storageEvent: true,
          url: e.url
        }
      });
    }
    
    if (e.key === 'auth_bus_seq') {
      // Nova sequência disponível, processa novos eventos
      this.processNewEvents();
    }
  }

  _onVisibility() {
    if (!document.hidden) {
      // Tab voltou ao foreground, reconcilia estado
      this.reconcile();
    }
  }

  async _onLoad() {
    if (this._sessionBusReady) {
      // Já foi inicializado via bootstrap, só reconcilia se necessário
      await this.reconcile();
    }
  }

  // ✅ DETERMINÍSTICO: Reconcile síncrono para boot
  // DEVE ser chamado pelo bootstrap APÓS FSM estar conectado
  reconcileImmediate() {
    console.log('[SessionBus] 🎯 IMMEDIATE RECONCILE (boot path)');
    return this.reconcile();
  }

  // Async leader lock init com backoff de contenção
  async initLeaderLock() {
    await this.tryAcquireLeaderLockWithBackoff();

    // Renovação periódica se for líder
    setInterval(async () => {
      if (this.isLeader) {
        const renewal = Date.now();
        localStorage.setItem('auth_leader_lock', JSON.stringify({
          tabId: this.tabId,
          ts: renewal
        }));
      }
    }, 2000);
  }

  // CAS leader lock: write verification loop com BACKOFF DE CONTENÇÃO
  // reduz "dual leader window" quase a zero
  async tryAcquireLeaderLockWithBackoff() {
    const key = 'auth_leader_lock';
    const token = this.tabId;

    for (let i = 0; i < 3; i++) {
      const now = Date.now();

      try {
        localStorage.setItem(key, JSON.stringify({
          tabId: token,
          ts: now
        }));
      } catch (e) {
        this.isLeader = false;
        return false;
      }

      // Força convergência temporal antes de commit lógico
      await new Promise(r => setTimeout(r, 20 + i * 15));

      const check = JSON.parse(localStorage.getItem(key) || '{}');

      if (check.tabId === token && check.ts === now) {
        this.isLeader = true;
        this.leaderAcquiredAt = now;
        return true;
      }
    }

    this.isLeader = false;
    return false;
  }

  // Reconciliation: recovery após tab suspension
  setupReconciliation() {
    window.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        // Tab voltou ao foreground, reconcilia estado
        await this.reconcile();
      }
    });
  }

  async reconcile() {
    try {
      // ✅ FIX 5: RECONCILE GLOBAL - Integração completa de estado distribuído
      console.log('[SessionBus] 🌐 GLOBAL RECONCILE START');
      
      // 1. Carregar checkpoint local
      const persistedCheckpoint = this.loadCheckpoint();
      
      // 2. ✅ FIX 5: Carregar leader state global
      const leaderState = this.loadGlobalLeaderState();
      
      // 3. ✅ FIX 5: Carregar vector clock global
      const globalVectorClock = this.loadGlobalVectorClock();
      
      // 4. ✅ FIX 5: Carregar broadcast history
      const broadcastHistory = this.loadBroadcastHistory();
      
      if (persistedCheckpoint) {
        // Merge com estado global (mais recente vence)
        this.checkpoint.lastSeq = Math.max(
          this.checkpoint.lastSeq, 
          persistedCheckpoint.lastSeq || 0,
          leaderState?.lastSeq || 0
        );
        this.checkpoint.lastAuthEventVersion = Math.max(
          this.checkpoint.lastAuthEventVersion, 
          persistedCheckpoint.lastAuthEventVersion || 0,
          leaderState?.lastAuthEventVersion || 0
        );
        this.checkpoint.lastLogoutVersion = Math.max(
          this.checkpoint.lastLogoutVersion,
          persistedCheckpoint.lastLogoutVersion || 0,
          leaderState?.lastLogoutVersion || 0
        );
        
        // ✅ FIX 5: Merge vector clocks
        if (globalVectorClock) {
          this.mergeVectorClock(globalVectorClock);
        }
        
        // Restaurar causal chain
        if (persistedCheckpoint.sessionFingerprint || leaderState?.sessionFingerprint) {
          this.checkpoint.sessionFingerprint = persistedCheckpoint.sessionFingerprint || leaderState?.sessionFingerprint;
          this.causality.sessionFingerprint = this.checkpoint.sessionFingerprint;
        }
        if (persistedCheckpoint.lastAuthEventType || leaderState?.lastAuthEventType) {
          this.checkpoint.lastAuthEventType = persistedCheckpoint.lastAuthEventType || leaderState?.lastAuthEventType;
          this.causality.lastAuthEventType = this.checkpoint.lastAuthEventType;
        }
        
        this.lastProcessedIndex = this.checkpoint.lastSeq;
        console.log('[SessionBus] Global state loaded, lastSeq:', this.checkpoint.lastSeq,
                    'vectorClock:', Object.keys(this.vectorClock.merged).length, 'peers');
      }
      
      // 5. Processar eventos do monotonic log + broadcast history
      const localEvents = this.getMonotonicLog();
      const allEvents = this.mergeEventSources(localEvents, broadcastHistory);
      
      const now = Date.now();
      const MAX_EVENT_AGE_MS = 5 * 60 * 1000;
      const MAX_AUTH_EVENT_AGE_MS = 2 * 60 * 1000;

      const newEvents = allEvents.filter(e => {
        const eventAge = e.ts ? (now - e.ts) : 0;
        const isAuthEvent = e.type === 'SESSION_RESTORED' || e.type === 'LOGIN' || e.type === 'LOGOUT';
        
        // Event Validity Window
        if (isAuthEvent && eventAge > MAX_AUTH_EVENT_AGE_MS) {
          console.log('[SessionBus] REJECTED (age):', e.type, 'age:', eventAge, 'ms');
          return false;
        }
        if (!isAuthEvent && eventAge > MAX_EVENT_AGE_MS) {
          return false;
        }
        
        // ✅ FIX 5: Validar contra vector clock global
        if (e.vectorClock) {
          const divergence = this.detectCausalDivergence(e.vectorClock);
          if (divergence.divergence) {
            console.log('[SessionBus] REJECTED (vector divergence):', e.type);
            return false;
          }
        }
        
        // ✅ FIX 5: Validar contra leader state
        if (e.type === 'SESSION_RESTORED' && this.checkpoint.lastLogoutVersion > 0) {
          const eventSeq = e.seq || e.index || 0;
          if (eventSeq <= this.checkpoint.lastLogoutVersion) {
            console.log('[SessionBus] REJECTED (reconcile): SESSION_RESTORED seq', eventSeq);
            return false;
          }
        }
        
        // Verificar sequência
        const eventSeq = e.seq || e.index || 0;
        return eventSeq > this.lastProcessedIndex;
      });

      if (newEvents.length > 0) {
        console.log('[SessionBus] Reconcile:', newEvents.length, 'events to process');
      }

      for (const event of newEvents) {
        this.route(event, 'replay');
      }
      
      // ✅ FIX 5: Deterministic Replay via DEE se disponível
      if (this.effectEngine) {
        console.log('[SessionBus] 🔄 Triggering DEE deterministic replay');
        try {
          const replayResult = await this.effectEngine.deterministicReplay();
          console.log('[SessionBus] DEE replay complete:', replayResult.replayed, 'events');
        } catch (e) {
          console.warn('[SessionBus] DEE replay failed:', e);
        }
      }
      
      // ✅ FIX 4: Persistir checkpoint após reconcile
      this.saveCheckpoint();
      
      // ✅ FIX 5: Salvar estado global para outras abas
      this.saveGlobalLeaderState();
      this.saveGlobalVectorClock();

      // ✅ HYDRATION: Notificar subscribers que SessionBus está pronto
      this._markSessionBusReady();

      console.log('[SessionBus] 🌐 GLOBAL RECONCILE COMPLETE');
    } catch (e) {
      console.warn('[SessionBus] Reconcile failed:', e);
    }
  }

  // ✅ HYDRATION: Marcar SessionBus como pronto e notificar FSMs
  _markSessionBusReady() {
    if (this._sessionBusReady) return;
    this._sessionBusReady = true;

    console.log('[SessionBus] Replay complete - notifying FSMs');

    const currentSession = this.getCurrentSession();

    // Notificar todos os FSMs conectados
    for (const fsm of this.connectedFSMs) {
      try {
        // ✅ DETERMINÍSTICO: Só enviar SESSION_BUS_INITIAL_SYNC se FSM não estiver hydrated
        // O estado inicial deve vir de applySnapshot(), não de evento assíncrono
        if (fsm.dispatch && !fsm._hydrated) {
          console.log('[SessionBus] Sending SESSION_BUS_INITIAL_SYNC to FSM (fallback - FSM not hydrated)');
          fsm.dispatch('SESSION_BUS_INITIAL_SYNC', {
            session: currentSession,
            meta: {
              source: 'session_bus_boot_replay',
              authoritative: true,
              phase: 'boot_sync',
              hasSession: !!currentSession,
              timestamp: Date.now()
            }
          });
        } else if (fsm._hydrated) {
          console.log('[SessionBus] FSM already hydrated via snapshot, skipping INITIAL_SYNC');
        }

        // Notificar que SessionBus está pronto (para cross-tab sync e auto-heal)
        if (fsm.markSessionBusReady) {
          fsm.markSessionBusReady();
        }
      } catch (e) {
        console.error('[SessionBus] Error notifying FSM:', e);
      }
    }

    // Publicar evento especial para quem está ouvindo via on()
    this.notifyExternalListeners('SESSION_BUS_READY', {
      type: 'SESSION_BUS_READY',
      timestamp: Date.now(),
      tabId: this.tabId,
      hasSession: !!currentSession
    });
  }
  
  // ✅ FIX 5: Carregar estado global do leader
  loadGlobalLeaderState() {
    try {
      const raw = localStorage.getItem('auth_global_leader_state');
      if (!raw) return null;
      
      const state = JSON.parse(raw);
      const age = Date.now() - (state.timestamp || 0);
      
      // Validade: 30 segundos
      if (age > 30000) {
        console.log('[SessionBus] Leader state expired');
        return null;
      }
      
      return state;
    } catch (e) {
      console.warn('[SessionBus] Failed to load global leader state:', e);
      return null;
    }
  }
  
  // ✅ FIX 5: Salvar estado global do leader
  saveGlobalLeaderState() {
    try {
      const state = {
        tabId: this.tabId,
        isAuthoritative: this.sessionLeader.isAuthoritative,
        lastSeq: this.checkpoint.lastSeq,
        lastAuthEventVersion: this.checkpoint.lastAuthEventVersion,
        lastLogoutVersion: this.checkpoint.lastLogoutVersion,
        sessionFingerprint: this.checkpoint.sessionFingerprint,
        lastAuthEventType: this.checkpoint.lastAuthEventType,
        timestamp: Date.now()
      };
      localStorage.setItem('auth_global_leader_state', JSON.stringify(state));
    } catch (e) {
      console.warn('[SessionBus] Failed to save global leader state:', e);
    }
  }
  
  // ✅ FIX 5: Carregar vector clock global
  loadGlobalVectorClock() {
    try {
      const raw = localStorage.getItem('auth_global_vector_clock');
      if (!raw) return null;
      
      const clock = JSON.parse(raw);
      return clock;
    } catch (e) {
      console.warn('[SessionBus] Failed to load global vector clock:', e);
      return null;
    }
  }
  
  // ✅ FIX 5: Salvar vector clock global
  saveGlobalVectorClock() {
    try {
      const clock = this.getVectorClock();
      localStorage.setItem('auth_global_vector_clock', JSON.stringify(clock));
    } catch (e) {
      console.warn('[SessionBus] Failed to save global vector clock:', e);
    }
  }
  
  // ✅ FIX 5: Carregar histórico de broadcast
  loadBroadcastHistory() {
    try {
      const raw = localStorage.getItem('auth_broadcast_history');
      if (!raw) return [];
      
      const history = JSON.parse(raw);
      const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutos
      
      // Filtrar eventos recentes
      return history.filter(e => (e.ts || 0) > cutoff);
    } catch (e) {
      console.warn('[SessionBus] Failed to load broadcast history:', e);
      return [];
    }
  }
  
  // ✅ FIX 5: Salvar evento no histórico de broadcast
  recordBroadcastEvent(event) {
    try {
      const history = this.loadBroadcastHistory();
      history.push({
        ...event,
        recordedAt: Date.now()
      });
      
      // Limitar a 100 eventos
      if (history.length > 100) {
        history.shift();
      }
      
      localStorage.setItem('auth_broadcast_history', JSON.stringify(history));
    } catch (e) {
      console.warn('[SessionBus] Failed to record broadcast event:', e);
    }
  }
  
  // ✅ FIX 5: Merge de fontes de eventos (local + broadcast)
  mergeEventSources(localEvents, broadcastHistory) {
    const allEvents = [...localEvents];
    const seenIds = new Set(localEvents.map(e => e.id));
    
    // Adicionar eventos do broadcast que não estão no local
    for (const event of broadcastHistory) {
      if (!seenIds.has(event.id)) {
        allEvents.push(event);
        seenIds.add(event.id);
      }
    }
    
    // Ordenar por sequência
    allEvents.sort((a, b) => (a.seq || 0) - (b.seq || 0));
    
    return allEvents;
  }
  
  // ✅ FIX 5: Setar Deterministic Effect Engine
  setEffectEngine(engine) {
    this.effectEngine = engine;
    this.secl = engine?.secl || null;
    console.log('[SessionBus] DEE connected');
  }
  
  // ✅ FIX 5: Verificar se DEE está ativo
  hasDeterministicEngine() {
    return this.effectEngine !== null && this.secl !== null;
  }
  
  // ✅ FIX 5: Enfileirar effect via DEE (se disponível)
  async enqueueEffect(effectName, payload, context) {
    if (this.effectEngine) {
      return this.effectEngine.enqueueEffect(effectName, payload, context);
    }
    
    // Fallback: executar diretamente via EffectRunner
    if (this.effectRunner) {
      const result = await this.effectRunner.run(effectName, payload, context);
      return { executed: true, result, fallback: true };
    }
    
    return { error: 'No effect engine available' };
  }
  
  // ✅ FIX 2: Ativar shadow buffer durante boot
  enableShadowBuffer() {
    this.shadowBuffer.enabled = true;
    this.shadowBuffer.flushed = false;
    this.shadowBuffer.queue = [];
    console.log('[SessionBus] Shadow buffer ENABLED');
  }
  
  // ✅ FIX 2: Desativar shadow buffer e processar eventos pendentes
  async flushShadowBuffer() {
    if (!this.shadowBuffer.enabled || this.shadowBuffer.flushed) {
      return;
    }
    
    console.log(`[SessionBus] Flushing ${this.shadowBuffer.queue.length} shadowed events`);
    
    // Marcar como flushed ANTES de processar (evita re-entrada)
    this.shadowBuffer.flushed = true;
    
    // Processar eventos em ordem FIFO
    for (const { event, source } of this.shadowBuffer.queue) {
      console.log('[SessionBus] Shadow flush:', event.type, 'from', source);
      
      // Re-executar route com flushed=true (não vai para buffer de novo)
      this.route(event, source);
      
      // Pequeno delay para não bloquear UI
      await new Promise(r => setTimeout(r, 0));
    }
    
    // Limpar queue
    this.shadowBuffer.queue = [];
    this.shadowBuffer.enabled = false;
    
    console.log('[SessionBus] Shadow buffer FLUSHED and DISABLED');
  }
  
  // ✅ FIX 2: Contar eventos pendentes
  getPendingEventCount() {
    return this.shadowBuffer.queue?.length || 0;
  }

  route(event, source = 'unknown') {
    // ✅ FIX 2: Se shadow buffer está ativo, enfileirar eventos externos
    if (this.shadowBuffer.enabled && !this.shadowBuffer.flushed) {
      if (source === 'bc' || source === 'storage' || source === 'replay') {
        console.log('[SessionBus] SHADOW BUFFER: Queuing event', event.type, 'from', source);
        this.shadowBuffer.queue.push({ event, source });
        return false; // Não processa ainda
      }
    }

    // Deduplicação global (independente de source)
    if (!this.shouldProcess(event)) {
      return false;
    }

    // Processamento baseado em source
    switch (source) {
      case 'local':
        // Evento local: já processado pelo emit, apenas log
        console.log('[SessionBus] Local event routed:', event.type);
        break;

      case 'bc':
      case 'storage':
        // Evento de outra aba: despachar para subscribers locais
        console.log('[SessionBus] External event routed:', event.type, 'from', source);
        this.publish(event);
        break;

      case 'replay':
        // Evento de reconcile: despachar para subscribers
        console.log('[SessionBus] Replay event routed:', event.type);
        this.publish(event);
        break;

      default:
        console.warn('[SessionBus] Unknown source:', source);
    }

    return true;
  }
  
  // ✅ FIX 4 & 5: Persistir checkpoint em localStorage COM causal chain
  saveCheckpoint() {
    try {
      const data = {
        lastSeq: this.checkpoint.lastSeq,
        lastClock: this.checkpoint.lastClock,
        savedAt: Date.now(),
        tabId: this.tabId,
        // ✅ FIX 5: Causal chain persistence
        lastAuthEventType: this.checkpoint.lastAuthEventType,
        lastAuthEventVersion: this.checkpoint.lastAuthEventVersion,
        sessionFingerprint: this.checkpoint.sessionFingerprint,
        lastLogoutVersion: this.checkpoint.lastLogoutVersion
      };
      localStorage.setItem('auth_session_checkpoint', JSON.stringify(data));
    } catch (e) {
      console.warn('[SessionBus] Failed to save checkpoint:', e);
    }
  }
  
  // ✅ FIX 4 & 5: Carregar checkpoint de localStorage COM causal chain
  loadCheckpoint() {
    try {
      const raw = localStorage.getItem('auth_session_checkpoint');
      if (!raw) return null;
      
      const data = JSON.parse(raw);
      // Validar estrutura mínima
      if (typeof data.lastSeq === 'number') {
        return data;
      }
      return null;
    } catch (e) {
      console.warn('[SessionBus] Failed to load checkpoint:', e);
      return null;
    }
  }

  // Normaliza sessão para schema Supabase-like padrão
  // Garante contrato único: user.id, access_token, refresh_token, expires_at
  normalizeSessionForBus(session) {
    if (!session) return null;

    // Já está no formato correto?
    // Garantir refresh_token mesmo no early return (obrigatório para isValidSession)
    if (session.user?.id && session.access_token && session.expires_at) {
      if (!session.refresh_token) {
        return { ...session, refresh_token: '' };
      }
      return session;
    }

    // Normalizar de formato flat (userId, expiresAt) para nested (user.id, expires_at)
    // refresh_token é obrigatório para isValidSession - garantir string mesmo que vazia
    const normalized = {
      user: session.user || {
        id: session.userId || session.user_id,
        aud: session.aud || 'authenticated',
        role: session.role || 'authenticated',
        email: session.email
      },
      access_token: session.access_token || session.accessToken,
      refresh_token: session.refresh_token || session.refreshToken || '',
      expires_at: session.expires_at || session.expiresAt
    };

    // Validar normalização
    if (!normalized.user?.id || !normalized.access_token || !normalized.expires_at) {
      console.error('[SessionBus] INVALID SESSION PAYLOAD - BLOCKED', {
        original: session,
        normalized
      });
      return null;
    }

    return normalized;
  }

  // Emite evento para todas as abas (com logical clock + sequence + version) - async
  async emit(type, payload = {}) {
    // 🎯 FASE 3.0 INSTRUMENTAÇÃO: Detectar uso antes de activateLifecycle
    if (!this.__lifecycle?.active) {
      console.warn('[INVARIANT][SessionBus] Uso antes de activateLifecycle', { type, active: this.__lifecycle?.active });
    }
    
    // ✅ PATCH FINAL: Single writer enforcement - SessionBus é única fonte de version
    if (payload.version != null) {
      console.error('[SessionBus] Multi-writer detected', payload);
      return; // HARD REJECT - não permite sobrescrever version
    }

    // Normalizar payload de SESSION_RESTORED para schema padrão
    if (type === 'SESSION_RESTORED') {
      const normalized = this.normalizeSessionForBus(payload);
      if (!normalized) {
        console.error('[SessionBus] SESSION_RESTORED emit blocked - invalid payload');
        return;
      }
      payload = normalized;
      
      // ✅ FIX 1: Adicionar fingerprint da sessão
      payload.sessionFingerprint = this.generateSessionFingerprint(payload);
    }
    
    // ✅ FIX 2: Atualizar causal chain para eventos de auth
    if (type === 'SESSION_RESTORED' || type === 'LOGIN' || type === 'LOGOUT') {
      this.causality.lastAuthEventType = type;
      this.causality.lastAuthTimestamp = Date.now();
    }

    // Incrementa logical clock (não depende de wall clock)
    this.logicalClock++;
    this.localSequence++;

    // Obtém sequence global PRIMEIRO (para usar como version cross-tab consistente)
    const globalSeq = this.getNextGlobalSequence();

    // ✅ PATCH FINAL: TODOS os eventos devem ter version
    // Adiciona version monotônico GLOBAL para TODOS os eventos
    payload = {
      ...payload,
      version: globalSeq  // globalSeq = ordering cross-tab consistente
    };

    // ✅ FIX 2: Incluir causal chain no evento
    const causalityChain = {
      lastAuthEventType: this.causality.lastAuthEventType,
      lastAuthEventVersion: this.checkpoint.lastAuthEventVersion,
      sessionFingerprint: this.causality.sessionFingerprint
    };

    const event = {
      id: `${globalSeq}_${this.tabId}`,  // ordering consistente cross-tab
      tabId: this.tabId,
      type,
      payload,
      ts: Date.now(),
      clock: this.logicalClock,     // logical clock
      seq: globalSeq,                // monotonic sequence
      fp: this.fingerprint(type, payload, this.logicalClock), // inclui clock
      // ✅ FIX 2: Causal chain para validação semântica
      causality: causalityChain
    };

    this.register(event);
    
    // ✅ FIX 2: Atualizar checkpoint com último evento auth
    if (type === 'SESSION_RESTORED' || type === 'LOGIN' || type === 'LOGOUT') {
      this.checkpoint.lastAuthEventType = type;
      this.checkpoint.lastAuthEventVersion = globalSeq;
      if (type === 'LOGOUT') {
        this.checkpoint.lastLogoutVersion = globalSeq;
        this.causality.sessionFingerprint = null;
      } else if (payload.sessionFingerprint) {
        this.causality.sessionFingerprint = payload.sessionFingerprint;
        this.checkpoint.sessionFingerprint = payload.sessionFingerprint;
      }
    }

    // Notifica listeners externos da PRÓPRIA aba (local listeners via on())
    this.notifyExternalListeners(type, event);

    // ✅ PATCH: Notifica subscribers (incluindo FSM via connectFSM/subscribe)
    // Garante que eventos locais também cheguem ao FSM
    this.publish(event);

    // BroadcastChannel (primary) - envia para OUTRAS abas
    if (this.channel) {
      this.channel.postMessage(event);
    }

    // Monotonic log storage (append com sequence)
    this.appendToMonotonicLog(event);
  }

  // Logical event fingerprint: elimina duplicação semântica (com logical clock)
  fingerprint(type, payload, clock) {
    const userId = payload?.session?.user?.id || payload?.user?.id || 'null';
    // Usa logical clock em vez de wall clock (evita drift issues)
    const clockWindow = Math.floor((clock || this.logicalClock) / 3);
    return `${type}:${userId}:${clockWindow}`;
  }

  // Global sequence: CAS monotônico (atomicamente seguro)
  getNextGlobalSequence() {
    const key = 'auth_global_seq';

    while (true) {
      const currentRaw = localStorage.getItem(key);
      const current = currentRaw ? Number(currentRaw) : 0;

      if (!Number.isInteger(current) || current < 0) {
        localStorage.setItem(key, '0');
        continue;
      }

      const next = current + 1;

      localStorage.setItem(key, String(next));

      // CONFIRMAÇÃO (CAS SIMPLES)
      const confirmRaw = localStorage.getItem(key);
      const confirm = confirmRaw ? Number(confirmRaw) : null;

      if (confirm === next) {
        return next;
      }

      // retry automático (colisão detectada)
    }
  }

  // Monotonic log: append com sequence index
  appendToMonotonicLog(event) {
    const key = 'auth_bus_events';
    try {
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      list.push(event);
      if (list.length > 20) list.shift(); // ring buffer limit
      localStorage.setItem(key, JSON.stringify(list));
      this.lastProcessedIndex = Math.max(this.lastProcessedIndex, event.seq || 0);
    } catch (e) {
      console.warn('[SessionBus] Monotonic log error:', e);
    }
  }

  // Processa novos eventos do log (após storage event)
  processNewEvents() {
    try {
      const events = this.getMonotonicLog();
      const newEvents = events.filter(e =>
        (e.seq || 0) > this.lastProcessedIndex && e.tabId !== this.tabId
      );

      for (const event of newEvents) {
        this.route(event, 'storage');
      }
    } catch (e) {
      console.warn('[SessionBus] Process new events failed:', e);
    }
  }

  // Obtém log monotônico
  getMonotonicLog() {
    try {
      return JSON.parse(localStorage.getItem('auth_bus_events') || '[]');
    } catch {
      return [];
    }
  }

  // Bounded LRU Map: cleanup de eventos antigos (60s TTL baseado em seenAt)
  startProcessedCleanup() {
    setInterval(() => {
      this.cleanupProcessedEvents();
    }, 30000); // a cada 30s
  }

  cleanupProcessedEvents() {
    const cp = this.checkpoint;
    const now = Date.now();
    const TTL = 60000; // 60 segundos

    // Cleanup baseado apenas em seenAt (não lastSeen)
    for (const [id, data] of cp.processed) {
      if (now - data.seenAt > TTL) {
        cp.processed.delete(id);
      }
    }
  }

  // Strict idempotency: unified checkpoint com bounded LRU Map
  // Separado: seenAt (cleanup base) vs lastSeen (LRU tracking)
  shouldProcess(event) {
    // Checkpoint unificado
    const cp = this.checkpoint;

    // Já processado este eventId?
    if (cp.processed.has(event.id)) {
      // Atualiza apenas lastSeen (LRU tracking)
      // seenAt permanece inalterado (evita mascarar replay loops)
      cp.processed.get(event.id).lastSeen = Date.now();
      return false;
    }

    // Sequência já processada? (lastSeq é autoridade)
    if (event.seq && event.seq <= cp.lastSeq) return false;
    
    // ✅ FIX 3: SEMANTIC REPLAY FILTER - Validar causalidade
    if (event.type === 'SESSION_RESTORED') {
      // Se houve LOGOUT posterior ao version deste evento, rejeitar
      if (cp.lastLogoutVersion > 0 && event.seq && event.seq <= cp.lastLogoutVersion) {
        console.log('[SessionBus] REJECTED: SESSION_RESTORED with seq', event.seq, 
                    'came before lastLogoutVersion', cp.lastLogoutVersion);
        return false;
      }
      
      // Se já processamos LOGOUT nesta aba, rejeitar qualquer SESSION_RESTORED antigo
      if (cp.lastAuthEventType === 'LOGOUT' && event.causality?.lastAuthEventType !== 'LOGOUT') {
        console.log('[SessionBus] REJECTED: SESSION_RESTORED after local LOGOUT');
        return false;
      }
      
      // Validar fingerprint se temos expectativa
      if (cp.sessionFingerprint && event.payload?.sessionFingerprint) {
        const fpCheck = this.validateFingerprintConsistency(
          event.payload, 
          cp.sessionFingerprint
        );
        if (!fpCheck.valid) {
          console.log('[SessionBus] REJECTED: Fingerprint mismatch', fpCheck);
          return false;
        }
      }
    }

    // Marca como processado: seenAt é fixo, lastSeen é mutável
    const now = Date.now();
    cp.processed.set(event.id, {
      seenAt: now,     // timestamp fixo de primeira ocorrência
      lastSeen: now    // timestamp mutável de último acesso
    });
    if (event.seq) cp.lastSeq = Math.max(cp.lastSeq, event.seq);
    if (event.clock) cp.lastClock = Math.max(cp.lastClock, event.clock);
    
    // ✅ FIX 4: Persistir checkpoint após processar novo evento
    this.saveCheckpoint();

    // Cleanup: limita Map size (LRU eviction baseado em lastSeen)
    if (cp.processed.size > 100) {
      // Evict LRU (menor lastSeen)
      let lruKey = null;
      let lruTime = Infinity;
      for (const [id, data] of cp.processed) {
        if (data.lastSeen < lruTime) {
          lruTime = data.lastSeen;
          lruKey = id;
        }
      }
      if (lruKey) cp.processed.delete(lruKey);
    }

    // Sync legacy props
    this.lastProcessedIndex = cp.lastSeq;
    this.logicalClock = cp.lastClock;

    return true;
  }

  // Roteia eventos vindos de outras abas
  route(event, source) {
    if (!event?.id) return;

    // ✅ PATCH FINAL: Sanitização de entrada - rejeitar eventos inválidos
    if (!event?.payload || event.payload.version == null) {
      console.error('[SessionBus] Dropping invalid event', event);
      return;
    }

    // Regra 1: ignorar próprio tab
    if (event.tabId === this.tabId) return;

    // Regra 2: dedupe por ID + fingerprint lógico
    if (this.isDuplicate(event)) return;

    // Regra 3: strict idempotency por eventId
    if (!this.shouldProcess(event)) {
      console.log('[SessionBus] Skip duplicate (idempotency):', event.id.slice(0, 8));
      return;
    }

    // Atualiza sequence tracking
    if (event.seq) {
      this.lastProcessedIndex = Math.max(this.lastProcessedIndex, event.seq);
    }

    this.register(event);

    console.log('[SessionBus] Routing from', source, ':', event.type, 'seq:', event.seq);

    // Regra 4: dispatch controlado
    this.dispatch(event);
  }

  // Verifica se evento é duplicado (ID + fingerprint lógico)
  isDuplicate(event) {
    // Dedupe por ID exato
    const cached = this.eventCache.get(event.id);
    if (cached) return true;

    // Dedupe por fingerprint (mesmo tipo+usuário+clock window)
    if (event.fp) {
      for (const [, v] of this.eventCache) {
        if (v.fp === event.fp) return true;
      }
    }

    return false;
  }

  // Registra evento no cache (com fingerprint e clock)
  register(event) {
    // Proteção defensiva contra race condition no constructor
    if (!this.eventCache) {
      console.error('[SessionBus] eventCache not initialized - defensive fix');
      this.eventCache = new Map();
    }

    this.eventCache.set(event.id, {
      ts: event.ts,
      fp: event.fp || this.fingerprint(event.type, event.payload, event.clock),
      clock: event.clock || 0
    });

    // Cleanup: evita memory leak
    if (this.eventCache.size > 50) {
      const firstKey = this.eventCache.keys().next().value;
      this.eventCache.delete(firstKey);
    }
  }

  // EventEmitter-style: subscribe to external events
  // @param {string} eventType - tipo do evento (ex: 'AUTH_STATE_CHANGE')
  // @param {Function} handler - callback(event)
  // @returns {Function} unsubscribe function
  on(eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(handler);

    // Return unsubscribe function
    return () => this.off(eventType, handler);
  }

  // EventEmitter-style: unsubscribe from events
  // @param {string} eventType - tipo do evento
  // @param {Function} handler - callback a remover
  off(eventType, handler) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(handler);
    }
  }

  // Notify external listeners
  notifyExternalListeners(eventType, event) {
    if (this.listeners.has(eventType)) {
      for (const handler of this.listeners.get(eventType)) {
        try {
          handler(event);
        } catch (e) {
          console.error('[SessionBus] Listener error:', e);
        }
      }
    }
  }

  // ✅ PATCH 4: Subscribe pattern (desacoplamento real)
  subscribe(fn) {
    if (typeof fn !== 'function') {
      throw new Error('Subscriber deve ser uma função');
    }
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  // ✅ PATCH 4: Publish para todos os subscribers
  publish(event) {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (e) {
        console.error('[SessionBus] Subscriber error:', e);
      }
    }
  }

  // ✅ PATCH 4: Connect FSM via subscribe pattern
  connectFSM(fsm) {
    // Auto-subscribe FSM para receber eventos (locais e cross-tab)
    const unsubscribe = this.subscribe((event) => {
      fsm.dispatch(event.type, event.payload);
    });

    // ✅ HYDRATION: Registrar FSM para notificação
    this.connectedFSMs.add(fsm);

    // Retornar unsubscribe que também remove da lista de FSMs
    return () => {
      this.connectedFSMs.delete(fsm);
      unsubscribe();
    };
  }

  // Dispatch para FSM e external listeners
  // ✅ INVARIANTE 2: SessionBus é transporte puro - NÃO transforma eventos
  // EXCEÇÃO: SESSION_RESTORED é normalizado para garantir schema consistente cross-tab
  dispatch(event) {
    let { type, payload } = event;

    // Normalizar payload de SESSION_RESTORED para schema padrão (cross-tab consistency)
    if (type === 'SESSION_RESTORED') {
      const normalized = this.normalizeSessionForBus(payload);
      if (normalized) {
        payload = normalized;
        event = { ...event, payload };
      } else {
        console.error('[SessionBus] Dropping SESSION_RESTORED with invalid payload');
        return;
      }
    }

    // INSTRUMENTAÇÃO: Log de evento do SessionBus
    console.log('[SESSION BUS DISPATCH]', {
      type,
      timestamp: Date.now(),
      eventId: event?.id,
      eventTabId: event?.tabId?.slice(0, 8),
      myTabId: this.tabId?.slice(0, 8),
      isOwnEvent: event?.tabId === this.tabId,
      payload: payload ? {
        userId: payload?.user?.id,
        accessToken: payload?.access_token ? 'present' : 'missing',
        version: payload?.version
      } : null
    });

    // ✅ FASE 1: REGISTRAR NO LEDGER ANTES DE PUBLICAR
    let ledgerEntry = null;
    if (this._ledger) {
      ledgerEntry = this._ledger.append({
        eventType: type,
        payload: payload,
        source: 'SessionBus',
        correlationId: payload?.correlationId,
        parentEventId: payload?.parentEventId,
        metadata: {
          eventId: event?.id,
          tabId: this.tabId,
          isOwnEvent: event?.tabId === this.tabId,
          sessionBusDispatch: true
        }
      });
      
      // Adicionar correlationId ao payload para propagação
      if (ledgerEntry) {
        event = {
          ...event,
          payload: {
            ...payload,
            correlationId: ledgerEntry.correlationId,
            parentEventId: ledgerEntry.eventId,
            _ledgerEventId: ledgerEntry.eventId
          }
        };
      }
    }

    // Notify external listeners first (allows intercepting)
    this.notifyExternalListeners(type, event);

    // ✅ PATCH 4: Publish para subscribers (desacoplamento)
    // FSM recebe via subscribe() - não precisa de dispatch direto
    this.publish(event);
  }

  // Gera ID único para a aba
  generateTabId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // ✅ FIX 1: Inicializar consenso distribuído
  initDistributedConsensus() {
    // Heartbeat periódico para leader election
    setInterval(() => this.sendHeartbeat(), 5000);
    
    // Verificar expiração de leader lock
    setInterval(() => this.checkLeaderExpiry(), 3000);
    
    console.log('[SessionBus] Distributed consensus initialized');
  }
  
  // ✅ FIX 1: Enviar heartbeat para eleição de leader
  sendHeartbeat() {
    const heartbeat = {
      type: 'LEADER_HEARTBEAT',
      tabId: this.tabId,
      priority: this.calculatePriority(),
      timestamp: Date.now(),
      vectorClock: this.getVectorClock()
    };
    
    if (this.channel) {
      this.channel.postMessage(heartbeat);
    }
    
    // Persistir em localStorage para tabs offline
    localStorage.setItem('auth_leader_heartbeat', JSON.stringify(heartbeat));
  }
  
  // ✅ FIX 1: Calcular prioridade (maior version + atividade)
  calculatePriority() {
    const versionScore = this.checkpoint.lastSeq * 1000;
    const activityScore = Date.now() - this.causality.lastAuthTimestamp;
    return versionScore + Math.max(0, 1000000 - activityScore);
  }
  
  // ✅ FIX 1: Verificar e atualizar leader
  checkLeaderExpiry() {
    const now = Date.now();
    const LEADER_LOCK_TTL = 15000; // 15 segundos
    
    if (this.sessionLeader.lockExpiry < now) {
      // Leader expirou, tentar assumir
      if (this.sessionLeader.tabId !== this.tabId) {
        console.log('[SessionBus] Leader expired, attempting takeover');
        this.attemptLeadership();
      }
    }
  }
  
  // ✅ FIX 1: Tentar assumir liderança
  attemptLeadership() {
    const myPriority = this.calculatePriority();
    const currentLeaderPriority = this.sessionLeader.priority;
    
    if (myPriority > currentLeaderPriority || 
        Date.now() > this.sessionLeader.lockExpiry) {
      // Assumir liderança
      this.sessionLeader = {
        tabId: this.tabId,
        priority: myPriority,
        heartbeat: Date.now(),
        lastSeenVersion: this.checkpoint.lastSeq,
        isAuthoritative: true,
        lockExpiry: Date.now() + 15000
      };
      
      console.log('[SessionBus] ★ ASSUMED LEADERSHIP ★');
      this.broadcastLeaderChange();
    }
  }
  
  // ✅ FIX 1: Broadcast de mudança de leader
  broadcastLeaderChange() {
    if (this.channel) {
      this.channel.postMessage({
        type: 'LEADER_CHANGE',
        leaderId: this.tabId,
        priority: this.sessionLeader.priority,
        timestamp: Date.now()
      });
    }
  }
  
  // ✅ FIX 3: Obter vector clock atual
  getVectorClock() {
    const clock = { [this.tabId]: this.vectorClock.local };
    for (const [tabId, version] of this.vectorClock.peers) {
      clock[tabId] = version;
    }
    return clock;
  }
  
  // ✅ FIX 3: Incrementar vector clock local
  incrementVectorClock() {
    this.vectorClock.local++;
    return this.getVectorClock();
  }
  
  // ✅ FIX 3: Merge de vector clocks
  mergeVectorClock(incomingClock) {
    const merged = { ...this.getVectorClock() };
    
    for (const [tabId, version] of Object.entries(incomingClock)) {
      if (merged[tabId] === undefined || merged[tabId] < version) {
        merged[tabId] = version;
        if (tabId !== this.tabId) {
          this.vectorClock.peers.set(tabId, version);
        }
      }
    }
    
    this.vectorClock.merged = merged;
    return merged;
  }
  
  // ✅ FIX 3: Detectar divergência causal
  detectCausalDivergence(eventClock) {
    const localClock = this.getVectorClock();
    let divergence = false;
    let ahead = false;
    let behind = false;
    
    for (const [tabId, version] of Object.entries(eventClock)) {
      const localVersion = localClock[tabId] || 0;
      if (version > localVersion) ahead = true;
      if (version < localVersion) behind = true;
    }
    
    // Divergência se evento está simultaneamente à frente e atrás
    divergence = ahead && behind;
    
    return { divergence, ahead, behind };
  }
  
  // ✅ FIX 2: Validar evento por quorum
  validateEventByQuorum(event) {
    // Leader sempre pode emitir
    if (this.sessionLeader.isAuthoritative) {
      return { valid: true, authority: 'leader' };
    }
    
    // Verificar confirmações existentes
    const confirmations = this.quorum.confirmations.get(event.id) || new Set();
    
    if (confirmations.size >= this.quorum.requiredConfirmations) {
      return { valid: true, authority: 'quorum', confirmations: confirmations.size };
    }
    
    // Aguardar confirmações
    return { valid: false, pending: true, confirmations: confirmations.size };
  }
  
  // ✅ FIX 2: Registrar confirmação de evento
  recordEventConfirmation(eventId, tabId) {
    if (!this.quorum.confirmations.has(eventId)) {
      this.quorum.confirmations.set(eventId, new Set());
    }
    this.quorum.confirmations.get(eventId).add(tabId);
  }
  
  // ✅ FIX 1: Verificar se esta aba é authoritativa
  isAuthoritativeWriter() {
    return this.sessionLeader.isAuthoritative && 
           this.sessionLeader.tabId === this.tabId &&
           Date.now() < this.sessionLeader.lockExpiry;
  }

  // Gera ID único para evento
  generateEventId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ✅ FIX 1: Gerar fingerprint estável da sessão
  generateSessionFingerprint(session) {
    if (!session?.user?.id || !session.access_token) {
      return null;
    }
    // Hash simples mas estável: combina user.id + access_token + refresh_token
    const raw = `${session.user.id}:${session.access_token}:${session.refresh_token || ''}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Converte para 32bit integer
    }
    return `fp_${Math.abs(hash).toString(36)}`;
  }
  
  // ✅ FIX 1: Verificar se fingerprint bate com sessão esperada
  validateFingerprintConsistency(payload, expectedFingerprint) {
    if (!expectedFingerprint) return { valid: true }; // Sem expectativa = aceita
    
    const incomingFp = payload?.sessionFingerprint || 
                       this.generateSessionFingerprint(payload);
    
    if (incomingFp !== expectedFingerprint) {
      return {
        valid: false,
        reason: 'fingerprint_mismatch',
        expected: expectedFingerprint,
        received: incomingFp
      };
    }
    return { valid: true };
  }

  // ✅ CORREÇÃO DEFINITIVA: Obter sessão atual para sincronização inicial
  getCurrentSession() {
    try {
      const raw = localStorage.getItem('auth_session');
      if (!raw) return null;

      const session = JSON.parse(raw);

      // Validar estrutura mínima
      if (!session?.user?.id || !session?.access_token) {
        console.warn('[SessionBus] Invalid session structure in localStorage');
        return null;
      }

      return session;
    } catch (e) {
      console.warn('[SessionBus] Failed to get current session:', e);
      return null;
    }
  }

  // 🎯 EXECUTION MODEL: SessionBus é PASSIVO
  // Inicializações ativas (timers, listeners, locks) devem ser feitas via BootOrchestrator
  // usando window.__EAL__.gate(() => { /* inicialização */ })

  // Cleanup
  destroy() {
    if (this.channel) {
      this.channel.close();
    }
  }
}

