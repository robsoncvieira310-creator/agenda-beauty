// ================================
// RUNTIME HEALTH — FASE 2.7 CLOSURE
// ================================
// OBSERVATIONAL ONLY — READ-ONLY HEALTH MONITORING
//
// 🎯 FASE 2.7 CLOSURE: RuntimeHealth é PURAMENTE OBSERVACIONAL
// ❌ NÃO altera estado
// ❌ NÃO corrige drift
// ❌ NÃO muta registry
// ✅ APENAS detecta e reporta
//
// AUTORIDADE:
// → BootOrchestrator é a ÚNICA autoridade de execução
// → RuntimeHealth apenas OBSERVA e REPORTA
// → Qualquer ação requer intervenção do Orchestrator
// ================================

window.RuntimeHealth = class RuntimeHealth {
  constructor(orchestrator, executionPlan = null) {
    this.orchestrator = orchestrator;
    this.plan = executionPlan;  // 🎯 FASE 2.8: ExecutionPlan de referência
    this.checks = [];
    this.interval = null;
    this.lastReport = null;
    this.driftLog = [];
    
    // Configuração
    this.config = {
      checkInterval: 30000,    // 30 segundos
      maxDriftLog: 100,        // Máximo de entradas no log
      // 🎯 FASE 2.8: RuntimeHealth é diff checker
      // Compara estado real contra ExecutionPlan
      criticalServices: ['sessionBus', 'authFSM'] // Serviços críticos
    };
  }

  /**
   * Iniciar monitoramento
   */
  start() {
    if (this.interval) return;
    
    console.log('[RuntimeHealth] Starting monitoring...');
    this._runCheck(); // Check imediato
    
    this.interval = setInterval(() => {
      this._runCheck();
    }, this.config.checkInterval);
  }

  /**
   * Parar monitoramento
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('[RuntimeHealth] Stopped monitoring');
    }
  }

  /**
   * Executar health check manual
   */
  checkNow() {
    return this._runCheck();
  }

  /**
   * Registrar check customizado
   */
  registerCheck(name, checkFn, critical = false) {
    this.checks.push({ name, check: checkFn, critical });
  }

  /**
   * Obter relatório de saúde
   */
  getHealthReport() {
    return this.lastReport || {
      timestamp: Date.now(),
      status: 'unknown',
      checks: [],
      drifts: []
    };
  }

  /**
   * Verificar se serviço crítico está saudável
   */
  isCriticalServiceHealthy(serviceName) {
    const report = this.getHealthReport();
    const serviceCheck = report.checks.find(c => c.name === `service_${serviceName}`);
    return serviceCheck ? serviceCheck.passed : false;
  }

  /**
   * Obter status geral do sistema
   */
  getSystemStatus() {
    const report = this.getHealthReport();
    const criticalFailed = report.checks.filter(c => c.critical && !c.passed);
    
    return {
      healthy: criticalFailed.length === 0,
      status: criticalFailed.length === 0 ? 'healthy' : 'degraded',
      criticalIssues: criticalFailed.map(c => c.name),
      lastCheck: report.timestamp
    };
  }

  /**
   * 🎯 FASE 2.8: Verificar divergência entre ExecutionPlan e estado real
   * Diff checker - compilação vs runtime
   */
  checkPlanDivergence() {
    if (!this.plan) {
      return { divergences: [], message: 'No ExecutionPlan to compare' };
    }
    
    const divergences = [];
    const context = this.orchestrator._context || {};
    const executed = this.orchestrator._executed || new Set();
    
    // Verificar cada passo do plano
    for (const step of this.plan.steps) {
      // Divergência 1: Passo deveria estar executado mas não está
      if (!executed.has(step.id) && this._shouldBeExecuted(step)) {
        divergences.push({
          type: 'missing_execution',
          step: step.id,
          expected: 'executed',
          actual: 'not_executed',
          phase: step.phase
        });
      }
      
      // Divergência 2: Instância deveria existir mas não existe
      if (step.action.includes('instantiate') && !context[step.id]) {
        divergences.push({
          type: 'missing_instance',
          step: step.id,
          expected: 'instance_in_context',
          actual: 'not_found',
          critical: step.critical
        });
      }
    }
    
    // Divergência 3: Estado real não está no plano (ghost)
    for (const key of Object.keys(context)) {
      if (!this.plan.hasStep(key) && !['services', 'core'].includes(key)) {
        divergences.push({
          type: 'unplanned_instance',
          key: key,
          message: 'Instance exists but not in ExecutionPlan'
        });
      }
    }
    
    return {
      timestamp: Date.now(),
      planChecksum: this.plan.checksum,
      divergenceCount: divergences.length,
      divergences
    };
  }
  
  /**
   * 🎯 FASE 2.8: Determinar se passo deveria já ter sido executado
   * @private
   */
  _shouldBeExecuted(step) {
    // Lógica simples: se é fase de runtime e estamos em runtime
    const runtimePhases = ['core_init', 'service_init', 'ui_init', 'boot_unlock'];
    return runtimePhases.includes(step.phase);
  }

  // ================================
  // PRIVATE
  // ================================
  
  _runCheck() {
    const report = {
      timestamp: Date.now(),
      status: 'healthy',
      checks: [],
      drifts: []
    };
    
    // 1. Verificar consistência Registry vs Realidade
    const driftCheck = this._checkRegistryConsistency();
    report.drifts = driftCheck.drifts;
    report.checks.push({
      name: 'registry_consistency',
      passed: driftCheck.consistent,
      critical: false,
      message: driftCheck.consistent ? 'Registry consistent' : `${driftCheck.drifts.length} drifts detected`
    });
    
    // 2. Verificar serviços críticos
    for (const serviceName of this.config.criticalServices) {
      const serviceCheck = this._checkService(serviceName);
      report.checks.push({
        name: `service_${serviceName}`,
        passed: serviceCheck.healthy,
        critical: true,
        message: serviceCheck.message
      });
    }
    
    // 3. Executar checks customizados
    for (const customCheck of this.checks) {
      try {
        const result = customCheck.check();
        report.checks.push({
          name: customCheck.name,
          passed: result.passed,
          critical: customCheck.critical,
          message: result.message
        });
      } catch (error) {
        report.checks.push({
          name: customCheck.name,
          passed: false,
          critical: customCheck.critical,
          message: `Check threw: ${error.message}`
        });
      }
    }
    
    // Determinar status geral
    const criticalFailed = report.checks.filter(c => c.critical && !c.passed);
    report.status = criticalFailed.length === 0 ? 'healthy' : 
                    criticalFailed.length < this.config.criticalServices.length ? 'degraded' : 'critical';
    
    this.lastReport = report;
    
    // Log estruturado
    if (report.status !== 'healthy') {
      console.warn(`[RuntimeHealth] System ${report.status}:`,
        report.checks.filter(c => !c.passed).map(c => c.name));
    }
    
    // 🎯 FASE 2.7 CLOSURE: REMOVIDO auto-recovery
    // RuntimeHealth NÃO altera estado - apenas reporta drift
    // Qualquer ação requer decisão do BootOrchestrator
    
    if (report.drifts.length > 0) {
      console.warn(`[RuntimeHealth] ${report.drifts.length} drifts detected - manual intervention required`);
    }
    
    return report;
  }
  
  _checkRegistryConsistency() {
    const drifts = [];
    const registry = this.orchestrator.registry;
    
    if (!registry) {
      return { consistent: true, drifts: [] };
    }
    
    const status = registry.getStatus();
    const context = this.orchestrator.context || {};
    
    for (const [name, info] of Object.entries(status)) {
      const instance = context[name] || context[`${name}Manager`];
      
      // Drift 1: Registry diz ativo, mas não existe
      if (info.active && !instance) {
        drifts.push({
          type: 'ghost_instance',
          service: name,
          message: `Registry shows ${name} as active but no instance found`
        });
      }
      
      // Drift 2: Instância existe mas registry não sabe
      if (instance && !info.active) {
        drifts.push({
          type: 'unregistered_instance',
          service: name,
          message: `Instance ${name} exists but not registered as active`
        });
      }
      
      // Drift 3: Estado inconsistente
      if (instance && info.active && instance._lifecycleActive !== info.active) {
        drifts.push({
          type: 'state_mismatch',
          service: name,
          message: `Instance._lifecycleActive (${instance._lifecycleActive}) != registry.active (${info.active})`
        });
      }
    }
    
    // Log drifts
    for (const drift of drifts) {
      this._logDrift(drift);
    }
    
    return {
      consistent: drifts.length === 0,
      drifts
    };
  }
  
  _checkService(serviceName) {
    const instance = this._getService(serviceName);
    
    if (!instance) {
      return {
        healthy: false,
        message: `Service ${serviceName} not found in context`
      };
    }
    
    // Verificar se tem lifecycle
    if (typeof instance.isActive === 'function') {
      const active = instance.isActive();
      return {
        healthy: active,
        message: active ? `${serviceName} is active` : `${serviceName} is inactive`
      };
    }
    
    // Sem método isActive - considerar presente como suficiente
    return {
      healthy: true,
      message: `${serviceName} present (no lifecycle check)`
    };
  }
  
  _getService(name) {
    const ctx = this.orchestrator.context || {};
    return ctx[name] || ctx[`${name}Manager`] || null;
  }
  
  _logDrift(drift) {
    this.driftLog.push({
      ...drift,
      timestamp: Date.now()
    });
    
    // Limitar tamanho do log
    if (this.driftLog.length > this.config.maxDriftLog) {
      this.driftLog.shift();
    }
    
    console.warn(`[RuntimeHealth] Drift detected: ${drift.type} - ${drift.message}`);
  }
  
  // 🎯 FASE 2.7 CLOSURE: REMOVIDO _attemptRecovery
  // RuntimeHealth NÃO altera estado - apenas reporta
  // Método removido para garantir observability-only
  
  /**
   * Gerar diagnostics snapshot (para análise manual)
   */
  generateDiagnosticsSnapshot() {
    const registry = this.orchestrator.registry;
    const context = this.orchestrator.context || {};
    
    return {
      timestamp: Date.now(),
      registryStatus: registry ? registry.getStatus() : null,
      contextKeys: Object.keys(context),
      healthReport: this.getHealthReport(),
      driftLog: [...this.driftLog],
      systemStatus: this.getSystemStatus()
    };
  }
};

console.log('[RuntimeHealth] FASE 2.8 loaded - Diff Checker vs ExecutionPlan');
console.log('[RuntimeHealth] ℹ️ Read-only: compares runtime state against compiled plan');
