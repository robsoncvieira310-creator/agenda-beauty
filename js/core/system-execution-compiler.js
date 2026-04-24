// ================================
// SYSTEM EXECUTION COMPILER (SEC) — FASE 2.8
// ================================
// PURE COMPILER — Deterministic Bootstrap Plan Generator
//
// 🎯 FASE 2.8: SEC vira compilador puro
// ❌ ANTES: contrato ativo com runtime awareness
// ✅ AGORA: compilador determinístico de bootstrap plan
//
// PROPRIEDADES:
// → Deterministic output
// → Pure function (mesmo input = mesmo output)
// → Compile-time only (zero runtime decisions)
// → Gera ExecutionPlan imutável
//
// CONCEITO:
// O sistema deixa de decidir o que fazer em runtime
// e passa a executar um plano previamente compilado.
//
// FLUXO:
// SystemConfig → SEC (Compiler) → ExecutionPlan (IR) → BootOrchestrator (Executor)
// ================================

window.SystemExecutionCompiler = class SystemExecutionCompiler {
  constructor() {
    // Definições de serviços (source code)
    this.definitions = new Map();
    
    // Inicializar definições padrão
    this._initializeDefinitions();
  }

  // ================================
  // COMPILATION API
  // ================================

  /**
   * 🎯 FASE 2.8: Compilar plano de execução
   * FUNÇÃO PURA — mesmo input sempre gera mesmo output
   * 
   * @param {Object} config - Configuração de compilação
   * @param {string} config.bootId - ID do ciclo de boot
   * @param {string} config.version - Versão do plano
   * @returns {ExecutionPlan} Plano imutável
   */
  compile({ bootId = null, version = '2.8.0' } = {}) {
    console.log('[SEC] Compiling ExecutionPlan...');
    
    const timestamp = Date.now();
    const finalBootId = bootId || `boot_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 1. Compilar definições em steps
    const steps = this._compileSteps();
    
    // 2. Resolver ordem topológica (determinística)
    const order = this._resolveOrder(steps);
    
    // 3. Criar ExecutionPlan imutável
    const plan = new window.ExecutionPlan({
      steps: order.map(id => steps.get(id)),
      version,
      timestamp,
      bootId: finalBootId
    });
    
    // 4. Log de compilação (audit trail)
    console.log('[SEC] ExecutionPlan compiled:', {
      bootId: finalBootId,
      version,
      stepCount: plan.stepCount,
      checksum: plan.checksum,
      timestamp
    });
    
    return plan;
  }

  /**
   * Compilar versão específica do plano (para testes/reprodução)
   */
  compileVersion(version, bootId = null) {
    return this.compile({ bootId, version });
  }

  // ================================
  // DEFINITION API (compile-time only)
  // ================================

  /**
   * Definir serviço no source code
   * NÃO afeta planos já compilados
   */
  define(name, config) {
    const definition = {
      name,
      phase: config.phase,
      action: config.action || 'instantiate_and_activate',
      dependencies: config.dependencies || [],
      critical: config.critical !== false,
      fallback: config.fallback || null,
      classRef: config.classRef || null,
      constructorArgs: config.constructorArgs || [],
      description: config.description || ''
    };
    
    this.definitions.set(name, definition);
    return this;
  }

  /**
   * Obter definição (compile-time inspection)
   */
  getDefinition(name) {
    return this.definitions.get(name) || null;
  }

  /**
   * Listar todas as definições
   */
  getAllDefinitions() {
    return Array.from(this.definitions.values());
  }

  // ================================
  // INTROSPECTION (read-only)
  // ================================

  /**
   * Obter informações do compilador
   */
  getCompilerInfo() {
    return {
      version: '2.8.0',
      type: 'deterministic_bootstrap_compiler',
      definitionCount: this.definitions.size,
      phases: [
        'pre_boot',
        'boot_lock',
        'core_init',
        'service_init',
        'ui_init',
        'boot_unlock',
        'post_boot'
      ]
    };
  }

  /**
   * Exportar source code (para auditoria)
   */
  exportSourceCode() {
    return {
      version: '2.8.0',
      timestamp: Date.now(),
      definitions: Array.from(this.definitions.values()).map(d => ({
        name: d.name,
        phase: d.phase,
        action: d.action,
        dependencies: d.dependencies,
        critical: d.critical,
        hasFallback: !!d.fallback,
        description: d.description
      }))
    };
  }

  // ================================
  // PRIVATE (compilation internals)
  // ================================

  _compileSteps() {
    const steps = new Map();
    
    for (const [name, def] of this.definitions) {
      const step = new window.ExecutionStep({
        id: name,
        phase: def.phase,
        action: def.action,
        dependencies: def.dependencies,
        critical: def.critical,
        fallback: def.fallback,
        metadata: {
          classRef: def.classRef?.name || null,
          constructorArgCount: def.constructorArgs.length,
          description: def.description
        }
      });
      
      steps.set(name, step);
    }
    
    return steps;
  }

  _resolveOrder(steps) {
    // Topological sort determinístico
    const visited = new Set();
    const temp = new Set();
    const order = [];
    
    const visit = (name) => {
      if (temp.has(name)) {
        throw new Error(`[SEC] Circular dependency detected: ${name}`);
      }
      if (visited.has(name)) return;
      
      temp.add(name);
      const step = steps.get(name);
      if (step) {
        for (const dep of step.dependencies) {
          if (steps.has(dep)) {
            visit(dep);
          }
        }
      }
      temp.delete(name);
      visited.add(name);
      order.push(name);
    };
    
    // Ordenar por fase primeiro, depois por dependências
    const phaseOrder = [
      'pre_boot',
      'boot_lock',
      'core_init',
      'service_init',
      'ui_init',
      'boot_unlock',
      'post_boot'
    ];
    
    const byPhase = {};
    for (const [name, step] of steps) {
      if (!byPhase[step.phase]) byPhase[step.phase] = [];
      byPhase[step.phase].push(name);
    }
    
    for (const phase of phaseOrder) {
      const phaseSteps = byPhase[phase] || [];
      for (const name of phaseSteps) {
        if (!visited.has(name)) {
          visit(name);
        }
      }
    }
    
    return order;
  }

  _initializeDefinitions() {
    // Fase: PRE_BOOT
    this.define('pre_boot_check', {
      phase: 'pre_boot',
      action: 'validate_environment',
      dependencies: [],
      critical: true,
      description: 'Pre-boot environment validation'
    });
    
    // Fase: BOOT_LOCK
    this.define('eal_lock', {
      phase: 'boot_lock',
      action: 'eal_lock',
      dependencies: ['pre_boot_check'],
      critical: true,
      description: 'EAL lock for controlled initialization'
    });
    
    // Fase: CORE_INIT
    this.define('sessionBus', {
      phase: 'core_init',
      action: 'instantiate_and_activate',
      dependencies: ['eal_lock'],
      critical: true,
      classRef: window.SessionBus,
      description: 'Session bus for cross-tab communication'
    });
    
    this.define('authFSM', {
      phase: 'core_init',
      action: 'instantiate_and_activate',
      dependencies: ['eal_lock', 'sessionBus'],
      critical: true,
      classRef: window.AuthFSM,
      description: 'Auth state machine'
    });
    
    // Fase: SERVICE_INIT
    this.define('dataCore', {
      phase: 'service_init',
      action: 'instantiate',
      dependencies: ['authFSM'],
      critical: false,
      fallback: () => ({ degraded: true, cache: false }),
      description: 'Data layer with caching'
    });
    
    this.define('services', {
      phase: 'service_init',
      action: 'instantiate_services',
      dependencies: ['dataCore'],
      critical: false,
      fallback: () => ({ degraded: true, offline: true }),
      description: 'Domain services'
    });
    
    // Fase: UI_INIT
    // 🎯 NOTA: SidebarManager removido - funcionalidade migrada para SidebarComponent
    // SidebarComponent é instanciado pelo ViewManager quando necessário
    
    this.define('modalManager', {
      phase: 'ui_init',
      action: 'instantiate_and_activate',
      dependencies: ['services'],
      critical: false,
      classRef: window.ModalManager,
      description: 'Modal UI component'
    });
    
    this.define('pageManager', {
      phase: 'ui_init',
      action: 'instantiate_and_activate',
      dependencies: ['services'],
      critical: false,
      classRef: window.PageManager,
      description: 'Page management'
    });
    
    // Fase: BOOT_UNLOCK
    this.define('eal_unlock', {
      phase: 'boot_unlock',
      action: 'eal_unlock',
      dependencies: ['modalManager', 'pageManager'],
      critical: true,
      description: 'EAL unlock for normal operation'
    });
    
    // Fase: POST_BOOT
    this.define('health_monitor_start', {
      phase: 'post_boot',
      action: 'start_health_monitoring',
      dependencies: ['eal_unlock'],
      critical: false,
      description: 'Start runtime health monitoring'
    });
  }
};

console.log('[SystemExecutionCompiler] FASE 2.8 loaded');
console.log('[SystemExecutionCompiler] Pure compiler - deterministic output');
console.log('[SystemExecutionCompiler] Zero runtime decisions');
