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
      requiresPasswordChange: state.requiresPasswordChange,
      hasRedirected: this.hasRedirected
    });

    // 🎯 PRIORIDADE 1: FIRST_LOGIN_REQUIRED - redirecionar para change-password
    if (state.requiresPasswordChange) {
      this.executeFirstLoginRedirect();
      return;
    }

    // 🎯 FASE 5: Navegação baseada em canAccessApp
    if (state.canAccessApp) {
      // 🎯 VERIFICAR FIRST_LOGIN ANTES DE REDIRECIONAR
      this._checkFirstLoginAndRedirect(state);
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
   * 🎯 Verificar first_login_completed antes de redirecionar
   */
  async _checkFirstLoginAndRedirect(state) {
    try {
      const userId = state.userId;
      if (!userId) {
        console.warn('[NavigationEffectRunner] _checkFirstLoginAndRedirect: userId não disponível');
        return;
      }

      console.log('[NavigationEffectRunner] Verificando first_login_completed para userId:', userId);

      // 🎯 Usar supabaseClient para evitar problemas com token expirado
      const client = window.supabaseClient;
      if (!client) {
        console.warn('[NavigationEffectRunner] supabaseClient não disponível');
        return;
      }

      console.log('[NavigationEffectRunner] Usando supabaseClient para verificar first_login_completed');

      try {
        // 🎯 Usar edge function para verificar first_login_completed sem JWT
        const SUPABASE_URL = 'https://kckbcjjgbipcqzkynwpy.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtja2JjampnaXBjcXpreW53cHkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc3Mjc0MjEyOCwiZXhwIjoyMDg4MzE4MTI4fQ.h3Z8LkzH_PXxE-BBHPii3WUwfHQH5HESsvzHUHKY7ZE';

        const headers = {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        };

        const url = `${SUPABASE_URL}/functions/v1/first-login-change-password`;
        console.log('[NavigationEffectRunner] Chamando edge function para verificar first_login_completed');

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'check', userId })
        });

        const data = await response.json();

        console.log('[NavigationEffectRunner] Response status:', response.status);
        console.log('[NavigationEffectRunner] Response data:', data);

        if (!response.ok) {
          console.error('[NavigationEffectRunner] Erro ao verificar first_login_completed:', response.status, data);
          return;
        }

        const firstLoginCompleted = data.first_login_completed;
        console.log('[NavigationEffectRunner] first_login_completed:', firstLoginCompleted);

        if (firstLoginCompleted === false) {
          console.log('[NavigationEffectRunner] First login detectado! Redirecionando para change-password.html');
          this.executeFirstLoginRedirect();
        } else {
          console.log('[NavigationEffectRunner] First login já completado - redirecionando para index.html');
          this.executeRedirect();
        }

      } catch (err) {
        console.error('[NavigationEffectRunner] Erro em _checkFirstLoginAndRedirect:', err);
      }

    } catch (error) {
      console.error('[NavigationEffectRunner] Erro em _checkFirstLoginAndRedirect:', error);
    }
  }

  /**
   * Executa redirect para change-password quando FIRST_LOGIN_REQUIRED
   */
  executeFirstLoginRedirect() {
    if (this.hasRedirected) {
      console.log('[NavigationEffectRunner] Redirect já executado, ignorando');
      return;
    }

    // Guard: só redirecionar se NÃO estiver na página de change-password
    const currentPath = window.location.pathname;
    const isChangePasswordPage = currentPath.includes('change-password');

    if (isChangePasswordPage) {
      console.log('[NavigationEffectRunner] Já está na página de change-password, skip redirect');
      return;
    }

    // Marcar como redirecionado ANTES de navegar (prevents race)
    this.hasRedirected = true;

    console.log('[NavigationEffectRunner] 🚀 Redirecionando para change-password.html (FIRST_LOGIN_REQUIRED)');

    // Executar navegação
    window.location.href = 'change-password.html';
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
