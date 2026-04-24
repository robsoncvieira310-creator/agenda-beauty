// ================================
// BOOT KERNEL - CONTROL PLANE (Puro)
// Responsabilidade: lock, state, serialização, concorrência
// NÃO executa bootstrap - apenas controla acesso
// ================================
(function () {
  if (window.__BOOT_KERNEL__) {
    console.log('[BOOT_KERNEL] Already initialized');
    return;
  }

  // TRACE HELPER (fallback se não definido)
  function trace(event, meta = {}) {
    const entry = {
      event,
      t: performance.now(),
      ...meta
    };
    if (window.__BOOT_TRACE__) {
      window.__BOOT_TRACE__.push(entry);
    }
    console.log("[BOOT_TRACE]", event, meta, performance.now());
  }

  // Boot ID Global
  const createBootId = () => `boot_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.__BOOT_ID__ = window.__BOOT_ID__ || createBootId();

  // ================================
  // KERNEL - Apenas controle
  // ================================
  const BootKernel = {
    // Estado central
    state: 'IDLE',        // IDLE | RUNNING | READY | FAILED | DEGRADED
    locked: false,        // Lock de execução
    currentBootId: null,  // Boot ID atual
    contextWritten: false, // 🔴 FIX FINAL: Apenas 1 boot pode escrever __APP_CONTEXT__
    
    // Metadados
    startedAt: null,
    completedAt: null,
    attempts: [],

    // P0 CRITICAL: Callbacks para notificação de READY
    onReadyCallbacks: [],

    // 🔴 STATE PERSISTENCE (CRÍTICO): READY como estado, não evento
    readyState: {
      isReady: false,
      context: null,
      timestamp: null
    },

    // ================================
    // API DE CONTROLE (Apenas Lock/State)
    // ================================

    /**
     * Registra callback para ser executado quando kernel estiver READY
     * P0 CRITICAL: STATE REPLAY - executa imediatamente se já READY
     * @param {Function} fn - Callback a executar
     */
    registerReadyCallback(fn) {
      // === PATCH: VALIDAÇÃO DE CONTEXTO ===
      if (!this || typeof this !== 'object') {
        console.error('[KERNEL][FATAL] registerReadyCallback called with invalid context');
        return;
      }

      // Garantir arrays inicializados
      this.onReadyCallbacks = this.onReadyCallbacks || [];
      this.readyState = this.readyState || { isReady: false, context: null, timestamp: null };

      // TRACE v2: Registro de callback
      if (window.trace) {
        window.trace("KERNEL_REGISTER_READY_CALLBACK", {
          currentState: this.state,
          isAlreadyReady: this.readyState?.isReady,
          queueLength: this.onReadyCallbacks?.length || 0
        });
      }

      // 🔴 STATE REPLAY (CRÍTICO): Se já está READY, executar COM CONTEXTO
      if (this.readyState?.isReady) {
        window.__BOOT_TRACE__?.log('KERNEL_READY_STATE_REPLAY', { 
          hasContext: !!this.readyState.context,
          timestamp: this.readyState.timestamp
        });
        
        if (window.trace) {
          window.trace("KERNEL_STATE_REPLAY_EXECUTING", {
            hasContext: !!this.readyState.context
          });
        }
        
        try {
          fn(this.readyState.context);
        } catch (err) {
          console.error('[BOOT_KERNEL] Error in ready callback:', err);
        }
        
        if (window.trace) {
          window.trace("KERNEL_STATE_REPLAY_DONE");
        }
        return;
      }

      // Caso contrário, agendar para quando ficar READY
      window.__BOOT_TRACE__?.log('KERNEL_READY_CALLBACK_REGISTERED', { 
        currentState: this.state,
        queueLength: (this.onReadyCallbacks?.length || 0) + 1
      });
      this.onReadyCallbacks.push(fn);
    },

    /**
     * API DE LEITURA DIRETA (UI SAFE CONTRACT)
     * Retorna contexto imediatamente se READY, ou null
     * @returns {object|null} Contexto pronto ou null
     */
    getReadyContext() {
      return this.readyState?.isReady ? this.readyState?.context : null;
    },

    /**
     * Adquire lock para execução
     * @param {string} bootId 
     * @returns {boolean} true se lock adquirido, false se já locked
     */
    acquire(bootId) {
      // === PATCH: VALIDAÇÃO DE CONTEXTO ===
      if (!this || typeof this !== 'object') {
        console.error('[KERNEL][FATAL] acquire called with invalid context');
        return false;
      }

      // Garantir estado inicializado
      this.onReadyCallbacks = this.onReadyCallbacks || [];

      // TRACE: Tentativa de acquire
      window.__BOOT_TRACE__?.log('KERNEL_ACQUIRE_ATTEMPT', { bootId, currentState: this.state });

      // Validar bootId
      if (bootId !== window.__BOOT_ID__) {
        console.error('[BOOT_KERNEL] BootId mismatch:', { provided: bootId, expected: window.__BOOT_ID__ });
        window.__BOOT_TRACE__?.log('KERNEL_ACQUIRE_FAIL', { reason: 'BOOT_ID_MISMATCH' });
        return false;
      }

      // Guard: Já completado
      if (this.state === 'READY') {
        console.log('[BOOT_KERNEL] Already ready');
        return false;
      }

      // Guard: Em execução
      if (this.locked || this.state === 'RUNNING') {
        console.warn('[BOOT_KERNEL] Already running');
        return false;
      }

      // 🔴 FIX FINAL: Guard - Contexto já foi escrito
      if (this.contextWritten) {
        console.warn('[BOOT_KERNEL] Context already written - boot not allowed');
        return false;
      }

      // Guard: Máximo de tentativas
      if (this.state === 'FAILED' && this.attempts.length >= 2) {
        console.error('[BOOT_KERNEL] Max retries exceeded');
        return false;
      }

      // Adquirir lock
      this.locked = true;
      this.state = 'RUNNING';
      this.currentBootId = bootId;
      this.startedAt = Date.now();

      console.log('[BOOT_KERNEL] Lock acquired:', { bootId, attempt: this.attempts.length + 1 });
      
      // TRACE: Lock adquirido
      window.__BOOT_TRACE__?.log('KERNEL_ACQUIRED', { bootId, attempt: this.attempts.length + 1 });
      
      return true;
    },

    /**
     * Libera lock após execução
     * @param {boolean} success - Se execução foi bem-sucedida
     */
    release(success = true) {
      // === PATCH 2: HARDENING INTERNO - VALIDAÇÃO DE CONTEXTO ===
      if (!this || typeof this !== 'object') {
        console.error('[KERNEL][FATAL] release called with invalid context');
        console.trace();
        return;
      }

      if (!this.state) {
        console.warn('[KERNEL][RECOVERY] state undefined, forcing RUNNING fallback');
        this.state = 'RUNNING';
      }

      // === CAUSAL TRACE v3 ===
      const releaseEvent = window.causalTrace
        ? window.causalTrace("KERNEL_RELEASE_ENTER", { success, stateBefore: this.state })
        : null;

      console.log("[BOOT_BREAKPOINT] release ENTER", {
        state: this.state,
        locked: this.locked,
        callbacks: this.onReadyCallbacks?.length
      });

      if (!this.locked) {
        console.warn('[BOOT_KERNEL] Release called without lock');
        window.causalTrace?.("KERNEL_RELEASE_INVALID", { reason: 'NO_LOCK' }, releaseEvent);
        return;
      }

      this.completedAt = Date.now();
      const duration = this.completedAt - this.startedAt;

      // P0 FIX: Transição atômica para READY
      if (success) {
        // PHASE: STATE_TRANSITION
        window.__BOOT_TRACE_PHASE__ = "STATE_TRANSITION";

        // === PATCH 3: GARANTIA DE TRANSIÇÃO ATÔMICA ===
        // Ordem exata: readyState inicializado → context atribuído → isReady = true → state = READY
        // 🔴 FIX RACE: Contexto DEVE estar disponível ANTES de state = 'READY'
        // Guard polling checa kernel.state primeiro - se READY, deve ter context
        this.readyState = this.readyState || {};
        this.readyState.context = window.__APP_CONTEXT__;  // ← ANTES de isReady/state
        this.readyState.isReady = true;
        this.readyState.timestamp = performance.now?.() ?? Date.now();

        console.log("[BOOT_BREAKPOINT] readyState prepared with context");

        // SOMENTE depois do contexto pronto, marcar state como READY
        this.state = 'READY';

        console.log("[BOOT_BREAKPOINT] STATE SET READY");

        // CAUSAL: Estado READY definido
        window.causalTrace?.("KERNEL_STATE_READY", {
          contextExists: !!this.readyState.context
        }, releaseEvent);

        console.log('[BOOT_KERNEL] Released (READY):', {
          duration: `${duration}ms`,
          contextPresent: !!this.readyState.context
        });
      } else {
        this.state = 'FAILED';
        console.error('[BOOT_KERNEL] Released (FAILED)');
      }

      this.locked = false;

      // DEBUG SAFETY: Validação obrigatória de consistência
      if (this.state === 'READY' && !this.readyState.isReady) {
        console.error('[BOOT_KERNEL] INCONSISTENT READY STATE DETECTED');
        this.state = 'DEGRADED';
      }

      // Callbacks SEMPRE após estado consistente
      if (this.state === 'READY') {
        const ctx = this.readyState.context;

        // === SINGLE FINALIZER LOCK - Kernel está resolvendo ===
        window.__BOOT_FINALIZED__ = true;
        window.causalTrace?.("KERNEL_FINALIZER_LOCK_ACQUIRED", {}, releaseEvent);

        // PHASE: CALLBACK_QUEUE_FLUSH
        window.__BOOT_TRACE_PHASE__ = "CALLBACK_QUEUE_FLUSH";
        window.__BOOT_TRACE__?.log('KERNEL_CALLBACK_QUEUE_FLUSH_START', {
          queueLength: this.onReadyCallbacks.length
        });

        // === PATCH 4: EXECUÇÃO SEGURA DE CALLBACKS ===
        // Copiar e limpar callbacks antes de executar (evita mutations durante execução)
        const callbacks = [...(this.onReadyCallbacks || [])];
        this.onReadyCallbacks.length = 0; // Limpar array preservando referência

        console.log("[BOOT_BREAKPOINT] BEFORE CALLBACK EXECUTION", {
          callbacks: callbacks.length,
          contextPresent: !!ctx
        });

        window.causalTrace?.("KERNEL_CALLBACK_QUEUE_FLUSH_START", {
          count: callbacks.length
        }, releaseEvent);

        for (const fn of callbacks) {
          // CAUSAL: Início do callback
          const cbStart = window.causalTrace?.("KERNEL_CALLBACK_EXECUTE_START", {
            callbackType: fn.name || 'anonymous'
          }, releaseEvent);

          try {
            const result = fn(ctx); // 🔴 SEMPRE com contexto

            // CAUSAL: Sucesso do callback
            window.causalTrace?.("KERNEL_CALLBACK_EXECUTE_END", { result }, cbStart);

          } catch (err) {
            // CAUSAL: Erro no callback
            window.causalTrace?.("KERNEL_CALLBACK_ERROR", { error: err?.message || 'unknown' }, cbStart);
            console.error('[KERNEL][CALLBACK_ERROR] READY callback error:', err);
          }
        }

        console.log("[BOOT_BREAKPOINT] AFTER CALLBACK EXECUTION");

        // CAUSAL: Todos callbacks executados
        window.causalTrace?.("KERNEL_CALLBACKS_EXECUTE_DONE", {
          executedCount: callbacks.length
        }, releaseEvent);

        // === PATCH 6: INSTRUMENTAÇÃO DE VERIFICAÇÃO ===
        console.log("[KERNEL][FINAL STATE]", {
          state: this.state,
          ready: this.readyState?.isReady,
          contextPresent: !!this.readyState?.context,
          callbacksPending: this.onReadyCallbacks?.length || 0,
          locked: this.locked,
          duration: this.completedAt - this.startedAt
        });
      }

      // Registrar tentativa
      this.attempts.push({
        bootId: this.currentBootId,
        success,
        duration,
        timestamp: this.completedAt
      });
    },

    /**
     * Marca que o contexto global foi escrito
     * 🔴 FIX FINAL: Apenas o boot que adquiriu lock pode chamar isso
     */
    markContextWritten() {
      if (!this.locked) {
        console.error('[BOOT_KERNEL] Cannot mark context written without lock');
        window.__BOOT_TRACE__?.log('KERNEL_CONTEXT_MARK_FAIL', { reason: 'NO_LOCK' });
        return;
      }
      this.contextWritten = true;
      console.log('[BOOT_KERNEL] Context write ownership claimed');
      window.__BOOT_TRACE__?.log('KERNEL_CONTEXT_MARKED', { bootId: this.currentBootId });
    },

    /**
     * Entra em modo degradado
     * @param {string} reason 
     */
    setDegraded(reason) {
      console.warn('[BOOT_KERNEL] Entering degraded mode:', reason);
      this.state = 'DEGRADED';
      this.locked = false;
      window.__BOOT_TRACE__?.log('KERNEL_DEGRADED', { reason, previousState: this.state });
    },

    // ================================
    // API DE CONSULTA
    // ================================
    
    isReady() {
      return this.state === 'READY';
    },

    isRunning() {
      return this.locked || this.state === 'RUNNING';
    },

    isLocked() {
      return this.locked;
    },

    getState() {
      return {
        state: this.state,
        bootId: this.currentBootId,
        locked: this.locked,
        attempts: this.attempts.length
      };
    },

    // ================================
    // RESET (apenas para desenvolvimento)
    // ================================
    __dangerousReset() {
      console.warn('[BOOT_KERNEL] DANGEROUS RESET');
      this.state = 'IDLE';
      this.currentBootId = null;
      this.locked = false;
      this.startedAt = null;
      this.completedAt = null;
      this.attempts = [];
    }
  };

  // ================================
  // EXPOSE GLOBAL - SINGLE SOURCE OF TRUTH
  // ================================

  // 🔴 PROTEÇÃO CONTRA OVERWRITE ACIDENTAL
  if (window.__BOOT_KERNEL__ && window.__BOOT_KERNEL__ !== BootKernel) {
    console.error("[KERNEL][FATAL] Multiple kernel instances detected");
    throw new Error("Kernel singleton violation - another instance already exists");
  }

  // 1. Bind obrigatório e idempotente
  if (!window.__BOOT_KERNEL__) {
    window.__BOOT_KERNEL__ = BootKernel;
  }

  // 2. Singleton lock
  window.__BOOT_KERNEL_SINGLETON__ = BootKernel;

  // 3. Todos os aliases de compatibilidade
  window.__KERNEL__ = window.__BOOT_KERNEL__;
  window.kernel = window.__BOOT_KERNEL__;
  window.__BOOT_KERNEL_SINGLETON = window.__BOOT_KERNEL__;

  // 🔬 INSTRUMENTAÇÃO DE DIAGNÓSTICO - KERNEL INSTANTIATION
  console.log("[KERNEL SINGLETON BIND]", {
    __BOOT_KERNEL__: !!window.__BOOT_KERNEL__,
    __KERNEL__: !!window.__KERNEL__,
    kernel: !!window.kernel,
    __BOOT_KERNEL_SINGLETON__: !!window.__BOOT_KERNEL_SINGLETON__,
    allRefsMatch: (
      window.__BOOT_KERNEL__ === window.__KERNEL__ &&
      window.__KERNEL__ === window.kernel &&
      window.kernel === window.__BOOT_KERNEL_SINGLETON__
    ),
    instanceId: window.__BOOT_ID__,
    stack: new Error().stack
  });

  console.log('[BOOT_KERNEL] Control plane initialized with bootId:', window.__BOOT_ID__);
})();
