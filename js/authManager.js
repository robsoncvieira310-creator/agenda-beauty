/**
 * AuthManager Centralizado - Corrigido para RLS
 * Agenda Beauty V1.3 - Versão Corrigida
 */

console.log('🔍 AUTH_MANAGER: Início do script centralizado');

class AuthManager {
  constructor(supabase) {
    if (!supabase) {
      throw new Error('Supabase client é obrigatório para AuthManager');
    }

    this.supabase = supabase;
    this.supabaseAvailable = true;
    this.currentUser = null;
    this.currentUserProfile = null;
    this.initialized = false;
    
    console.log('🔍 AUTH_MANAGER: Construtor iniciado');
    console.log('✅ AUTH_MANAGER: Supabase client disponível');
    console.log('🔍 AUTH_MANAGER: Construtor finalizado');
  }

  async getCurrentUser() {
    if (!this.currentUser) {
      const session = await this.getCurrentSession();
      this.currentUser = session?.user || null;
    }
    return this.currentUser;
  }

  async getCurrentSession() {
    if (!this.supabase) {
      throw new Error('Supabase não inicializado no AuthManager');
    }
    
    try {
      const { data, error } = await this.supabase.auth.getSession();
      if (error) {
        console.error('❌ AUTH_MANAGER: Erro ao obter sessão:', error);
        throw error;
      }
      return data.session;
    } catch (error) {
      console.error('❌ AUTH_MANAGER: Erro ao obter sessão atual:', error);
      throw error;
    }
  }

  async login(email, password) {
    if (!this.supabase) {
      throw new Error('Supabase não inicializado no AuthManager');
    }
    
    try {
      console.log('🔐 AUTH_MANAGER: Tentando login...', { email });
      
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('❌ AUTH_MANAGER: Erro no login:', error);
        throw error;
      }

      console.log('✅ AUTH_MANAGER: Login sucesso!', data.user);
      this.currentUser = data.user;
      
      // ✅ CARREGAR PROFILE APÓS LOGIN - PASSANDO USER ID
      await this.loadUserProfile(data.user.id);
      
      return { 
        success: true, 
        user: data.user,
        profile: this.currentUserProfile 
      };
    } catch (error) {
      console.error('❌ AUTH_MANAGER: Falha no login:', error);
      throw error;
    }
  }

  async logout() {
    if (!this.supabase) {
      throw new Error('Supabase não inicializado no AuthManager');
    }
    
    try {
      console.log('🔐 AUTH_MANAGER: Realizando logout...');
      
      const { error } = await this.supabase.auth.signOut();
      
      if (error) {
        console.error('❌ AUTH_MANAGER: Erro no logout:', error);
        throw error;
      }

      console.log('✅ AUTH_MANAGER: Logout sucesso!');
      this.currentUser = null;
      this.currentUserProfile = null;
      window.currentUserProfile = null;
      
      return { success: true };
    } catch (error) {
      console.error('❌ AUTH_MANAGER: Falha no logout:', error);
      throw error;
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

  async initialize() {
    console.log('🔍 AUTH_MANAGER: Inicializando...');
    
    if (!this.supabase) {
      throw new Error('Supabase não inicializado no AuthManager');
    }

    try {
      // ✅ VERIFICAR SESSÃO PRIMEIRO
      const { data, error } = await this.supabase.auth.getSession();

      if (error) {
        console.error('❌ AUTH_MANAGER: Erro ao verificar sessão:', error);
        throw error;
      }

      if (!data.session) {
        console.log('⚠️ AUTH_MANAGER: Nenhuma sessão ativa encontrada');
        return { authenticated: false };
      }

      this.currentUser = data.session.user;
      console.log('✅ AUTH_MANAGER: Sessão encontrada:', data.session.user.email);

      // ✅ CARREGAR PROFILE APÓS SESSÃO
      this.currentUserProfile = await this.loadUserProfile(this.currentUser.id);
      
      if (!this.currentUserProfile) {
        console.error('❌ AUTH_MANAGER: Falha ao carregar profile');
        return { authenticated: false };
      }

      console.log('✅ AUTH_MANAGER: Inicialização concluída com sucesso');
      return {
        authenticated: true,
        user: this.currentUser,
        profile: this.currentUserProfile
      };

    } catch (error) {
      console.error('❌ AUTH_MANAGER: Erro na inicialização:', error);
      throw error;
    }
  }

  async loadUserProfile(userId) {
    if (!this.supabase) {
      throw new Error('Supabase não inicializado no AuthManager');
    }

    if (!userId) {
      throw new Error('UserID é obrigatório para carregar profile');
    }

    try {
      console.log('🔍 AUTH_MANAGER: Carregando profile...', userId);
      
      // ✅ QUERY SEGURA COM RLS - SEM FALLBACKS
      const { data, error } = await this.supabase
        .from('profiles')
        .select('id, nome, email, role, first_login_completed')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ AUTH_MANAGER: Erro ao carregar profile:', error);
        
        // ❌ NÃO USAR FALLBACK - RETORNAR ERRO REAL
        if (error.code === 'PGRST116') {
          // Profile não existe - criar automaticamente
          console.log('🔧 AUTH_MANAGER: Profile não encontrado, criando novo...');
          return await this.createProfileForUser();
        }
        
        // Erro RLS ou outro - propagar erro
        throw new Error(`Erro de RLS ou permissão: ${error.message}`);
      }

      if (!data) {
        console.log('🔧 AUTH_MANAGER: Profile nulo, criando...');
        return await this.createProfileForUser();
      }

      console.log('✅ AUTH_MANAGER: Profile carregado com sucesso:', data);
      window.currentUserProfile = data;
      return data;
      
    } catch (error) {
      console.error('❌ AUTH_MANAGER: Erro crítico ao carregar profile:', error);
      window.currentUserProfile = null;
      throw error; // ❌ NÃO ENGOLIR ERROS
    }
  }

  async createProfileForUser() {
    if (!this.currentUser) {
      throw new Error('Usuário não autenticado para criar profile');
    }

    if (!this.supabase) {
      throw new Error('Supabase não inicializado no AuthManager');
    }

    try {
      const profileData = {
        id: this.currentUser.id,
        nome: this.currentUser.user_metadata?.nome || this.currentUser.email?.split('@')[0] || 'Usuário',
        email: this.currentUser.email,
        role: this.currentUser.user_metadata?.role || 'admin',
        first_login_completed: false
      };

      console.log('🔧 AUTH_MANAGER: Criando profile para usuário:', profileData);

      const { data, error } = await this.supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single();

      if (error) {
        console.error('❌ AUTH_MANAGER: Erro ao criar profile:', error);
        throw new Error(`Falha ao criar profile: ${error.message}`);
      }

      console.log('✅ AUTH_MANAGER: Profile criado com sucesso:', data);
      window.currentUserProfile = data;
      return data;

    } catch (error) {
      console.error('❌ AUTH_MANAGER: Erro ao criar profile:', error);
      throw error;
    }
  }
}

// Criar instância global ÚNICA com injeção de dependência
console.log('🔍 AUTH_MANAGER: Criando instância global centralizada');

// ✅ PROTEÇÃO CONTRA SOBRESCRITA COM INJEÇÃO OBRIGATÓRIA
if (!window.authManager && window.supabaseClient) {
  console.log('🔒 AUTH_MANAGER: Criando primeira instância global com Supabase client');
  window.authManager = new AuthManager(window.supabaseClient);
} else if (!window.supabaseClient) {
  console.error('❌ AUTH_MANAGER: Supabase client não disponível para criação do AuthManager');
  throw new Error('Supabase client é obrigatório para AuthManager');
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

// ✅ VALIDAR MÉTODOS DISPONÍVEIS
if (window.authManager) {
  console.log('🔍 AUTH_MANAGER: Métodos disponíveis:', Object.getOwnPropertyNames(Object.getPrototypeOf(window.authManager)));
  console.log('✅ AUTH_MANAGER: Método initialize existe:', typeof window.authManager.initialize === 'function');
  console.log('✅ AUTH_MANAGER: Método loadUserProfile existe:', typeof window.authManager.loadUserProfile === 'function');
}
