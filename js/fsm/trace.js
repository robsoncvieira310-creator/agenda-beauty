// ================================
// TRACE LOGGER - Rastreamento de Fluxo
// ================================
// Debug estruturado + auditoria de transições

window.createTracer = function() {
  const log = [];
  let enabled = true;

  return {
    record(entry) {
      if (!enabled) return;

      const enriched = {
        timestamp: Date.now(),
        sequence: log.length,
        ...entry
      };

      log.push(enriched);

      // Console debug em desenvolvimento
      if (typeof window !== 'undefined' && window.__FSM_DEBUG__) {
        console.log('[FSM Trace]', enriched);
      }
    },

    dump() {
      return [...log];
    },

    clear() {
      log.length = 0;
    },

    enable() {
      enabled = true;
    },

    disable() {
      enabled = false;
    },

    // Replay mental: retorna fluxo como string
    replay() {
      return log.map(e =>
        `[${e.sequence}] ${e.state} --${e.event}→ ${e.nextState || '(effect)'} (${e.origin})`
      ).join('\n');
    }
  };
}

