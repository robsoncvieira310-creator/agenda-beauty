// ================================
// BOOT RECOVERY MANAGER
// Camada de resiliência e recuperação automática
// NÃO modifica core - apenas adiciona retry seguro
// ================================

// TRACE HELPER v2 - Usa trace global do boot-trace-context.js se disponível
function localTrace(event, meta = {}) {
  if (window.trace) {
    window.trace(event, meta);
  } else {
    // Fallback para buffer global
    const entry = {
      bootId: window.__BOOT_TRACE_ID__ || 'unknown',
      event,
      meta,
      t: performance.now(),
      phase: window.__BOOT_TRACE_PHASE__ || 'INIT'
    };
    if (window.__BOOT_TRACE_BUFFER__) {
      window.__BOOT_TRACE_BUFFER__.push(entry);
    }
    console.log("[BOOT_TRACE_FALLBACK]", event, meta, performance.now());
  }
}

// Alias para compatibilidade
const trace = localTrace;

(function () {
  if (window.__BOOT_RECOVERY_MANAGER__) {
    console.log('[BOOT_RECOVERY] Already initialized');
    return;
  }

  // FALLBACK CONTEXT IMUTÁVEL - Seguro para consumo UI
  window.__BOOT_CONTEXT_FALLBACK__ = Object.freeze({
    bootId: 'fallback',
    authFSM: {
      state: 'UNAUTHENTICATED',
      isAuthenticated: false,
      getState: () => ({ 
        state: 'UNAUTHENTICATED', 
        isAuthenticated: false,
        status: 'UNAUTHENTICATED'
      }),
      subscribe: () => () => {}, // No-op unsubscribe
      waitForStableAuth: async () => {}
    },
    getAuthState: () => ({ 
      state: 'UNAUTHENTICATED', 
      isAuthenticated: false,
      status: 'UNAUTHENTICATED'
    }),
    // authStore: REMOVIDO (CICLO 1.2.2) — usar authFSM.getState()
    sessionBus: null,
    core: null,
    services: Object.freeze({}),
    isFallback: true,
    _warning: 'FALLBACK_CONTEXT: Limited functionality available'
  });

  // SAFE BOOT CONTEXT - Wrapper seguro para UI
  window.__SAFE_BOOT_CONTEXT__ = function() {
    const context = window.__APP_CONTEXT__ || window.__BOOT_CONTEXT_FALLBACK__;
    
    // TRACE: Uso do fallback
    if (context.isFallback) {
      window.__BOOT_TRACE__?.log('FALLBACK_CONTEXT_USED', {
        timestamp: Date.now(),
        reason: window.__APP_CONTEXT__ ? 'context_valid' : 'no_app_context'
      });
    }
    
    return context;
  };

  // RECOVERY MANAGER
  window.__BOOT_RECOVERY_MANAGER__ = {
    maxRetries: 1,
    retryCount: 0,
    isRecovering: false,

    /**
     * Tenta recuperação de boot falho
     * @param {Function} bootFn - Função de bootstrap a executar
     * @param {string} bootId - ID do boot atual
     * @returns {Promise} Contexto recuperado ou fallback
     */
    async attemptRecovery(bootFn, bootId) {
      if (this.retryCount >= this.maxRetries) {
        console.error('[BOOT_RECOVERY] Max retries reached, returning fallback');
        
        window.__BOOT_TRACE__?.log('BOOT_RECOVERY_MAX_RETRIES', {
          bootId,
          retries: this.retryCount,
          fallback: true
        });

        // Garantir que kernel está em estado degradado
        if (window.__BOOT_KERNEL__?.state !== 'DEGRADED') {
          window.__BOOT_KERNEL__?.setDegraded?.('max_retries_reached');
        }

        return window.__BOOT_CONTEXT_FALLBACK__;
      }

      if (this.isRecovering) {
        console.warn('[BOOT_RECOVERY] Recovery already in progress, returning fallback');
        return window.__BOOT_CONTEXT_FALLBACK__;
      }

      this.isRecovering = true;
      this.retryCount++;

      try {
        console.warn('[BOOT_RECOVERY] Attempting recovery', {
          bootId,
          retry: this.retryCount,
          timestamp: Date.now()
        });

        window.__BOOT_TRACE__?.log('BOOT_RECOVERY_ATTEMPT', {
          bootId,
          retry: this.retryCount
        });

        // Limpar estado anterior para retry limpo
        if (window.__BOOT_KERNEL__?.locked) {
          window.__BOOT_KERNEL__.release(false);
        }

        // Novo boot ID para retry
        const retryBootId = `retry-${Date.now()}`;
        window.__BOOT_ID__ = retryBootId;

        const result = await bootFn();

        // Validar resultado
        if (!result || (!result.authFSM && !result.isFallback)) {
          throw new Error('Invalid boot result - no authFSM');
        }

        // Sucesso!
        this.isRecovering = false;
        
        window.__BOOT_TRACE__?.log('BOOT_RECOVERY_SUCCESS', {
          bootId: retryBootId,
          originalBootId: bootId,
          retry: this.retryCount,
          hasFSM: !!result.authFSM,
          isFallback: result.isFallback
        });

        console.log('[BOOT_RECOVERY] Recovery successful');
        return result;

      } catch (err) {
        this.isRecovering = false;
        
        console.error('[BOOT_RECOVERY] Recovery failed:', err.message);
        
        window.__BOOT_TRACE__?.log('BOOT_RECOVERY_FAILED', {
          bootId,
          retry: this.retryCount,
          error: err?.message,
          fallback: true
        });

        // Marcar kernel como degradado
        window.__BOOT_KERNEL__?.setDegraded?.(err.message);

        return window.__BOOT_CONTEXT_FALLBACK__;
      }
    },

    /**
     * Reseta contadores para novo ciclo
     */
    reset() {
      this.retryCount = 0;
      this.isRecovering = false;
      
      window.__BOOT_TRACE__?.log('BOOT_RECOVERY_RESET', {
        timestamp: Date.now()
      });
    },

    /**
     * Status atual da recuperação
     */
    getStatus() {
      return {
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
        isRecovering: this.isRecovering,
        canRetry: this.retryCount < this.maxRetries && !this.isRecovering
      };
    }
  };

  // WRAPPER SEGURO DE BOOTSTRAP
  window.bootstrapAppSafe = async function(uiAdapter) {
    const bootId = window.__BOOT_ID__ || `safe-${Date.now()}`;

    window.__BOOT_TRACE__?.log('BOOT_SAFE_WRAPPER_START', { bootId });

    try {
      // Tentativa normal
      const context = await window.bootstrapApp(uiAdapter);

      // Validar resultado
      if (context?.authFSM && (context?.core || context?.services)) {
        window.__BOOT_TRACE__?.log('BOOT_SUCCESS_FINAL', { 
          bootId,
          hasFSM: true,
          hasCore: !!context.core,
          hasServices: !!context.services
        });
        
        // Resetar contadores em sucesso
        window.__BOOT_RECOVERY_MANAGER__.reset();
        
        return context;
      }

      throw new Error('Invalid boot context - missing core components');

    } catch (err) {
      // Falha - entrar em recovery
      trace("BOOT_SAFE_CATCH_ENTER", {
        error: err?.message,
        bootId
      });

      console.error('[BOOT_SAFE] Bootstrap failed, entering recovery:', err.message);

      window.__BOOT_KERNEL__?.setDegraded?.(err.message);

      window.__BOOT_TRACE__?.log('BOOT_FAILED_ENTER_RECOVERY', {
        bootId,
        error: err.message,
        kernelState: window.__BOOT_KERNEL__?.state
      });

      trace("BOOT_ATTEMPT_RECOVERY_START", {
        bootId,
        retryCount: window.__BOOT_RECOVERY_MANAGER__.retryCount
      });

      return await window.__BOOT_RECOVERY_MANAGER__
        .attemptRecovery(() => window.bootstrapApp(uiAdapter), bootId);
    }
  };

  // AUTO-HEAL NO DEGRADED STATE
  // Verifica periodicamente se pode recuperar
  if (window.__BOOT_KERNEL__) {
    const originalSetDegraded = window.__BOOT_KERNEL__.setDegraded;

    window.__BOOT_KERNEL__.setDegraded = function(reason) {
      // === CAUSAL TRACE v3 - setDegraded ===
      const degradedEvent = window.causalTrace?.("SET_DEGRADED_TRIGGERED", {
        state: this.state,
        reason: reason,
        timestamp: Date.now()
      });

      // Chamar original
      originalSetDegraded.call(this, reason);

      // TRIGGER AUTO-HEAL
      window.__BOOT_TRACE__?.log('BOOT_AUTO_HEAL_TRIGGERED', {
        reason,
        hasAppContext: !!window.__APP_CONTEXT__,
        timestamp: Date.now()
      });

      setTimeout(async () => {
        // === CAUSAL - Timeout fired ===
        const timeoutEvent = window.causalTrace?.("AUTO_HEAL_TIMEOUT_FIRED", {
          timestamp: Date.now(),
          hasAppContext: !!window.__APP_CONTEXT__,
          isFallback: window.__APP_CONTEXT__?.isFallback,
          alreadyFinalized: window.__BOOT_FINALIZED__
        }, degradedEvent);

        // Só tentar se não tem contexto válido
        if (!window.__APP_CONTEXT__ || window.__APP_CONTEXT__.isFallback) {
          window.__BOOT_TRACE__?.log('BOOT_AUTO_HEAL_RETRY', {
            timestamp: Date.now(),
            previousRetryCount: window.__BOOT_RECOVERY_MANAGER__.retryCount
          });

          // Tentar recovery
          const recovered = await window.__BOOT_RECOVERY_MANAGER__
            .attemptRecovery(() => window.bootstrapApp(), window.__BOOT_ID__);

          // === CAUSAL - Recovery result ===
          const recoveryEvent = window.causalTrace?.("AUTO_HEAL_RECOVERY_RESULT", {
            isFallback: recovered?.isFallback,
            hasContext: !!recovered,
            alreadyFinalized: window.__BOOT_FINALIZED__
          }, timeoutEvent);

          if (recovered && !recovered.isFallback) {
            console.log('[BOOT_AUTO_HEAL] System recovered successfully');

            // Atualizar APP_CONTEXT
            window.__APP_CONTEXT__ = recovered;

            // === CAUSAL - Finalizer attempt ===
            const finalizerEvent = window.causalTrace?.("AUTO_HEAL_FINALIZER_ATTEMPT", {
              alreadyFinalized: window.__BOOT_FINALIZED__
            }, recoveryEvent);

            // === 🔴 GUARD RAÍZ - impede dual finalizer não determinístico ===
            if (window.__BOOT_FINALIZED__) {
              window.causalTrace?.("AUTO_HEAL_BLOCKED_ALREADY_FINALIZED", {
                reason: "SINGLE_FINALIZER_LOCK"
              }, finalizerEvent);
              console.warn('[BOOT_AUTO_HEAL] BLOCKED - Boot already finalized by kernel');
              return;
            }

            // Marcar como finalizado
            window.__BOOT_FINALIZED__ = true;

            // Resolver BOOT_READY
            if (window.__resolveBootReady) {
              window.__resolveBootReady(recovered);
            }

            // === CAUSAL - Resolve done ===
            window.causalTrace?.("AUTO_HEAL_RESOLVE_DONE", {
              context: !!recovered,
              isFallback: recovered?.isFallback
            }, finalizerEvent);
          }
        }
      }, 1000);
    };
  }

  // RECOVERY TELEMETRY EXPANSION
  // Adicionar ao diagnostics existente
  const enhanceDiagnostics = () => {
    if (!window.__BOOT_DIAGNOSTICS__) return;

    window.__BOOT_DIAGNOSTICS__.recovery = {
      retryCount: window.__BOOT_RECOVERY_MANAGER__?.retryCount,
      maxRetries: window.__BOOT_RECOVERY_MANAGER__?.maxRetries,
      isRecovering: window.__BOOT_RECOVERY_MANAGER__?.isRecovering,
      fallbackUsed: !!window.__APP_CONTEXT__?.isFallback,
      degraded: window.__BOOT_KERNEL__?.state === 'DEGRADED',
      hasSafeWrapper: !!window.bootstrapAppSafe,
      hasSafeContext: !!window.__SAFE_BOOT_CONTEXT__,
      timestamp: Date.now()
    };
  };

  // Registrar para atualização periódica
  setInterval(enhanceDiagnostics, 5000);

  console.log('[BOOT_RECOVERY_MANAGER] Recovery system ready');
  console.log('[BOOT_RECOVERY] Features:', {
    maxRetries: window.__BOOT_RECOVERY_MANAGER__.maxRetries,
    hasFallback: !!window.__BOOT_CONTEXT_FALLBACK__,
    hasSafeWrapper: !!window.bootstrapAppSafe,
    hasSafeContext: !!window.__SAFE_BOOT_CONTEXT__
  });

  window.__BOOT_TRACE__?.log('BOOT_RECOVERY_INITIALIZED', {
    maxRetries: 1,
    hasAutoHeal: true,
    hasFallback: true
  });
})();
