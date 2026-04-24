// ================================
// STATE HYDRATOR v2.0 — FSM-ONLY ARCHITECTURE
// ================================
// CRÍTICO: Este hydrator depende EXCLUSIVAMENTE de AuthFSM
// Qualquer referência a AuthStore/storeState é PROIBIDA
//
// Contrato válido: hydrate({ fsm, sessionBus, core, services })
// Contrato inválido: qualquer propriedade 'authStore' ou 'storeState'
// ================================
(function () {
  if (window.__STATE_HYDRATOR__) {
    console.log('[STATE_HYDRATOR] Already initialized');
    return;
  }

  window.__STATE_HYDRATOR__ = {
    /**
     * Hydrata estado global a partir dos componentes ativos
     * @param {Object} components - Componentes do sistema
     * @param {AuthFSM} components.fsm - FSM de autenticação (única fonte obrigatória)
     * @param {SessionBus} components.sessionBus - Bus de sessão (opcional)
     * @param {DataCore} components.core - Core de dados (opcional)
     * @param {Object} components.services - Serviços (opcional)
     * @returns {Object} Estado consolidado e frozen
     * @throws {Error} Se contrato legacy for detectado
     */
    hydrate(components = {}) {
      // 🔴 GUARD CRÍTICO: Verificar contrato legacy
      if ('authStore' in components || 'storeState' in components) {
        throw new Error('[HYDRATOR] Legacy state contract detected: authStore/storeState proibidos');
      }

      const { fsm, sessionBus, core, services } = components;

      const timestamp = Date.now();
      const bootId = window.__BOOT_ID__ || 'unknown';

      // Extrair estado da FSM (única fonte de verdade)
      const fsmState = fsm?.getState?.() || null;
      
      // Extrair snapshot do SessionBus
      const busSnapshot = sessionBus?.getSnapshot?.() || {
        hasSessionBus: !!sessionBus,
        leader: sessionBus?.isLeader || false,
        channel: sessionBus?.channelName || null
      };

      // Verificar consistência cruzada
      const consistency = this._validateConsistency({
        fsmState,
        busSnapshot
      });

      const unifiedState = {
        // Identificação
        __meta: {
          hydratedAt: timestamp,
          bootId,
          version: '1.0'
        },

        // Estado de Autenticação (fonte: FSM - pass-through puro)
        auth: {
          state: fsmState?.state || 'UNKNOWN',
          isAuthenticated: fsmState?.isAuthenticated ?? false,
          session: fsmState?.session || null,
          error: fsmState?.error || null
        },

        // ⚠️  LEGACY: Seção 'store' removida — AuthStore não participa do runtime
        // Estado de auth vem exclusivamente da FSM (acima)

        // Estado do Bus (fonte: SessionBus)
        session: {
          hasBus: !!sessionBus,
          snapshot: busSnapshot
        },

        // Infraestrutura
        infra: {
          hasCore: !!core,
          hasServices: !!services,
          serviceCount: services ? Object.keys(services).length : 0
        },

        // Validação
        consistency: {
          valid: consistency.valid,
          checks: consistency.checks
        }
      };

      // Congelar estado para imutabilidade
      const frozenState = Object.freeze(unifiedState);
      
      // Publicar globalmente
      window.__APP_STATE__ = frozenState;

      console.log('[STATE_HYDRATOR] State hydrated:', {
        bootId,
        authStatus: frozenState.auth.status,
        isAuthenticated: frozenState.auth.isAuthenticated,
        consistency: frozenState.consistency.valid ? 'VALID' : 'INVALID'
      });

      return frozenState;
    },

    /**
     * Valida consistência entre fontes de estado
     */
    _validateConsistency({ fsmState, busSnapshot }) {
      const checks = [];

      // Check 1: FSM tem estado válido
      checks.push({
        name: 'FSM_STATE_VALID',
        pass: fsmState && typeof fsmState.state === 'string',
        details: fsmState?.state
      });

      // Check 2: Session existe apenas se AUTHENTICATED (FSM é única fonte)
      if (fsmState) {
        const hasSession = !!fsmState.session;
        const isAuth = fsmState.state === 'AUTHENTICATED';
        checks.push({
          name: 'SESSION_VALIDITY',
          pass: !isAuth || (isAuth && hasSession), // Se auth, deve ter session
          details: { isAuthenticated: isAuth, hasSession }
        });
      }

      const allPassed = checks.every(c => c.pass);

      return {
        valid: allPassed,
        checks
      };
    },

    /**
     * Recupera estado atual
     */
    getState() {
      return window.__APP_STATE__ || null;
    },

    /**
     * Verifica se estado está consistente
     */
    isConsistent() {
      return window.__APP_STATE__?.consistency?.valid || false;
    }
  };

  console.log('[STATE_HYDRATOR] Initialized (FSM-ONLY v2.0)');
})();
