// ================================
// LOGIN VIEW - UI Component (FSM V3)
// ================================
// UI passiva - apenas consome estado derivado
// Nunca acessa FSM diretamente, sempre via AuthAdapter

// FASE 1: LOG DE CARREGAMENTO DO SCRIPT
console.log('[LOGIN SCRIPT LOADED] LoginView.js executing');

window.LoginView = class LoginView {
  constructor(fsm, auth) {
    this.fsm = fsm;
    this.auth = auth;

    // DOM elements
    this.form = document.getElementById('loginForm');
    this.emailInput = document.getElementById('email');
    this.passwordInput = document.getElementById('password');
    this.btnLogin = document.getElementById('btnLogin');
    this.btnText = document.getElementById('btnText');
    this.alertContainer = document.getElementById('alertContainer');

    // Subscriptions
    this.unsubscribe = null;

    // Guard para garantir que login foi iniciado nesta sessão (evita login automático fantasma)
    this.loginAttempted = false;

    // 🔒 Guard contra inicialização duplicada
    if (this._initialized) return;
    this._initialized = true;

    this.mount();
  }

  mount() {
    // 🔒 Guard contra mount duplicado
    if (this.unsubscribe) return;

    // FASE 2: DETECTAR BIND DO FORM
    const form = document.getElementById('loginForm');
    console.log('[LOGIN FORM FOUND]', !!form, 'formId:', form?.id);

    // FASE 3 e 4: Setup event listeners com preventDefault e log
    this.form?.addEventListener('submit', (e) => {
      e.preventDefault(); // FASE 4: BLOQUEAR RELOAD
      console.log('[LOGIN SUBMIT TRIGGERED]');
      this.handleLogin();
    });

    this.emailInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.passwordInput?.focus();
    });

    this.passwordInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleLogin();
    });

    // Check immediate state (se estado já mudou antes do subscribe)
    const currentState = this.auth.getDerivedState();
    this.render(currentState);

    // Subscribe via AuthAdapter (estado derivado)
    this.unsubscribe = this.auth.subscribe((state) => {
      console.log('[SUBSCRIBE FIRED]', state);
      this.render(state);
    });
  }

  render(state) {
    // Loading states
    if (state.isLoading) {
      this.setLoading(true);
      return;
    }

    // 🔒 LOG APENAS: não faz redirect - deixa para o guard do sistema
    // O redirect será feito pelo guard em login.html quando detectar AUTHENTICATED
    console.log('[LOGIN STATE CHECK]', {
      isAuthenticated: state.isAuthenticated,
      lastState: this._lastState,
      message: state.isAuthenticated ? 'Login successful - guard will redirect' : 'Not authenticated'
    });

    this._lastState = state.isAuthenticated ? 'AUTHENTICATED' : 'UNAUTHENTICATED';

    // Handle error state
    if (state.hasError || state.state === 'ERROR') {
      this.setLoading(false);
      // Traduzir mensagem específica do Supabase para português
      let errorMessage = state.error || 'Erro de autenticação';
      
      // Verificar diferentes formatos de erro do Supabase
      if (errorMessage === 'Invalid login credentials' || 
          errorMessage.includes('Invalid login credentials') ||
          errorMessage === 'HTTP 400: ') {
        errorMessage = 'Email ou senha incorretos';
      }
      
      this.showError(errorMessage);
      return;
    }

    // Ready for input
    this.setLoading(false);
  }

  async handleLogin() {
    // FASE 6: LOG INICIAL DO HANDLELOGIN
    console.log('[LOGIN START] handleLogin() executing');

    // Bloqueia login se já está autenticado (evita estado inconsistente)
    const state = this.auth.getDerivedState();
    console.log('[LOGIN CHECK] isAuthenticated:', state.isAuthenticated);
    if (state.isAuthenticated) {
      console.warn('[LoginView] Already authenticated, ignoring login request');
      return;
    }

    // FASE 5: LOGAR VALORES
    const email = this.emailInput?.value?.trim();
    const password = this.passwordInput?.value;
    console.log('[LOGIN DATA]', { email, hasPassword: !!password, passwordLength: password?.length });

    if (!email || !password) {
      this.showError('Por favor, preencha todos os campos.');
      return;
    }

    if (!this.validateEmail(email)) {
      this.showError('Por favor, digite um email válido.');
      return;
    }

    this.clearAlerts();

    // FLUXO FSM CORRETO: Dispatch LOGIN_REQUEST → FSM transiciona para AUTHENTICATING
    // → EffectRunner faz login no Supabase → FSM dispara LOGIN_SUCCESS internamente
    // → handleAuthenticating processa e transiciona para AUTHENTICATED
    console.log('[LOGIN DISPATCH] Enviando LOGIN_REQUEST para FSM...');
    this.fsm.dispatch('LOGIN_REQUEST', { email, password });
  }

  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  setLoading(loading) {
    this.btnLogin?.classList.toggle('loading', loading);
    if (this.btnLogin) this.btnLogin.disabled = loading;
    if (this.btnText) this.btnText.textContent = loading ? '' : 'Entrar';
  }

  showError(message) {
    this.showAlert(message, 'login-error', 5000);
  }

  showSuccess(message) {
    this.showAlert(message, 'login-success', 3000);
  }

  showAlert(message, className, timeout) {
    this.clearAlerts();
    const alertDiv = document.createElement('div');
    alertDiv.className = className;
    alertDiv.textContent = message;
    this.alertContainer?.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), timeout);
  }

  clearAlerts() {
    if (this.alertContainer) this.alertContainer.innerHTML = '';
  }

  destroy() {
    this.unsubscribe?.();
  }
}

// Exposto globalmente via window.LoginView
