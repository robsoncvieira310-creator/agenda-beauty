// auth-store.js — LEGACY FACADE (DEPRECATED CICLO 1.2.2)
//
// ⚠️  ESTA CLASSE NÃO DEVE SER INSTANCIADA EM RUNTIME
// ⚠️  NÃO ADICIONAR LÓGICA AQUI — TODA REGRA DE AUTENTICAÇÃO PERTENCE AO AuthFSM
//
// AuthFSM é a única fonte de verdade para autenticação.
// Esta classe é mantida apenas como compatibilidade histórica.
//
// Se você precisa verificar autenticação:
//   ✅ USE: authFSM.getState().isAuthenticated
//   ❌ NÃO USE: authStore.isAuthenticated()

window.AuthStore = class AuthStore {
  constructor(authFSM) {
    if (!authFSM || typeof authFSM.subscribe !== 'function') {
      throw new Error('AuthStore requer uma FSM válida com subscribe()');
    }

    this.fsm = authFSM;
  }

  // 🔥 ÚNICO MÉTODO REALMENTE NECESSÁRIO
  subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback deve ser função');
    }

    return this.fsm.subscribe((state, context) => {
      try {
        callback(state, context);
      } catch (err) {
        console.error('[AuthStore] erro no subscriber:', err);
      }
    });
  }

  // 🔎 Métodos auxiliares (opcional, mas úteis para UI)
  getState() {
    if (typeof this.fsm.getState === 'function') {
      return this.fsm.getState();
    }
    return null;
  }

  isAuthenticated() {
    return this.fsm?.getState?.()?.isAuthenticated ?? false;
  }

  getSession() {
    const state = this.getState();
    return state?.context?.session || null;
  }

  getProfile() {
    const state = this.getState();
    return state?.context?.profile || null;
  }
}

console.log('⚠️  AuthStore (LEGACY) carregado — NÃO INSTANCIAR EM RUNTIME');

// Auto-expor classe para compatibilidade histórica
// NÃO criar window.authStore — AuthFSM é a única fonte de verdade
window.AuthStore = AuthStore;
