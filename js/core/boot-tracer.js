// ================================
// BOOT TRACE COLLECTOR
// Rastreabilidade e diagnóstico do boot
// NÃO interfere no fluxo de execução
// ================================
(function () {
  if (window.__BOOT_TRACE__) {
    console.log('[BOOT_TRACER] Already initialized');
    return;
  }

  window.__BOOT_TRACE__ = {
    events: [],
    startTime: performance.now(),

    /**
     * Registra evento no trace
     * @param {string} event - Nome do evento
     * @param {object} data - Dados associados
     */
    log(event, data = {}) {
      const entry = {
        t: performance.now(),
        relT: performance.now() - this.startTime,
        event,
        data: JSON.parse(JSON.stringify(data)) // Deep clone para imutabilidade
      };
      this.events.push(entry);
      
      // Log em dev mode
      if (window.location.hostname === 'localhost' || window.location.search.includes('debug=1')) {
        console.log(`[BOOT_TRACE] ${event}`, { t: entry.relT.toFixed(2) + 'ms', ...data });
      }
    },

    /**
     * Cria snapshot imutável do estado atual
     */
    snapshot() {
      return Object.freeze({
        capturedAt: performance.now(),
        duration: performance.now() - this.startTime,
        eventCount: this.events.length,
        events: Object.freeze([...this.events]),
        kernelState: window.__BOOT_KERNEL__?.getState?.(),
        hasAppContext: !!window.__APP_CONTEXT__,
        appContextKeys: window.__APP_CONTEXT__ ? Object.keys(window.__APP_CONTEXT__) : [],
        bootId: window.__BOOT_ID__,
        isReady: window.__BOOT_KERNEL__?.isReady?.()
      });
    },

    /**
     * Exporta dados para análise externa
     */
    export() {
      return {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        ...this.snapshot()
      };
    },

    /**
     * Busca eventos específicos no trace
     * @param {string} eventName - Nome do evento a buscar
     */
    findEvents(eventName) {
      return this.events.filter(e => e.event === eventName);
    },

    /**
     * Calcula tempo entre dois eventos
     * @param {string} fromEvent - Evento inicial
     * @param {string} toEvent - Evento final
     */
    getDuration(fromEvent, toEvent) {
      const from = this.events.find(e => e.event === fromEvent);
      const to = this.events.find(e => e.event === toEvent);
      if (!from || !to) return null;
      return to.t - from.t;
    }
  };

  // Log inicial
  window.__BOOT_TRACE__.log('TRACER_INITIALIZED', {
    bootId: window.__BOOT_ID__,
    timestamp: Date.now()
  });

  console.log('[BOOT_TRACER] Trace collector ready');
})();
