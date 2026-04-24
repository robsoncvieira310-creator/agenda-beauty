(function() {
// 🔒 VALIDAÇÃO DE DEPENDÊNCIAS CRÍTICAS
if (!window.BaseService) {
  throw new Error('[BOOTSTRAP FATAL] ClienteService: window.BaseService missing. Ensure BaseService.js loads first.');
}

window.ClienteService = class ClienteService extends window.BaseService {
  constructor(core) {
    super(core, 'clientes');
  }

  // =========================
  // LEITURA (DOMÍNIO)
  // =========================

  async getClientesOrdenados() {
    return this.core.query(this.table, {
      order: { column: 'nome', asc: true }
    });
  }

  async buscarPorNome(nome) {
    if (!nome || nome.length < 2) {
      return [];
    }

    const clientes = await this.list();
    return clientes.filter(c =>
      c.nome.toLowerCase().includes(nome.toLowerCase())
    );
  }

  async getClientePorId(id) {
    if (!id) throw new Error('ID é obrigatório');

    const result = await this.core.query(this.table, {
      eq: { id },
      limit: 1
    });

    return result?.[0] || null;
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
        console.warn('[ClienteService] _getCurrentUserEmpresaId: No user found');
        return null;
      }

      // Admin não filtra por empresa
      const role = user.app_metadata?.role || user.user_metadata?.role;
      if (role === 'admin') {
        console.log('[ClienteService] _getCurrentUserEmpresaId: Admin user - no filter');
        return null;
      }

      // Para adm_empresa, retornar empresa_id
      const empresaId = user.app_metadata?.empresa_id || user.user_metadata?.empresa_id;
      
      console.log('[ClienteService] _getCurrentUserEmpresaId:', {
        userId: user.id,
        role,
        empresaId
      });

      return empresaId;
    } catch (e) {
      console.error('[ClienteService] _getCurrentUserEmpresaId error:', e);
      return null;
    }
  }

  /**
   * 🔍 OVERRIDE: Criar cliente com empresa_id do usuário logado
   */
  async create(data) {
    this._assertCanAccessApp();
    
    // Adicionar empresa_id do usuário logado
    const empresaId = this._getCurrentUserEmpresaId();
    if (empresaId) {
      data.empresa_id = empresaId;
      console.log('[ClienteService] create() - adicionando empresa_id:', empresaId);
    }
    
    this._validate(data);
    const result = await this.core.insert(this.table, data);
    this.core.invalidate(this.table);
    return result;
  }

  /**
   * 🔍 OVERRIDE: Listar clientes com filtro por empresa_id
   */
  async list(options = {}) {
    this._assertCanAccessApp();
    
    // Adicionar filtro por empresa_id do usuário logado
    const empresaId = this._getCurrentUserEmpresaId();
    if (empresaId) {
      options.eq = options.eq || {};
      options.eq.empresa_id = empresaId;
      console.log('[ClienteService] list() - filtering by empresa_id:', empresaId);
    }
    
    return this.core.query(this.table, options);
  }

  // =========================
  // ESCRITA (DOMÍNIO)
  // =========================

  async criarCliente(dados) {
    this._validarCliente(dados);

    const payload = {
      nome: dados.nome.trim(),
      telefone: dados.telefone?.trim() || null,
      email: dados.email?.trim().toLowerCase() || null,
      created_at: new Date().toISOString()
    };

    const result = await this.create(payload);

    return result;
  }

  async atualizarCliente(id, dados) {
    if (!id) throw new Error('ID é obrigatório');

    this._validarCliente(dados, true);

    const payload = {
      nome: dados.nome?.trim(),
      telefone: dados.telefone?.trim(),
      email: dados.email?.toLowerCase()
    };

    const result = await this.update(id, payload);

    return result;
  }

  // =========================
  // REGRAS DE DOMÍNIO
  // =========================

  _validarCliente(dados, isUpdate = false) {
    if (!dados) throw new Error('Dados obrigatórios');

    if (!isUpdate || dados.nome !== undefined) {
      if (!dados.nome || dados.nome.trim().length < 2) {
        throw new Error('Nome inválido');
      }
    }

    if (dados.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(dados.email)) {
        throw new Error('Email inválido');
      }
    }

    // Validar empresa_id para não-admin
    if (!isUpdate || dados.empresa_id !== undefined) {
      const empresaId = this._getCurrentUserEmpresaId();
      if (empresaId && !dados.empresa_id) {
        throw new Error('empresa_id é obrigatório para usuários não-admin');
      }
    }
  }
}
})();