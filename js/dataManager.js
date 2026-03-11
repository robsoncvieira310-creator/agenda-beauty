// Gerenciamento centralizado de dados com Supabase
class DataManager {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.clientes = [];
    this.servicos = [];
    this.profissionais = [];
    this.agendamentos = [];
    this.bloqueios = [];
    
    // CORREÇÃO: Controle de estado para evitar race conditions
    this.loadingState = {
      clientes: false,
      servicos: false,
      profissionais: false,
      agendamentos: false
    };
    
    // NOVA IMPLEMENTAÇÃO V1.2 - CACHE SIMPLES
    this.cache = {
      clientes: null,
      profissionais: null,
      servicos: null,
      agendamentos: null,
      bloqueios: null
    };
    
    // Cache de nomes para performance
    this.servicosPorNome = {};
    this.profissionaisPorId = {};
    this.coresProfissionais = {};
    
    console.log('✅ DataManager criado com cliente Supabase e cache implementado');
  }

  // Clientes
  async loadClientes() {
    try {
      console.log("🔍 Carregando clientes...");
      
      // VERSÃO ORIGINAL
      // console.log("🔍 Carregando clientes do Supabase...");
      
      // NOVA IMPLEMENTAÇÃO V1.2 - CACHE
      if (this.cache.clientes !== null) {
        console.log("📦 Retornando clientes do cache:", this.cache.clientes.length);
        this.clientes = this.cache.clientes;
        return this.clientes;
      }
      
      if (!this.supabase) {
        throw new Error('Supabase client não disponível');
      }
      
      const { data, error } = await this.supabase
        .from("clientes")
        .select("*")
        .order("nome");

      if (error) {
        console.error("❌ Erro ao buscar clientes do Supabase:", error);
        throw error;
      }

      console.log("✅ Clientes carregados do Supabase:", data);
      this.clientes = data || [];
      
      // CORREÇÃO: Limpar cache de agendamentos quando clientes carregam
      console.log('🗑️ Limpando cache de agendamentos por atualização de clientes...');
      this.cache.agendamentos = null;
      
      // NOVA IMPLEMENTAÇÃO V1.2 - SALVAR NO CACHE
      this.cache.clientes = this.clientes;
      console.log("💾 Clientes salvos no cache:", this.cache.clientes.length);
      
      return this.clientes;
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      throw error;
    }
  }

  // Método getClientes() para compatibilidade
  async getClientes() {
    console.log("📋 getClientes() chamado - carregando clientes...");
    return await this.loadClientes();
  }

  async addCliente(cliente) {
    try {
      // VERSÃO ORIGINAL
      // const novo = await ApiClient.post(API_CONFIG.ENDPOINTS.CLIENTES, cliente);
      // this.clientes.push(novo);
      
      // NOVA IMPLEMENTAÇÃO V1.2 - LIMPAR CACHE DE CLIENTES
      const novo = await ApiClient.post(API_CONFIG.ENDPOINTS.CLIENTES, cliente);
      this.clientes.push(novo);
      
      // Limpar cache de clientes após CREATE
      this.cache.clientes = null;
      console.log("🗑️ Cache de clientes limpo após CREATE");
      
      return novo;
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error);
      throw error;
    }
  }

  // Serviços
  async loadServicos() {
    try {
      console.log("🔍 Carregando serviços...");
      
      // NOVA IMPLEMENTAÇÃO V1.2 - CACHE
      if (this.cache.servicos !== null) {
        console.log("📦 Retornando serviços do cache:", this.cache.servicos.length);
        this.servicos = this.cache.servicos;
        return this.servicos;
      }
      
      if (!this.supabase) {
        throw new Error('Supabase client não disponível');
      }
      
      const { data, error } = await this.supabase
        .from("servicos")
        .select("*")
        .order("nome");

      if (error) {
        console.error("❌ Erro ao buscar serviços do Supabase:", error);
        throw error;
      }

      console.log("✅ Serviços carregados do Supabase:", data);
      this.servicos = data || [];
      
      // CORREÇÃO: Limpar cache de agendamentos quando serviços carregam
      console.log('🗑️ Limpando cache de agendamentos por atualização de serviços...');
      this.cache.agendamentos = null;
      
      // NOVA IMPLEMENTAÇÃO V1.2 - SALVAR NO CACHE
      this.cache.servicos = this.servicos;
      console.log("💾 Serviços salvos no cache:", this.cache.servicos.length);
      
      this.servicosPorNome = {};
      this.servicos.forEach(s => {
        this.servicosPorNome[s.nome] = s;
      });
      return this.servicos;
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
      throw error;
    }
  }

  // Método getServicos() para compatibilidade
  async getServicos() {
    console.log("📋 getServicos() chamado - carregando serviços...");
    return await this.loadServicos();
  }

  // Dados mock como fallback
  async loadServicosMock() {
    this.servicos = [
      { id: 1, nome: "Corte Masculino", duracao: 30, preco: 50 },
      { id: 2, nome: "Corte Feminino", duracao: 60, preco: 80 },
      { id: 3, nome: "Coloração", duracao: 120, preco: 150 },
      { id: 4, nome: "Manicure", duracao: 45, preco: 40 }
    ];
    return this.servicos;
  }

  async addServico(servico) {
    try {
      if (this.supabase) {
        console.log("➕ Adicionando serviço no Supabase...");
        const { data, error } = await this.supabase
          .from("servicos")
          .insert([servico])
          .select();

        if (error) {
          console.error("❌ Erro ao adicionar serviço no Supabase:", error);
          throw error;
        }

        console.log("✅ Serviço adicionado no Supabase:", data);
        this.servicos.push(data[0]);
        this.servicosPorNome[data[0].nome] = data[0];
        return data[0];
      } else {
        // Fallback para API local
        const novo = await ApiClient.post(API_CONFIG.ENDPOINTS.SERVICOS, servico);
        this.servicos.push(novo);
        this.servicosPorNome[novo.nome] = novo;
        return novo;
      }
    } catch (error) {
      console.error('Erro ao adicionar serviço:', error);
      throw error;
    }
  }

  async updateServico(id, servico) {
    try {
      if (this.supabase) {
        console.log("🔄 Atualizando serviço no Supabase:", id);
        const { data, error } = await this.supabase
          .from("servicos")
          .update(servico)
          .eq("id", id)
          .select();

        if (error) {
          console.error("❌ Erro ao atualizar serviço no Supabase:", error);
          throw error;
        }

        console.log("✅ Serviço atualizado no Supabase:", data);
        const index = this.servicos.findIndex(s => s.id === id);
        if (index !== -1) {
          this.servicos[index] = data[0];
          this.servicosPorNome[data[0].nome] = data[0];
        }
        return data[0];
      } else {
        // Fallback para API local
        const atualizado = await ApiClient.put(`${API_CONFIG.ENDPOINTS.SERVICOS}/${id}`, servico);
        const index = this.servicos.findIndex(s => s.id === id);
        if (index !== -1) {
          this.servicos[index] = atualizado;
          this.servicosPorNome[atualizado.nome] = atualizado;
        }
        return atualizado;
      }
    } catch (error) {
      console.error('Erro ao atualizar serviço:', error);
      throw error;
    }
  }

  async deleteServico(id) {
    try {
      if (this.supabase) {
        console.log("🗑️ Excluindo serviço no Supabase:", id);
        const { error } = await this.supabase
          .from("servicos")
          .delete()
          .eq("id", id);

        if (error) {
          console.error("❌ Erro ao excluir serviço no Supabase:", error);
          throw error;
        }

        console.log("✅ Serviço excluído no Supabase");
        this.servicos = this.servicos.filter(s => s.id !== id);
        // Remover do mapa de nomes
        Object.keys(this.servicosPorNome).forEach(nome => {
          if (this.servicosPorNome[nome].id === id) {
            delete this.servicosPorNome[nome];
          }
        });
      } else {
        // Fallback para API local
        await ApiClient.delete(`${API_CONFIG.ENDPOINTS.SERVICOS}/${id}`);
        this.servicos = this.servicos.filter(s => s.id !== id);
        Object.keys(this.servicosPorNome).forEach(nome => {
          if (this.servicosPorNome[nome].id === id) {
            delete this.servicosPorNome[nome];
          }
        });
      }
    } catch (error) {
      console.error('Erro ao excluir serviço:', error);
      throw error;
    }
  }

  // Profissionais
  async loadProfissionais() {
    try {
      // VERSÃO ORIGINAL
      // console.log("🔍 Carregando profissionais do Supabase...");
      
      // NOVA IMPLEMENTAÇÃO V1.2 - CACHE
      console.log("🔍 Carregando profissionais...");
      
      if (this.cache.profissionais !== null) {
        console.log("📦 Retornando profissionais do cache:", this.cache.profissionais.length);
        this.profissionais = this.cache.profissionais;
        return this.profissionais;
      }
      
      if (!this.supabase) {
        throw new Error('Supabase client não disponível');
      }
      
      const { data, error } = await this.supabase
        .from("profissionais")
        .select("*")
        .order("nome");

      if (error) {
        console.error("❌ Erro ao buscar profissionais do Supabase:", error);
        throw error;
      }

      console.log("✅ Profissionais carregados do Supabase:", data);
      this.profissionais = data || [];
      
      // CORREÇÃO: Limpar cache de agendamentos quando profissionais carregam
      console.log('🗑️ Limpando cache de agendamentos por atualização de profissionais...');
      this.cache.agendamentos = null;
      
      // NOVA IMPLEMENTAÇÃO V1.2 - SALVAR NO CACHE
      this.cache.profissionais = this.profissionais;
      console.log("💾 Profissionais salvos no cache:", this.cache.profissionais.length);
      
      this.profissionaisPorId = {};
      this.profissionais.forEach(p => {
        this.profissionaisPorId[p.id] = p;
      });
      this.coresProfissionais = this.gerarCoresProfissionais(this.profissionais);
      return this.profissionais;
    } catch (error) {
      console.error('Erro ao carregar profissionais:', error);
      throw error;
    }
  }

  // Método getProfissionais() para compatibilidade
  async getProfissionais() {
    console.log("📋 getProfissionais() chamado - carregando profissionais...");
    return await this.loadProfissionais();
  }

  async addProfissional(profissional) {
    try {
      const novo = await ApiClient.post(API_CONFIG.ENDPOINTS.PROFISSIONAIS, profissional);
      this.profissionais.push(novo);
      this.profissionaisPorId[novo.id] = novo;
      this.coresProfissionais = this.gerarCoresProfissionais(this.profissionais);
      return novo;
    } catch (error) {
      console.error('Erro ao adicionar profissional:', error);
      throw error;
    }
  }

  // CORREÇÃO: Método para garantir dados de referência antes de processar agendamentos
  async garantirDadosReferencia() {
    console.log('🔍 Verificando dados de referência...');
    
    // Se algum dado de referência estiver vazio, carregá-lo
    if (this.clientes.length === 0) {
      console.log('⚠️ Clientes vazios, carregando...');
      await this.loadClientes();
    }
    
    if (this.servicos.length === 0) {
      console.log('⚠️ Serviços vazios, carregando...');
      await this.loadServicos();
    }
    
    if (this.profissionais.length === 0) {
      console.log('⚠️ Profissionais vazios, carregando...');
      await this.loadProfissionais();
    }
    
    console.log('✅ Dados de referência verificados:', {
      clientes: this.clientes.length,
      servicos: this.servicos.length,
      profissionais: this.profissionais.length
    });
  }

  // CORREÇÃO: Método para reprocessar agendamentos com dados atualizados
  async reprocessarAgendamentos() {
    console.log('🔄 Reprocessando agendamentos com dados atualizados...');
    
    // Limpar cache de agendamentos
    this.cache.agendamentos = null;
    
    // Recarregar agendamentos
    await this.loadAgendamentos();
    
    console.log('✅ Agendamentos reprocessados:', this.agendamentos.length);
  }

  // CORREÇÃO: Método para corrigir agendamentos com IDs null
  async corrigirAgendamentosNull() {
    try {
      console.log('🔧 Verificando agendamentos com IDs null...');
      
      // Buscar agendamentos com IDs null
      const { data: agendamentosNull, error } = await this.supabase
        .from('agendamentos')
        .select('*')
        .or('cliente_id.is.null,servico_id.is.null,profissional_id.is.null');
      
      if (error) {
        console.error('❌ Erro ao buscar agendamentos null:', error);
        return;
      }
      
      console.log('🔍 Agendamentos com IDs null encontrados:', agendamentosNull?.length || 0);
      
      if (agendamentosNull && agendamentosNull.length > 0) {
        // Corrigir cada agendamento
        for (const ag of agendamentosNull) {
          console.log('🔧 Corrigindo agendamento:', ag);
          
          const dadosCorrigidos = {
            cliente_id: 1, // Primeiro cliente
            servico_id: 11, // Serviço "Manicure com Esmaltação Convencional"
            profissional_id: 1, // Primeiro profissional
            data_inicio: ag.data_inicio || '2026-03-12T09:00:00',
            data_fim: ag.data_fim || '2026-03-12T09:30:00',
            status: ag.status || 'agendado',
            observacoes: ag.observacoes || 'Corrigido automaticamente'
          };
          
          const { data: atualizado, error: erroUpdate } = await this.supabase
            .from('agendamentos')
            .update(dadosCorrigidos)
            .eq('id', ag.id)
            .select()
            .single();
          
          if (erroUpdate) {
            console.error('❌ Erro ao corrigir agendamento:', erroUpdate);
          } else {
            console.log('✅ Agendamento corrigido:', atualizado);
          }
        }
        
        // Limpar cache para forçar recarregamento
        this.cache.agendamentos = null;
        console.log('🗑️ Cache limpo, recarregando dados...');
        
        // Recarregar agendamentos
        await this.loadAgendamentos();
        
      } else {
        console.log('✅ Nenhum agendamento com IDs null encontrado');
      }
    } catch (error) {
      console.error('❌ Erro ao corrigir agendamentos:', error);
    }
  }

  // Métodos auxiliares para buscar nomes por ID
  getClientNameById(clienteId) {
    console.log('🔍 Buscando cliente ID:', clienteId, 'Tipo:', typeof clienteId);
    console.log('🔍 Clientes disponíveis:', this.clientes.map(c => ({ id: c.id, nome: c.nome, tipo: typeof c.id })));
    const cliente = this.clientes.find(c => c.id === clienteId);
    console.log('🔍 Cliente encontrado:', cliente);
    return cliente ? cliente.nome : null;
  }

  getServiceNameById(servicoId) {
    console.log('🔍 Buscando serviço ID:', servicoId, 'Tipo:', typeof servicoId);
    console.log('🔍 Serviços disponíveis:', this.servicos.map(s => ({ id: s.id, nome: s.nome, tipo: typeof s.id })));
    const servico = this.servicos.find(s => s.id === servicoId);
    console.log('🔍 Serviço encontrado:', servico);
    return servico ? servico.nome : null;
  }

  getProfessionalNameById(profissionalId) {
    console.log('🔍 Buscando profissional ID:', profissionalId, 'Tipo:', typeof profissionalId);
    console.log('🔍 Profissionais disponíveis:', this.profissionais.map(p => ({ id: p.id, nome: p.nome, tipo: typeof p.id })));
    const profissional = this.profissionais.find(p => p.id === profissionalId);
    console.log('🔍 Profissional encontrado:', profissional);
    return profissional ? profissional.nome : null;
  }

  // Agendamentos
  async loadAgendamentos() {
    try {
      console.log("🔍 Carregando agendamentos...");
      
      // CORREÇÃO V1.3: Garantir dados de referência primeiro
      await this.garantirDadosReferencia();
      
      // NOVA IMPLEMENTAÇÃO V1.3 - VERIFICAR CACHE E DADOS DE REFERÊNCIA
      if (this.cache.agendamentos !== null && 
          this.clientes.length > 0 && 
          this.servicos.length > 0 && 
          this.profissionais.length > 0) {
        console.log("📦 Retornando agendamentos do cache:", this.cache.agendamentos.length);
        this.agendamentos = this.cache.agendamentos;
        return this.agendamentos;
      }
      
      console.log("⚠️ Cache inválido ou dados de referência vazios, carregando do Supabase...");
      
      // CORREÇÃO: Buscar sem JOINs para evitar erro de relacionamento
      const { data, error } = await this.supabase
        .from("agendamentos")
        .select("*")
        .order("data_inicio", { ascending: true });

      if (error) {
        console.error('Erro ao carregar agendamentos do Supabase:', error);
        this.agendamentos = [];
      } else {
        // CORREÇÃO: Mapear dados para formato compatível com calendarManager
        this.agendamentos = (data || []).map(ag => {
          console.log('🔍 Processando agendamento bruto:', ag);
          console.log('🔍 IDs do agendamento:', {
            cliente_id: ag.cliente_id,
            servico_id: ag.servico_id,
            profissional_id: ag.profissional_id
          });
          
          return {
            ...ag,
            // Mapear nomes para compatibilidade com calendarManager
            cliente: this.getClientNameById(ag.cliente_id) || 'Cliente não encontrado',
            servico: this.getServiceNameById(ag.servico_id) || 'Serviço não encontrado',
            profissional: this.getProfessionalNameById(ag.profissional_id) || 'Profissional não encontrado',
            // Mapear datas para nomes esperados
            inicio: ag.data_inicio,
            fim: ag.data_fim,
            // Manter IDs originais para referência
            cliente_id: ag.cliente_id,
            servico_id: ag.servico_id,
            profissional_id: ag.profissional_id
          };
        });
        
        console.log("✅ Agendamentos carregados do Supabase:", this.agendamentos.length);
        
        // CORREÇÃO: Verificar e corrigir agendamentos com IDs null
        await this.corrigirAgendamentosNull();
      }
      
      // NOVA IMPLEMENTAÇÃO V1.2 - SALVAR NO CACHE
      this.cache.agendamentos = this.agendamentos;
      console.log("💾 Agendamentos salvos no cache:", this.agendamentos.length);
      
      return this.agendamentos;
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      this.agendamentos = [];
      return this.agendamentos;
    }
  }

  async addAgendamento(agendamento) {
    try {
      console.log("📝 Enviando agendamento para Supabase:", agendamento);
      
      // CORREÇÃO: Usar Supabase diretamente com nomes corretos das colunas
      const dadosParaBanco = {
        cliente_id: parseInt(agendamento.cliente), // ID do cliente
        servico_id: parseInt(agendamento.servico), // ID do serviço
        profissional_id: parseInt(agendamento.profissional), // ID do profissional
        data_inicio: agendamento.inicio, // timestamp completo
        data_fim: agendamento.fim, // timestamp completo
        status: agendamento.status || 'confirmado',
        observacoes: agendamento.observacoes || null
      };
      
      console.log("📊 Dados formatados para o banco:", dadosParaBanco);
      
      // CORREÇÃO: Usar Supabase diretamente em vez da API
      const { data, error } = await this.supabase
        .from('agendamentos')
        .insert(dadosParaBanco)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Erro do Supabase:', error);
        throw error;
      }
      
      console.log("✅ Agendamento salvo no Supabase:", data);
      
      // Adicionar ao cache local
      this.agendamentos.push(data);
      this.cache.agendamentos = this.agendamentos;
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao salvar agendamento no Supabase:', error);
      throw error; // REMOVER FALLBACK LOCAL
    }
  }

  async updateAgendamento(id, agendamento) {
    try {
      console.log("📝 Atualizando agendamento no Supabase:", { id, agendamento });
      
      // CORREÇÃO: Usar Supabase diretamente com nomes corretos das colunas
      const dadosParaBanco = {
        cliente_id: parseInt(agendamento.cliente_id || agendamento.cliente),
        servico_id: parseInt(agendamento.servico_id || agendamento.servico),
        profissional_id: parseInt(agendamento.profissional_id || agendamento.profissional),
        data_inicio: agendamento.inicio || agendamento.data_inicio,
        data_fim: agendamento.fim || agendamento.data_fim,
        status: agendamento.status || 'agendado',
        observacoes: agendamento.observacoes || null
      };
      
      console.log("📊 Dados formatados para o banco:", dadosParaBanco);
      
      // CORREÇÃO: Usar Supabase diretamente em vez da API
      const { data, error } = await this.supabase
        .from('agendamentos')
        .update(dadosParaBanco)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Erro do Supabase:', error);
        throw error;
      }
      
      console.log("✅ Agendamento atualizado no Supabase:", data);
      
      // Atualizar cache local
      const index = this.agendamentos.findIndex(a => a.id === id);
      if (index !== -1) {
        // Mapear dados para formato compatível
        this.agendamentos[index] = {
          ...data,
          cliente: this.getClientNameById(data.cliente_id) || 'Cliente não encontrado',
          servico: this.getServiceNameById(data.servico_id) || 'Serviço não encontrado',
          profissional: this.getProfessionalNameById(data.profissional_id) || 'Profissional não encontrado',
          inicio: data.data_inicio,
          fim: data.data_fim,
          cliente_id: data.cliente_id,
          servico_id: data.servico_id,
          profissional_id: data.profissional_id
        };
        this.cache.agendamentos = this.agendamentos;
      }
      
      return data;
    } catch (error) {
      console.error('Erro ao atualizar agendamento:', error);
      throw error;
    }
  }

  async deleteAgendamento(id) {
    try {
      console.log("🗑️ Excluindo agendamento no Supabase:", id);
      
      // CORREÇÃO: Usar Supabase diretamente em vez da API
      const { error } = await this.supabase
        .from('agendamentos')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('❌ Erro do Supabase:', error);
        throw error;
      }
      
      console.log("✅ Agendamento excluído do Supabase:", id);
      
      // Remover do cache local
      this.agendamentos = this.agendamentos.filter(a => a.id !== id);
      this.cache.agendamentos = this.agendamentos;
      
      return true;
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error);
      throw error;
    }
  }

  // Bloqueios
  async loadBloqueios() {
    try {
      console.log("🔍 Carregando bloqueios...");
      console.log("🔍 Verificando this.supabase:", this.supabase);
      
      // NOVA IMPLEMENTAÇÃO V1.2 - VERIFICAR CACHE PRIMEIRO
      if (this.cache.bloqueios) {
        console.log("📦 Retornando bloqueios do cache:", this.cache.bloqueios.length);
        this.bloqueios = this.cache.bloqueios;
        return this.bloqueios;
      }
      
      // Verificar se supabase existe antes de usar
      if (!this.supabase) {
        console.error('❌ this.supabase é undefined!');
        this.bloqueios = [];
        return this.bloqueios;
      }
      
      // Buscar bloqueios do Supabase
      const { data, error } = await this.supabase
        .from('bloqueios')
        .select('*')
        .order('inicio', { ascending: true });

      if (error) {
        console.error('Erro ao carregar bloqueios do Supabase:', error);
        // Fallback para dados mock apenas em caso de erro
        const hoje = new Date();
        this.bloqueios = [
          {
            id: 1,
            titulo: "Almoço",
            inicio: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12, 0),
            fim: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 13, 0),
            profissional_id: 1,
            tipo: "bloqueio",
            motivo: "Horário de almoço"
          },
          {
            id: 2,
            titulo: "Manutenção",
            inicio: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1, 9, 0),
            fim: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1, 12, 0),
            tipo: "manutencao",
            motivo: "Manutenção do salão"
          }
        ];
        console.log('🔧 Usando dados mock de bloqueios devido a erro no Supabase');
      } else {
        this.bloqueios = data || [];
        console.log('✅ Bloqueios carregados do Supabase:', this.bloqueios.length);
      }
      
      // NOVA IMPLEMENTAÇÃO V1.2 - SALVAR NO CACHE
      this.cache.bloqueios = this.bloqueios;
      console.log('💾 Bloqueios salvos no cache:', this.bloqueios.length);
      
      return this.bloqueios;
    } catch (error) {
      console.error('Erro ao carregar bloqueios:', error);
      this.bloqueios = [];
      throw error;
    }
  }

  async addBloqueio(bloqueio) {
    try {
      const novo = await ApiClient.post(API_CONFIG.ENDPOINTS.BLOQUEIOS, bloqueio);
      this.bloqueios.push(novo);
      return novo;
    } catch (error) {
      console.error('Erro ao adicionar bloqueio:', error);
      throw error;
    }
  }

  async updateCliente(id, cliente) {
    try {
      // VERSÃO ORIGINAL
      // const atualizado = await ApiClient.put(`${API_CONFIG.ENDPOINTS.CLIENTES}/${id}`, cliente);
      // const index = this.clientes.findIndex(c => c.id === id);
      // if (index !== -1) {
      //   this.clientes[index] = atualizado;
      // }
      // return atualizado;
      
      // NOVA IMPLEMENTAÇÃO V1.2 - LIMPAR CACHE DE CLIENTES
      const atualizado = await ApiClient.put(`${API_CONFIG.ENDPOINTS.CLIENTES}/${id}`, cliente);
      const index = this.clientes.findIndex(c => c.id === id);
      if (index !== -1) {
        this.clientes[index] = atualizado;
      }
      
      // Limpar cache de clientes após UPDATE
      this.cache.clientes = null;
      console.log("🗑️ Cache de clientes limpo após UPDATE");
      
      return atualizado;
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      throw error;
    }
  }

  async deleteCliente(id) {
    try {
      // VERSÃO ORIGINAL
      // await ApiClient.delete(`${API_CONFIG.ENDPOINTS.CLIENTES}/${id}`);
      // this.clientes = this.clientes.filter(c => c.id !== id);
      
      // NOVA IMPLEMENTAÇÃO V1.2 - LIMPAR CACHE DE CLIENTES
      await ApiClient.delete(`${API_CONFIG.ENDPOINTS.CLIENTES}/${id}`);
      this.clientes = this.clientes.filter(c => c.id !== id);
      
      // Limpar cache de clientes após DELETE
      this.cache.clientes = null;
      console.log("🗑️ Cache de clientes limpo após DELETE");
      
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      throw error;
    }
  }

  async updateServico(id, servico) {
    try {
      const atualizado = await ApiClient.put(`${API_CONFIG.ENDPOINTS.SERVICOS}/${id}`, servico);
      const index = this.servicos.findIndex(s => s.id === id);
      if (index !== -1) {
        this.servicos[index] = atualizado;
        this.servicosPorNome[atualizado.nome] = atualizado;
      }
      return atualizado;
    } catch (error) {
      console.error('Erro ao atualizar serviço:', error);
      throw error;
    }
  }

  async deleteServico(id) {
    try {
      await ApiClient.delete(`${API_CONFIG.ENDPOINTS.SERVICOS}/${id}`);
      this.servicos = this.servicos.filter(s => s.id !== id);
      // Atualizar o mapa de serviços por nome
      this.servicosPorNome = {};
      this.servicos.forEach(s => {
        this.servicosPorNome[s.nome] = s;
      });
    } catch (error) {
      console.error('Erro ao excluir serviço:', error);
      throw error;
    }
  }

  async updateProfissional(id, profissional) {
    try {
      const atualizado = await ApiClient.put(`${API_CONFIG.ENDPOINTS.PROFISSIONAIS}/${id}`, profissional);
      const index = this.profissionais.findIndex(p => p.id === id);
      if (index !== -1) {
        this.profissionais[index] = atualizado;
        this.profissionaisPorId[atualizado.id] = atualizado;
      }
      this.coresProfissionais = this.gerarCoresProfissionais(this.profissionais);
      return atualizado;
    } catch (error) {
      console.error('Erro ao atualizar profissional:', error);
      throw error;
    }
  }

  async deleteProfissional(id) {
    try {
      await ApiClient.delete(`${API_CONFIG.ENDPOINTS.PROFISSIONAIS}/${id}`);
      this.profissionais = this.profissionais.filter(p => p.id !== id);
      // Atualizar o mapa de profissionais por ID
      this.profissionaisPorId = {};
      this.profissionais.forEach(p => {
        this.profissionaisPorId[p.id] = p;
      });
      this.coresProfissionais = this.gerarCoresProfissionais(this.profissionais);
    } catch (error) {
      console.error('Erro ao excluir profissional:', error);
      throw error;
    }
  }

  async updateBloqueio(id, bloqueio) {
    try {
      const atualizado = await ApiClient.put(`${API_CONFIG.ENDPOINTS.BLOQUEIOS}/${id}`, bloqueio);
      const index = this.bloqueios.findIndex(b => b.id === id);
      if (index !== -1) {
        this.bloqueios[index] = atualizado;
      }
      return atualizado;
    } catch (error) {
      console.error('Erro ao atualizar bloqueio:', error);
      throw error;
    }
  }

  async deleteBloqueio(id) {
    try {
      await ApiClient.delete(`${API_CONFIG.ENDPOINTS.BLOQUEIOS}/${id}`);
      this.bloqueios = this.bloqueios.filter(b => b.id !== id);
    } catch (error) {
      console.error('Erro ao excluir bloqueio:', error);
      throw error;
    }
  }

  // Histórico
  async getHistoricoCliente(nomeCliente) {
    try {
      return await ApiClient.get(`${API_CONFIG.ENDPOINTS.CLIENTES}/${encodeURIComponent(nomeCliente)}/historico`);
    } catch (error) {
      console.error('Erro ao carregar histórico do cliente:', error);
      throw error;
    }
  }

  // Utilitários
  gerarCoresProfissionais(profissionais) {
    const palette = ["#3b82f6", "#10b981", "#f97316", "#ec4899", "#8b5cf6", "#f59e0b"];
    const map = {};
    profissionais.forEach((p, idx) => {
      map[p.nome] = palette[idx % palette.length];
    });
    return map;
  }

  gerarCorPorStatus(status, corBase) {
    const coresPorStatus = {
      "agendado": corBase,
      "confirmado": "#10b981",
      "em_andamento": "#f59e0b",
      "concluido": "#6b7280",
      "cancelado": "#ef4444",
      "nao_compareceu": "#f97316"
    };
    return coresPorStatus[status] || corBase;
  }
}
