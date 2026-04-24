// ================================
// BOOT ORCHESTRATOR - FASE 2.8: BLIND EXECUTOR (EXECUTION COMPILATION LAYER)
// ================================
// 🎯 FASE 2.8: BootOrchestrator vira "executor cego"
//
// REGRAS INVARIANTES (NÃO NEGOCIÁVEIS):
// ✅ Nenhum efeito colateral fora de window.__EAL__.gate(() => { ... })
// ✅ Nenhuma inicialização ativa em SessionBus/AuthFSM constructors
// ✅ BootOrchestrator é BLIND EXECUTOR — apenas segue o plano
// ✅ SystemExecutionCompiler gera ExecutionPlan (compilação)
// ✅ ExecutionPlan é IMUTÁVEL — única fonte de verdade
// ✅ EAL é a única autoridade temporal de execução
// ✅ ExecutionFirewall é a única autoridade de execução de lifecycle
// ✅ RuntimeHealth é APENAS observacional (sem mutação)
//
// ARQUITETURA FASE 2.8 (Execution Compilation Layer):
// SystemExecutionCompiler (COMPILER — determina plano)
//   ↓
// ExecutionPlan (IMUTÁVEL — IR do sistema)
//   ↓
// BootOrchestrator (BLIND EXECUTOR — sem decisão)
//   ↓
// ExecutionFirewall (enforcement)
//   ↓
// LifecycleContract (state consistency)
//   ↓
// LifecycleRegistry (observability)
//   ↓
// RuntimeHealth (passive diagnostics)
//
// PRINCÍPIO CENTRAL:
// → O sistema deixa de decidir o que fazer em runtime
// → Passa a executar um plano previamente compilado
// → Zero lógica condicional no Orchestrator
// → Determinismo bit-a-bit
// ================================
(function() {

if (window.BootOrchestrator) {
  console.warn('[LOAD] BootOrchestrator already loaded, skipping...');
  return;
}

// ================================
// BOOT ORCHESTRATOR
// ================================
window.BootOrchestrator = class BootOrchestrator {
  constructor(options = {}) {
    // BOOT ID ÚNICO para este ciclo de aplicação
    this.CURRENT_BOOT_ID = `boot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[BootOrchestrator] Boot ID:', this.CURRENT_BOOT_ID);

    // 🔴 FASE 2.6.4: Validar todas as camadas
    if (!window.__EAL__) {
      throw new Error('[BootOrchestrator] EAL not initialized - load execution-authority-layer.js first');
    }
    
    if (!window.ExecutionFirewall) {
      throw new Error('[BootOrchestrator] ExecutionFirewall not initialized - load execution-firewall.js first');
    }
    
    // 🎯 FASE 2.8: Execution Compilation Layer
    // BootOrchestrator é BLIND EXECUTOR — apenas executa o plano
    
    // 1. COMPILAR PLANO (uma vez, no início)
    this.compiler = new window.SystemExecutionCompiler();
    this.plan = this.compiler.compile({ bootId: this.CURRENT_BOOT_ID });
    console.log('[BootOrchestrator] ExecutionPlan compiled:', {
      bootId: this.CURRENT_BOOT_ID,
      checksum: this.plan.checksum,
      stepCount: this.plan.stepCount
    });
    
    // 2. EAL (temporal)
    
    // 3. ExecutionFirewall (enforcement)
    this.firewall = window.ExecutionFirewall.getInstance();
    this.token = this.firewall.assumeOwnership(this.CURRENT_BOOT_ID);
    this.firewall.enableStrictMode();
    
    // 4. LifecycleRegistry (observability)
    this.registry = window.LifecycleRegistry?.getInstance?.() || null;
    if (!this.registry) {
      console.warn('[BootOrchestrator] LifecycleRegistry not available');
    }
    
    // 5. ManagerFactory (conveniência)
    this.factory = window.ManagerFactory?.getInstance?.() || null;
    
    // 6. RuntimeHealth (observacional - diff checker)
    this.health = new window.RuntimeHealth(this, this.plan);  // FASE 2.8: recebe plano
    
    // 🎯 FASE 2.8: Estado de execução — apenas rastreamento, não decisão
    this._executed = new Set();  // Passos executados (do plano)
    this._failed = new Set();    // Passos falhos
    this._context = {};          // Contexto acumulado

    // Dependências externas (injetadas, não derivadas)
    this.deps = {
      SessionBus: window.SessionBus,
      EffectRunner: window.EffectRunner,
      AuthFSM: window.AuthFSM,
      DataCore: window.DataCore,
      ClienteService: window.ClienteService,
      ServicoService: window.ServicoService,
      ProfissionalService: window.ProfissionalService,
      BloqueioService: window.BloqueioService,
      AgendamentoService: window.AgendamentoService,
      // 🎯 SidebarManager removido - funcionalidade migrada para SidebarComponent
      ModalManager: window.ModalManager,
      PageManager: window.PageManager,
      supabaseClient: window.supabaseClient
    };

    // Validar dependências críticas
    this._validateDependencies();

    // Contexto acumulado durante o boot
    this.context = {
      bootId: this.CURRENT_BOOT_ID
    };

    console.log('[BootOrchestrator] Initialized (FASE 2: EAL Single Authority)');
  }

  /**
   * Valida dependências críticas
   * @private
   */
  _validateDependencies() {
    const critical = ['SessionBus', 'AuthFSM', 'DataCore', 'supabaseClient'];
    const missing = critical.filter(key => !this.deps[key]);

    if (missing.length > 0) {
      throw new Error(`[BootOrchestrator] Missing critical dependencies: ${missing.join(', ')}`);
    }
  }

  /**
   * 🎯 FASE 2.8: Verificar integridade do plano compilado
   * BootOrchestrator NÃO valida lógica — apenas verifica integridade do artefato
   * @private
   */
  _validatePlan() {
    // Verificar checksum do plano
    if (!this.plan.verifyChecksum()) {
      throw new Error(`[BootOrchestrator] ExecutionPlan checksum mismatch — plan corrupted`);
    }
    
    console.log('[BOOT] ExecutionPlan validated:', {
      checksum: this.plan.checksum,
      stepCount: this.plan.stepCount,
      criticalSteps: this.plan.getCriticalSteps().length
    });
  }

  /**
   * 🎯 FASE 2.8: Bootstrap com Execution Compilation Layer
   * BootOrchestrator é BLIND EXECUTOR — apenas segue o ExecutionPlan
   * ZERO lógica condicional — execução determinística
   * 
   * @param {Object} uiAdapter - Adaptador opcional de UI
   * @returns {Promise<Object>} Contexto inicializado
   */
  async bootstrap(uiAdapter = null) {
    // 🎯 FASE 4: RESET DO REGISTRY - Evitar lixo entre boots
    if (window.LifecycleRegistry) {
      window.LifecycleRegistry.reset();
      console.log('[BootOrchestrator] LifecycleRegistry reset executed');
    }
    
    if (uiAdapter) {
      this.uiAdapter = uiAdapter;
    }

    // 🎯 FASE 3.0 INSTRUMENTAÇÃO: Log de início de boot
    console.log('[BOOT TRACE] Boot iniciado', {
      hasLedger: !!window.__EVENT_LEDGER__,
      hasSupabase: !!window.supabaseClient,
      hasEAL: !!window.__EAL__
    });
    console.log('[BOOT] BootOrchestrator FASE 2.8 - Blind Executor (Execution Compilation Layer)');
    console.log('[BOOT] Executing plan:', this.plan.bootId);

    // ============ BLIND EXECUTION PIPELINE ============
    // 🎯 FASE 2.8: Zero decisão — apenas execução sequencial do plano
    
    // 1. VALIDATE PLAN INTEGRITY
    this._validatePlan();
    
    // 2. EXECUTE PLAN SEQUENTIALLY (blind execution)
    for (const step of this.plan.steps) {
      // Verificar se dependências foram executadas (dado do plano, não decisão)
      const depsMet = step.dependencies.every(d => this._executed.has(d));
      if (!depsMet) {
        throw new Error(`[BOOT] Dependencies not met for step ${step.id} — plan invalid`);
      }
      
      // Executar passo (sem decisão — apenas execução)
      await this._executeStep(step);
    }
    
    // 3. COMPLETION
    console.log('[BOOT] ExecutionPlan complete — all steps executed');
    
    // 4. START HEALTH MONITORING
    this.health.start();
    console.log('[BOOT] RuntimeHealth monitoring started (diff checker)');
    
    // 5. BOOT COMPLETE LOG
    // 🎯 FASE 3.0 INSTRUMENTAÇÃO: Log de boot finalizado
    console.log('[BOOT TRACE] Boot finalizado', {
      sessionBusActive: this._context?.sessionBus?.__lifecycle?.active,
      authFSMActive: this._context?.authFSM?.__lifecycle?.active
    });
    console.log('[BOOT] FASE 2.8 Execution Compilation Complete:', {
      bootId: this.CURRENT_BOOT_ID,
      planChecksum: this.plan.checksum,
      stepCount: this.plan.stepCount,
      executedCount: this._executed.size,
      failedCount: this._failed.size,
      timestamp: Date.now()
    });

    return this.getContext();
  }

  /**
   * 🎯 FASE 2.8: Executar passo do plano (blind execution)
   * Sem decisão — apenas execução determinística
   * @private
   */
  async _executeStep(step) {
    console.log(`[BOOT] Executing step: ${step.describe()}`);
    
    try {
      switch (step.action) {
        case 'validate_environment':
          await this._execValidateEnvironment(step);
          break;
          
        case 'eal_lock':
          await this._execEalLock(step);
          break;
          
        case 'instantiate':
        case 'instantiate_and_activate':
          await this._execInstantiateAndActivate(step);
          break;
          
        case 'instantiate_services':
          await this._execInstantiateServices(step);
          break;
          
        case 'eal_unlock':
          await this._execEalUnlock(step);
          break;
          
        case 'start_health_monitoring':
          // Health já é iniciado no final do bootstrap
          this._executed.add(step.id);
          break;
          
        default:
          console.warn(`[BOOT] Unknown action: ${step.action} — skipping`);
      }
    } catch (error) {
      console.error(`[BOOT] Step ${step.id} failed:`, error);
      this._failed.add(step.id);
      
      if (step.critical) {
        throw new Error(`[BOOT] Critical step ${step.id} failed: ${error.message}`);
      } else if (step.fallback) {
        console.log(`[BOOT] Executing fallback for ${step.id}`);
        const fallbackResult = step.fallback();
        this._context[step.id] = fallbackResult;
      }
    }
  }

  /**
   * Executar: validate_environment
   */
  async _execValidateEnvironment(step) {
    const checks = [
      { name: 'eal', check: () => !!window.__EAL__ },
      { name: 'firewall', check: () => !!window.ExecutionFirewall }
    ];
    
    for (const check of checks) {
      if (!check.check()) {
        throw new Error(`Environment check failed: ${check.name}`);
      }
    }
    
    this._executed.add(step.id);
  }

  /**
   * Executar: eal_lock
   */
  async _execEalLock(step) {
    window.__EAL__.lock();
    console.log('[BOOT] EAL LOCKED');
    this._executed.add(step.id);
  }

  /**
   * Executar: instantiate_and_activate
   */
  async _execInstantiateAndActivate(step) {
    const classRef = step.metadata?.classRef ? window[step.metadata.classRef] : null;
    
    if (!classRef) {
      throw new Error(`Class not found for step ${step.id}`);
    }
    
    // 🎯 FASE 5: PROTEÇÃO CONTRA DUPLA INSTÂNCIA
    if (this._context[step.id]) {
      console.warn(`[BOOT] ${step.id} already instantiated, skipping`);
      return this._context[step.id];
    }
    
    // Instanciar
    let instance;
    const deps = step.dependencies.map(d => this._context[d]).filter(Boolean);
    
    if (this.factory) {
      instance = this.factory.create(classRef, step.id, deps);
    } else {
      instance = new classRef(...deps);
    }
    
    // Armazenar no contexto
    this._context[step.id] = instance;
    
    // Registrar no registry
    if (this.registry) {
      this.registry.register(step.id, instance);
    }
    
    // 🎯 FASE 3.0 INSTRUMENTAÇÃO: Log pré-ativação
    console.log('[BOOT TRACE] Pré-ativação', {
      stepId: step.id,
      className: step.metadata?.classRef,
      hasInstance: !!instance,
      canActivate: !!instance.activateLifecycle,
      ledger: !!window.__EVENT_LEDGER__
    });
    
    // Ativar via Firewall
    if (instance.activateLifecycle) {
      window.__EAL__.gate(() => {
        this.firewall.execute(step.id, 'activate', {}, { token: this.token });
      });
    }
    
    this._executed.add(step.id);
  }

  /**
   * Executar: instantiate_services
   */
  async _execInstantiateServices(step) {
    const core = this._context.dataCore;
    
    if (!core) {
      throw new Error('DataCore not available for services initialization');
    }
    
    // Criar serviços
    const services = {
      clientes: new this.deps.ClienteService(core),
      servicos: new this.deps.ServicoService(core),
      profissionais: new this.deps.ProfissionalService(core),
      bloqueios: new this.deps.BloqueioService(core),
      agendamentos: new this.deps.AgendamentoService(core)
    };
    
    // Congelar e expor
    this._context.services = Object.freeze(services);
    
    Object.defineProperty(window, 'services', {
      value: this._context.services,
      writable: false,
      configurable: false
    });
    
    this._executed.add(step.id);
  }

  /**
   * Executar: eal_unlock
   */
  async _execEalUnlock(step) {
    window.__EAL__.unlock();
    console.log('[BOOT] EAL UNLOCKED');
    this._executed.add(step.id);
  }

  /**
   * Inicialização de serviços (chamada dentro de EAL lock)
   * @private
   */
  async _initServices() {
    // Criar DataCore
    this.context.core = new this.deps.DataCore(this.deps.supabaseClient);
    console.log('[BOOT PHASE] DataCore created');

    // Proteção: Impedir reinicialização de services
    if (window.services) {
      throw new Error('[BOOTSTRAP FATAL] Services already initialized');
    }

    // Criar todos os serviços
    const services = {
      clientes: new this.deps.ClienteService(this.context.core),
      servicos: new this.deps.ServicoService(this.context.core),
      profissionais: new this.deps.ProfissionalService(this.context.core),
      bloqueios: new this.deps.BloqueioService(this.context.core),
      agendamentos: new this.deps.AgendamentoService(this.context.core),
    };

    // Congelar services
    this.context.services = Object.freeze(services);

    // Expor globalmente (protegido)
    Object.defineProperty(window, 'services', {
      value: this.context.services,
      writable: false,
      configurable: false,
      enumerable: true
    });

    console.log('[BOOT] Services initialized');
  }

  /**
   * Retorna contexto acumulado durante boot
   * @returns {Object}
   */
  getContext() {
    return Object.freeze({
      // Core
      sessionBus: this.context.sessionBus,
      authFSM: this.context.authFSM,
      core: this.context.core,
      services: this.context.services,
      
      // UI Managers
      // 🎯 SidebarManager removido - funcionalidade migrada para SidebarComponent
      modalManager: this.context.modalManager,
      pageManager: this.context.pageManager,
      
      // 🎯 FASE 2.6 CLOSURE: Execution Infrastructure (4 blocos)
      firewall: this.firewall,      // 1. Enforcement real
      registry: this.registry,     // 2. Observability
      factory: this.factory,       // 3. Conveniência (NÃO enforcement)
      execute: (manager, operation, payload) => {
        // ÚNICO enforcement real — via Firewall
        return this.firewall.execute(manager, operation, payload, { token: this.token });
      },
      create: (Class, name, args) => {
        // Factory convenience — NÃO enforcement
        return this.factory 
          ? this.factory.create(Class, name, args)
          : new Class(...args);
      },
      
      // Status queries
      isReady: () => window.__EAL__?.canExecute() || false,
      getAuthState: () => this.context.authFSM?.getState?.() || null,
      getLifecycleStatus: () => this.registry?.getStatus?.() || {}
    });
  }
}

// ================================
// GLOBAL BOOT FUNCTION
// ================================

/**
 * Função global de bootstrap usando BootOrchestrator FASE 2
 * @param {Object} uiAdapter - Adaptador opcional de UI
 * @param {Object} options - Opções de bootstrap
 * @returns {Promise<Object>} Contexto inicializado
 */
window.bootstrapAppSequential = async function(uiAdapter = null, options = {}) {
  console.log('[BOOT] bootstrapAppSequential FASE 2 called');

  // LOCK GLOBAL: Previne execução duplicada
  if (window.__APP_BOOTSTRAPPED__) {
    console.warn('[BOOT] Duplicate bootstrap prevented - already bootstrapped');
    return window.__APP_CONTEXT__;
  }

  // IDEMPOTÊNCIA: Retorna promise compartilhada se bootstrap está em andamento
  if (window.__APP_BOOTSTRAPPING__) {
    console.warn('[BOOT] Bootstrap in progress - returning shared promise');
    return window.__BOOT_PROMISE__;
  }

  // MARCAR INÍCIO DO BOOTSTRAP
  window.__APP_BOOTSTRAPPING__ = true;

  // PROMISE COMPARTILHADA
  window.__BOOT_PROMISE__ = (async () => {
    try {
      const orchestrator = new window.BootOrchestrator(options);
      const context = await orchestrator.bootstrap(uiAdapter);

      // MARCAR BOOTSTRAP COMPLETO
      window.__APP_BOOTSTRAPPED__ = true;
      window.__APP_CONTEXT__ = context;
      window.__BOOT_ORCHESTRATOR__ = orchestrator;

      // Limpar flag de bootstrapping
      window.__APP_BOOTSTRAPPING__ = false;

      console.log('[BOOT CHECK] FASE 2 complete:', {
        supabaseClient: !!window.supabaseClient,
        authFSM: !!window.authFSM,
        services: !!window.services,
        ealState: window.__EAL__?.getState?.()
      });

      return context;
    } catch (error) {
      // Em caso de erro, limpar locks para permitir retry
      window.__APP_BOOTSTRAPPING__ = false;
      window.__BOOT_PROMISE__ = null;
      throw error;
    }
  })();

  return window.__BOOT_PROMISE__;
};

console.log('[LOAD] boot-orchestrator FASE 2 loaded successfully');

// ================================
// 🎯 FASE 3.0: FUNÇÃO GLOBAL DE AUDITORIA
// ================================
window.__BOOT_AUDIT__ = function() {
  return {
    ledger: !!window.__EVENT_LEDGER__,
    supabase: !!window.supabaseClient,
    eal: !!window.__EAL__,
    sessionBus: {
      exists: !!window.__SESSION_BUS__,
      active: window.__SESSION_BUS__?.__lifecycle?.active
    },
    authFSM: {
      exists: !!window.__AUTH_FSM__,
      active: window.__AUTH_FSM__?.__lifecycle?.active
    },
    bootStatus: {
      bootstrapped: !!window.__APP_BOOTSTRAPPED__,
      bootstrapping: !!window.__APP_BOOTSTRAPPING__,
      ealState: window.__EAL__?.getState?.() || 'unknown'
    }
  };
};

// Fechar IIFE
})();
