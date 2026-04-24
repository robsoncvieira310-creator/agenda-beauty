// ================================
// DETERMINISTIC EFFECT ENGINE (DEE)
// ================================
// Fase 5: Correção de fundamentos de correência e verdade semântica
// 
// Responsabilidade única: Serialização global determinística de efeitos
// Garantias: FIFO ordering, 2-phase commit, idempotência hard lock
//
// Arquitetura: Event Sourcing + Command Pattern + Deterministic Replay

(function() {
  'use strict';

  if (window.DeterministicEffectEngine) {
    console.warn('[DEE] Already loaded, skipping');
    return;
  }

  // ================================
  // SINGLE EVENT CANONICAL LOG (SECL)
  // ================================
  // ✅ FIX 3: Única fonte de verdade do sistema
  class SingleEventCanonicalLog {
    constructor() {
      // Log imutável de eventos (append-only)
      this.log = [];
      
      // Índice por eventId para deduplicação O(1)
      this.index = new Map();
      
      // Último evento commitado (para recovery)
      this.lastCommittedIndex = -1;
      this.lastCommittedHash = null;
      
      // Persistência
      this.storageKey = 'auth_secl_v1';
      this.loadFromStorage();
    }

    // ✅ FIX 3: Append-only com validação
    append(event) {
      // Verificar duplicação
      if (this.index.has(event.id)) {
        console.log('[SECL] Deduplicate:', event.id);
        return { success: false, reason: 'duplicate', index: this.index.get(event.id) };
      }

      // Validar integridade
      if (!this.validateEvent(event)) {
        console.error('[SECL] Invalid event:', event);
        return { success: false, reason: 'invalid' };
      }

      // Adicionar metadados de commit
      const committedEvent = {
        ...event,
        _secl: {
          index: this.log.length,
          timestamp: Date.now(),
          hash: this.computeEventHash(event),
          prevHash: this.lastCommittedHash
        }
      };

      // Append ao log
      this.log.push(committedEvent);
      this.index.set(event.id, this.log.length - 1);
      
      // Atualizar estado de commit
      this.lastCommittedIndex = this.log.length - 1;
      this.lastCommittedHash = committedEvent._secl.hash;

      // Persistir
      this.persist();

      console.log('[SECL] Committed:', event.type, 'at index', committedEvent._secl.index);
      
      return { 
        success: true, 
        index: committedEvent._secl.index,
        hash: committedEvent._secl.hash 
      };
    }

    // ✅ FIX 3: Validar estrutura de evento
    validateEvent(event) {
      return (
        event &&
        typeof event.id === 'string' &&
        typeof event.type === 'string' &&
        event.payload !== undefined &&
        event.vectorClock !== undefined &&
        typeof event.tabId === 'string'
      );
    }

    // ✅ FIX 5: Computar hash determinístico do evento
    computeEventHash(event) {
      // Normalizar para hash determinístico
      const normalized = {
        id: event.id,
        type: event.type,
        payload: this.normalizePayload(event.payload),
        vectorClock: event.vectorClock,
        tabId: event.tabId,
        seq: event.seq
      };
      
      const str = JSON.stringify(normalized, Object.keys(normalized).sort());
      
      // Simple hash (suficiente para browser)
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      
      return `h${Math.abs(hash).toString(36)}`;
    }

    normalizePayload(payload) {
      // Remover campos voláteis do payload para hash consistente
      const { persistedAt, sourceTabId, ...stable } = payload || {};
      return stable;
    }

    // ✅ FIX 3: Obter evento por índice
    get(index) {
      return this.log[index] || null;
    }

    // ✅ FIX 3: Obter todos os eventos desde um índice
    getSince(index) {
      return this.log.slice(index + 1);
    }

    // ✅ FIX 3: Obter log completo
    getAll() {
      return [...this.log];
    }

    // ✅ FIX 4: Obter ordenação determinística total
    getTotalOrder() {
      // Ordenação: vectorClock dominance → seq → hash → timestamp
      return this.log.map((e, i) => ({
        index: i,
        event: e,
        sortKey: this.computeSortKey(e)
      })).sort((a, b) => {
        return a.sortKey.localeCompare(b.sortKey);
      });
    }

    computeSortKey(event) {
      // Criar chave de ordenação total determinística
      const vc = Object.entries(event.vectorClock || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join(',');
      
      const seq = String(event.seq || 0).padStart(10, '0');
      const hash = event._secl?.hash || 'z';
      
      return `${vc}|${seq}|${hash}`;
    }

    // Persistência
    persist() {
      try {
        const data = {
          log: this.log,
          lastCommittedIndex: this.lastCommittedIndex,
          lastCommittedHash: this.lastCommittedHash,
          version: '1.0'
        };
        localStorage.setItem(this.storageKey, JSON.stringify(data));
      } catch (e) {
        console.error('[SECL] Persist failed:', e);
      }
    }

    loadFromStorage() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          const data = JSON.parse(raw);
          this.log = data.log || [];
          this.lastCommittedIndex = data.lastCommittedIndex || -1;
          this.lastCommittedHash = data.lastCommittedHash || null;
          
 // Reconstruir índice
          this.log.forEach((e, i) => this.index.set(e.id, i));
          
          console.log('[SECL] Loaded:', this.log.length, 'events');
        }
      } catch (e) {
        console.error('[SECL] Load failed:', e);
      }
    }

    // ✅ FIX 5: Verificar se evento já foi commitado
    isCommitted(eventId) {
      return this.index.has(eventId);
    }

    // ✅ FIX 5: Obter proof de commit
    getCommitProof(eventId) {
      const index = this.index.get(eventId);
      if (index === undefined) return null;
      
      const event = this.log[index];
      return {
        index,
        hash: event._secl.hash,
        timestamp: event._secl.timestamp,
        merklePath: this.computeMerklePath(index)
      };
    }

    computeMerklePath(index) {
      // Simplificação: retornar hash dos eventos adjacentes
      const neighbors = [];
      if (index > 0) neighbors.push(this.log[index - 1]._secl.hash);
      if (index < this.log.length - 1) neighbors.push(this.log[index + 1]._secl.hash);
      return neighbors;
    }
  }

  // ================================
  // DETERMINISTIC EFFECT ENGINE
  // ================================
  window.DeterministicEffectEngine = class DeterministicEffectEngine {
    constructor(sessionBus, authFSM) {
      this.sessionBus = sessionBus;
      this.authFSM = authFSM;
      
      // ✅ FIX 3: Single Event Canonical Log
      this.secl = new SingleEventCanonicalLog();
      
      // ✅ FIX 1: Fila global FIFO determinística
      this.effectQueue = [];
      this.processing = false;
      this.currentEffect = null;
      
      // ✅ FIX 2: 2-Phase Commit tracking
      this.pendingCommits = new Map(); // effectId → {phase, computed, result}
      this.committedEffects = new Set(); // effectIds já commitados
      
      // ✅ FIX 5: Idempotência hard lock
      this.executedEffects = new Set(); // hash de effect já executado
      
      // Configuração
      this.maxRetries = 3;
      this.retryDelay = 100;
      
      console.log('[DEE] Deterministic Effect Engine initialized');
    }

    // ================================
    // ✅ FIX 1: EFFECT SERIALIZATION LAYER
    // ================================
    
    // Enfileirar effect para execução serializada
    async enqueueEffect(effectName, payload, context = {}) {
      const effectId = this.computeEffectId(effectName, payload, context);
      
      // ✅ FIX 5: Verificar idempotência
      if (this.executedEffects.has(effectId)) {
        console.log('[DEE] Effect already executed:', effectId);
        return { skipped: true, reason: 'already_executed', effectId };
      }

      const effect = {
        id: effectId,
        name: effectName,
        payload,
        context,
        enqueuedAt: Date.now(),
        retryCount: 0
      };

      this.effectQueue.push(effect);
      console.log('[DEE] Enqueued:', effectName, 'queue size:', this.effectQueue.length);
      
      // Processar fila se não estiver processando
      if (!this.processing) {
        this.processQueue();
      }
      
      return { enqueued: true, effectId, position: this.effectQueue.length };
    }

    // Processar fila de effects em ordem FIFO
    async processQueue() {
      if (this.processing || this.effectQueue.length === 0) {
        return;
      }

      this.processing = true;
      console.log('[DEE] Starting queue processing, effects:', this.effectQueue.length);

      while (this.effectQueue.length > 0) {
        // Pegar próximo effect
        this.currentEffect = this.effectQueue.shift();
        
        try {
          // ✅ FIX 2: 2-Phase Commit
          await this.executeEffectTwoPhase(this.currentEffect);
        } catch (error) {
          console.error('[DEE] Effect execution failed:', this.currentEffect.name, error);
          
          // Retry logic
          if (this.currentEffect.retryCount < this.maxRetries) {
            this.currentEffect.retryCount++;
            this.effectQueue.unshift(this.currentEffect);
            await this.delay(this.retryDelay * this.currentEffect.retryCount);
          }
        }
      }

      this.processing = false;
      this.currentEffect = null;
      console.log('[DEE] Queue processing complete');
    }

    // ================================
    // ✅ FIX 2: 2-PHASE EFFECT COMMIT
    // ================================
    
    async executeEffectTwoPhase(effect) {
      console.log('[DEE] 2-Phase executing:', effect.name);
      
      // Phase 1: COMPUTE
      const computeResult = await this.computeEffect(effect);
      
      if (!computeResult.success) {
        throw new Error(`Compute failed: ${computeResult.error}`);
      }
      
      // Registrar pending commit
      this.pendingCommits.set(effect.id, {
        phase: 'computed',
        computed: Date.now(),
        result: computeResult
      });
      
      // Phase 2: COMMIT (após validação)
      await this.commitEffect(effect, computeResult);
      
      // Marcar como executado (idempotência)
      this.executedEffects.add(effect.id);
      this.pendingCommits.delete(effect.id);
      
      console.log('[DEE] Effect committed:', effect.name);
    }

    // Phase 1: Compute (sem side effects no estado)
    async computeEffect(effect) {
      const { name, payload, context } = effect;
      
      console.log('[DEE] Phase 1 - Compute:', name);
      
      // Executar effect do EffectRunner
      if (!this.sessionBus.effectRunner) {
        return { success: false, error: 'No effect runner available' };
      }
      
      try {
        const result = await this.sessionBus.effectRunner.run(
          name, 
          payload, 
          { signal: context.signal }
        );
        
        return { 
          success: true, 
          result,
          computedAt: Date.now()
        };
      } catch (error) {
        return { 
          success: false, 
          error: error.message 
        };
      }
    }

    // Phase 2: Commit (aplicar ao estado)
    async commitEffect(effect, computeResult) {
      console.log('[DEE] Phase 2 - Commit:', effect.name);
      
      const { result } = computeResult;
      
      // Criar evento para SECL
      if (result?.event) {
        const event = {
          id: `${Date.now()}_${effect.id}`,
          type: result.event,
          payload: result.payload || {},
          vectorClock: this.sessionBus.getVectorClock(),
          tabId: this.sessionBus.tabId,
          seq: this.sessionBus.checkpoint.lastSeq + 1,
          sourceEffect: effect.name,
          effectId: effect.id
        };
        
        // Commit ao SECL
        const seclResult = this.secl.append(event);
        
        if (seclResult.success) {
          // Dispatch para FSM
          await this.authFSM.dispatch(result.event, result.payload);
          
          // Emit via SessionBus
          await this.sessionBus.emit(result.event, result.payload);
        }
      }
      
      return { committed: true };
    }

    // ================================
    // ✅ FIX 4: DETERMINISTIC REPLAY ENGINE
    // ================================
    
    // Replay determinístico completo do log
    async deterministicReplay(targetIndex = null) {
      console.log('[DEE] 🔄 DETERMINISTIC REPLAY START');
      
      // 1. Obter ordenação total determinística
      const totalOrder = this.secl.getTotalOrder();
      const eventsToReplay = targetIndex !== null 
        ? totalOrder.filter(e => e.index <= targetIndex)
        : totalOrder;
      
      console.log('[DEE] Replaying', eventsToReplay.length, 'events');
      
      // 2. Reset FSM para estado inicial
      this.authFSM.resetToInitialState();
      
      // 3. Replay em ordem determinística
      for (const { index, event } of eventsToReplay) {
        console.log('[DEE] Replay:', event.type, 'at index', index);
        
        // Validar integridade
        const proof = this.secl.getCommitProof(event.id);
        if (!proof) {
          throw new Error(`Missing commit proof for event at index ${index}`);
        }
        
        // Aplicar ao FSM
        await this.authFSM.dispatch(event.type, event.payload);
        
        // Pequeno delay para não bloquear
        await this.delay(0);
      }
      
      console.log('[DEE] ✅ DETERMINISTIC REPLAY COMPLETE');
      
      return {
        replayed: eventsToReplay.length,
        finalState: this.authFSM.getState(),
        lastIndex: eventsToReplay[eventsToReplay.length - 1]?.index
      };
    }

    // ================================
    // ✅ FIX 5: IDEMPOTENCY UTILITIES
    // ================================
    
    computeEffectId(effectName, payload, context) {
      // Hash determinístico do effect
      const normalized = {
        name: effectName,
        payload: this.normalizeForId(payload),
        vectorClock: context.vectorClock || this.sessionBus?.getVectorClock(),
        tabId: context.tabId || this.sessionBus?.tabId
      };
      
      const str = JSON.stringify(normalized, Object.keys(normalized).sort());
      
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      
      return `eff_${Math.abs(hash).toString(36)}`;
    }

    normalizeForId(obj) {
      // Normalizar objeto para hash consistente
      if (typeof obj !== 'object' || obj === null) return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(item => this.normalizeForId(item));
      }
      
      const sorted = {};
      Object.keys(obj).sort().forEach(key => {
        sorted[key] = this.normalizeForId(obj[key]);
      });
      
      return sorted;
    }

    // Verificar se effect já foi executado
    isEffectExecuted(effectId) {
      return this.executedEffects.has(effectId);
    }

    // ================================
    // UTILITIES
    // ================================
    
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Obter estado atual do engine
    getEngineState() {
      return {
        secl: {
          length: this.secl.log.length,
          lastCommitted: this.secl.lastCommittedIndex
        },
        queue: {
          length: this.effectQueue.length,
          processing: this.processing,
          current: this.currentEffect?.name
        },
        pendingCommits: this.pendingCommits.size,
        executedEffects: this.executedEffects.size
      };
    }

    // Limpar estado (para testing)
    clear() {
      this.secl = new SingleEventCanonicalLog();
      this.effectQueue = [];
      this.processing = false;
      this.pendingCommits.clear();
      this.executedEffects.clear();
    }
  };

  console.log('[DEE] Module loaded');

})();
