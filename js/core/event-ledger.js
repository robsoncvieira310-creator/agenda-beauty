/**
 * EventLedger - Sistema Central de Registro de Eventos
 * FASE 1: EVENT LEDGER + TRAVA DE DISPATCH
 * 
 * Responsabilidades:
 * - Registro append-only de todos os eventos do sistema
 * - Centralização obrigatória de dispatch (nenhum evento entra sem passar pelo ledger)
 * - Propagação de correlationId para tracing causal
 * - Modo DEBUG com log consolidado por correlationId
 * 
 * @class EventLedger
 * @singleton
 */

class EventLedger {
  constructor() {
    if (EventLedger.instance) {
      return EventLedger.instance;
    }
    
    // =====================
    // CORE STORAGE (append-only)
    // =====================
    this._entries = [];              // Array principal - nunca remove
    this._indexById = new Map();     // Índice por eventId O(1)
    this._indexByCorrelation = new Map(); // Índice por correlationId
    this._indexByType = new Map();   // Índice por eventType
    
    // =====================
    // CORRELATION TRACKING
    // =====================
    this._activeCorrelations = new Map(); // correlationId -> {startTime, chain}
    this._currentCorrelation = null;      // correlation em andamento (para herança)
    
    // =====================
    // CONFIGURATION
    // =====================
    this._config = {
      maxEntries: 10000,              // Limite de memória (LRU em último caso)
      debugMode: false,               // DEBUG ativado?
      logToConsole: true,           // Log em console?
      persistToStorage: false,       // Persistir em localStorage?
      maxChainDepth: 50              // Limite de profundidade de chain
    };
    
    // =====================
    // METRICS
    // =====================
    this._metrics = {
      totalAppended: 0,
      totalDispatched: 0,
      totalRejected: 0,
      bySource: new Map(),
      byType: new Map(),
      startTime: Date.now()
    };
    
    // =====================
    // DISPATCH TRAVA (pipeline central)
    // =====================
    this._dispatchHandlers = new Map(); // eventType -> handler[]
    this._globalPreDispatch = [];       // Middlewares globais
    this._ledgerLock = false;           // Previne reentrância no ledger
    
    EventLedger.instance = this;
    
    console.log('[EventLedger] ✅ Singleton inicializado - FASE 1 ATIVA');
  }
  
  // =====================
  // SINGLETON ACCESSOR
  // =====================
  static getInstance() {
    if (!EventLedger.instance) {
      // 🎯 FASE 3.0 INSTRUMENTAÇÃO: Rastrear criação de instância
      console.warn('[TRACE][EventLedger] Instância criada em:', new Error().stack);
      EventLedger.instance = new EventLedger();
    }
    return EventLedger.instance;
  }
  
  static reset() {
    EventLedger.instance = null;
    console.log('[EventLedger] 🔄 Reset - nova instância será criada');
  }
  
  // =====================
  // CORE: APPEND (único ponto de entrada)
  // =====================
  
  /**
   * Registra um evento no ledger (APPEND-ONLY)
   * 
   * @param {Object} eventData
   * @param {string} eventData.eventType - Tipo do evento (ex: SESSION_RESTORED)
   * @param {Object} eventData.payload - Payload do evento
   * @param {string} eventData.source - Origem (FSM | SessionBus | AutoHeal | Supabase | BroadcastChannel)
   * @param {string} [eventData.eventId] - UUID (gerado se omitido)
   * @param {string} [eventData.correlationId] - Herdado ou gerado novo
   * @param {string} [eventData.parentEventId] - Evento pai na cadeia causal
   * @param {Object} [eventData.metadata] - Metadados adicionais
   * 
   * @returns {Object} entry registrada (com eventId e timestamp atribuídos)
   */
  append(eventData) {
    // TRAVA: Previne reentrância
    if (this._ledgerLock) {
      console.warn('[EventLedger] ⚠️ Reentrância detectada, enfileirando');
      return this._enqueueForAppend(eventData);
    }
    
    this._ledgerLock = true;
    
    try {
      // Validação obrigatória
      if (!eventData.eventType) {
        throw new Error('[EventLedger] ❌ eventType é obrigatório');
      }
      if (!eventData.source) {
        throw new Error('[EventLedger] ❌ source é obrigatório');
      }
      
      // Validação de source permitido
      const allowedSources = ['FSM', 'SessionBus', 'AutoHeal', 'Supabase', 'BroadcastChannel', 'Storage', 'EffectRunner', 'BootKernel'];
      if (!allowedSources.includes(eventData.source)) {
        console.warn(`[EventLedger] ⚠️ Source desconhecido: ${eventData.source}`);
      }
      
      // Gerar IDs
      const eventId = eventData.eventId || this._generateEventId();
      const timestamp = Date.now();
      
      // CorrelationId propagation rule
      let correlationId = eventData.correlationId;
      if (!correlationId) {
        // Se veio de outro evento (tem parentEventId), herda correlation se existir
        if (eventData.parentEventId) {
          const parentEntry = this._indexById.get(eventData.parentEventId);
          if (parentEntry) {
            correlationId = parentEntry.correlationId;
          }
        }
        // Se ainda não tem, gera novo
        if (!correlationId) {
          correlationId = this._generateCorrelationId();
        }
      }
      
      // Criar entry
      const entry = {
        eventId,
        timestamp,
        source: eventData.source,
        eventType: eventData.eventType,
        payload: this._sanitizePayload(eventData.payload),
        correlationId,
        parentEventId: eventData.parentEventId || null,
        metadata: {
          ...eventData.metadata,
          ledgerIndex: this._entries.length,
          ledgerSequence: this._metrics.totalAppended + 1,
          bootId: window.__BOOT_ID__ || 'unknown'
        }
      };
      
      // APPEND-ONLY: Adiciona ao array principal
      this._entries.push(entry);
      this._metrics.totalAppended++;
      
      // Indexar
      this._indexById.set(eventId, entry);
      
      // Indexar por correlation
      if (!this._indexByCorrelation.has(correlationId)) {
        this._indexByCorrelation.set(correlationId, []);
      }
      this._indexByCorrelation.get(correlationId).push(entry);
      
      // Indexar por tipo
      if (!this._indexByType.has(eventData.eventType)) {
        this._indexByType.set(eventData.eventType, []);
      }
      this._indexByType.get(eventData.eventType).push(entry);
      
      // Métricas por source
      const sourceCount = this._metrics.bySource.get(eventData.source) || 0;
      this._metrics.bySource.set(eventData.source, sourceCount + 1);
      
      // Métricas por tipo
      const typeCount = this._metrics.byType.get(eventData.eventType) || 0;
      this._metrics.byType.set(eventData.eventType, typeCount + 1);
      
      // Persistir se configurado
      if (this._config.persistToStorage) {
        this._persistEntry(entry);
      }
      
      // DEBUG: Log consolidado
      if (this._config.debugMode) {
        this._logDebugEntry(entry);
      }
      
      // Check limites de memória
      this._enforceMemoryLimits();
      
      // Notificar listeners do ledger
      this._notifyLedgerListeners(entry);
      
      return entry;
      
    } finally {
      this._ledgerLock = false;
      this._processQueue();
    }
  }
  
  // =====================
  // CENTRAL DISPATCH GATE (trava obrigatória)
  // =====================
  
  /**
   * DISPATCH CENTRAL - Único ponto de entrada para dispatch no sistema
   * 
   * FLUXO OBRIGATÓRIO:
   *   1. append() → registra no ledger
   *   2. executa pre-dispatch middlewares
   *   3. chama handler(s) registrado(s)
   *   4. registra resultado
   * 
   * NENHUM dispatch deve ocorrer fora deste método.
   * 
   * @param {string} eventType - Tipo do evento
   * @param {Object} payload - Payload
   * @param {Object} options - Opções
   * @param {string} options.source - Origem obrigatória
   * @param {string} [options.correlationId] - Para herança
   * @param {string} [options.parentEventId] - Evento causal pai
   * @returns {Object} Resultado do dispatch
   */
  dispatch(eventType, payload, options = {}) {
    // TRAVA FUNDAMENTAL: source é obrigatório
    if (!options.source) {
      console.error(`[EventLedger] ❌ DISPATCH REJEITADO: source não informado para ${eventType}`);
      console.error('[EventLedger] ❌ Todo dispatch deve informar sua origem!');
      throw new Error(`Dispatch sem source: ${eventType}. Use ledger.dispatch(eventType, payload, { source: 'XXX' })`);
    }
    
    // PASSO 1: Sempre append primeiro
    const entry = this.append({
      eventType,
      payload,
      source: options.source,
      correlationId: options.correlationId,
      parentEventId: options.parentEventId,
      metadata: {
        dispatchOptions: options,
        dispatchTimestamp: Date.now()
      }
    });
    
    // PASSO 2: Executar middlewares globais
    const context = {
      entry,
      eventType,
      payload,
      options,
      cancelled: false,
      result: null
    };
    
    for (const middleware of this._globalPreDispatch) {
      try {
        middleware(context);
        if (context.cancelled) {
          console.log(`[EventLedger] 🚫 Dispatch cancelado por middleware: ${eventType}`);
          this._metrics.totalRejected++;
          return { status: 'cancelled', entry, reason: 'middleware' };
        }
      } catch (e) {
        console.error('[EventLedger] ❌ Erro em middleware:', e);
      }
    }
    
    // PASSO 3: Executar handlers
    const handlers = this._dispatchHandlers.get(eventType) || [];
    const results = [];
    
    for (const handler of handlers) {
      try {
        const result = handler(payload, entry, context);
        results.push({ handler: handler.name, result, success: true });
      } catch (e) {
        console.error(`[EventLedger] ❌ Erro em handler ${handler.name}:`, e);
        results.push({ handler: handler.name, error: e.message, success: false });
      }
    }
    
    // PASSO 4: Registrar resultado
    this._metrics.totalDispatched++;
    entry.metadata.dispatchResults = results;
    entry.metadata.dispatchCompletedAt = Date.now();
    
    // DEBUG
    if (this._config.debugMode) {
      console.log(`[EventLedger] ✅ DISPATCH: ${eventType} (${results.length} handlers)`, {
        eventId: entry.eventId,
        correlationId: entry.correlationId,
        results: results.length
      });
    }
    
    return {
      status: 'dispatched',
      entry,
      handlerResults: results,
      handlersCount: results.length
    };
  }
  
  /**
   * Registra um handler para um tipo de evento
   * @param {string} eventType - Tipo do evento
   * @param {Function} handler - (payload, entry, context) => void
   */
  on(eventType, handler) {
    if (!this._dispatchHandlers.has(eventType)) {
      this._dispatchHandlers.set(eventType, []);
    }
    this._dispatchHandlers.get(eventType).push(handler);
    
    if (this._config.debugMode) {
      console.log(`[EventLedger] 🔗 Handler registrado: ${eventType} (${handler.name || 'anonymous'})`);
    }
    
    // Retornar unsubscribe
    return () => {
      const handlers = this._dispatchHandlers.get(eventType);
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    };
  }
  
  /**
   * Adiciona middleware global de pre-dispatch
   * @param {Function} middleware - (context) => void (set context.cancelled = true para bloquear)
   */
  use(middleware) {
    this._globalPreDispatch.push(middleware);
  }
  
  // =====================
  // CORRELATION CHAIN DEBUG
  // =====================
  
  /**
   * Recupera toda a cadeia causal de um correlationId
   * @param {string} correlationId 
   * @returns {Array} Entries ordenadas por timestamp
   */
  getCausalChain(correlationId) {
    const chain = this._indexByCorrelation.get(correlationId) || [];
    return [...chain].sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Mostra no console a cadeia causal completa (DEBUG)
   * @param {string} correlationId 
   */
  debugChain(correlationId) {
    const chain = this.getCausalChain(correlationId);
    
    console.group(`[EventLedger] 🔍 CAUSAL CHAIN: ${correlationId}`);
    console.log(`Total events: ${chain.length}`);
    console.log(`Duration: ${chain.length > 1 ? chain[chain.length - 1].timestamp - chain[0].timestamp : 0}ms`);
    
    chain.forEach((entry, idx) => {
      const indent = '  '.repeat(idx);
      const arrow = idx > 0 ? '└─► ' : '● ';
      console.log(`${indent}${arrow}[${entry.source}] ${entry.eventType} (${entry.timestamp})`, {
        eventId: entry.eventId,
        payloadKeys: Object.keys(entry.payload || {})
      });
    });
    
    console.groupEnd();
    
    return chain;
  }
  
  /**
   * Mostra todas as chains ativas no momento
   */
  debugAllChains() {
    console.group('[EventLedger] 🔍 ALL ACTIVE CHAINS');
    
    const correlations = Array.from(this._indexByCorrelation.keys());
    console.log(`Total correlations: ${correlations.length}`);
    
    correlations.forEach(corrId => {
      const chain = this._indexByCorrelation.get(corrId);
      if (chain.length > 1) {
        console.log(`\n[${corrId}] ${chain.length} events`);
        chain.forEach((entry, idx) => {
          console.log(`  ${idx + 1}. [${entry.source}] ${entry.eventType}`);
        });
      }
    });
    
    console.groupEnd();
  }
  
  // =====================
  // INSTRUMENTATION HELPERS
  // =====================
  
  /**
   * Cria um wrapper instrumentado para qualquer função de dispatch
   * Útil para instrumentar código legado
   * 
   * @param {Function} originalFn - Função original (ex: fsm.dispatch)
   * @param {string} source - Source a ser registrado
   * @param {Object} target - Objeto alvo (para contexto)
   * @returns {Function} Função wrapper
   */
  instrumentDispatch(originalFn, source, target) {
    const ledger = this;
    
    return function instrumentedDispatch(eventType, payload) {
      // Chamar pelo ledger central
      return ledger.dispatch(eventType, payload, {
        source,
        parentEventId: ledger._currentContext?.eventId
      });
    };
  }
  
  /**
   * Wrapper para eventos externos (Supabase, BroadcastChannel, etc)
   * @param {string} source - Origem do evento externo
   * @param {Function} handler - Handler a ser chamado após registro
   */
  wrapExternalEvent(source, handler) {
    const ledger = this;
    
    return function wrappedHandler(event) {
      // Determinar eventType baseado no evento recebido
      let eventType = 'EXTERNAL_EVENT';
      let payload = event;
      
      if (event?.type) {
        eventType = event.type;
      }
      if (event?.data) {
        payload = event.data;
        if (event.data.type) {
          eventType = event.data.type;
        }
      }
      
      // Registro obrigatório
      const entry = ledger.append({
        eventType,
        payload,
        source,
        metadata: {
          rawEvent: event,
          isExternal: true
        }
      });
      
      // Atualizar contexto atual para herança
      ledger._currentContext = entry;
      
      try {
        // Chamar handler original
        return handler(event, entry);
      } finally {
        ledger._currentContext = null;
      }
    };
  }
  
  // =====================
  // QUERY METHODS
  // =====================
  
  getEntryById(eventId) {
    return this._indexById.get(eventId);
  }
  
  getEntriesByType(eventType) {
    return this._indexByType.get(eventType) || [];
  }
  
  getEntriesBySource(source) {
    return this._entries.filter(e => e.source === source);
  }
  
  getEntriesInRange(startTime, endTime) {
    return this._entries.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
  }
  
  getAllEntries() {
    return [...this._entries];
  }
  
  getMetrics() {
    return {
      ...this._metrics,
      totalInLedger: this._entries.length,
      uniqueCorrelations: this._indexByCorrelation.size,
      uptime: Date.now() - this._metrics.startTime,
      memoryUsage: this._estimateMemoryUsage()
    };
  }
  
  // =====================
  // CONFIGURATION
  // =====================
  
  configure(options) {
    Object.assign(this._config, options);
    
    if (options.debugMode) {
      console.log('[EventLedger] 🔍 DEBUG MODE ATIVADO');
    }
  }
  
  enableDebug() {
    this._config.debugMode = true;
    this._config.logToConsole = true;
    console.log('[EventLedger] 🔍 DEBUG MODE ATIVADO');
  }
  
  disableDebug() {
    this._config.debugMode = false;
    console.log('[EventLedger] 🔍 DEBUG MODE DESATIVADO');
  }
  
  // =====================
  // PRIVATE METHODS
  // =====================
  
  _generateEventId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  _generateCorrelationId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `corr_${crypto.randomUUID()}`;
    }
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  _sanitizePayload(payload) {
    // Remover dados sensíveis
    if (!payload) return payload;
    
    const sensitive = ['password', 'secret', 'token', 'access_token', 'refresh_token'];
    const sanitized = { ...payload };
    
    for (const key of sensitive) {
      if (sanitized[key]) {
        sanitized[key] = `[${key.toUpperCase()}_REDACTED]`;
      }
    }
    
    return sanitized;
  }
  
  _logDebugEntry(entry) {
    if (!this._config.logToConsole) return;
    
    const chain = this._indexByCorrelation.get(entry.correlationId) || [];
    const chainIndex = chain.indexOf(entry);
    
    console.log(`[EventLedger] 📝 ${entry.eventType}`, {
      source: entry.source,
      eventId: entry.eventId,
      correlationId: entry.correlationId,
      chainPosition: `${chainIndex + 1}/${chain.length}`,
      timestamp: entry.timestamp,
      payload: entry.payload
    });
  }
  
  _notifyLedgerListeners(entry) {
    // Hook para futuras extensões (ex: telemetria)
    if (window.__LEDGER_LISTENERS__) {
      for (const listener of window.__LEDGER_LISTENERS__) {
        try {
          listener(entry);
        } catch (e) {
          console.error('[EventLedger] Erro em listener:', e);
        }
      }
    }
  }
  
  _enforceMemoryLimits() {
    if (this._entries.length > this._config.maxEntries) {
      // Em modo append-only, não removemos - apenas avisamos
      console.warn(`[EventLedger] ⚠️ Limite de entradas atingido: ${this._entries.length}/${this._config.maxEntries}`);
      
      // Futuro: arquivar em IndexedDB ou truncar com backup
    }
  }
  
  _estimateMemoryUsage() {
    // Estimativa simples
    const avgEntrySize = 500; // bytes
    return this._entries.length * avgEntrySize;
  }
  
  _persistEntry(entry) {
    try {
      const key = `ledger_${entry.eventId}`;
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (e) {
      console.warn('[EventLedger] Falha ao persistir:', e);
    }
  }
  
  _enqueueForAppend(eventData) {
    if (!this._appendQueue) this._appendQueue = [];
    this._appendQueue.push(eventData);
    return { status: 'enqueued', eventData };
  }
  
  _processQueue() {
    if (!this._appendQueue || this._appendQueue.length === 0) return;
    
    const queue = [...this._appendQueue];
    this._appendQueue = [];
    
    for (const eventData of queue) {
      this.append(eventData);
    }
  }
}

// =====================
// GLOBAL ACCESS
// =====================

window.EventLedger = EventLedger;

// Criar instância singleton global
window.__EVENT_LEDGER__ = EventLedger.getInstance();

// Atalho de conveniência
window.$ledger = window.__EVENT_LEDGER__;

console.log('[EventLedger] 📊 Sistema de Ledger inicializado e disponível via window.__EVENT_LEDGER__ ou window.$ledger');

// Export para módulos (se houver sistema de modules)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventLedger;
}
