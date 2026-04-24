// ================================
// BOOT ANOMALY DETECTOR
// Detecção leve de falhas silenciosas
// NÃO bloqueia execução - apenas reporta
// ================================
(function () {
  if (window.__BOOT_ANOMALY_DETECTOR__) {
    return;
  }

  window.__BOOT_ANOMALY_DETECTOR__ = {
    /**
     * Verifica integridade do trace de boot
     * @param {object} trace - Objeto __BOOT_TRACE__
     * @returns {object} Relatório de validação
     */
    check(trace) {
      if (!trace || !trace.events) {
        return {
          valid: false,
          issues: ['NO_TRACE_AVAILABLE'],
          warnings: [],
          metrics: {}
        };
      }

      const events = trace.events;
      const issues = [];
      const warnings = [];

      // Check 1: Eventos críticos presentes
      const hasBootStart = events.some(e => e.event === 'BOOT_START');
      const hasFSMCreate = events.some(e => e.event === 'FSM_CREATE');
      const hasBootComplete = events.some(e => e.event === 'BOOT_COMPLETE');
      const hasKernelAcquire = events.some(e => e.event === 'KERNEL_ACQUIRED');

      if (!hasBootStart) issues.push('NO_BOOT_START');
      if (!hasFSMCreate) issues.push('NO_FSM_CREATED');
      if (!hasBootComplete) issues.push('BOOT_INCOMPLETE');
      if (!hasKernelAcquire) issues.push('NO_KERNEL_LOCK');

      // Check 2: Sequência correta
      const bootStart = events.find(e => e.event === 'BOOT_START');
      const bootComplete = events.find(e => e.event === 'BOOT_COMPLETE');
      
      if (bootStart && bootComplete && bootComplete.t < bootStart.t) {
        issues.push('INVALID_SEQUENCE');
      }

      // Check 3: Tempo excessivo
      const bootDuration = bootStart && bootComplete 
        ? bootComplete.t - bootStart.t 
        : null;
      
      if (bootDuration && bootDuration > 10000) {
        warnings.push('BOOT_SLOW');
      }

      // Check 4: FSM múltiplo (anomalia)
      const fsmCreates = events.filter(e => e.event === 'FSM_CREATE').length;
      if (fsmCreates > 1) {
        issues.push('MULTIPLE_FSM_CREATED');
      }

      // Check 5: Kernel state inconsistente
      const kernelStates = events
        .filter(e => e.event.startsWith('KERNEL_'))
        .map(e => ({ t: e.t, event: e.event }));

      // Check 6: Contexto publicado
      const hasContextPublished = events.some(e => e.event === 'CONTEXT_PUBLISHED');
      if (!hasContextPublished && hasBootComplete) {
        warnings.push('CONTEXT_NOT_PUBLISHED');
      }

      // Métricas
      const metrics = {
        totalEvents: events.length,
        bootDuration: bootDuration ? Math.round(bootDuration) : null,
        fsmCreates,
        kernelTransitions: kernelStates.length,
        uniqueEventTypes: [...new Set(events.map(e => e.event))].length
      };

      return {
        valid: issues.length === 0 && hasBootStart && hasFSMCreate && hasBootComplete,
        issues,
        warnings,
        metrics,
        kernelStates: kernelStates.slice(0, 5) // Top 5 kernel events
      };
    },

    /**
     * Diagnóstico rápido de saúde do sistema
     */
    healthCheck() {
      const trace = window.__BOOT_TRACE__;
      const kernel = window.__BOOT_KERNEL__;
      const context = window.__APP_CONTEXT__;

      return {
        timestamp: Date.now(),
        healthy: kernel?.isReady?.() && !!context,
        components: {
          kernel: {
            exists: !!kernel,
            state: kernel?.state,
            isReady: kernel?.isReady?.()
          },
          context: {
            exists: !!context,
            hasAuthFSM: !!context?.authFSM,
            hasServices: !!context?.services,
            frozen: Object.isFrozen(context)
          },
          trace: {
            exists: !!trace,
            eventCount: trace?.events?.length || 0
          }
        },
        anomaly: this.check(trace)
      };
    }
  };

  console.log('[BOOT_ANOMALY_DETECTOR] Anomaly detector ready');
})();
