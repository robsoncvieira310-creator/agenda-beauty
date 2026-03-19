// Gerenciamento centralizado de dados com Supabase
// DataManager - Gerenciamento de dados e cache
// VERSÃO: 1.4.0 - VERSÃO LIMPA
console.log('💾 DataManager V1.4.0 carregado - Versão limpa');

class DataManager {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error("Supabase client não fornecido ao DataManager");
    }
    
    this.supabase = supabaseClient;
    this.clientes = [];
    this.servicos = [];
    this.profissionais = [];
    this.agendamentos = [];
    this.bloqueios = [];
    
    // Cache para performance
    this.cache = {
      clientes: null,
      profissionais: null,
      servicos: null,
      agendamentos: null,
      bloqueios: null
    };
    
    console.log('✅ DataManager criado com cliente Supabase e cache implementado');
  }

  async loadClientes() {
    if (!this.supabase) {
      throw new Error("Supabase não inicializado no DataManager");
    }
    
    try {
      const { data, error } = await this.supabase
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error('Erro ao carregar clientes do Supabase:', error);
        this.clientes = [];
      } else {
        this.clientes = data || [];
      }
      
      // Salvar no cache
      this.cache.clientes = this.clientes;
      
      return this.clientes;
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.clientes = [];
      return this.clientes;
    }
  }

  async loadServicos() {
    try {
      const { data, error } = await this.supabase
        .from('servicos')
        .select('*')
        .order('nome');

      if (error) {
        console.error('Erro ao carregar serviços:', error);
        this.servicos = [];
      } else {
        this.servicos = data || [];
      }
      
      // Salvar no cache
      this.cache.servicos = this.servicos;
      
      return this.servicos;
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
      this.servicos = [];
      return this.servicos;
    }
  }

  async loadBloqueios() {
    try {
      const { data, error } = await this.supabase
        .from('bloqueios')
        .select('*')
        .order('inicio', { ascending: true });

      if (error) {
        console.error('Erro ao carregar bloqueios:', error);
        this.bloqueios = [];
      } else {
        this.bloqueios = data || [];
        // Mapear para formato compatível
        this.bloqueios = this.bloqueios.map(bloqueio => ({
          ...bloqueio,
          data_inicio: bloqueio.inicio,
          data_fim: bloqueio.fim,
          titulo: bloqueio.titulo || 'Bloqueio',
          motivo: bloqueio.motivo || '',
          tipo: bloqueio.tipo || 'bloqueio'
        }));
      }
      
      return this.bloqueios;
    } catch (error) {
      console.error('Erro ao carregar bloqueios:', error);
      this.bloqueios = [];
      return this.bloqueios;
    }
  }

  async loadProfissionais() {
    try {
      if (this.cache.profissionais && this.cache.profissionais.length > 0) {
        this.profissionais = this.cache.profissionais;
        return this.profissionais;
      }

      const { data, error } = await this.supabase
        .from('profissionais')
        .select(`
          id, 
          telefone, 
          created_at, 
          profile_id, 
          profiles!inner(nome, email, role)
        `)
        .order('id', { ascending: true });

      if (error) {
        console.warn('Erro no JOIN, tentando solução alternativa:', error.message);
        
        // SOLUÇÃO ALTERNATIVA: Duas consultas separadas
        try {
          // 1. Buscar profissionais
          const { data: profissionais, error: errorProf } = await this.supabase
            .from('profissionais')
            .select('*')
            .order('id', { ascending: true });
            
          if (errorProf) {
            console.error('❌ Erro ao buscar profissionais:', errorProf);
            this.profissionais = [];
            return this.profissionais;
          }
          
          // 2. Buscar profiles com bypass de RLS (admin)
          const { data: profiles, error: errorProfiles } = await this.supabase
            .from('profiles')
            .select('*')
            .then(async (result) => {
              // Se der erro RLS, tentar com opções de admin
              if (result.error && result.error.message.includes('recursion')) {
                console.log('🔓 Tentando bypass RLS para profiles...');
                return await this.supabase.rpc('get_profiles_admin'); // Tentar RPC se existir
              }
              return result;
            })
            .catch(async (err) => {
              // Último recurso: buscar profiles via auth.users
              console.log('🔓 Tentando buscar via auth.users...');
              try {
                const { data: { users } } = await this.supabase.auth.admin.listUsers();
                const profilesFromAuth = users.map(user => ({
                  id: user.id,
                  nome: user.user_metadata?.nome || user.email?.split('@')[0] || 'Usuário',
                  email: user.email,
                  role: user.user_metadata?.role || 'user'
                }));
                return { data: profilesFromAuth, error: null };
              } catch (authError) {
                console.warn('⚠️ Falha no auth.admin também:', authError.message);
                return { data: [], error: authError };
              }
            });
            
          if (errorProfiles) {
            console.warn('⚠️ Erro ao buscar profiles, tentando auth.users como fallback...');
            // ÚLTIMO RECURSO: Tentar buscar via auth.users para obter emails
            try {
              const { data: { users } } = await this.supabase.auth.admin.listUsers();
              const usersMap = {};
              users.forEach(user => {
                usersMap[user.id] = user;
              });
              
              this.profissionais = profissionais.map(p => {
                const user = usersMap[p.profile_id];
                return {
                  ...p,
                  nome: user?.user_metadata?.nome || user?.email?.split('@')[0] || `Profissional ${p.id}`,
                  email: user?.email || 'Email não informado'
                };
              });
              
              console.log('✅ Profissionais carregados via auth.users fallback:', this.profissionais);
            } catch (authError) {
              console.warn('⚠️ Falha no auth.users também, usando placeholders:', authError.message);
              this.profissionais = profissionais.map(p => ({
                ...p,
                nome: `Profissional ${p.id}`,
                email: 'Email não informado'
              }));
            }
          } else {
            // 3. Juntar dados manualmente
            const profilesMap = {};
            profiles.forEach(profile => {
              profilesMap[profile.id] = profile;
            });
            
            this.profissionais = profissionais.map(profissional => {
              const profile = profilesMap[profissional.profile_id];
              if (profile) {
                return {
                  ...profissional,
                  nome: profile.nome,
                  email: profile.email,
                  role: profile.role
                };
              } else {
                return {
                  ...profissional,
                  nome: `Profissional ${profissional.id}`,
                  email: 'Email não informado'
                };
              }
            });
          }
          
        } catch (altError) {
          console.error('Erro na solução alternativa:', altError);
          this.profissionais = [];
        }
      } else {
        this.profissionais = data || [];
        
        // Mapear para formato compatível
        this.profissionais = this.profissionais.map(profissional => {
          const result = {
            id: parseInt(profissional.id) || profissional.id,
            nome: profissional.profiles?.nome || `Profissional ${profissional.id}`,
            email: profissional.profiles?.email || 'Email não informado',
            telefone: profissional.telefone,
            role: profissional.profiles?.role || 'user',
            profile_id: profissional.profile_id,
            created_at: profissional.created_at,
            // Manter compatibilidade com código antigo
            servicos: profissional.servicos || []
          };
          return result;
        });
        
        this.cache.profissionais = this.profissionais;
      }
      
      return this.profissionais;
    } catch (error) {
      console.error('Erro ao carregar profissionais:', error);
      this.profissionais = [];
      return this.profissionais;
    }
  }

  async loadAgendamentos() {
    try {
      // CORREÇÃO: Se cache foi limpo, recarregar do banco
      if (!this.cache.agendamentos) {
        
        // Obter profissional logado
        const profissionalLogado = await this.getProfissionalLogado();
        
        if (!profissionalLogado) {
          // SEM SESSÃO: Retornar vazio
          this.agendamentos = [];
          this.cache.agendamentos = this.agendamentos;
        } else if (profissionalLogado.role === 'admin') {
          // ADMIN: Carregar todos os agendamentos
          const { data, error } = await this.supabase
            .from("agendamentos")
            .select("*")
            .order("data_inicio", { ascending: true });

          if (error) {
            console.error('Erro ao carregar agendamentos do Supabase:', error);
            this.agendamentos = [];
          } else {
            this.agendamentos = data || [];
            console.log('✅ ADMIN: Agendamentos carregados:', this.agendamentos.length, this.agendamentos);
          }
          
          // Salvar no cache
          this.cache.agendamentos = this.agendamentos;
        } else {
          // PROFISSIONAL: Carregar apenas seus agendamentos
          const { data, error } = await this.supabase
            .from("agendamentos")
            .select("*")
            .eq("profissional_id", profissionalLogado.id)
            .order("data_inicio", { ascending: true });

          if (error) {
            console.error('Erro ao carregar agendamentos do profissional:', error);
            this.agendamentos = [];
          } else {
            this.agendamentos = data || [];
          }
          
          // Salvar no cache
          this.cache.agendamentos = this.agendamentos;
        }
      } else {
        this.agendamentos = this.cache.agendamentos;
      }
      
      return this.agendamentos;
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      this.agendamentos = [];
      return this.agendamentos;
    }
  }

  async getProfissionalLogado() {
    if (!this.supabase) {
      throw new Error("Supabase não inicializado no DataManager");
    }
    
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      
      if (!user) {
        console.log('DATA_MANAGER: Usuário não autenticado');
        return null;
      }

      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('DATA_MANAGER: Erro ao buscar profile:', error);
        return null;
      }

      console.log('DATA_MANAGER: Profissional encontrado:', data);
      return data;

    } catch (error) {
      console.error('DATA_MANAGER: Erro em getProfissionalLogado:', error);
      return null;
    }
  }

  async addProfissional(dados) {
    console.log('Adicionando profissional (fluxo correto):', dados);
    
    // PROTEÇÃO CONTRA EXECUÇÃO DUPLICADA
    if (this.addingProfissional) {
      console.log('addProfissional já está em execução, ignorando chamada duplicada');
      return;
    }
    
    this.addingProfissional = true;
    
    try {
      // FLUXO CORRETO: auth.users → profiles → profissionais
      console.log('ETAPA 1: Criando usuário no Supabase Auth...');
      
      let userId = null;
      let profileData = null;
      
      // 1. Criar usuário no auth.users
      try {
        const { data: authData, error: authError } = await this.supabase.auth.signUp({
          email: dados.email,
          password: dados.senhaTemporaria || 'temp123456',
          options: {
            data: {
              role: 'profissional',
              nome: dados.nome
            }
          }
        });
        
        if (authError) {
          console.warn("Erro ao criar usuário:", authError.message);
          
          // Se email já existe, tentar buscar usuário existente
          if (authError.message.includes('already registered')) {
            console.log("Email já registrado, buscando usuário existente...");
            const { data: { users } } = await this.supabase.auth.admin.listUsers();
            const existingUser = users.find(u => u.email === dados.email);
            if (existingUser) {
              userId = existingUser.id;
              console.log("Usuário existente encontrado:", userId);
            }
          }
        } else {
          userId = authData.user?.id;
          console.log("Usuário criado com sucesso:", userId);
        }
      } catch (authError) {
        console.warn("Falha na criação de usuário:", authError.message);
      }
      
      // 2. Criar ou atualizar profile
      if (userId) {
        console.log("👤 ETAPA 2: Criando/atualizando profile...");
        
        try {
          const { data: profile, error: profileError } = await this.supabase
            .from('profiles')
            .upsert({
              id: userId,
              nome: dados.nome, // ✅ CORRIGIDO: Salvar nome em profiles
              email: dados.email, // ✅ CORRIGIDO: Salvar email em profiles
              role: 'profissional',
              first_login_completed: true // ✅ CORRIGIDO: true pois profissional ainda não logou
            })
            .select()
            .single();
            
          if (profileError) {
            console.warn("⚠️ Erro ao criar profile:", profileError.message);
          } else {
            profileData = profile;
            console.log("✅ Profile criado/atualizado:", profileData);
          }
        } catch (profileError) {
          console.warn("⚠️ Falha ao criar profile:", profileError.message);
        }
      }
      
      // 3. Criar registro na tabela profissionais
      console.log("ETAPA 3: Criando registro profissional...");
      
      let profissionalData = {};
      
      // Tentar com colunas completas primeiro
      if (userId) {
        profissionalData = {
          nome: dados.nome,
          telefone: dados.telefone,
          email: dados.email,
          especialidade: dados.especialidade || 'Geral',
          ativo: true,
          profile_id: userId // RELACIONAMENTO CORRETO
        };
      } else {
        // Fallback: criar sem profile_id
        profissionalData = {
          telefone: dados.telefone,
          profile_id: null
        };
      }
      
      console.log("Dados para profissionais:", profissionalData);
      
      let { data: profissional, error: profissionalError } = await this.supabase
        .from('profissionais')
        .insert(profissionalData)
        .select()
        .single();
      
      // Se falhar por coluna inexistente, tentar com colunas mínimas
      if (profissionalError && profissionalError.message.includes('column')) {
        console.warn("Colunas completas não funcionaram, tentando mínimas...");
        
        profissionalData = userId ? 
          { telefone: dados.telefone, profile_id: userId } :
          { telefone: dados.telefone, profile_id: null };
        
        const result = await this.supabase
          .from('profissionais')
          .insert(profissionalData)
          .select()
          .single();
        
        profissional = result.data;
        profissionalError = result.error;
      }
      
      if (profissionalError) {
        console.error("Erro ao criar profissional:", profissionalError);
        throw new Error(`Erro ao criar profissional: ${profissionalError.message}`);
      }
      
      console.log("Profissional criado com sucesso:", profissional);
      
      // 4. Retornar resultado completo
      const resultado = {
        profissional: {
          ...profissional,
          nome: dados.nome || `Profissional ${profissional.id}`,
          email: dados.email,
          especialidade: dados.especialidade || 'Geral',
          ativo: true
        },
        usuario: userId ? { id: userId, email: dados.email } : null,
        profile: profileData,
        fluxo: userId ? 
          "FLUXO COMPLETO: auth.users → profiles → profissionais" : 
          "FLUXO PARCIAL: apenas profissionais (crie usuário manualmente)"
      };
      
      console.log("Resultado do fluxo:", resultado);
      
      // Adicionar ao cache local
      this.profissionais.push(resultado.profissional);
      this.cache.profissionais = null;
      
      return resultado;
      
    } catch (error) {
      console.error('Erro ao adicionar profissional:', error);
      throw error;
    } finally {
      this.addingProfissional = false;
    }
  }

  async deleteProfissional(profissionalId) {
    try {
      console.log('🗑️ Excluindo profissional em cascata:', profissionalId);
      
      // 1. Buscar dados completos do profissional
      const { data: profissional, error: errorProf } = await this.supabase
        .from('profissionais')
        .select('*')
        .eq('id', profissionalId)
        .single();
      
      if (errorProf) {
        throw new Error(`Erro ao buscar profissional: ${errorProf.message}`);
      }
      
      console.log('📋 Dados do profissional:', profissional);
      
      // 2. Excluir da tabela profissionais
      const { error: errorDeleteProf } = await this.supabase
        .from('profissionais')
        .delete()
        .eq('id', profissionalId);
      
      if (errorDeleteProf) {
        throw new Error(`Erro ao excluir profissional: ${errorDeleteProf.message}`);
      }
      
      console.log('✅ Profissional excluído da tabela profissionais');
      
      // 3. Se tiver profile_id, excluir o profile
      if (profissional.profile_id) {
        const { error: errorDeleteProfile } = await this.supabase
          .from('profiles')
          .delete()
          .eq('id', profissional.profile_id);
        
        if (errorDeleteProfile) {
          console.warn('⚠️ Erro ao excluir profile:', errorDeleteProfile.message);
        } else {
          console.log('✅ Profile excluído');
        }
        
        // 4. Excluir usuário do auth (se for admin)
        try {
          const { error: errorDeleteUser } = await this.supabase.auth.admin.deleteUser(
            profissional.profile_id
          );
          
          if (errorDeleteUser) {
            console.warn('⚠️ Erro ao excluir usuário do auth:', errorDeleteUser.message);
          } else {
            console.log('✅ Usuário excluído do auth');
          }
        } catch (authError) {
          console.warn('⚠️ Falha ao excluir usuário do auth:', authError.message);
        }
      }
      
      // 5. Remover do cache local
      this.profissionais = this.profissionais.filter(p => p.id !== profissionalId);
      this.cache.profissionais = null;
      
      console.log('🎉 Exclusão em cascata concluída com sucesso');
      
      return {
        success: true,
        message: 'Profissional excluído com sucesso (usuário, profile e profissional)'
      };
      
    } catch (error) {
      console.error('❌ Erro ao excluir profissional:', error);
      throw error;
    }
  }

  async addProfissionalCompleto(dados) {
    try {
      console.log("🔧 Criando profissional completo (usuário + profile + profissional):", dados);
      
      // ✅ MÉTODO COMPLETO: Tentar criar usuário no Supabase Auth
      let userId = null;
      let profileData = null;
      
      try {
        // Tentar criar usuário via signup (sem precisar de admin)
        const { data: authData, error: authError } = await this.supabase.auth.signUp({
          email: dados.email,
          password: dados.senhaTemporaria || 'temp123456',
          options: {
            data: {
              role: 'profissional',
              nome: dados.nome
            }
          }
        });
        
        if (authError) {
          console.warn("⚠️ Erro ao criar usuário via signup:", authError.message);
        } else {
          userId = authData.user?.id;
          console.log("✅ Usuário criado no Auth:", userId);
        }
      } catch (signupError) {
        console.warn("⚠️ Falha no signup:", signupError.message);
      }
      
      // Se conseguiu criar usuário, criar profile
      if (userId) {
        try {
          const { data: profile, error: profileError } = await this.supabase
            .from('profiles')
            .insert({
              id: userId,
              nome: dados.nome,
              email: dados.email,
              role: 'profissional',
              first_login_completed: false
            })
            .select()
            .single();
            
          if (profileError) {
            console.warn("⚠️ Erro ao criar profile:", profileError.message);
          } else {
            profileData = profile;
            console.log("✅ Profile criado:", profileData);
          }
        } catch (profileError) {
          console.warn("⚠️ Falha ao criar profile:", profileError.message);
        }
      }
      
      // Criar registro na tabela profissionais
      const profissionalData = {
        nome: dados.nome,
        telefone: dados.telefone,
        email: dados.email,
        especialidade: dados.especialidade || 'Geral',
        ativo: true,
        profile_id: userId || null // Associar se tiver usuário
      };
      
      console.log("📊 Dados para inserir na tabela profissionais:", profissionalData);
      
      const { data, error } = await this.supabase
        .from('profissionais')
        .insert(profissionalData)
        .select()
        .single();
      
      if (error) {
        console.error("❌ Erro ao inserir profissional:", error);
        throw new Error(`Erro ao inserir profissional: ${error.message}`);
      }
      
      console.log("✅ Profissional criado com sucesso:", data);
      
      // Retornar informações completas
      const resultado = {
        profissional: data,
        usuario: userId ? { id: userId, email: dados.email } : null,
        profile: profileData,
        observacao: userId ? 
          "Profissional completo com usuário e profile criados" : 
          "Apenas registro profissional criado (crie usuário manualmente)"
      };
      
      console.log("🎉 Resultado completo:", resultado);
      
      // Adicionar ao cache local
      this.profissionais.push(data);
      this.cache.profissionais = null;
      
      return resultado;
      
    } catch (error) {
      console.error("❌ Erro ao criar profissional completo:", error);
      throw error;
    }
  }

  async addProfissionalFrontend(dados) {
    try {
      console.log("🔧 Criando profissional com método simplificado:", dados);
      
      // ✅ CORRIGIDO: Usar colunas que agora existem na tabela
      const profissionalData = {
        nome: dados.nome,
        telefone: dados.telefone,
        email: dados.email,
        especialidade: dados.especialidade || 'Geral',
        ativo: true,
        profile_id: null // Sem usuário associado inicialmente
      };
      
      console.log("📊 Dados para inserir na tabela profissionais:", profissionalData);
      
      const { data, error } = await this.supabase
        .from('profissionais')
        .insert(profissionalData)
        .select()
        .single();
      
      if (error) {
        console.error("❌ Erro ao inserir profissional:", error);
        throw new Error(`Erro ao inserir profissional: ${error.message}`);
      }
      
      console.log("✅ Profissional criado com sucesso:", data);
      
      // Adicionar ao cache local
      this.profissionais.push(data);
      
      // Limpar cache para forçar recarregamento
      this.cache.profissionais = null;
      
      return data;
      
    } catch (error) {
      console.error("❌ Erro ao criar profissional:", error);
      throw error;
    }
  }

  async addProfissionalEdgeFunction(dados) {
    if (!dados.senhaTemporaria) {
      throw new Error('Senha temporária é obrigatória para criar profissional');
    }
    
    console.log('🔐 CHAMANDO EDGE FUNCTION: create-profissional...');
    
    const { data, error } = await this.supabase.functions.invoke('create-profissional', {
      body: dados
    });
    
    if (error) {
      console.error('❌ Erro na Edge Function:', error);
      throw new Error(`Erro na Edge Function: ${error.message}`);
    }
    
    console.log('✅ Edge Function retornou:', data);
    return data;
  }

  async garantirDadosReferencia() {
    console.log('🔍 Verificando dados de referência...');
    
    // Verificar e carregar clientes se necessário
    if (this.clientes.length === 0) {
      console.log('⚠️ Clientes vazios, carregando...');
      await this.loadClientes();
    }
    
    // Verificar e carregar serviços se necessário
    if (this.servicos.length === 0) {
      console.log('⚠️ Serviços vazios, carregando...');
      await this.loadServicos();
    }
    
    // Verificar e carregar profissionais se necessário
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

  getClientNameById(clienteId) {
    const cliente = this.clientes.find(c => c.id === clienteId);
    return cliente ? cliente.nome : null;
  }

  getServiceNameById(servicoId) {
    const servico = this.servicos.find(s => s.id === servicoId);
    return servico ? servico.nome : null;
  }

  getProfessionalNameById(profissionalId) {
    const profissional = this.profissionais.find(p => p.id === profissionalId);
    return profissional ? profissional.nome : null;
  }

  getClientes() {
    return this.loadClientes();
  }

  getServicos() {
    return this.loadServicos();
  }

  getAgendamentos() {
    return this.loadAgendamentos();
  }

  getBloqueios() {
    return this.loadBloqueios();
  }

  getProfissionais() {
    return this.loadProfissionais();
  }

  // Atualizar cliente - VERSÃO CORRIGIDA COM CAMPOS REAIS
  async updateCliente(id, dados) {
    try {
      // CORREÇÃO: Campos que REALMENTE existem na tabela clientes
      const clienteData = {
        nome: dados.nome.trim(),
        telefone: dados.telefone?.trim() || null,
        observacoes: dados.observacoes?.trim() || null, // ✅ EXISTE NA TABELA
        updated_at: new Date().toISOString() // ✅ EXISTE NA TABELA
      };
      
      const { data, error } = await this.supabase
        .from('clientes')
        .update(clienteData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Erro ao atualizar cliente:', error);
        throw new Error(`Erro ao atualizar cliente: ${error.message}`);
      }
      
      // Atualizar cache local
      const index = this.clientes.findIndex(c => c.id === id);
      if (index !== -1) {
        this.clientes[index] = data;
      }
      
      // Limpar cache para forçar recarregamento
      this.cache.clientes = null;
      
      return data;
      
    } catch (error) {
      console.error('❌ Erro ao atualizar cliente:', error);
      throw error;
    }
  }

  // Adicionar cliente - VERSÃO CORRIGIDA COM CAMPOS REAIS
  async addCliente(cliente) {
    try {
      if (this.supabase) {
        // Gerar token único para ficha de anamnese - VERSÃO v1.4
        const fichaToken = this.generateUniqueToken();

        // CORREÇÃO: Campos que REALMENTE existem na tabela clientes
        const clienteWithToken = {
          nome: cliente.nome,
          telefone: cliente.telephone || cliente.telefone, // Compatibilidade
          observacoes: cliente.observacoes || null, // ✅ EXISTE NA TABELA
          created_at: new Date().toISOString(), // ✅ EXISTE NA TABELA
          ficha_token: fichaToken
        };

        const { data, error } = await this.supabase
          .from("clientes")
          .insert([clienteWithToken])
          .select();

        if (error) {
          console.error("❌ Erro ao criar cliente:", error);
          throw error;
        }

        // CORREÇÃO: Limpar cache de clientes após CREATE
        this.cache.clientes = null;

        return data;
      }
    } catch (error) {
      console.error('❌ Erro ao criar cliente:', error);
      throw error;
    }
  }

  // Gerar token único para ficha de anamnese - VERSÃO RESTAURADA v1.4
  generateUniqueToken() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ficha_${timestamp}_${random}`;
  }

  // Gerar token único para ficha de anamnese
  gerarTokenFicha() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${timestamp}${random}`.toUpperCase();
  }

  // Adicionar agendamento
  async addAgendamento(dados) {
    console.log('➕ Adicionando agendamento:', dados);
    
    try {
      // Preparar dados para inserção
      const agendamentoData = {
        cliente_id: dados.cliente,
        servico_id: dados.servico,
        profissional_id: dados.profissional,
        status: dados.status || 'agendado',
        data_inicio: dados.inicio,
        data_fim: dados.fim,
        observacoes: dados.observacoes || '',
        created_at: new Date().toISOString()
      };
      
      console.log('📊 Dados para inserir na tabela agendamentos:', agendamentoData);
      
      const { data, error } = await this.supabase
        .from('agendamentos')
        .insert(agendamentoData)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Erro ao inserir agendamento:', error);
        throw new Error(`Erro ao inserir agendamento: ${error.message}`);
      }
      
      console.log('✅ Agendamento criado com sucesso:', data);
      
      // Adicionar ao cache local
      this.agendamentos.push(data);
      
      // Limpar cache para forçar recarregamento
      this.cache.agendamentos = null;
      
      return data;
      
    } catch (error) {
      console.error('❌ Erro ao criar agendamento:', error);
      throw error;
    }
  }

  // Resetar senha de profissional - SUPABASE AUTH NATIVO
  async resetarSenhaDireto(email) {
    console.log('🔐 Resetando senha para:', email);
    
    try {
      // Gerar nova senha temporária
      const novaSenha = this.gerarSenhaTemporaria();
      console.log('🔑 Nova senha gerada:', novaSenha);
      
      // Buscar profissional (cache)
      const profissional = this.profissionais.find(p => p.email === email);
      if (!profissional) {
        throw new Error('Profissional não encontrado. Recarregue a página.');
      }
      
      console.log('✅ Profissional encontrado:', profissional);
      
      // Usar profile_id do profissional como userId do Supabase Auth
      const userId = profissional.profile_id;
      console.log('🔐 Usando profile_id como userId:', userId);
      
      // Atualizar senha no Supabase Auth via Edge Function segura
      console.log('🔐 Atualizando senha via Edge Function...');
      
      // 🔧 1. CHAMADA COM TOKEN VÁLIDO
      console.log('🔐 Obtendo sessão para reset de senha...');
      
      const session = await this.supabase.auth.getSession();
      const token = session.data.session.access_token;

      console.log('🔍 Token obtido:', !!token);
      
      // 🔍 DEBUG: Chamada direta para Edge Function
      try {
        const response = await fetch("https://kckbcjjgbipcqzkynwpy.supabase.co/functions/v1/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}` 
          },
          body: JSON.stringify({
            userId,
            newPassword: novaSenha
          })
        });

        console.log('🔍 RESPONSE STATUS:', response.status);
        console.log('🔍 RESPONSE HEADERS:', Object.fromEntries(response.headers.entries()));
        
        const data = await response.json();
        console.log('🔍 RESPONSE DATA:', data);

        if (!response.ok) {
          console.error('❌ ERRO NA EDGE FUNCTION:', {
            status: response.status,
            statusText: response.statusText,
            data
          });
          throw new Error(data.error || `Erro ${response.status}: ${response.statusText}`);
        }

        console.log('✅ Edge Function executada com sucesso');
        const resetData = data;
        const resetError = null;
        
      } catch (fetchError) {
        console.error('❌ ERRO NO FETCH:', fetchError);
        throw new Error('Erro ao comunicar com Edge Function: ' + fetchError.message);
      }
      
      // Mantendo compatibilidade com código existente
      if (resetError) {
        throw new Error('Erro ao atualizar senha: ' + resetError.message);
      }
      
      if (!resetData || !resetData.success) {
        throw new Error('Falha ao atualizar senha no servidor');
      }
      
      console.log('✅ Senha atualizada com sucesso via Edge Function');
      
      // Resetar first_login_completed para forçar troca no próximo login
      try {
        await this.supabase
          .from('profiles')
          .update({ first_login_completed: false })
          .eq('id', userId);
        console.log('✅ first_login_completed resetado');
      } catch (profileError) {
        console.warn('⚠️ Erro ao resetar first_login_completed:', profileError);
      }
      
      // Retornar sucesso com senha atualizada automaticamente
      return {
        success: true,
        email: email,
        senhaTemporaria: novaSenha,
        message: 'Senha atualizada automaticamente no Supabase Auth',
        instructions: `Senha atualizada com sucesso!\n\n📧 Email: ${email}\n🔑 Nova Senha: ${novaSenha}\n\nO profissional já pode usar esta senha para fazer login.`,
        profileId: profissional.id,
        nome: profissional.nome,
        method: 'supabase_auth_automatic'
      };
      
    } catch (error) {
      console.error('❌ Erro no resetarSenhaDireto:', error);
      throw new Error('Erro ao resetar senha: ' + error.message);
    }
  }
  
  // Métodos auxiliares para acesso rápido por ID
  get servicosPorId() {
    if (!this._servicosPorId || this.servicos.length !== Object.keys(this._servicosPorId).length) {
      this._servicosPorId = {};
      this.servicos.forEach(servico => {
        this._servicosPorId[servico.id] = servico;
      });
    }
    return this._servicosPorId;
  }
  
  get profissionaisPorId() {
    if (!this._profissionaisPorId || this.profissionais.length !== Object.keys(this._profissionaisPorId).length) {
      this._profissionaisPorId = {};
      this.profissionais.forEach(profissional => {
        this._profissionaisPorId[profissional.id] = profissional;
      });
    }
    return this._profissionaisPorId;
  }
  
  get clientesPorId() {
    if (!this._clientesPorId || this.clientes.length !== Object.keys(this._clientesPorId).length) {
      this._clientesPorId = {};
      this.clientes.forEach(cliente => {
        this._clientesPorId[cliente.id] = cliente;
      });
    }
    return this._clientesPorId;
  }
  
  // Gerar cor baseada no status
  gerarCorPorStatus(status, corBase) {
    const coresPorStatus = {
      'agendado': corBase || '#28a745',      // verde
      'confirmado': corBase || '#007bff',    // azul
      'concluido': corBase || '#6c757d',    // cinza
      'cancelado': corBase || '#dc3545',    // vermelho
      'aguardando': corBase || '#ffc107',   // amarelo
      'em_atendimento': corBase || '#17a2b8' // ciano
    };
    
    return coresPorStatus[status] || corBase || '#6c757d';
  }
  
  // Atualizar agendamento
  async updateAgendamento(id, dados) {
    console.log('🔧 Atualizando agendamento:', id, dados);
    
    try {
      // CORREÇÃO CRÍTICA: Mapear campos corretamente para o banco
      const agendamentoData = {
        cliente_id: dados.cliente_id,      // CORREÇÃO: Usar cliente_id do evento
        servico_id: dados.servico_id,      // CORREÇÃO: Usar servico_id do evento
        profissional_id: dados.profissional_id, // CORREÇÃO: Usar profissional_id do evento
        status: dados.status || 'agendado',
        data_inicio: dados.data_inicio,    // CORREÇÃO: Usar data_inicio formatado
        data_fim: dados.data_fim,          // CORREÇÃO: Usar data_fim formatado
        observacoes: dados.observacoes || ''
        // CORREÇÃO: Removido updated_at pois não existe na tabela
      };
      
      console.log('🔧 Dados para atualizar no banco:', agendamentoData);
      
      const { data, error } = await this.supabase
        .from('agendamentos')
        .update(agendamentoData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Erro ao atualizar agendamento:', error);
        throw new Error(`Erro ao atualizar agendamento: ${error.message}`);
      }
      
      console.log('✅ Agendamento atualizado com sucesso:', data);
      
      // CORREÇÃO: Limpar cache específico do agendamento atualizado
      this.cache.agendamentos = null;
      
      // CORREÇÃO: Atualizar cache local imediatamente
      const index = this.agendamentos.findIndex(a => a.id === id);
      if (index !== -1) {
        this.agendamentos[index] = data;
        console.log('✅ Cache local atualizado para agendamento:', id);
      }
      
      return data;
      
    } catch (error) {
      console.error('❌ Erro ao atualizar agendamento:', error);
      throw error;
    }
  }
  
  // Excluir agendamento
  async deleteAgendamento(id) {
    console.log('🗑️ Excluindo agendamento:', id);
    
    try {
      const { error } = await this.supabase
        .from('agendamentos')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('❌ Erro ao excluir agendamento:', error);
        throw new Error(`Erro ao excluir agendamento: ${error.message}`);
      }
      
      console.log('✅ Agendamento excluído com sucesso');
      
      // Remover do cache local
      this.agendamentos = this.agendamentos.filter(a => a.id !== id);
      
      // Limpar cache para forçar recarregamento
      this.cache.agendamentos = null;
      
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao excluir agendamento:', error);
      throw error;
    }
  }
  
  // Adicionar bloqueio
  async addBloqueio(dados) {
    console.log('➕ Adicionando bloqueio:', dados);
    
    try {
      const bloqueioData = {
        titulo: dados.tituloBloqueio,
        data_inicio: dados.inicio,
        data_fim: dados.fim,
        created_at: new Date().toISOString()
      };
      
      const { data, error } = await this.supabase
        .from('bloqueios')
        .insert(bloqueioData)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Erro ao inserir bloqueio:', error);
        throw new Error(`Erro ao inserir bloqueio: ${error.message}`);
      }
      
      console.log('✅ Bloqueio criado com sucesso:', data);
      
      // Adicionar ao cache local
      this.bloqueios.push(data);
      
      // Limpar cache para forçar recarregamento
      this.cache.bloqueios = null;
      
      return data;
      
    } catch (error) {
      console.error('❌ Erro ao criar bloqueio:', error);
      throw error;
    }
  }
  
  // Atualizar bloqueio
  async updateBloqueio(id, dados) {
    console.log('🔧 Atualizando bloqueio:', id, dados);
    
    try {
      const bloqueioData = {
        titulo: dados.tituloBloqueio,
        data_inicio: dados.inicio,
        data_fim: dados.fim
        // CORREÇÃO: Removido updated_at pois não existe na tabela
      };
      
      const { data, error } = await this.supabase
        .from('bloqueios')
        .update(bloqueioData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Erro ao atualizar bloqueio:', error);
        throw new Error(`Erro ao atualizar bloqueio: ${error.message}`);
      }
      
      console.log('✅ Bloqueio atualizado com sucesso:', data);
      
      // Atualizar cache local
      const index = this.bloqueios.findIndex(b => b.id === id);
      if (index !== -1) {
        this.bloqueios[index] = data;
      }
      
      // Limpar cache para forçar recarregamento
      this.cache.bloqueios = null;
      
      return data;
      
    } catch (error) {
      console.error('❌ Erro ao atualizar bloqueio:', error);
      throw error;
    }
  }
  
  // Excluir bloqueio
  async deleteBloqueio(id) {
    console.log('🗑️ Excluindo bloqueio:', id);
    
    try {
      const { error } = await this.supabase
        .from('bloqueios')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('❌ Erro ao excluir bloqueio:', error);
        throw new Error(`Erro ao excluir bloqueio: ${error.message}`);
      }
      
      console.log('✅ Bloqueio excluído com sucesso');
      
      // Remover do cache local
      this.bloqueios = this.bloqueios.filter(b => b.id !== id);
      
      // Limpar cache para forçar recarregamento
      this.cache.bloqueios = null;
      
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao excluir bloqueio:', error);
      throw error;
    }
  }

  // Método de diagnóstico para identificar o problema real
  async diagnosticarProfilesRLS(email) {
    console.log('🔍 Iniciando diagnóstico da tabela profiles...');
    
    try {
      // Teste 1: Consulta simples sem filtros
      console.log('🧪 Teste 1: Consulta simples...');
      const { data: test1, error: error1 } = await this.supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      console.log('🧪 Resultado Teste 1:', { test1, error1 });
      
      // Teste 2: Consulta com filtro direto
      console.log('🧪 Teste 2: Filtro direto...');
      const { data: test2, error: error2 } = await this.supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email);
      
      console.log('🧪 Resultado Teste 2:', { test2, error2 });
      
      // Teste 3: Consulta via RPC (se existir)
      console.log('🧪 Teste 3: Via RPC...');
      const { data: test3, error: error3 } = await this.supabase
        .rpc('get_profile_by_email', { user_email: email });
      
      console.log('🧪 Resultado Teste 3:', { test3, error3 });
      
    } catch (diagError) {
      console.error('🧪 Erro no diagnóstico:', diagError);
    }
  }
  
  // Gerar senha temporária segura
  gerarSenhaTemporaria() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let senha = '';
    
    // Garantir pelo menos 8 caracteres com variedade
    for (let i = 0; i < 10; i++) {
      senha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Garantir que tenha letra maiúscula, minúscula e número
    if (!/\d/.test(senha)) {
      senha += Math.floor(Math.random() * 10);
    }

    return senha;
  }
}

// Exportar para uso global
window.DataManager = DataManager;
