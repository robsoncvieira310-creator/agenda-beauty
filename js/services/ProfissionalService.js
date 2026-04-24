(function() {
// 🔒 VALIDAÇÃO DE DEPENDÊNCIAS CRÍTICAS
if (!window.BaseService) {
  throw new Error('[BOOTSTRAP FATAL] ProfissionalService: window.BaseService missing. Ensure BaseService.js loads first.');
}

const SUPABASE_URL = 'https://kckbcjjgbipcqzkynwpy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtja2JjampnYmlwY3F6a3lud3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0NDkzNTAsImV4cCI6MjA1MDAyNTM1MH0.VteI_8gRuD2q-6OKa373nc1j2-1qF_2A1aR0EJ1eFw8';

window.ProfissionalService = class ProfissionalService extends window.BaseService {
  constructor(core) {
    super(core, 'profissionais');
  }

  /**
   * 🔍 Obter empresa_id do usuário logado
   * Retorna null para admin (não filtra) ou empresa_id para adm_empresa
   */
  _getCurrentUserEmpresaId() {
    try {
      const state = window.authFSM?.getState?.();
      const user = state?.session?.user;
      
      if (!user) {
        console.warn('[ProfissionalService] _getCurrentUserEmpresaId: No user found');
        return null;
      }

      // Admin não filtra por empresa
      const role = user.app_metadata?.role || user.user_metadata?.role;
      if (role === 'admin') {
        console.log('[ProfissionalService] _getCurrentUserEmpresaId: Admin user - no filter');
        return null;
      }

      // Para adm_empresa, retornar empresa_id
      const empresaId = user.app_metadata?.empresa_id || user.user_metadata?.empresa_id;
      
      console.log('[ProfissionalService] _getCurrentUserEmpresaId:', {
        userId: user.id,
        role,
        empresaId
      });

      return empresaId;
    } catch (e) {
      console.error('[ProfissionalService] _getCurrentUserEmpresaId error:', e);
      return null;
    }
  }

  /**
   * 🔍 Obter profissional logado pelo user_id
   * Retorna o profissional correspondente ao usuário autenticado
   * @returns {Promise<Object|null>} - Dados do profissional ou null se não encontrado/admin
   */
  async getProfissionalLogado() {
    try {
      const state = window.authFSM?.getState?.();
      const user = state?.session?.user;
      
      if (!user) {
        console.warn('[ProfissionalService] getProfissionalLogado: No user found');
        return null;
      }

      // Admin não tem profissional logado
      const role = user.app_metadata?.role || user.user_metadata?.role;
      if (role === 'admin') {
        console.log('[ProfissionalService] getProfissionalLogado: Admin user - no profissional');
        return null;
      }

      // Buscar profissional pelo user_id
      const profissionais = await this.list();
      const profissionalLogado = profissionais.find(p => p.user_id === user.id);
      
      console.log('[ProfissionalService] getProfissionalLogado:', {
        userId: user.id,
        role,
        profissionalEncontrado: !!profissionalLogado,
        profissionalNome: profissionalLogado?.nome
      });

      return profissionalLogado || null;
    } catch (e) {
      console.error('[ProfissionalService] getProfissionalLogado error:', e);
      return null;
    }
  }

  /**
   * 🎯 OVERRIDE: Criar profissional via Edge Function (auth + profile + profissional)
   * ATÔMICO: Ou cria tudo (auth user + profile + profissional) ou nada
   * ROLLBACK automático na Edge Function se profissional falhar
   * 
   * @param {Object} data - { nome, email, password, telefone }
   * @returns {Promise<Object>} - { id, profile_id, nome, email, ... }
   */
  async create(data) {
    // 🎯 FASE 4: PROTEÇÃO CONTRA BYPASS DE PRIMEIRO LOGIN
    this._assertCanAccessApp();

    console.log('[ProfissionalService] create() - iniciando criação atômica...');

    // 🎯 VALIDAÇÃO SÍNCRONA: Campos obrigatórios para criação completa
    if (!data.nome || !data.email || !data.password) {
      throw new Error('Campos obrigatórios: nome, email, password');
    }

    // 🎯 OBTER SESSÃO: Token válido para Edge Function
    const { data: { session }, error: sessionError } = 
      await window.supabaseClient.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      console.error('[ProfissionalService] create() - Sessão não encontrada');
      throw new Error('Sessão não encontrada. Faça login novamente.');
    }

    console.log('[ProfissionalService] create() - chamando Edge Function...');

    // 🎯 CHAMADA ATÔMICA: Edge Function cria auth + profile + profissional
    // Se falhar em qualquer etapa, rollback automático no servidor
    const result = await this.createWithAuth(data, session.access_token);

    console.log('[ProfissionalService] create() - sucesso:', result);

    // 🎯 INVALIDAÇÃO DE CACHE: Garantir lista atualizada
    this.core.invalidate(this.table);
    this.core.invalidate('profiles');

    // 🎯 RETORNO NORMALIZADO: Compatível com outras operações CRUD
    return {
      id: result.user_id,           // profile_id (UUID do auth)
      profile_id: result.user_id,  // mesma coisa
      nome: data.nome,
      email: data.email,
      telefone: data.telefone || '',
      especialidade: '',
      status: 'active',
      _fromEdgeFunction: true
    };
  }

  /**
   * 🎯 OVERRIDE: Atualizar profissional via Edge Function (bypass RLS)
   * Atualiza tabela profissionais, profiles e auth.users (email) via service_role
   */
  async update(id, data) {
    // 🎯 FASE 4: PROTEÇÃO CONTRA BYPASS DE PRIMEIRO LOGIN
    this._assertCanAccessApp();

    console.log('[ProfissionalService] update() - id:', id, 'data:', JSON.stringify(data));

    // 🎯 FASE 1: Buscar profissional atual para obter profile_id
    const profissionalAtual = await this.getById(id);
    if (!profissionalAtual) {
      throw new Error('Profissional não encontrado');
    }
    const profileId = profissionalAtual.profile_id;
    console.log('[ProfissionalService] update() - profile_id:', profileId);

    // 🎯 OBTER SESSÃO: Token válido para Edge Function
    const { data: { session }, error: sessionError } = 
      await window.supabaseClient.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      console.error('[ProfissionalService] update() - Sessão não encontrada');
      throw new Error('Sessão não encontrada. Faça login novamente.');
    }

    // 🎯 CHAMADA EDGE FUNCTION: Update com service_role (bypass RLS)
    const result = await this.updateWithAuth(id, profileId, data, session.access_token);

    console.log('[ProfissionalService] update() - sucesso:', result);

    // 🎯 INVALIDAÇÃO DE CACHE
    this.core.invalidate(this.table);
    this.core.invalidate('profiles');

    return result;
  }

  /**
   * 🎯 Atualizar profissional via Edge Function (bypass RLS)
   */
  async updateWithAuth(profissionalId, profileId, data, accessToken) {
    this._assertCanAccessApp();

    return this.core.execute(
      'update-profissional',
      async () => {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/update-profissional`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            profissional_id: String(profissionalId),
            profile_id: profileId,
            especialidade: data.especialidade,
            status: data.status,
            nome: data.nome,
            email: data.email,
            telefone: data.telefone
          })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || error.message || `Edge Function Error: ${response.status}`);
        }

        const result = await response.json();
        return {
          id: result.profissional.id,
          profile_id: profileId,
          nome: result.profile?.nome || result.profissional.nome || data.nome,
          email: result.profile?.email || data.email,
          telefone: result.profile?.telefone || data.telefone,
          especialidade: result.profissional.especialidade,
          status: result.profissional.status
        };
      },
      {
        invalidate: ['profissionais', 'profiles']
      }
    );
  }

  /**
   * 🎯 OVERRIDE: Listar profissionais com dados de profiles
   * Faz duas queries separadas e junta os dados (evita problema de JOIN no Supabase)
   */
  async list(options = {}) {
    console.log('[ProfissionalService] list() - fetching profissionais...');
    
    // 🎯 FILTRO POR EMPRESA: Adicionar empresa_id do usuário logado
    const empresaId = this._getCurrentUserEmpresaId();
    if (empresaId) {
      options.eq = options.eq || {};
      options.eq.empresa_id = empresaId;
      console.log('[ProfissionalService] list() - filtering by empresa_id:', empresaId);
    }
    
    // Query 1: Buscar profissionais
    const profissionais = await this.core.query(this.table, options);
    console.log('[ProfissionalService] list() - profissionais:', profissionais?.length || 0);
    
    if (!profissionais || profissionais.length === 0) {
      return [];
    }
    
    // Query 2: Buscar profiles (tabela auth do Supabase)
    console.log('[ProfissionalService] list() - fetching profiles...');
    let profiles = [];
    try {
      profiles = await this.core.query('profiles', {});
      console.log('[ProfissionalService] list() - profiles:', profiles?.length || 0);
    } catch (err) {
      console.warn('[ProfissionalService] list() - profiles query failed:', err.message);
    }
    
    // Criar mapa de profiles para lookup O(1)
    const profilesMap = {};
    if (profiles && profiles.length > 0) {
      profiles.forEach(profile => {
        profilesMap[profile.id] = profile;
      });
    }
    
    // Juntar dados: profissional + profile
    const resultado = profissionais.map(p => {
      const profile = profilesMap[p.profile_id] || {};
      return {
        id: p.id,
        profile_id: p.profile_id,
        nome: profile.nome || 'Sem nome',
        email: profile.email || 'Sem email',
        telefone: profile.telefone || 'Sem telefone',
        especialidade: p.especialidade || '',
        status: p.status || 'active'
      };
    });
    
    console.log('[ProfissionalService] list() - transformed:', resultado);
    return resultado;
  }

  /**
   * Criar profissional via Edge Function (com integração auth)
   */
  async createWithAuth(data, accessToken) {
    // 🎯 FASE 4: PROTEÇÃO CONTRA BYPASS DE PRIMEIRO LOGIN
    this._assertCanAccessApp();

    console.log('[ProfissionalService] createWithAuth() - URL:', `${SUPABASE_URL}/functions/v1/create-profissional`);
    console.log('[ProfissionalService] createWithAuth() - payload:', { nome: data.nome, email: data.email, telefone: data.telefone });

    return this.core.execute(
      'create-profissional',
      async () => {
        let response;
        try {
          response = await fetch(`${SUPABASE_URL}/functions/v1/create-profissional`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
              'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify(data)
          });
        } catch (networkError) {
          console.error('[ProfissionalService] createWithAuth() - Network error:', networkError);
          throw new Error('Erro de conexão com o servidor. Verifique sua internet.');
        }

        console.log('[ProfissionalService] createWithAuth() - response status:', response.status, response.statusText);

        let responseBody;
        const responseText = await response.text();
        console.log('[ProfissionalService] createWithAuth() - raw response:', responseText);

        try {
          responseBody = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
          console.error('[ProfissionalService] createWithAuth() - JSON parse error:', parseError);
          responseBody = { error: 'Resposta inválida do servidor', raw: responseText };
        }

        if (!response.ok) {
          console.error('[ProfissionalService] createWithAuth() - HTTP error:', response.status, responseBody);
          
          // Mapear erros específicos da Edge Function
          const errorMessage = responseBody?.error || `Erro ${response.status}: ${response.statusText}`;
          
          if (response.status === 401) {
            throw new Error('Sessão expirada. Faça login novamente.');
          }
          if (response.status === 403) {
            throw new Error('Você não tem permissão para criar profissionais.');
          }
          if (response.status === 400) {
            throw new Error(`Dados inválidos: ${errorMessage}`);
          }
          if (response.status === 409 || errorMessage.includes('Email já está registrado')) {
            throw new Error('Email já está registrado. Use um email diferente.');
          }
          if (response.status === 429 || errorMessage.includes('Limite')) {
            throw new Error('Limite de criação excedido. Tente novamente em alguns minutos.');
          }
          
          // Erro 500 - problema no servidor
          if (response.status === 500) {
            console.error('[ProfissionalService] ERRO 500 - Edge Function falhou. Verifique:');
            console.error('  1. Variáveis de ambiente no Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANON_KEY)');
            console.error('  2. Logs da Edge Function no dashboard do Supabase');
            console.error('  3. Se a Edge Function foi deployada: supabase functions deploy create-profissional');
            throw new Error(`Erro no servidor: ${errorMessage}. Contate o suporte.`);
          }

          throw new Error(errorMessage);
        }

        console.log('[ProfissionalService] createWithAuth() - success:', responseBody);
        return responseBody;
      },
      {
        invalidate: ['profissionais']
      }
    );
  }

  /**
   * Deletar profissional via Edge Function (com cascade delete)
   */
  async deleteWithCascade(id, accessToken) {
    // 🎯 FASE 4: PROTEÇÃO CONTRA BYPASS DE PRIMEIRO LOGIN
    this._assertCanAccessApp();

    return this.core.execute(
      'delete-profissional',
      async () => {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-profissional`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ id })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || `Edge Function Error: ${response.status}`);
        }

        return response.json();
      },
      {
        invalidate: ['profissionais']
      }
    );
  }

  /**
   * Reset de senha via Edge Function
   */
  async resetPassword(userId, novaSenha, adminId, accessToken) {
    return this.core.execute(
      'reset-password-admin',
      async () => {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/reset-password-admin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            admin_id: adminId,
            user_id: userId,
            new_password: novaSenha
          })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || `Edge Function Error: ${response.status}`);
        }

        return response.json();
      },
      {
        invalidate: [] // Não invalida cache de profissionais
      }
    );
  }
}
})();
