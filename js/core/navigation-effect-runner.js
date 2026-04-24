// ================================
// NAVIGATION EFFECT RUNNER - FSM-DRIVEN NAVIGATION
// ================================
// Regra: Navegação 100% acionada por eventos do AuthFSM
// Sem polling, sem DOM readiness, sem kernel context dependency

window.NavigationEffectRunner = class NavigationEffectRunner {
  constructor(authFSM) {
    this.authFSM = authFSM;
    this.unsubscribe = null;
    this.hasRedirected = false;
    this.targetUrl = 'index.html';
  }

  /**
   * Inicializa o runner - deve ser chamado após AuthFSM estar pronta
   */
  init() {
    if (!this.authFSM) {
      console.error('[NavigationEffectRunner] AuthFSM não fornecido');
      return;
    }

    if (this.unsubscribe) {
      console.warn('[NavigationEffectRunner] Já inicializado, ignorando');
      return;
    }

    console.log('[NavigationEffectRunner] Inicializando...');

    // Subscribe ao AuthFSM - única fonte de verdade para navegação
    this.unsubscribe = this.authFSM.subscribe((state) => {
      this.handleState(state);
    });

    // Check imediato: se pode acessar app, navegar agora
    const currentState = this.authFSM.getState?.();
    if (currentState?.canAccessApp) {
      console.log('[NavigationEffectRunner] canAccessApp=true, navegando...');
      this.executeRedirect();
    }

    console.log('[NavigationEffectRunner] Inicializado e subscrito ao AuthFSM');
  }

  /**
   * Handler de estado - chamado toda vez que AuthFSM muda de estado
   */
  handleState(state) {
    if (!state) return;

    // Log para debug
    console.log('[NavigationEffectRunner] State received:', {
      state: state.state,
      canAccessApp: state.canAccessApp,
      hasRedirected: this.hasRedirected
    });

    // 🎯 FASE 5: Navegação baseada em canAccessApp
    if (state.canAccessApp) {
      // Usuário autenticado → redirecionar para app se estiver no login
      this.executeRedirect();
    } else {
      // Usuário não autenticado → redirecionar para login se não estiver no login
      this.executeLogoutRedirect();
    }
  }

  /**
   * Executa o redirect - garantido único por ciclo de vida
   */
  executeRedirect() {
    if (this.hasRedirected) {
      console.log('[NavigationEffectRunner] Redirect já executado, ignorando');
      return;
    }

    // Guard: só redirecionar se estiver na página de login
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.includes('login') || currentPath.includes('login-profissional');

    if (!isLoginPage) {
      console.log('[NavigationEffectRunner] Não está na página de login, skip redirect');
      return;
    }

    // Marcar como redirecionado ANTES de navegar (prevents race)
    this.hasRedirected = true;

    console.log('[NavigationEffectRunner] 🚀 Executando redirect para:', this.targetUrl);

    // Executar navegação
    window.location.href = this.targetUrl;
  }

  /**
   * Executa redirect para login após logout
   */
  executeLogoutRedirect() {
    // Guard: só redirecionar se NÃO estiver na página de login
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath.includes('login') || currentPath.includes('login-profissional');

    if (isLoginPage) {
      console.log('[NavigationEffectRunner] Já está na página de login, skip redirect');
      return;
    }

    console.log('[NavigationEffectRunner] 🚀 Executando redirect para login.html (logout)');

    // Executar navegação para login
    window.location.href = 'login.html';
  }

  /**
   * Destrói o runner e limpa subscriptions
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.hasRedirected = false;
    console.log('[NavigationEffectRunner] Destruído');
  }

  /**
   * Força reset do flag (útil para testes)
   */
  reset() {
    this.hasRedirected = false;
    console.log('[NavigationEffectRunner] Flag resetado');
  }
}

console.log('[NavigationEffectRunner] Classe carregada');
