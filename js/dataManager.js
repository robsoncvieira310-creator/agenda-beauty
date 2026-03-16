// Gerenciamento centralizado de dados com Supabase
// DataManager - Gerenciamento de dados e cache
// VERSÃO: 1.3.3 - DIAGNÓSTICO DE SALVAMENTO
// CACHE-BREAKER: 20260312160500
console.log('💾 DataManager V1.3.3 carregado - Diagnóstico de salvamento');

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
    this.servicosPorId = {};
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
    console.log("getClientes() chamado - carregando clientes...");
    return await this.loadClientes();
  }

  async addCliente(cliente) {
    try {
      if (this.supabase) {
        // Gerar token único para ficha de anamnese
        const fichaToken = this.generateUniqueToken();
        
        // Apenas campos que existem na tabela clientes
        const clienteWithToken = {
          nome: cliente.nome,
          telefone: cliente.telefone,
          ficha_token: fichaToken
        };
        
        console.log("Criando cliente com token:", clienteWithToken);
        const { data, error } = await this.supabase
          .from("clientes")
          .insert([clienteWithToken])
          .select();

        if (error) {
          console.error("Erro ao criar cliente:", error);
          throw error;
        }

        console.log("Cliente criado:", data);
        
        // Limpar cache de clientes após CREATE
        this.cache.clientes = null;
        console.log("Cache de clientes limpo após CREATE");
        
        return data;
      } else {
        // Fallback para API local
        const novo = await ApiClient.post(API_CONFIG.ENDPOINTS.CLIENTES, cliente);
        this.clientes.push(novo);
        
        // Limpar cache de clientes após CREATE
        this.cache.clientes = null;
        console.log("🗑️ Cache de clientes limpo após CREATE");
        
        return novo;
      }
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error);
      throw error;
    }
  }

  async updateCliente(id, cliente) {
    try {
      if (this.supabase) {
        const { data, error } = await this.supabase
          .from("clientes")
          .update({ 
            nome: cliente.nome,
            telefone: cliente.telefone
          })
          .eq('id', id)
          .select();

        if (error) {
          console.error("Erro ao atualizar cliente:", error);
          throw error;
        }

        console.log("✅ Cliente atualizado:", data);
        
        // Limpar cache de clientes após UPDATE
        this.cache.clientes = null;
        console.log("🗑️ Cache de clientes limpo após UPDATE");
        
        return data;
      }
    } catch (error) {
      console.error("Erro ao atualizar cliente:", error);
      throw error;
    }
  }

  async deleteCliente(id) {
    try {
      if (this.supabase) {
        const { error } = await this.supabase
          .from("clientes")
          .delete()
          .eq('id', id);

        if (error) {
          console.error("Erro ao excluir cliente:", error);
          throw error;
        }

        console.log("✅ Cliente excluído com sucesso");
        
        // Limpar cache de clientes após DELETE
        this.cache.clientes = null;
        console.log("🗑️ Cache de clientes limpo após DELETE");
        
        return true;
      }
    } catch (error) {
      console.error("Erro ao excluir cliente:", error);
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
      this.servicosPorId = {};
      this.servicos.forEach(s => {
        this.servicosPorNome[s.nome] = s;
        this.servicosPorId[s.id] = s;
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
        this.servicosPorId[data[0].id] = data[0];
        return data[0];
      } else {
        // Fallback para API local
        const novo = await ApiClient.post(API_CONFIG.ENDPOINTS.SERVICOS, servico);
        this.servicos.push(novo);
        this.servicosPorNome[novo.nome] = novo;
        this.servicosPorId[novo.id] = novo;
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
          this.servicosPorId[data[0].id] = data[0];
        }
        return data[0];
      } else {
        // Fallback para API local
        const atualizado = await ApiClient.put(`${API_CONFIG.ENDPOINTS.SERVICOS}/${id}`, servico);
        const index = this.servicos.findIndex(s => s.id === id);
        if (index !== -1) {
          this.servicos[index] = atualizado;
          this.servicosPorNome[atualizado.nome] = atualizado;
          this.servicosPorId[atualizado.id] = atualizado;
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
        // Remover do mapa de IDs
        delete this.servicosPorId[id];
        // Limpar cache de serviços após exclusão
        this.cache.servicos = null;
      } else {
        // Fallback para API local
        await ApiClient.delete(`${API_CONFIG.ENDPOINTS.SERVICOS}/${id}`);
        this.servicos = this.servicos.filter(s => s.id !== id);
        Object.keys(this.servicosPorNome).forEach(nome => {
          if (this.servicosPorNome[nome].id === id) {
            delete this.servicosPorNome[nome];
          }
        });
        // Remover do mapa de IDs
        delete this.servicosPorId[id];
      }
    } catch (error) {
      console.error('Erro ao excluir serviço:', error);
      throw error;
    }
  }

  // Profissionais
  async loadProfissionais(forceReload = false) {
    try {
      // VERSÃO ORIGINAL
      // console.log("🔍 Carregando profissionais do Supabase...");
      
      // NOVA IMPLEMENTAÇÃO V1.2 - CACHE
      console.log("🔍 Carregando profissionais...", forceReload ? "(forçado)" : "(cache)");
      
      if (!forceReload && this.cache.profissionais !== null) {
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
  async getProfissionais(forceReload = false) {
    console.log("📋 getProfissionais() chamado - carregando profissionais...", forceReload ? "(forçado)" : "(cache)");
    return await this.loadProfissionais(forceReload);
  }

  // Função para verificar estrutura da tabela profissionais
  async verificarEstruturaProfissionais() {
    try {
      console.log('🔍 Verificando estrutura da tabela profissionais...');
      
      // Tentar obter a estrutura da tabela
      const { data, error } = await this.supabase
        .from("profissionais")
        .select("*")
        .limit(1);

      if (error) {
        console.error('❌ Erro ao verificar estrutura:', error);
        return false;
      }

      if (data && data.length > 0) {
        const exemplo = data[0];
        console.log('✅ Estrutura da tabela profissionais:', Object.keys(exemplo));
        console.log('📋 Exemplo de registro:', exemplo);
        
        // Verificar campos esperados - CAMPOS CORRIGIDOS CONFORME BANCO REAL
        const camposEsperados = ['id', 'nome', 'telefone', 'email', 'senha_hash', 'created_at', 'profile_id'];
        const camposExistentes = Object.keys(exemplo);
        
        const camposFaltando = camposEsperados.filter(campo => !camposExistentes.includes(campo));
        const camposExtras = camposExistentes.filter(campo => !camposEsperados.includes(campo));
        
        if (camposFaltando.length > 0) {
          console.warn('⚠️ Campos faltando na tabela:', camposFaltando);
        }
        
        if (camposExtras.length > 0) {
          console.info('ℹ️ Campos extras na tabela:', camposExtras);
        }
        
        console.log('✅ Verificação de estrutura concluída');
        return true;
      } else {
        console.log('ℹ️ Tabela profissionais vazia, mas estrutura OK');
        return true;
      }
    } catch (error) {
      console.error('Erro na verificação da estrutura:', error);
      return false;
    }
  }
        
  async addProfissional(profissional) {
    console.log('Adicionando profissional:', profissional);
    
    try {
      // Chamar Edge Function para criar profissional
      console.log('🔐 CHAMANDO EDGE FUNCTION: create-profissional...');
      
      const response = await fetch(`${this.supabase.supabaseUrl}/functions/v1/create-profissional`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.supabase.supabaseKey}`,
          'apikey': this.supabase.supabaseKey
        },
        body: JSON.stringify({
          nome: profissional.nome,
          telefone: profissional.telefone,
          email: profissional.email
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ ERRO NA EDGE FUNCTION:', errorData);
        
        // Tratar erro de email já existente
        if (response.status === 409 && errorData.code === 'EMAIL_ALREADY_EXISTS') {
          throw new Error('Este email já está registrado. Use um email diferente ou verifique se o profissional já existe.');
        }
        
        throw new Error(errorData.error || 'Erro ao criar profissional');
      }

      const result = await response.json();
      console.log('✅ PROFISSIONAL CRIADO COM SUCESSO:', result);

      // Atualizar cache e lista local
      this.profissionais.push(result.data.profissional);
      this.profissionaisPorId[result.data.profissional.id] = result.data.profissional;
      this.coresProfissionais = this.gerarCoresProfissionais(this.profissionais);
      
      // Limpar cache para forçar recarregamento
      this.cache.profissionais = null;
      
      return {
        ...result.data.profissional,
        message: result.message
      };
      
    } catch (error) {
      console.error('Erro ao adicionar profissional:', error);
      throw error;
    }
  }

  // Gerar senha temporária aleatória
  gerarSenhaTemporaria() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let senha = '';
    for (let i = 0; i < 12; i++) {
      senha += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return senha;
  }

  // Gerar cor aleatória
  gerarCorAleatoria() {
    const cores = ['#e91e63', '#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#795548'];
    return cores[Math.floor(Math.random() * cores.length)];
  }

  // MÉTODOS ANTIGOS REMOVIDOS - AGORA USA APENAS SUPABASE AUTH
// senha_hash, senha_criada, primeiro login foram removidos do fluxo

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
      
      // VALIDAÇÃO CRÍTICA
      if (!dadosParaBanco.cliente_id || isNaN(dadosParaBanco.cliente_id)) {
        console.error('❌ cliente_id inválido:', dadosParaBanco.cliente_id);
        throw new Error('cliente_id inválido');
      }
      if (!dadosParaBanco.servico_id || isNaN(dadosParaBanco.servico_id)) {
        console.error('❌ servico_id inválido:', dadosParaBanco.servico_id);
        throw new Error('servico_id inválido');
      }
      if (!dadosParaBanco.profissional_id || isNaN(dadosParaBanco.profissional_id)) {
        console.error('❌ profissional_id inválido:', dadosParaBanco.profissional_id);
        throw new Error('profissional_id inválido');
      }
      
      console.log('✅ Dados validados, enviando para Supabase...');
      
      // CORREÇÃO: Usar Supabase diretamente em vez da API
      const { data, error } = await this.supabase
        .from('agendamentos')
        .update(dadosParaBanco)
        .eq('id', id)
        .select()
        .single();
      
      console.log('📦 Resposta do Supabase:', { data, error });
      
      if (error) {
        console.error('❌ Erro do Supabase:', error);
        throw error;
      }
      
      console.log('✅ Agendamento atualizado no Supabase:', data);
      console.log('🔍 Verificação do que foi salvo:', {
        id: data.id,
        data_inicio_original: data.data_inicio,
        data_fim_original: data.data_fim,
        data_inicio_formatado: new Date(data.data_inicio).toLocaleString(),
        data_fim_formatado: new Date(data.data_fim).toLocaleString()
      });
      
      // Limpar cache para forçar recarregamento
      this.cache.agendamentos = null;
      console.log('🗑️ Cache de agendamentos limpo');
      
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
        this.bloqueios = [];
        console.log('🔧 Nenhum bloqueio carregado devido a erro no Supabase');
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
      if (this.supabase) {
        console.log("🔄 Atualizando cliente no Supabase:", id);
        const { data, error } = await this.supabase
          .from("clientes")
          .update(cliente)
          .eq("id", id)
          .select();

        if (error) {
          console.error("❌ Erro ao atualizar cliente no Supabase:", error);
          throw error;
        }

        console.log("✅ Cliente atualizado no Supabase:", data);
        const index = this.clientes.findIndex(c => c.id === id);
        if (index !== -1) {
          this.clientes[index] = data[0];
        }
        
        // Limpar cache de clientes após UPDATE
        this.cache.clientes = null;
        console.log("🗑️ Cache de clientes limpo após UPDATE");
        
        return data[0];
      } else {
        // Fallback para API local
        const atualizado = await ApiClient.put(`${API_CONFIG.ENDPOINTS.CLIENTES}/${id}`, cliente);
        const index = this.clientes.findIndex(c => c.id === id);
        if (index !== -1) {
          this.clientes[index] = atualizado;
        }
        
        // Limpar cache de clientes após UPDATE
        this.cache.clientes = null;
        console.log("🗑️ Cache de clientes limpo após UPDATE");
        
        return atualizado;
      }
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      throw error;
    }
  }

  async deleteCliente(id) {
    try {
      if (this.supabase) {
        console.log("🗑️ Excluindo cliente no Supabase:", id);
        const { error } = await this.supabase
          .from("clientes")
          .delete()
          .eq("id", id);

        if (error) {
          console.error("❌ Erro ao excluir cliente no Supabase:", error);
          throw error;
        }

        console.log("✅ Cliente excluído no Supabase");
        this.clientes = this.clientes.filter(c => c.id !== id);
        
        // Limpar cache de clientes após DELETE
        this.cache.clientes = null;
        console.log("🗑️ Cache de clientes limpo após DELETE");
      } else {
        // Fallback para API local
        await ApiClient.delete(`${API_CONFIG.ENDPOINTS.CLIENTES}/${id}`);
        this.clientes = this.clientes.filter(c => c.id !== id);
        
        // Limpar cache de clientes após DELETE
        this.cache.clientes = null;
        console.log("🗑️ Cache de clientes limpo após DELETE");
      }
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      throw error;
    }
  }

  async updateProfissional(id, profissional) {
    try {
      // Verificar estrutura antes de atualizar
      await this.verificarEstruturaProfissionais();
      
      console.log('📝 Atualizando profissional via Supabase:', { id, profissional });
      
      const { data, error } = await this.supabase
        .from("profissionais")
        .update(profissional)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao atualizar profissional no Supabase:', error);
        throw error;
      }

      console.log('✅ Profissional atualizado com sucesso:', data);
      
      // Atualizar cache e lista local
      const index = this.profissionais.findIndex(p => p.id === id);
      if (index !== -1) {
        this.profissionais[index] = data;
        this.profissionaisPorId[data.id] = data;
        this.coresProfissionais = this.gerarCoresProfissionais(this.profissionais);
      }
      
      // Limpar cache para forçar recarregamento
      this.cache.profissionais = null;
      
      return data;
    } catch (error) {
      console.error('Erro ao atualizar profissional:', error);
      throw error;
    }
  }

  async deleteProfissional(id) {
    try {
      // Verificar estrutura antes de excluir
      await this.verificarEstruturaProfissionais();
      
      console.log('🗑️ Excluindo profissional via Supabase:', id);
      const { error } = await this.supabase
        .from('profissionais')
        .delete()
        .eq('id', id);
        
      if (error) {
        throw error;
      }
      
      this.profissionais = this.profissionais.filter(p => p.id !== id);
      // Atualizar o mapa de profissionais por ID
      this.profissionaisPorId = {};
      this.profissionais.forEach(p => {
        this.profissionaisPorId[p.id] = p;
      });
      this.coresProfissionais = this.gerarCoresProfissionais(this.profissionais);
      
      // Limpar cache de profissionais para forçar recarregamento
      this.cache.profissionais = null;
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

  // Gerar token único para ficha de anamnese
  generateUniqueToken() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ficha_${timestamp}_${random}`;
  }

  // Buscar cliente por token da ficha
  async getClienteByToken(token) {
    try {
      console.log("🔍 Buscando cliente por token:", token);
      
      if (this.supabase) {
        const { data, error } = await this.supabase
          .from("clientes")
          .select("*")
          .eq("ficha_token", token)
          .single();

        if (error) {
          console.error("❌ Erro ao buscar cliente por token:", error);
          if (error.code === 'PGRST116') {
            return null; // Token não encontrado
          }
          throw error;
        }

        console.log("✅ Cliente encontrado por token:", data);
        return data;
      }
      
      return null;
    } catch (error) {
      console.error("❌ Erro ao buscar cliente por token:", error);
      throw error;
    }
  }

  // Salvar ficha de anamnese pública
  async savePublicAnamnese(token, anamneseData) {
    try {
      console.log("🔄 Salvando ficha pública:", { token, anamneseData });
      console.log("📋 Campos sendo salvos no banco:", Object.keys(anamneseData));
      console.log("📊 Valores dos campos:", anamneseData);
      
      // Primeiro, buscar o cliente pelo token
      const cliente = await this.getClienteByToken(token);
      if (!cliente) {
        throw new Error("Token inválido ou não encontrado");
      }
      
      // Verificar se já existe ficha para este cliente
      const existingAnamnese = await this.loadAnamneseByCliente(cliente.id);
      
      if (existingAnamnese) {
        // Atualizar ficha existente
        const { data, error } = await this.supabase
          .from("anamnese_clientes")
          .update(anamneseData)
          .eq("id", existingAnamnese.id)
          .select();

        if (error) {
          console.error("❌ Erro ao atualizar ficha pública:", error);
          throw error;
        }

        console.log("✅ Ficha pública atualizada com sucesso:", data);
        return { success: true, action: 'updated', data: data[0] };
      } else {
        // Criar nova ficha
        const anamneseWithClientId = {
          ...anamneseData,
          cliente_id: cliente.id
        };

        const { data, error } = await this.supabase
          .from("anamnese_clientes")
          .insert([anamneseWithClientId])
          .select();

        if (error) {
          console.error("❌ Erro ao criar ficha pública:", error);
          throw error;
        }

        console.log("✅ Ficha pública criada com sucesso:", data);
        return { success: true, action: 'created', data: data[0] };
      }
    } catch (error) {
      console.error("❌ Erro ao salvar ficha pública:", error);
      throw error;
    }
  }
  
  async loadAnamneseByCliente(clienteId) {
    try {
      console.log("🔍 Carregando anamnese do cliente:", clienteId);
      
      if (this.supabase) {
        // Tenta fazer uma consulta simples para ver se a tabela existe e quais colunas tem
        console.log("🔍 Tentando descobrir estrutura da tabela anamnese_clientes...");
        
        try {
          // Tentativa 1: Verificar se podemos consultar a tabela
          const { data: testData, error: testError } = await this.supabase
            .from("anamnese_clientes")
            .select("*")
            .limit(1);

          if (testError) {
            console.log("❌ Erro ao testar tabela:", testError);
            
            // Se o erro for de coluna não encontrada, a tabela existe mas com estrutura diferente
            if (testError.message?.includes('column') || testError.code === 'PGRST204') {
              console.log("📋 Tabela existe mas com estrutura diferente");
              console.log("📋 Erro específico:", testError.message);
              
              // Vamos tentar criar um registro mínimo para descobrir as colunas
              console.log("🔍 Tentando criar registro mínimo para descobrir colunas...");
              const minimalData = {
                cliente_id: clienteId,
                nome_completo: "Teste"
              };
              
              const { data: insertData, error: insertError } = await this.supabase
                .from("anamnese_clientes")
                .insert([minimalData])
                .select();
                
              if (insertError) {
                console.log("❌ Erro ao inserir registro teste:", insertError);
                if (insertError.message?.includes('column')) {
                  console.log("📋 Colunas mencionadas no erro:", insertError.message);
                }
              } else {
                console.log("✅ Registro teste criado:", insertData);
                console.log("📋 Colunas disponíveis:", insertData && insertData.length > 0 ? Object.keys(insertData[0]) : 'Nenhuma');
                
                // Limpar o registro de teste
                await this.supabase
                  .from("anamnese_clientes")
                  .delete()
                  .eq("id", insertData[0].id);
              }
            }
          } else {
            console.log("✅ Tabela acessível:", testData);
            console.log("📋 Colunas disponíveis:", testData && testData.length > 0 ? Object.keys(testData[0]) : 'Tabela vazia');
          }
        } catch (diagError) {
          console.log("❌ Erro no diagnóstico:", diagError);
        }

        // Continuar com a consulta original
        const { data, error } = await this.supabase
          .from("anamnese_clientes")
          .select("*")
          .eq("cliente_id", clienteId)
          .maybeSingle();

        if (error) {
          console.error("❌ Erro ao carregar anamnese:", error);
          // Se for erro de tabela não existir, retorna null
          if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
            console.log("📋 Tabela anamnese_clientes não encontrada");
            return null;
          }
          throw error;
        }

        console.log("✅ Anamnese carregada:", data);
        return data;
      }
      
      return null;
    } catch (error) {
      console.error("❌ Erro ao carregar anamnese:", error);
      // Se for erro de tabela não existir, retorna null
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        console.log("📋 Tabela anamnese_clientes não encontrada");
        return null;
      }
      throw error;
    }
  }

  async createAnamnese(anamnese) {
    try {
      if (this.supabase) {
        console.log("🔄 Criando anamnese no Supabase:", anamnese);
        
        // Se a tabela está vazia, vamos tentar descobrir a estrutura primeiro
        console.log("🔍 Tentando descobrir estrutura através de inserção controlada...");
        
        // Tentativa 1: Inserir apenas com campos básicos
        try {
          const basicData = {
            cliente_id: anamnese.cliente_id,
            nome_completo: anamnese.nome_completo || "Teste"
          };
          
          console.log("🔍 Testando inserção básica:", basicData);
          const { data: basicInsert, error: basicError } = await this.supabase
            .from("anamnese_clientes")
            .insert([basicData])
            .select();
            
          if (basicError) {
            console.log("❌ Erro na inserção básica:", basicError);
            throw basicError;
          } else {
            console.log("✅ Inserção básica funcionou:", basicInsert);
            console.log("📋 Estrutura descoberta:", basicInsert && basicInsert.length > 0 ? Object.keys(basicInsert[0]) : 'Nenhuma');
            
            // Limpar registro de teste
            await this.supabase
              .from("anamnese_clientes")
              .delete()
              .eq("id", basicInsert[0].id);
              
            // Agora tentar inserir com todos os campos, mas adaptando aos que existem
            return await this.insertWithKnownStructure(anamnese, basicInsert[0]);
          }
        } catch (discoverError) {
          console.log("❌ Erro ao descobrir estrutura:", discoverError);
          
          // Se falhar, vamos tentar uma abordagem mais agressiva
          console.log("🔍 Tentando abordagem alternativa...");
          return await this.alternativeInsert(anamnese);
        }
      }
    } catch (error) {
      console.error("❌ Erro ao criar anamnese:", error);
      throw error;
    }
  }

  async insertWithKnownStructure(anamnese, structure) {
    try {
      console.log("🔍 Inserindo com estrutura conhecida:", structure);
      
      // Adaptar dados apenas para colunas que existem
      const availableColumns = Object.keys(structure);
      console.log("📋 Colunas disponíveis:", availableColumns);
      
      const adaptedData = {};
      
      // Mapear campos do formulário para colunas disponíveis
      if (availableColumns.includes('cliente_id')) adaptedData.cliente_id = anamnese.cliente_id;
      if (availableColumns.includes('nome_completo')) adaptedData.nome_completo = anamnese.nome_completo;
      if (availableColumns.includes('idade')) adaptedData.idade = anamnese.idade;
      if (availableColumns.includes('ocupacao')) adaptedData.ocupacao = anamnese.ocupacao;
      if (availableColumns.includes('endereco')) adaptedData.endereco = anamnese.endereco;
      if (availableColumns.includes('cep')) adaptedData.cep = anamnese.cep;
      if (availableColumns.includes('cpf')) adaptedData.cpf = anamnese.cpf;
      
      // Adicionar campos booleanos se existirem
      const booleanFields = [
        'menor_idade', 'gestacao', 'diabetes', 'roe_unhas', 'unha_encravada',
        'alergia', 'cuticula', 'micose', 'medicamento', 'atividade_fisica',
        'piscina_praia', 'autorizacao'
      ];
      
      booleanFields.forEach(field => {
        if (availableColumns.includes(field)) {
          adaptedData[field] = anamnese[field] || false;
        }
      });
      
      // Adicionar campos de texto se existirem
      const textFields = ['responsavel', 'contato_responsavel', 'medicamentos', 'servico_escolhido'];
      textFields.forEach(field => {
        if (availableColumns.includes(field)) {
          adaptedData[field] = anamnese[field] || '';
        }
      });
      
      console.log("🔄 Dados adaptados:", adaptedData);
      
      const { data, error } = await this.supabase
        .from("anamnese_clientes")
        .insert([adaptedData])
        .select();

      if (error) {
        console.error("❌ Erro ao criar anamnese no Supabase:", error);
        throw error;
      }

      console.log("✅ Anamnese criada com sucesso:", data);
      return data;
    } catch (error) {
      console.error("❌ Erro ao inserir com estrutura conhecida:", error);
      throw error;
    }
  }

  async alternativeInsert(anamnese) {
    try {
      console.log("🔍 Tentando inserção alternativa mínima...");
      
      // Tentar inserção com apenas os campos essenciais
      const minimalData = {
        cliente_id: anamnese.cliente_id,
        nome_completo: anamnese.nome_completo
      };
      
      const { data, error } = await this.supabase
        .from("anamnese_clientes")
        .insert([minimalData])
        .select();

      if (error) {
        console.error("❌ Erro na inserção alternativa:", error);
        throw error;
      }

      console.log("✅ Inserção alternativa funcionou:", data);
      return data;
    } catch (error) {
      console.error("❌ Erro na inserção alternativa:", error);
      throw error;
    }
  }

  async updateAnamnese(id, anamnese) {
    try {
      if (this.supabase) {
        console.log("🔄 Atualizando anamnese no Supabase:", id);
        const { data, error } = await this.supabase
          .from("anamnese_clientes")
          .update(anamnese)
          .eq("id", id)
          .select();

        if (error) {
          console.error("❌ Erro ao atualizar anamnese no Supabase:", error);
          throw error;
        }

        console.log("✅ Anamnese atualizada no Supabase:", data);
        return data[0];
      } else {
        // Fallback para API local
        throw new Error("API local não implementada para anamnese");
      }
    } catch (error) {
      console.error('Erro ao atualizar anamnese:', error);
      throw error;
    }
  }
}
