// ================================
// BOOT TRACE CONTEXT v2
// Sistema de tracing determinístico para boot pipeline
// Provê: boot instance isolation, phase tracking, causal ordering
// ================================

// Boot Instance ID - único por carregamento de página
window.__BOOT_TRACE_ID__ = window.__BOOT_TRACE_ID__ || 
  (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `boot_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`);

// Buffer de trace global
window.__BOOT_TRACE_BUFFER__ = [];

// Fase atual do boot (para tracking de transições de estado)
window.__BOOT_TRACE_PHASE__ = "INIT";

// Histórico de fases (para reconstrução causal)
window.__BOOT_TRACE_PHASE_HISTORY__ = [{ phase: "INIT", t: performance.now() }];

/**
 * Função principal de trace
 * @param {string} event - Nome do evento
 * @param {object} meta - Metadados adicionais
 */
function trace(event, meta = {}) {
  const entry = {
    bootId: window.__BOOT_TRACE_ID__,
    event,
    meta: { ...meta, url: window.location.href, pathname: window.location.pathname },
    t: performance.now(),
    phase: window.__BOOT_TRACE_PHASE__,
    index: window.__BOOT_TRACE_BUFFER__.length
  };
  
  window.__BOOT_TRACE_BUFFER__.push(entry);
  
  // Log colorido para fácil identificação
  const colors = {
    KERNEL: '#FF6B6B',
    BOOT: '#4ECDC4',
    RECOVERY: '#FFE66D',
    CALLBACK: '#95E1D3',
    PHASE: '#F38181'
  };
  
  const color = Object.entries(colors).find(([k]) => event.includes(k))?.[1] || '#A8A8A8';
  
  console.log(
    `%c[BOOT_TRACE v2]%c ${event}`,
    `background: ${color}; color: #000; font-weight: bold; padding: 2px 6px; border-radius: 3px;`,
    'color: inherit;',
    { 
      phase: window.__BOOT_TRACE_PHASE__, 
      bootId: window.__BOOT_TRACE_ID__.slice(0, 8),
      meta: entry.meta,
      t: entry.t.toFixed(3)
    }
  );
}

/**
 * Transição de fase com registro
 * @param {string} newPhase - Nova fase
 * @param {object} meta - Metadados da transição
 */
function setPhase(newPhase, meta = {}) {
  const oldPhase = window.__BOOT_TRACE_PHASE__;
  window.__BOOT_TRACE_PHASE__ = newPhase;
  
  window.__BOOT_TRACE_PHASE_HISTORY__.push({
    phase: newPhase,
    t: performance.now(),
    from: oldPhase,
    ...meta
  });
  
  trace(`PHASE_TRANSITION`, { from: oldPhase, to: newPhase, ...meta });
}

// Expor globalmente
window.trace = trace;
window.setBootPhase = setPhase;

// Guarda contra múltiplas inicializações
if (!window.__BOOT_TRACE_CONTEXT_INITIALIZED__) {
  window.__BOOT_TRACE_CONTEXT_INITIALIZED__ = true;
  
  trace("TRACE_CONTEXT_INITIALIZED", {
    traceId: window.__BOOT_TRACE_ID__,
    timestamp: Date.now()
  });
}

console.log('[BOOT_TRACE_CONTEXT] v2 initialized with ID:', window.__BOOT_TRACE_ID__);
