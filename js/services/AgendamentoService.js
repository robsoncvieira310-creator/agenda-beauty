// ================================
// AGENDAMENTO SERVICE - Camada de Domínio
// ================================
// Responsabilidade: lógica de negócio de agendamentos
// Regras: validações, filtros por tenant, composição de dados
//
// 🔧 Refatorado: herda de BaseService, aceita DataCore via DI

(function() {
// 🔒 VALIDAÇÃO DE DEPENDÊNCIAS CRÍTICAS
if (!window.BaseService) {
  throw new Error('[BOOTSTRAP FATAL] AgendamentoService: window.BaseService missing. Ensure BaseService.js loads first.');
}

window.AgendamentoService = class AgendamentoService extends window.BaseService {
  constructor(core) {
    super(core, 'agendamentos');
  }

  // ================================
  // READ OPERATIONS (especializadas)
  // ================================

  async listByDate(startDate, endDate) {
    const data = await this.list({ order: { column: 'data_inicio', asc: true } });

    if (startDate && endDate) {
      return data.filter(item => {
        const itemDate = new Date(item.data_inicio);
        return itemDate >= startDate && itemDate <= endDate;
      });
    }

    return data;
  }

  async listByCliente(clienteId) {
    return this.list({
      eq: { cliente_id: clienteId },
      order: { column: 'data_inicio', asc: true }
    });
  }

  async getProximoAtendimento(clienteId, dataAtual) {
    const data = await this.core.query('agendamentos', {
      eq: { cliente_id: clienteId },
      gte: { data_inicio: dataAtual },
      order: { column: 'data_inicio', asc: true },
      limit: 1
    });
    return data[0] || null;
  }

  async getUltimoAtendimento(clienteId, dataAtual) {
    const data = await this.core.query('agendamentos', {
      eq: { cliente_id: clienteId },
      lt: { data_inicio: dataAtual },
      order: { column: 'data_inicio', asc: false },
      limit: 1
    });
    return data[0] || null;
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
        console.warn('[AgendamentoService] _getCurrentUserEmpresaId: No user found');
        return null;
      }

      // Admin não filtra por empresa
      const role = user.app_metadata?.role || user.user_metadata?.role;
      if (role === 'admin') {
        console.log('[AgendamentoService] _getCurrentUserEmpresaId: Admin user - no filter');
        return null;
      }

      // Para adm_empresa, retornar empresa_id
      const empresaId = user.app_metadata?.empresa_id || user.user_metadata?.empresa_id;
      
      console.log('[AgendamentoService] _getCurrentUserEmpresaId:', {
        userId: user.id,
        role,
        empresaId
      });

      return empresaId;
    } catch (e) {
      console.error('[AgendamentoService] _getCurrentUserEmpresaId error:', e);
      return null;
    }
  }

  /**
   * 🔍 OVERRIDE: Criar agendamento com empresa_id do usuário logado
   */
  async create(data) {
    this._assertCanAccessApp();
    
    // Adicionar empresa_id do usuário logado
    const empresaId = this._getCurrentUserEmpresaId();
    if (empresaId) {
      data.empresa_id = empresaId;
      console.log('[AgendamentoService] create() - adicionando empresa_id:', empresaId);
    }
    
    this._validate(data);
    const result = await this.core.insert(this.table, data);
    this.core.invalidate(this.table);
    return result;
  }

  /**
   * 🔍 OVERRIDE: Listar agendamentos com filtro por empresa_id
   */
  async list(options = {}) {
    this._assertCanAccessApp();
    
    // Adicionar filtro por empresa_id do usuário logado
    const empresaId = this._getCurrentUserEmpresaId();
    if (empresaId) {
      options.eq = options.eq || {};
      options.eq.empresa_id = empresaId;
      console.log('[AgendamentoService] list() - filtering by empresa_id:', empresaId);
    }
    
    return this.core.query(this.table, options);
  }

  // ================================
  // DOMAIN VALIDATION
  // ================================

  _validate(payload, isUpdate = false) {
    const errors = [];

    if (!isUpdate || payload.cliente_id !== undefined) {
      if (!payload.cliente_id) errors.push('cliente_id é obrigatório');
    }

    if (!isUpdate || payload.profissional_id !== undefined) {
      if (!payload.profissional_id) errors.push('profissional_id é obrigatório');
    }

    if (!isUpdate || payload.servico_id !== undefined) {
      if (!payload.servico_id) errors.push('servico_id é obrigatório');
    }

    if (!isUpdate || payload.data_inicio !== undefined) {
      if (!payload.data_inicio) errors.push('data_inicio é obrigatório');
    }

    if (!isUpdate || payload.data_fim !== undefined) {
      if (!payload.data_fim) errors.push('data_fim é obrigatório');
    }

    // Validar empresa_id para não-admin
    if (!isUpdate || payload.empresa_id !== undefined) {
      const empresaId = this._getCurrentUserEmpresaId();
      if (empresaId && !payload.empresa_id) {
        errors.push('empresa_id é obrigatório para usuários não-admin');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Validação falhou: ${errors.join(', ')}`);
    }
  }
}
})();

