// ================================
// BOOT CAUSAL ENGINE v3
// Grafo causal completo - Call graph runtime - Detector de dual finalizer
// ================================

// Inicialização do grafo causal global
window.__BOOT_CAUSAL_GRAPH__ = [];
window.__BOOT_EVENT_INDEX__ = 0;
window.__BOOT_FINALIZED__ = false;  // SINGLE FINALIZER LOCK

/**
 * Gera ID sequencial para eventos
 */
function getEventId() {
  return ++window.__BOOT_EVENT_INDEX__;
}

/**
 * Trace causal - registra evento com lineage
 * @param {string} event - Nome do evento
 * @param {object} meta - Metadados adicionais
 * @param {number|null} parentId - ID do evento pai (causal link)
 * @returns {number} ID do evento criado
 */
window.causalTrace = function(event, meta = {}, parentId = null) {
  const node = {
    id: getEventId(),
    bootId: window.__BOOT_TRACE_ID__ || window.__BOOT_ID__ || 'unknown',
    event,
    meta,
    parentId,
    t: performance.now(),
    phase: window.__BOOT_TRACE_PHASE__ || 'INIT'
  };

  window.__BOOT_CAUSAL_GRAPH__.push(node);

  // Log para console em modo debug
  if (window.__BOOT_CAUSAL_DEBUG__) {
    const parentInfo = parentId ? `(parent: ${parentId})` : '(root)';
    console.log(`[CAUSAL] ${event} ${parentInfo}`, meta);
  }

  return node.id;
};

/**
 * Wrapper para compatibilidade com trace v2
 * Converte chamadas trace() para causalTrace()
 */
window.trace = function(event, meta = {}) {
  // Usar último evento como parent se disponível
  const graph = window.__BOOT_CAUSAL_GRAPH__;
  const lastEvent = graph.length > 0 ? graph[graph.length - 1] : null;
  const parentId = lastEvent && !event.includes('ENTER') ? lastEvent.id : null;

  return window.causalTrace(event, meta, parentId);
};

/**
 * Obtém o último evento registrado (útil para chaining)
 */
window.getLastCausalEvent = function() {
  const graph = window.__BOOT_CAUSAL_GRAPH__;
  return graph.length > 0 ? graph[graph.length - 1] : null;
};

/**
 * Encontra evento por ID
 */
window.findCausalEvent = function(id) {
  return window.__BOOT_CAUSAL_GRAPH__.find(n => n.id === id);
};

/**
 * Reconstrói cadeia causal a partir de um evento
 * @param {number} eventId - ID do evento de destino
 * @returns {Array} Cadeia de eventos do root até o destino
 */
window.buildCausalChain = function(eventId) {
  const chain = [];
  let current = window.findCausalEvent(eventId);

  while (current) {
    chain.unshift(current);
    current = current.parentId ? window.findCausalEvent(current.parentId) : null;
  }

  return chain;
};

/**
 * Encontra todos os eventos filhos de um evento pai
 */
window.findCausalChildren = function(parentId) {
  return window.__BOOT_CAUSAL_GRAPH__.filter(n => n.parentId === parentId);
};

console.log('[BOOT_CAUSAL_ENGINE] v3 initialized - Causal graph ready');
