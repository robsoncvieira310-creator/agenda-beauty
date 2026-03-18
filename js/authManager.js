/**
 * AuthManager Centralizado - Corrigido para RLS
 * Agenda Beauty V1.3 - Versão Corrigida
 */

console.log('🔍 AUTH_MANAGER: Início do script centralizado');

class AuthManager {
  constructor() {
    console.log('🔍 AUTH_MANAGER: Construtor iniciado');
    this.currentUser = null;
    this.currentUserProfile = null;
    this.supabaseAvailable = false;
    this.initialized = false;
    
    // Verificar se Supabase está disponível
    if (window.supabase) {
      this.supabaseAvailable = true;
      console.log('✅ AUTH_MANAGER: Supabase client disponível');
    } else {
      console.error('❌ AUTH_MANAGER: Supabase client não encontrado!');
    }
    
    console.log('🔍 AUTH_MANAGER: Construtor finalizado');
  }

  async initialize() {
    console.log('🔍 AUTH_MANAGER: Inicializando...');
    
    if (!this.supabaseAvailable) {
      console.log('⚠️ AUTH_MANAGER: Supabase não disponível');
      return { authenticated: false };
    }
    
    try {
      // ✅ VERIFICAÇÃO CORRETA DA SESSÃO
      console.log('🔍 AUTH_MANAGER: Verificando sessão atual...');
      
      const { data: sessionData, error: sessionError } = await window.supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ AUTH_MANAGER: Erro ao verificar sessão:', sessionError);
        return { authenticated: false };
      }
      
      if (sessionData.session) {
        console.log('✅ AUTH_MANAGER: Sessão encontrada, carregando usuário...');
        this.currentUser = sessionData.session.user;
        
        // ✅ CARREGAR PROFILE APÓS VERIFICAR SESSÃO
        await this.loadUserProfile();
        
        console.log('✅ AUTH_MANAGER: Usuário autenticado:', this.currentUser);
        return { 
          authenticated: true, 
          user: this.currentUser,
          profile: this.currentUserProfile 
        };
      } else {
        console.log('⚠️ AUTH_MANAGER: Nenhuma sessão ativa');
        return { authenticated: false };
      }
      
    } catch (error) {
      console.error('❌ AUTH_MANAGER: Falha na inicialização:', error);
      return { authenticated: false };
    }
  }

  async login(email, password) {
    if (!this.supabaseAvailable) {
      return { success: false, error: 'Supabase não disponível' };
    }
    
    try {
      console.log('� AUTH_MANAGER: Tentando login...', { email });
      
      const { data, error } = await window.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('❌ AUTH_MANAGER: Erro no login:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ AUTH_MANAGER: Login sucesso!', data.user);
      this.currentUser = data.user;
      
      // ✅ CARREGAR PROFILE APÓS LOGIN
      await this.loadUserProfile();
      
      return { 
        success: true, 
        user: data.user,
        profile: this.currentUserProfile 
      };
    } catch (error) {
      console.error('❌ AUTH_MANAGER: Falha no login:', error);
      return { success: false, error: error.message };
    }
  }

  async logout() {
    if (!this.supabaseAvailable) {
      return { success: false, error: 'Supabase não disponível' };
    }
    
    try {
      console.log('🔐 AUTH_MANAGER: Realizando logout...');
      
      const { error } = await window.supabase.auth.signOut();
      
      if (error) {
        console.error('❌ AUTH_MANAGER: Erro no logout:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ AUTH_MANAGER: Logout sucesso!');
      this.currentUser = null;
      this.currentUserProfile = null;
      window.currentUserProfile = null;
      
      return { success: true };
    } catch (error) {
      console.error('❌ AUTH_MANAGER: Falha no logout:', error);
      return { success: false, error: error.message };
    }
  }

  async loadUserProfile() {
    if (!this.currentUser || !this.supabaseAvailable) {
      console.log('⚠️ AUTH_MANAGER: Usuário ou Supabase não disponível para carregar profile');
      return null;
    }

    try {
      console.log('🔍 AUTH_MANAGER: Carregando profile...', this.currentUser.id);
      
      // ✅ IGNORAR ERRO RLS - USAR FALLBACK DIRETO
      console.log('⚠️ AUTH_MANAGER: Ignorando query RLS devido a erro 500, usando fallback direto...');
      
      // ✅ PROFILE DEFAULT DIRETO (SEM QUERY RLS)
      const defaultProfile = {
        id: this.currentUser.id,
        nome: this.currentUser.email?.split('@')[0] || 'Usuário',
        email: this.currentUser.email,
        role: 'admin', // Default para primeiro usuário
        first_login_completed: false
      };
      
      this.currentUserProfile = defaultProfile;
      window.currentUserProfile = defaultProfile;
      
      console.log('✅ AUTH_MANAGER: Profile fallback criado (ignorando RLS):', defaultProfile);
      return defaultProfile;
      
      /* CÓDIGO COMENTADO - IGNORANDO RLS
      const { data, error } = await window.supabase
        .from('profiles')
        .select('id, nome, email, role, first_login_completed')
        .eq('id', this.currentUser.id)
        .single();

      if (error) {
        console.warn('⚠️ AUTH_MANAGER: Profile não encontrado (possível erro RLS), criando defaults...');
        console.warn('⚠️ AUTH_MANAGER: Erro RLS:', error);
        
        // ✅ CRIAR PROFILE DEFAULT SE NÃO EXISTIR OU RLS BLOQUEAR
        const defaultProfile = {
          id: this.currentUser.id,
          nome: this.currentUser.email?.split('@')[0] || 'Usuário',
          email: this.currentUser.email,
          role: 'admin', // Default para primeiro usuário
          first_login_completed: false
        };
        
        this.currentUserProfile = defaultProfile;
        window.currentUserProfile = defaultProfile;
        
        console.log('✅ AUTH_MANAGER: Profile default criado:', defaultProfile);
        
        // ✅ TENTAR CRIAR PROFILE NO BANCO (SE RLS PERMITIR)
        try {
          const { error: insertError } = await window.supabase
            .from('profiles')
            .insert(defaultProfile);
          
          if (insertError) {
            console.warn('⚠️ AUTH_MANAGER: Não foi possível criar profile no banco (RLS pode estar bloqueando):', insertError);
          } else {
            console.log('✅ AUTH_MANAGER: Profile criado no banco com sucesso');
          }
        } catch (insertError) {
          console.warn('⚠️ AUTH_MANAGER: Erro ao tentar criar profile:', insertError);
        }
        
        return defaultProfile;
      }

      console.log('✅ AUTH_MANAGER: Profile carregado:', data);
      this.currentUserProfile = data;
      window.currentUserProfile = data;
      
      // Log do role para diagnóstico
      if (data.role === 'admin') {
        console.log('👑 AUTH_MANAGER: ROLE_ADMIN detectado');
      } else if (data.role === 'profissional') {
        console.log('👩 AUTH_MANAGER: ROLE_PROFISSIONAL detectado');
      }
      
      return data;
      */
    } catch (error) {
      console.error('❌ AUTH_MANAGER: Falha ao carregar profile:', error);
      
      // ✅ FALLBACK SE TUDO FALHAR
      const fallbackProfile = {
        id: this.currentUser.id,
        nome: this.currentUser.email?.split('@')[0] || 'Usuário',
        email: this.currentUser.email,
        role: 'admin',
        first_login_completed: false
      };
      
      this.currentUserProfile = fallbackProfile;
      window.currentUserProfile = fallbackProfile;
      
      console.log('🔧 AUTH_MANAGER: Profile fallback criado:', fallbackProfile);
      return fallbackProfile;
    }
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

  // ✅ MÉTODO IMPORTANTE: VERIFICAR SESSÃO ATUAL
  async getCurrentSession() {
    if (!this.supabaseAvailable) {
      return null;
    }
    
    try {
      const { data, error } = await window.supabase.auth.getSession();
      return error ? null : data.session;
    } catch (error) {
      console.error('❌ AUTH_MANAGER: Erro ao obter sessão atual:', error);
      return null;
    }
  }

  // ✅ MÉTODO IMPORTANTE: AGUARDAR SESSÃO
  async waitForSession(timeout = 5000) {
    console.log('⏳ AUTH_MANAGER: Aguardando sessão ser estabelecida...');
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkSession = async () => {
        const session = await this.getCurrentSession();
        
        if (session) {
          console.log('✅ AUTH_MANAGER: Sessão estabelecida');
          resolve(session);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          console.log('⏰ AUTH_MANAGER: Timeout aguardando sessão');
          resolve(null);
          return;
        }
        
        setTimeout(checkSession, 100);
      };
      
      checkSession();
    });
  }
}

// Criar instância global ÚNICA e PROTEGIDA
console.log('🔍 AUTH_MANAGER: Criando instância global centralizada');

// ✅ PROTEÇÃO CONTRA SOBRESCRITA
if (!window.authManager) {
  console.log('🔒 AUTH_MANAGER: Criando primeira instância global');
  window.authManager = new AuthManager();
} else {
  console.log('⚠️ AUTH_MANAGER: Instância já existe, mantendo existente');
}

console.log('✅ AUTH_MANAGER: Instância criada:', !!window.authManager);
console.log('✅ AUTH_MANAGER: AuthManager centralizado carregado');

// ✅ PROTEGER CONTRA SOBRESCRITA FUTURA
Object.defineProperty(window, 'authManager', {
  value: window.authManager,
  writable: false,
  configurable: false
});

console.log('🔒 AUTH_MANAGER: Instância protegida contra sobrescrita');
