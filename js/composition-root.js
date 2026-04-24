// ================================
// COMPOSITION ROOT - Bootstrap Orchestrator
// ================================
// Ordem crítica de boot: SessionBus → AuthFSM → bootAutoHeal → UI
// ✅ ETAPA 2.7: Auto-heal é o único entrypoint de restore (determinístico)
// Previne race conditions no startup multi-tab
//
// DEPENDÊNCIAS (devem ser carregadas antes via script tags):
// - supabaseClient.js → window.supabaseClient
// - session-bus.js → window.SessionBus
// - effect-runner.js → window.EffectRunner
// - auth-fsm.js → window.AuthFSM, window.AuthState, window.AuthEvent
// - DataCore.js → window.DataCore
// - BaseService.js → window.BaseService
// - services/* → window.*Service

// ================================
// DEPENDÊNCIA: js/core/boot-trace-context.js deve ser carregado ANTES
// Provê: window.trace, window.__BOOT_TRACE_ID__, window.__BOOT_TRACE_BUFFER__, window.__BOOT_TRACE_PHASE__
// ================================

// ================================
// DEPENDÊNCIA: js/core/boot-kernel.js deve ser carregado ANTES
// Provê: window.__BOOT_KERNEL__, window.__BOOT_ID__
// ================================

// ================================
// UI STATE CONTRACT HARDENING
// Evento único de READY para eliminar race conditions
// ================================
if (window.trace) {
  window.trace("BOOT_READY_PROMISE_CREATED");
}

// === PATCH 5: GARANTIA DE RESOLUÇÃO ÚNICA DO BOOT PROMISE ===
window.__BOOT_READY__ = new Promise((resolve) => {
  window.__resolveBootReady = (value) => {
    // Proteção contra double resolve
    if (!window.__BOOT_READY__._resolved) {
      window.__BOOT_READY__._resolved = true;
      window.causalTrace?.("BOOT_READY_RESOLVE_FROM_KERNEL", {
        hasValue: !!value
      });
      resolve(value);
    } else {
      console.warn('[BOOT] Ignorando tentativa de double resolve');
    }
  };
  if (window.trace) {
    window.trace("BOOT_RESOLVER_STORED");
  }
});

// Inicializar flag de resolução
window.__BOOT_READY__._resolved = false;

// ================================
// REDIRECT GUARD (UI Layer apenas)
// Garante unicidade de redirect
// ================================
window.__REDIRECT_GUARD__ = {
  executed: false,
  run(fn) {
    if (this.executed) return;
    this.executed = true;
    fn();
  }
};

// ================================
// SAFE FALLBACK FSM
// FSM mínima para modo degradado quando boot falha
// ================================
window.__SAFE_AUTH_FALLBACK__ = {
  state: 'UNAUTHENTICATED',
  session: null,
  error: null,
  __lifecycle: {
    isFallback: true,
    createdAt: Date.now()
  },

  // Interface compatível com AuthFSM
  getState() {
    return { state: this.state, session: null, error: null };
  },

  isAuthenticated() {
    return false;
  },

  async restoreSession() {
    console.warn('[SAFE FALLBACK] restoreSession called - no-op');
    return { success: false, reason: 'FALLBACK_MODE' };
  },

  async waitForStableAuth() {
    return { state: 'UNAUTHENTICATED' };
  },

  subscribe(listener) {
    // No-op: fallback não emite eventos
    return () => {};
  },

  dispatch() {
    console.warn('[SAFE FALLBACK] dispatch blocked - no transitions allowed');
    return { success: false, reason: 'FALLBACK_IMMUTABLE' };
  }
};

// ================================
// IIFE - ISOLAMENTO DE ESCOPO
// ================================
(function() {

// CORREÇÃO ARQUITETURAL: Execução única é garantida por __BOOT_KERNEL__
// Não precisamos de guard aqui - o kernel cuida disso
function validate() {
  const missing = [];
  if (!window.supabaseClient) missing.push('supabaseClient');
  if (!window.EffectRunner) missing.push('EffectRunner');
  if (!window.AuthFSM) missing.push('AuthFSM');
  if (!window.DataCore) missing.push('DataCore');
  if (!window.BaseService) missing.push('BaseService');
  // CORREÇÃO: BootKernel e Hydrator são obrigatórios
  if (!window.__BOOT_KERNEL__) missing.push('__BOOT_KERNEL__');
  if (!window.__STATE_HYDRATOR__) missing.push('__STATE_HYDRATOR__');

  if (missing.length > 0) {
    console.error('[COMPOSITION ROOT] Missing dependencies:', missing);
    return false;
  }
  return true;
}

const depsValid = validate();

const supabaseClient = window.supabaseClient;
const SessionBus = window.SessionBus;
const EffectRunner = window.EffectRunner;
const AuthFSM = window.AuthFSM;
const AuthState = window.AuthState;
const AuthEvent = window.AuthEvent;
const DataCore = window.DataCore;
const ClienteService = window.ClienteService;
const ServicoService = window.ServicoService;
const ProfissionalService = window.ProfissionalService;
const BloqueioService = window.BloqueioService;
const AgendamentoService = window.AgendamentoService;

// ================================
// COMPOSITION ROOT CLASS
// ================================

window.CompositionRoot = class CompositionRoot {
  constructor() {
    this.sessionBus = null;
    this.authFSM = null;
    this.effectRunner = null;
    this.core = null;
    this.services = null;
    this.booted = false;
    this.uiAdapter = null;
  }

  // =====================
  // BOOTSTRAP ORQUESTRADO (FLUXO ORIGINAL - SEM BootSequencer)
  // =====================
  async bootstrap(uiAdapter = null) {
    if (this.booted) {
      console.warn('[CompositionRoot] Already booted');
      return this.getContext();
    }

    // CORREÇÃO ARQUITETURAL: BootRunner usa KERNEL apenas para controle
    // Kernel = lock/state | Runner = execução
    const CURRENT_BOOT_ID = window.__BOOT_ID__;

    // TRACE: Início do bootstrap
    window.__BOOT_TRACE__?.log('BOOT_START', {
      bootId: CURRENT_BOOT_ID,
      timestamp: Date.now(),
      kernelState: window.__BOOT_KERNEL__?.getState?.()
    });

    console.log('[BOOT]', 'bootstrap_start', CURRENT_BOOT_ID, Date.now());

    // SAFE EXECUTION com fallback
    try {
      return await this._executeBootstrap(uiAdapter, CURRENT_BOOT_ID);
    } catch (error) {
      console.error('[BOOT] Bootstrap failed:', error);

      // Retry limitado (1 tentativa) - Runner gerencia
      if (window.__BOOT_KERNEL__.attempts?.length <= 1) {
        console.log('[BOOT] Attempting retry...');
        await new Promise(r => setTimeout(r, 500));
        return this._executeBootstrap(uiAdapter, CURRENT_BOOT_ID);
      }

      // Fallback para modo degradado
      console.warn('[BOOT] Max retries reached - entering degraded mode');
      return this._createDegradedContext();
    }
  }

  // Método privado para execução segura
  // ✅ DETERMINÍSTICO: Nova ordem de boot - snapshot síncrono first-class
  async _executeBootstrap(uiAdapter, CURRENT_BOOT_ID) {
    // 1. SessionBus primeiro (infraestrutura de comunicação)
    this.sessionBus = new SessionBus(null);
    console.log('[CompositionRoot] SessionBus ready');

    // 2. EffectRunner (única camada que fala com Supabase)
    this.effectRunner = new EffectRunner();
    this.effectRunner.setSessionBus(this.sessionBus);
    console.log('[CompositionRoot] EffectRunner ready');

    // 3. AuthFSM (única instância - ÚNICO DONO DO LOCK - AJUSTE 1)
    // VALIDAÇÃO RÍGIDA: lifecycle marker obrigatório + bootId match
    const existingFSM = window.authFSM;
    const isValidExisting = (
      existingFSM &&
      existingFSM instanceof AuthFSM &&
      existingFSM.__lifecycle?.initialized === true &&
      existingFSM.__lifecycle?.bootId === CURRENT_BOOT_ID
    );

    if (isValidExisting) {
      console.log('[FSM] Reutilizando instância válida do boot atual:', existingFSM.__lifecycle.instanceId);
      this.authFSM = existingFSM;
    } else {
      // INVALIDAÇÃO: instância antiga (boot anterior) ou inválida
      if (existingFSM) {
        console.warn('[FSM] Descartando instância inválida/antiga:', {
          hasLifecycle: !!existingFSM.__lifecycle,
          initialized: existingFSM.__lifecycle?.initialized,
          existingBootId: existingFSM.__lifecycle?.bootId,
          currentBootId: CURRENT_BOOT_ID,
          reason: existingFSM.__lifecycle?.bootId !== CURRENT_BOOT_ID ? 'BOOT_ID_MISMATCH' : 'INVALID_STATE'
        });
      }

      console.log('[FSM] Criando nova instância com bootId:', CURRENT_BOOT_ID);
      this.authFSM = new AuthFSM(this.sessionBus, supabaseClient);
      
      // TRACE: FSM criada
      window.__BOOT_TRACE__?.log('FSM_CREATE', {
        bootId: CURRENT_BOOT_ID,
        instanceId: this.authFSM?.__lifecycle?.instanceId || 'unknown'
      });

      // AJUSTE 1: ÚNICO DONO DO LOCK - Object.defineProperty com writable: false
      // CRÍTICO: Verificar se já existe e é locked antes de tentar redefinir
      try {
        const existingDesc = Object.getOwnPropertyDescriptor(window, 'authFSM');
        
        if (existingDesc && !existingDesc.configurable) {
          // Já existe e não é configurável - reutilizar se for a mesma instância
          if (window.authFSM === this.authFSM) {
            console.log('[FSM] window.authFSM já locked e é mesma instância - reutilizando');
          } else {
            console.warn('[FSM] window.authFSM locked com instância diferente - modo degradado');
            window.__BOOT_KERNEL__?.setDegraded('FSM_LOCK_CONFLICT');
            return this._createDegradedContext();
          }
        } else {
          // Definir nova propriedade ou redefinir se configurável
          Object.defineProperty(window, 'authFSM', {
            value: this.authFSM,
            writable: false,
            configurable: false,
            enumerable: true
          });
          window.__AUTH_FSM_LOCKED__ = true;
          console.log('[FSM] window.authFSM locked (immutable) - CompositionRoot is SINGLE OWNER');
        }
      } catch (e) {
        // SAFE FAILURE: não throw, usa fallback
        console.error('[FSM] Failed to lock window.authFSM:', e);
        window.__BOOT_KERNEL__?.setDegraded('FSM_LOCK_FAILED');
        return this._createDegradedContext();
      }
    }

    // Conectar dependências (para cross-tab sync, não para boot state)
    this.authFSM.connectSessionBus(this.sessionBus);
    this.authFSM.setEffectRunner(this.effectRunner);
    console.log('[CompositionRoot] AuthFSM conectada');

    // ✅ DETERMINÍSTICO: ORDEM DE BOOT CRÍTICA
    // 1. Obter snapshot do Supabase (síncrono do ponto de vista do boot)
    const initialSession = this.sessionBus.getCurrentSession();
    console.log('[BOOT] Snapshot obtido:', { hasSession: !!initialSession });

    // 2. Aplicar snapshot ao FSM (DECISÃO FINAL DE ESTADO - não depende de evento)
    // 🎯 FASE 1: applySnapshot é síncrono - sempre inicia em AUTHENTICATED se houver sessão
    const snapshotResult = this.authFSM.applySnapshot(initialSession);
    console.log('[BOOT] Snapshot aplicado:', snapshotResult);

    // 🎯 DETECÇÃO CORRETA (Supabase v2 safe chain)
    try {
      const state = this.authFSM.getState();
      const userId = state?.userId;

      if (!userId) {
        console.log('[BOOT] userId ausente — pulando verificação de first login (UNAUTHENTICATED)');
      } else {
        const client = window.supabaseClient;

        if (!client || typeof client.from !== 'function') {
          console.error('[BOOT] supabaseClient inválido ou não inicializado');
        } else {
          const query = client
            .from('profiles')
            .select('first_login_completed')
            .eq('id', userId)
            .maybeSingle();

          const { data, error } = await query;

          if (error) {
            console.error('[BOOT] Erro ao carregar profile:', error.message);
          } else if (!data) {
            console.warn('[BOOT] Profile não encontrado para userId:', userId);
          } else {
            console.log('[BOOT] first_login_completed:', data.first_login_completed);

            if (data.first_login_completed === false) {
              console.log('[BOOT] Disparando FIRST_LOGIN_DETECTED');
              this.authFSM.dispatch('FIRST_LOGIN_DETECTED');
            }
          }
        }
      }

    } catch (err) {
      console.error('[BOOT] Falha crítica ao verificar first login:', err);
    }

    // 3. Reconcile imediato (após FSM estar conectado, mas estado já decidido)
    await this.sessionBus.reconcileImmediate();
    console.log('[BOOT] SessionBus reconcile completo');

    // 4. Auto-heal só pode atuar após hydration completo
    // Não é mais gate de boot - só verificação pós-hydration
    const healResult = await this.authFSM.runAutoHeal({ trigger: 'composition_root', postHydration: true });
    console.log('[CompositionRoot] Auto-heal pós-hydration:', healResult);

    // 6. Verificar estado estável (FSM já deve estar _hydrated)
    // ✅ DETERMINÍSTICO: Não aguarda - estado já foi decidido pelo snapshot
    const bootState = this.authFSM.getState?.();
    console.log('[CompositionRoot] AuthFSM estado final (pós-snapshot):', bootState);
    
    if (!this.authFSM._hydrated) {
      console.error('[BOOT CRÍTICO] FSM não está hydrated após snapshot - estado inconsistente');
    }

    // 7. UI mount
    if (uiAdapter) {
      this.uiAdapter = uiAdapter;
      this.mountUI();
    }

    // 8. Setup listener
    this.setupStateListener();

    // 8.5. Navigation Effect Runner (FSM-driven navigation)
    // Navegação 100% baseada em eventos do AuthFSM - sem polling, sem DOM dependency
    if (window.NavigationEffectRunner) {
      this.navigationRunner = new NavigationEffectRunner(this.authFSM);
      this.navigationRunner.init();
      // Expor globalmente para debug
      window.__NAVIGATION_RUNNER__ = this.navigationRunner;
      console.log('[CompositionRoot] NavigationEffectRunner inicializado');
    }

    // 9. DataCore
    this.core = new DataCore(supabaseClient);
    console.log('[CompositionRoot] DataCore ready');

    // 10. Services (com proteção contra duplicação)
    if (window.services) {
      throw new Error('[BOOTSTRAP FATAL] Services já inicializados');
    }

    const services = {
      clientes: new ClienteService(this.core),
      servicos: new ServicoService(this.core),
      profissionais: new ProfissionalService(this.core),
      empresas: new EmpresaService(this.core),
      bloqueios: new BloqueioService(this.core),
      agendamentos: new AgendamentoService(this.core),
    };

    this.services = Object.freeze(services);
    Object.defineProperty(window, 'services', {
      value: this.services,
      writable: false,
      configurable: false,
      enumerable: true
    });

    console.log('[CompositionRoot] Services ready');

    // 🎯 FASE DEFINITIVA: SidebarManager REMOVIDO
    // Funcionalidade migrada para SidebarComponent (FSM-driven)
    // SidebarComponent é instanciado pelo ViewManager quando necessário

    // 11. AuthAuthorization (camada de autorização alinhada com RLS)
    if (window.AuthAuthorization && window.createAuthAuthorization) {
      this.authAuthorization = window.createAuthAuthorization();
      if (this.authAuthorization) {
        Object.defineProperty(window, 'authAuthorization', {
          value: this.authAuthorization,
          writable: false,
          configurable: false,
          enumerable: true
        });
        console.log('[CompositionRoot] AuthAuthorization ready');
      }
    } else {
      console.warn('[CompositionRoot] AuthAuthorization não disponível');
    }

    this.booted = true;
    
    // TRACE: Bootstrap completado
    window.__BOOT_TRACE__?.log('BOOT_COMPLETE', {
      bootId: CURRENT_BOOT_ID,
      success: true,
      timestamp: Date.now(),
      hasAuthFSM: !!this.authFSM,
      hasServices: !!this.services
    });
    
    console.log('[BOOT]', 'bootstrap_complete', Date.now());

    // CORREÇÃO: Kernel já marca boot como READY internamente

    // CORREÇÃO ARQUITETURAL: STATE HYDRATION - Unificação de estado
    const finalState = window.__STATE_HYDRATOR__.hydrate({
      fsm: this.authFSM,
      sessionBus: this.sessionBus,
      core: this.core,
      services: this.services
    });

    console.log('[BOOT] State hydrated:', {
      authStatus: finalState.auth.status,
      isAuthenticated: finalState.auth.isAuthenticated,
      consistency: finalState.consistency.valid ? 'VALID' : 'INVALID'
    });

    // CHECKPOINT
    console.log('[BOOT CHECK]', {
      supabaseClient: !!window.supabaseClient,
      authFSM: !!window.authFSM,
      authState: window.authFSM?.getState?.()?.state,
      services: !!window.services,
      servicesFrozen: Object.isFrozen(window.services),
      bootId: CURRENT_BOOT_ID,
      authFSMLocked: window.__AUTH_FSM_LOCKED__,
      stateHydrated: !!window.__APP_STATE__
    });

    // 🔬 INSTRUMENTAÇÃO DE DIAGNÓSTICO - KERNEL GLOBAL WIRING CHECK
    const kernel = window.__BOOT_KERNEL__;
    const localKernelRef = kernel;

    // 🔴 GARANTIA DE ALIASES - Re-sincronizar todos os ponteiros
    if (kernel) {
      window.__BOOT_KERNEL__ = kernel;
      window.__KERNEL__ = kernel;
      window.kernel = kernel;
      window.__BOOT_KERNEL_SINGLETON__ = kernel;
      window.__BOOT_KERNEL_SINGLETON = kernel;
    }

    console.log("[KERNEL GLOBAL WIRING CHECK]", {
      beforeExpose: {
        kernelExists: typeof kernel !== "undefined",
        kernelType: typeof kernel,
        windowKernelBefore: window.kernel,
        windowBootKernelBefore: window.__BOOT_KERNEL__,
        sameRefs: {
          localEqualsBootKernel: localKernelRef === window.__BOOT_KERNEL__,
          kernelEqualsBootKernel: kernel === window.__BOOT_KERNEL__
        }
      },
      // Verificar todos os aliases
      aliases: {
        __BOOT_KERNEL__: !!window.__BOOT_KERNEL__,
        __KERNEL__: !!window.__KERNEL__,
        kernel: !!window.kernel,
        __BOOT_KERNEL_SINGLETON__: !!window.__BOOT_KERNEL_SINGLETON__,
        __BOOT_KERNEL_SINGLETON: !!window.__BOOT_KERNEL_SINGLETON
      }
    });

    console.log("[KERNEL ALIASES EXPOSED]", {
      windowKernelAfter: window.kernel,
      windowBootKernelAfter: window.__BOOT_KERNEL__,
      windowKERNELAfter: window.__KERNEL__,
      sameRefAfter: window.kernel === window.__BOOT_KERNEL__,
      sameAsLocal: window.kernel === localKernelRef,
      allRefsMatch: (
        window.__BOOT_KERNEL__ === window.__KERNEL__ &&
        window.__KERNEL__ === window.kernel
      )
    });

    return this.getContext();
  }

  // =====================
  // UI MOUNT (após auth estável)
  // =====================
  mountUI() {
    if (!this.uiAdapter) {
      console.warn('[CompositionRoot] Cannot mount UI - no adapter');
      return;
    }

    const state = this.authFSM.getState();
    this.uiAdapter.mount({
      authState: state.state,
      session: state.session,
      isAuthenticated: state.isAuthenticated
    });

    console.log('[CompositionRoot] UI mounted');
  }

  // =====================
  // STATE LISTENER (para UI updates)
  // =====================
  setupStateListener() {
    // Configurar listener para estado de autenticação
    const unsubAuth = this.authFSM.subscribe?.((state) => {
      console.log('[Auth State]', state.state);
      
      // TRACE: Mudança de estado de auth
      window.__BOOT_TRACE__?.log('AUTH_STATE_CHANGE', {
        state: state.state,
        isAuthenticated: state.isAuthenticated,
        timestamp: Date.now()
      });

      if (this.uiAdapter && this.uiAdapter.updateAuth) {
        this.uiAdapter.updateAuth(state);
      }
    });
  }

  // =====================
  // CONTEXT ACCESS (PROMPT 5: Estado Global Final)
  // =====================
  getContext() {
    const bootId = window.__BOOT_ID__;
    
    // PROMPT 5: Contexto deve ser frozen e conter todos os elementos
    // ⚠️  AuthStore removido (CICLO 1.2.2) — FSM é única fonte de verdade
    return Object.freeze({
      bootId,
      authFSM: this.authFSM,
      // authStore: REMOVED — usar authFSM.getState() diretamente
      sessionBus: this.sessionBus,
      core: this.core,
      services: this.services,
      // 🎯 SidebarManager removido - funcionalidade migrada para SidebarComponent
      state: window.__APP_STATE__, // Referência ao estado hydratado (frozen)
      isReady: () => this.booted,
      getAuthState: () => this.authFSM?.getState()
    });
  }

  // =====================
  // SAFE FALLBACK CONTEXT (AJUSTE 3)
  // =====================
  _createDegradedContext() {
    console.warn('[BOOT] Creating degraded context with safe fallback');

    const fallbackFSM = window.__SAFE_AUTH_FALLBACK__;

    // Tornar o fallback acessível globalmente (mas não lockar - já está em degraded)
    if (!window.authFSM) {
      window.authFSM = fallbackFSM;
    }

    window.__BOOT_KERNEL__?.setDegraded?.('BOOT_FAILED_OR_BLOCKED');

    return Object.freeze({
      sessionBus: null,
      authFSM: fallbackFSM,
      core: null,
      services: null,
      isReady: () => false,
      getAuthState: () => ({ state: 'UNAUTHENTICATED', session: null, error: 'DEGRADED_MODE' }),
      __degraded: true,
      __reason: 'BOOT_FAILED_OR_BLOCKED'
    });
  }
}

// ================================
// BOOTSTRAP FUNCTION (convenience)
// ================================

// ================================
// BOOT RUNNER (Execution Plane)
// Responsabilidade: execução do bootstrap, FSM creation, hydration
// Usa KERNEL para controle de concorrência
// ================================

window.bootstrapApp = async function(uiAdapter = null) {
  // === CAUSAL TRACE v3 - BOOT ENTRY ===
  const bootStart = window.causalTrace?.("BOOTSTRAP_APP_ENTER", {
    timestamp: Date.now()
  });

  const kernel = window.__BOOT_KERNEL__;
  const bootId = window.__BOOT_ID__;

  // 🔬 INSTRUMENTAÇÃO DE DIAGNÓSTICO - KERNEL CONSUMPTION CHECK (ENTRY)
  console.log("[KERNEL CONSUMPTION CHECK - ENTRY]", {
    windowKernel: window.kernel,
    windowBootKernel: window.__BOOT_KERNEL__,
    localKernel: typeof kernel !== "undefined" ? kernel : null,
    refsMatch: window.kernel === window.__BOOT_KERNEL__,
    stack: new Error().stack
  });

  // === PATCH 1: GARANTIA DE CONTEXTO FIXO DO KERNEL ===
  if (kernel) {
    kernel.release = kernel.release.bind(kernel);
    kernel.registerReadyCallback = kernel.registerReadyCallback.bind(kernel);
    console.log('[BOOT_RUNNER] Kernel methods bound to correct context');
  }

  console.log('[BOOT_RUNNER] bootstrapApp called', {
    kernelState: kernel?.getState?.(),
    alreadyBootstrapped: window.__APP_BOOTSTRAPPED__,
    bootId
  });

  // GUARD: Kernel é obrigatório
  if (!kernel) {
    console.error('[BOOT_RUNNER] BootKernel not available');
    throw new Error('[BOOTSTRAP FATAL] BootKernel not initialized');
  }

  // CONTROLE: Adquirir lock via Kernel
  const acquireEvent = window.causalTrace?.("BOOT_ACQUIRE_ATTEMPT", {
    bootId,
    kernelState: kernel?.state,
    alreadyBootstrapped: window.__APP_BOOTSTRAPPED__
  }, bootStart);

  if (!kernel.acquire(bootId)) {
    console.warn('[BOOT_RUNNER] Kernel lock failed - boot already in progress or completed');

    window.causalTrace?.("BOOT_ACQUIRE_FAILED", {
      kernelState: kernel.state,
      locked: kernel.locked
    }, acquireEvent);

    // 🔴 FIX P0.5: NUNCA retornar contexto diretamente em early contention path
    // UI deve sempre receber contexto via kernel state contract

    return new Promise((resolve) => {
      // Tentar leitura direta imediata (kernel já READY)
      const ctx = kernel.getReadyContext();
      if (ctx) {
        if (window.trace) {
          window.trace("BOOT_EARLY_CONTENTION_RESOLVED", {
            source: 'getReadyContext',
            hasContext: true
          });
        }
        resolve(ctx);
        return;
      }

      // Aguardar callback determinístico quando kernel ficar READY
      if (window.trace) {
        window.trace("BOOT_EARLY_CONTENTION_WAITING", {
          kernelState: kernel.state,
          callbackRegistered: true
        });
      }

      kernel.registerReadyCallback((context) => {
        if (window.trace) {
          window.trace("BOOT_EARLY_CONTENTION_CALLBACK", {
            hasContext: !!context,
            kernelState: kernel.state
          });
        }
        resolve(context);
      });
    });
  }

  const successEvent = window.causalTrace?.("BOOT_ACQUIRE_SUCCESS", {
    bootId,
    kernelState: kernel.state
  }, acquireEvent);

  console.log('[BOOT_RUNNER] Lock acquired, executing bootstrap');

  // EXECUÇÃO: Bootstrap real
  try {
    const root = new CompositionRoot();
    const context = await root.bootstrap(uiAdapter);

    // 🔴 FIX FINAL: Congelar contexto ANTES de publicar
    const frozen = Object.freeze(context);

    // Marcar bootstrap completo globalmente
    window.__APP_BOOTSTRAPPED__ = true;
    window.__APP_CONTEXT__ = frozen;

    // TRACE: Contexto publicado
    window.__BOOT_TRACE__?.log('CONTEXT_PUBLISHED', {
      bootId: window.__BOOT_ID__,
      contextKeys: Object.keys(frozen)
    });

    // 🔴 FIX FINAL: Kernel marca que contexto foi escrito (propriedade única)
    kernel.markContextWritten();

    // TRACE v2: Antes de chamar release
    if (window.trace) {
      window.trace("BOOT_RELEASE_TRUE_CALL", {
        kernelState: kernel.state,
        hasContext: !!window.__APP_CONTEXT__
      });
    }

    // P0 CRITICAL: Ligar BOOT_READY ao KERNEL READY
    // Callback será executado quando kernel.release(true) for chamado
    const cbEvent = window.causalTrace?.("REGISTER_READY_CALLBACK", {}, successEvent);

    kernel.registerReadyCallback(() => {
      const cbExec = window.causalTrace?.("BOOT_READY_CALLBACK_EXECUTED", {
        kernelState: kernel.state,
        hasResolveFunction: !!window.__resolveBootReady
      }, cbEvent);

      if (window.__resolveBootReady) {
        // Usar a função protegida contra double resolve (PATCH 5)
        window.__resolveBootReady(frozen);
      } else {
        console.error('[BOOT] __resolveBootReady não disponível');
      }
    });

    // Sucesso: Liberar lock (isso vai executar os callbacks)
    if (window.trace) {
      window.trace("BOOT_KERNEL_RELEASE_INVOKED", {
        success: true
      });
    }
    
    kernel.release(true);

    // SNAPSHOT AUTOMÁTICO DE DEBUG
    window.__BOOT_DEBUG_SNAPSHOT__ = window.__BOOT_TRACE__?.snapshot();
    
    // EXPORT GLOBAL DE DIAGNÓSTICO
    window.__BOOT_DIAGNOSTICS__ = {
      trace: window.__BOOT_TRACE__?.export(),
      snapshot: window.__BOOT_DEBUG_SNAPSHOT__,
      anomaly: window.__BOOT_ANOMALY_DETECTOR__?.check(window.__BOOT_TRACE__)
    };

    console.log('[BOOT_RUNNER] Bootstrap completed successfully');
    console.log('[BOOT_DIAGNOSTICS] Available at window.__BOOT_DIAGNOSTICS__');

    return frozen;

  } catch (error) {
    // Falha: Liberar lock com erro
    if (window.trace) {
      window.trace("BOOTSTRAP_CATCH_ENTER", {
        error: error?.message,
        kernelState: kernel.state
      });
    }

    if (window.trace) {
      window.trace("BOOT_KERNEL_RELEASE_INVOKED", {
        success: false
      });
    }
    
    kernel.release(false);

    if (window.trace) {
      window.trace("BOOTSTRAP_CATCH_RELEASE_DONE", {
        kernelState: kernel.state
      });
    }

    console.error('[BOOT_RUNNER] Bootstrap failed:', error);
    throw error;
  }

  if (window.trace) {
    window.trace("BOOTSTRAP_APP_EXIT", {
      success: true
    });
  }
}

// Fechar IIFE
})();
