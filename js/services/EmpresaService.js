(function() {
// 🔒 VALIDAÇÃO DE DEPENDÊNCIAS CRÍTICAS
if (!window.BaseService) {
  throw new Error('[BOOTSTRAP FATAL] EmpresaService: window.BaseService missing. Ensure BaseService.js loads first.');
}

const SUPABASE_URL = 'https://kckbcjjgbipcqzkynwpy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtja2JjampnYmlwY3F6a3lud3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0NDkzNTAsImV4cCI6MjA1MDAyNTM1MH0.VteI_8gRuD2q-6OKa373nc1j2-1qF_2A1aR0EJ1eFw8';

window.EmpresaService = class EmpresaService extends window.BaseService {
  constructor(core) {
    super(core, 'empresas');
  }

  /**
   * 🎯 OVERRIDE: Deletar empresa via Edge Function (cascata)
   * Exclui empresa e todos os dados vinculados (profissionais, clientes, servicos, etc.)
   */
  async delete(empresaId) {
    // 🎯 FASE 4: PROTEÇÃO CONTRA BYPASS DE PRIMEIRO LOGIN
    this._assertCanAccessApp();

    console.log('[EmpresaService] delete() - iniciando exclusão em cascata...');

    // 🎯 OBTER SESSÃO: Token válido para Edge Function
    const { data: { session }, error: sessionError } = 
      await window.supabaseClient.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      console.error('[EmpresaService] delete() - Sessão não encontrada');
      throw new Error('Sessão não encontrada. Faça login novamente.');
    }

    // 🎯 CHAMADA EDGE FUNCTION: Exclusão atômica em cascata
    const result = await this.deleteWithAuth(empresaId, session.access_token);

    console.log('[EmpresaService] delete() - sucesso:', result);

    // 🎯 INVALIDAÇÃO DE CACHE: Garantir listas atualizadas
    this.core.invalidate(this.table);
    this.core.invalidate('profiles');
    this.core.invalidate('profissionais');
    this.core.invalidate('clientes');
    this.core.invalidate('servicos');
    this.core.invalidate('agendamentos');

    return result;
  }

  /**
   * 🎯 Deletar empresa via Edge Function (com exclusão em cascata)
   * Segue exatamente o mesmo padrão de createWithAuth()
   */
  async deleteWithAuth(empresaId, accessToken) {
    // 🎯 FASE 4: PROTEÇÃO CONTRA BYPASS DE PRIMEIRO LOGIN
    this._assertCanAccessApp();

    return this.core.execute(
      'delete-empresa',
      async () => {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-empresa`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ empresa_id: empresaId })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || error.message || `Edge Function Error: ${response.status}`);
        }

        return response.json();
      },
      {
        invalidate: ['empresas', 'profiles', 'profissionais', 'clientes', 'servicos', 'agendamentos']
      }
    );
  }

  /**
   * 🎯 OVERRIDE: Criar empresa via Edge Function (auth + profile + empresa)
   * ATÔMICO: Ou cria tudo (auth user + profile + empresa) ou nada
   * 
   * @param {Object} data - { nome, email, password }
   * @returns {Promise<Object>} - { empresa_id, user_id, ... }
   */
  async create(data) {
    // 🎯 FASE 4: PROTEÇÃO CONTRA BYPASS DE PRIMEIRO LOGIN
    this._assertCanAccessApp();

    console.log('[EmpresaService] create() - iniciando criação atômica...');

    // 🎯 VALIDAÇÃO SÍNCRONA: Campos obrigatórios para criação completa
    if (!data.nome || !data.email || !data.password) {
      throw new Error('Campos obrigatórios: nome, email, password');
    }

    // 🎯 OBTER SESSÃO: Token válido para Edge Function
    const { data: { session }, error: sessionError } = 
      await window.supabaseClient.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      console.error('[EmpresaService] create() - Sessão não encontrada');
      throw new Error('Sessão não encontrada. Faça login novamente.');
    }

    console.log('[EmpresaService] create() - chamando Edge Function...');

    // 🎯 CHAMADA ATÔMICA: Edge Function cria auth + profile + empresa
    const result = await this.createWithAuth(data, session.access_token);

    console.log('[EmpresaService] create() - sucesso:', result);

    // 🎯 INVALIDAÇÃO DE CACHE: Garantir lista atualizada
    this.core.invalidate(this.table);
    this.core.invalidate('profiles');

    return result;
  }

  /**
   * 🎯 OVERRIDE: Atualizar empresa via Edge Function (bypass RLS)
   * Atualiza nome da empresa e email do admin via service_role
   */
  async update(id, data) {
    // 🎯 FASE 4: PROTEÇÃO CONTRA BYPASS DE PRIMEIRO LOGIN
    this._assertCanAccessApp();

    console.log('[EmpresaService] update() - id:', id, 'data:', JSON.stringify(data));

    // 🎯 OBTER SESSÃO: Token válido para Edge Function
    const { data: { session }, error: sessionError } = 
      await window.supabaseClient.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      console.error('[EmpresaService] update() - Sessão não encontrada');
      throw new Error('Sessão não encontrada. Faça login novamente.');
    }

    // 🎯 CHAMADA EDGE FUNCTION: Update com service_role (bypass RLS)
    const result = await this.updateWithAuth(id, data, session.access_token);

    console.log('[EmpresaService] update() - sucesso:', result);

    // 🎯 INVALIDAÇÃO DE CACHE
    this.core.invalidate(this.table);
    this.core.invalidate('profiles');

    return result;
  }

  /**
   * 🎯 Atualizar empresa via Edge Function (bypass RLS)
   */
  async updateWithAuth(empresaId, data, accessToken) {
    this._assertCanAccessApp();

    return this.core.execute(
      'update-empresa',
      async () => {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/update-empresa`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            empresa_id: empresaId,
            nome: data.nome,
            email: data.email
          })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || error.message || `Edge Function Error: ${response.status}`);
        }

        const result = await response.json();
        return {
          id: result.empresa.id,
          nome: result.empresa.nome,
          email: result.profile?.email,
          admin_id: result.profile?.id,
          admin_nome: result.profile?.nome,
          updated_at: result.empresa.updated_at
        };
      },
      {
        invalidate: ['empresas', 'profiles']
      }
    );
  }

  /**
   * 🎯 OVERRIDE: Listar empresas
   * Busca empresas com seus respectivos administradores
   */
  async list(options = {}) {
    console.log('[EmpresaService] list() - fetching empresas...');

    // Query 1: Buscar empresas
    const empresas = await this.core.query(this.table, options);
    console.log('[EmpresaService] list() - empresas:', empresas?.length || 0);

    if (!empresas || empresas.length === 0) {
      return [];
    }

    // Query 2: Buscar profiles adm_empresa
    console.log('[EmpresaService] list() - fetching profiles adm_empresa...');
    let profiles = [];
    try {
      profiles = await this.core.query('profiles', {
        eq: { role: 'adm_empresa' }
      });
      console.log('[EmpresaService] list() - profiles:', profiles?.length || 0);
    } catch (err) {
      console.warn('[EmpresaService] list() - profiles query failed:', err.message);
    }

    // Criar mapa de profiles por empresa_id
    const profilesByEmpresa = {};
    if (profiles && profiles.length > 0) {
      profiles.forEach(profile => {
        if (profile.empresa_id) {
          if (!profilesByEmpresa[profile.empresa_id]) {
            profilesByEmpresa[profile.empresa_id] = [];
          }
          profilesByEmpresa[profile.empresa_id].push(profile);
        }
      });
    }

    // Juntar dados: empresa + seus administradores
    const resultado = empresas.map(e => {
      const admins = profilesByEmpresa[e.id] || [];
      const admin = admins[0]; // Pega o primeiro admin (pode ser undefined)

      return {
        id: e.id,
        nome: e.nome,
        email: admin?.email,
        admin_id: admin?.id,
        admin_nome: admin?.nome,
        created_at: e.created_at,
        updated_at: e.updated_at
      };
    });

    console.log('[EmpresaService] list() - transformed:', resultado);
    return resultado;
  }

  /**
   * 🎯 Criar empresa via Edge Function (com integração auth)
   * Segue exatamente o mesmo padrão de ProfissionalService.createWithAuth()
   */
  async createWithAuth(data, accessToken) {
    // 🎯 FASE 4: PROTEÇÃO CONTRA BYPASS DE PRIMEIRO LOGIN
    this._assertCanAccessApp();

    return this.core.execute(
      'create-empresa',
      async () => {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/create-empresa`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || error.message || `Edge Function Error: ${response.status}`);
        }

        return response.json();
      },
      {
        invalidate: ['empresas']
      }
    );
  }

  /**
   * 🎯 Resetar senha de profissional da empresa via Edge Function
   * Permite que adm_empresa resete senha de profissionais da mesma empresa
   */
  async resetPassword(profissionalUserId, newPassword) {
    // 🎯 FASE 4: PROTEÇÃO CONTRA BYPASS DE PRIMEIRO LOGIN
    this._assertCanAccessApp();

    console.log('[EmpresaService] resetPassword() - user_id:', profissionalUserId);

    // 🎯 OBTER SESSÃO: Token válido para Edge Function
    const { data: { session }, error: sessionError } = 
      await window.supabaseClient.auth.getSession();
    
    if (sessionError || !session?.access_token || !session?.user?.id) {
      console.error('[EmpresaService] resetPassword() - Sessão não encontrada');
      throw new Error('Sessão não encontrada. Faça login novamente.');
    }

    // 🎯 CHAMADA EDGE FUNCTION
    const response = await fetch(`${SUPABASE_URL}/functions/v1/reset-password-empresa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        admin_id: session.user.id,
        user_id: profissionalUserId,
        new_password: newPassword
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || error.message || `Edge Function Error: ${response.status}`);
    }

    const result = await response.json();
    console.log('[EmpresaService] resetPassword() - sucesso:', result);

    return result;
  }
}
})();
