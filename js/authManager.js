class AuthManager {
  constructor() {
    this.currentUser = null;
    this.currentUserProfile = null;
    this.supabaseAvailable = false;
    this.init();
  }

  async init() {
    try {
      if (typeof window !== 'undefined' && window.supabase) {
        this.supabaseAvailable = true;
        console.log('✅ AUTH_MANAGER: Supabase disponível');
        
        // Verificar sessão atual
        await this.checkCurrentSession();
      } else {
        console.warn('⚠️ AUTH_MANAGER: Supabase não encontrado');
      }
    } catch (error) {
      console.error('❌ AUTH_MANAGER: Erro na inicialização:', error);
    }
  }

  async checkCurrentSession() {
    if (!this.supabaseAvailable) return;

    try {
      const { data: { session }, error } = await window.supabase.auth.getSession();
      
      if (error) {
        console.warn('⚠️ AUTH_MANAGER: Erro ao verificar sessão:', error);
        return;
      }

      if (session) {
        this.currentUser = session.user;
        window.currentUser = session.user;
        console.log('✅ AUTH_MANAGER: Sessão encontrada:', session.user);
        
        // Carregar profile do usuário
        await this.loadUserProfile();
      } else {
        console.log('ℹ️ AUTH_MANAGER: Nenhuma sessão ativa');
      }
    } catch (error) {
      console.error('❌ AUTH_MANAGER: Erro ao verificar sessão:', error);
    }
  }

  async loadUserProfile() {
    if (!this.currentUser || !this.supabaseAvailable) {
      console.warn('⚠️ AUTH_MANAGER: Usuário ou Supabase não disponível');
      return;
    }

    try {
      const { data, error } = await window.supabase
        .from('profiles')
        .select('id, nome, email, role, first_login_completed')
        .eq('id', this.currentUser.id)
        .single();

      if (error) {
        console.error('❌ AUTH_MANAGER: Erro ao buscar profile:', error);
        this.currentUserProfile = null;
        window.currentUserProfile = null;
        return null;
      }

      console.log('✅ AUTH_MANAGER: Profile carregado:', data);
      this.currentUserProfile = data;
      window.currentUserProfile = data;
      return data;
    } catch (error) {
      console.error('❌ AUTH_MANAGER: Erro ao buscar profile:', error);
      this.currentUserProfile = null;
      window.currentUserProfile = null;
      return null;
    }
  }

  async updateUserProfile(updates) {
    try {
      const { data, error } = await window.supabase
        .from('profiles')
        .update(updates)
        .eq('id', this.currentUser.id)
        .single();

      if (error) throw error;

      this.currentUserProfile = { ...this.currentUserProfile, ...data };
      window.currentUserProfile = this.currentUserProfile;

      console.log('✅ AUTH_MANAGER: Profile atualizado:', this.currentUserProfile);
      return this.currentUserProfile;
    } catch (error) {
      console.error('❌ AUTH_MANAGER: Erro ao atualizar profile:', error);
      throw error;
    }
  }

  logout() {
    console.log('🚪 AUTH_MANAGER: Fazendo logout...');
    
    // Limpar estado
    this.currentUser = null;
    this.currentUserProfile = null;
    window.currentUser = null;
    window.currentUserProfile = null;
    
    // Fazer logout do Supabase
    window.supabase.auth.signOut();
  }

  isAdmin() {
    const isAdmin = this.currentUserProfile?.role === 'admin';
    console.log('🔐 AUTH_MANAGER: Verificando se é admin:', isAdmin);
    return isAdmin;
  }

  isProfissional() {
    const isProfissional = this.currentUserProfile?.role === 'profissional';
    console.log('👩 AUTH_MANAGER: Verificando se é profissional:', isProfissional);
    return isProfissional;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getCurrentUserProfile() {
    return this.currentUserProfile;
  }
}

// Exportar para uso global
window.AuthManager = AuthManager;
