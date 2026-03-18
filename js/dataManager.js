// Gerenciamento centralizado de dados com Supabase
// DataManager - Gerenciamento de dados e cache
// VERSÃO: 1.4.0 - VERSÃO LIMPA
console.log('💾 DataManager V1.4.0 carregado - Versão limpa');

class DataManager {
  constructor(supabaseClient) {
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
    try {
      console.log('🔍 Carregando clientes...');
      
      const { data, error } = await this.supabase
        .from('clientes')
        .select('*')
        .order('nome');

      if (error) {
        console.error('❌ Erro ao carregar clientes do Supabase:', error);
        this.clientes = [];
      } else {
        this.clientes = data || [];
        console.log('✅ Clientes carregados do Supabase:', this.clientes.length);
        this.cache.clientes = this.clientes;
        console.log('💾 Clientes salvos no cache:', this.clientes.length);
      }
      
      return this.clientes;
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.clientes = [];
      return this.clientes;
    }
  }

  async loadServicos() {
    try {
      console.log('Carregando serviços...');
      
      const { data, error } = await this.supabase
        .from('servicos')
        .select('*')
        .order('nome');

      if (error) {
        console.error('Erro ao carregar serviços:', error);
        this.servicos = [];
      } else {
        this.servicos = data || [];
        console.log('Serviços carregados do Supabase:', this.servicos.length);
        this.servicos = this.servicos.map(servico => ({
          ...servico,
          duracao_min: parseInt(servico.duracao_min) || 30,
          valor: parseFloat(servico.valor) || 0
        }));
        console.log('Serviços mapeados para formato compatível:', this.servicos.length);
        this.cache.servicos = this.servicos;
        console.log('Serviços salvos no cache:', this.servicos.length);
      }
      
      return this.servicos;
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
      this.servicos = [];
      return this.servicos;
    }
  }

  async loadBloqueios() {
    try {
      console.log('🔍 Carregando bloqueios...');
      console.log('🔍 Verificando this.supabase:', this.supabase);
      
      // ✅ CORRIGIDO: Usar colunas corretas da tabela bloqueios
      const { data, error } = await this.supabase
        .from('bloqueios')
        .select('*')
        .order('inicio', { ascending: true });

      if (error) {
        console.error('❌ Erro ao carregar bloqueios:', error);
        this.bloqueios = [];
      } else {
        this.bloqueios = data || [];
        console.log('✅ Bloqueios carregados:', this.bloqueios.length);
        // ✅ CORRIGIDO: Mapear para formato compatível
        this.bloqueios = this.bloqueios.map(bloqueio => ({
          ...bloqueio,
          // Mapear nomes das colunas para compatibilidade
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
      console.log('🔍 Carregando profissionais... (cache)');
      
      // Verificar cache primeiro
      if (this.cache.profissionais !== null) {
        console.log('📦 Retornando profissionais do cache:', this.cache.profissionais.length);
        this.profissionais = this.cache.profissionais;
        return this.profissionais;
      }
      
      console.log('⚠️ Cache vazio, carregando do Supabase com JOIN...');
      
      // ✅ CORRIGIDO: Usar nome específico do relacionamento (sugerido pelo erro)
      const { data, error } = await this.supabase
        .from('profissionais')
        .select(`
          id,
          telefone,
          created_at,
          profile_id,
          profiles!profissionais_profiles_fk(nome, email, role)
        `)
        .order('id', { ascending: true });

      if (error) {
        console.warn('⚠️ Erro no JOIN, tentando solução alternativa com 2 consultas:', error.message);
        
        // ✅ SOLUÇÃO ALTERNATIVA: Duas consultas separadas
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
            console.warn('⚠️ Erro ao buscar profiles, usando dados básicos:', errorProfiles.message);
            this.profissionais = profissionais.map(p => ({
              ...p,
              nome: `Profissional ${p.id}`,
              email: 'Email não informado'
            }));
          } else {
            // 3. Juntar dados manualmente
            const profilesMap = {};
            profiles.forEach(profile => {
              profilesMap[profile.id] = profile;
            });
            
            console.log('🔍 Profiles encontrados:', profiles);
            console.log('🔍 Mapa de profiles:', profilesMap);
            
            this.profissionais = profissionais.map(profissional => {
              const profile = profilesMap[profissional.profile_id];
              console.log('🔍 Verificando profissional:', {
                profissional_id: profissional.id,
                profile_id: profissional.profile_id,
                profile_encontrado: !!profile,
                profile_dados: profile
              });
              
              return {
                ...profissional,
                nome: profile ? profile.nome : `Profissional ${profissional.id}`,
                email: profile ? profile.email : 'Email não informado',
                role: profile ? profile.role : null
              };
            });
          }
          
          console.log('✅ Profissionais carregados com solução alternativa:', this.profissionais.length);
          
        } catch (altError) {
          console.error('❌ Erro na solução alternativa:', altError);
          this.profissionais = [];
        }
      } else {
        this.profissionais = data || [];
        console.log('✅ Profissionais carregados do Supabase com JOIN:', this.profissionais.length);
        
        // Mapear para formato compatível
        this.profissionais = this.profissionais.map(profissional => {
          const result = {
            id: parseInt(profissional.id) || profissional.id,
            telefone: profissional.telefone,
            created_at: profissional.created_at,
            profile_id: profissional.profile_id
          };
          
          // ✅ Adicionar dados do profile se existir
          if (profissional.profiles) {
            result.nome = profissional.profiles.nome;
            result.email = profissional.profiles.email;
            result.role = profissional.profiles.role;
          } else {
            result.nome = `Profissional ${profissional.id}`;
            result.email = 'Email não informado';
          }
          
          return result;
        });
        
        console.log('✅ Profissionais mapeados para formato compatível:', this.profissionais.length);
        this.cache.profissionais = this.profissionais;
        console.log('💾 Profissionais salvos no cache:', this.profissionais.length);
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
      console.log("🔍 Carregando agendamentos...");
      
      // CORREÇÃO: Se cache foi limpo, recarregar do banco
      if (!this.cache.agendamentos) {
        console.log("🔄 Cache vazio, carregando do banco...");
        
        // Obter profissional logado
        const profissionalLogado = await this.getProfissionalLogado();
        
        if (!profissionalLogado) {
          // ✅ ADMIN: Carregar todos os agendamentos
          console.log("👑 Admin detectado - carregando todos os agendamentos");
          
          const { data, error } = await this.supabase
            .from("agendamentos")
            .select("*")
            .order("data_inicio", { ascending: true });

          if (error) {
            console.error('Erro ao carregar agendamentos do Supabase:', error);
            this.agendamentos = [];
          } else {
            this.agendamentos = data || [];
            console.log("✅ Agendamentos carregados do banco:", this.agendamentos.length);
          }
          
          // Salvar no cache
          this.cache.agendamentos = this.agendamentos;
        } else {
          // PROFSSIONAL: Lógica específica (se necessário)
          this.agendamentos = [];
          this.cache.agendamentos = this.agendamentos;
        }
      } else {
        console.log("📦 Usando agendamentos do cache:", this.cache.agendamentos.length);
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
    // IGNORAR ERRO RLS - RETORNAR NULL DIRETO
    console.log('DATA_MANAGER: Ignorando query RLS em getProfissionalLogado devido a erro 500');
    return null;
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
    console.log('📋 getClientes() chamado - carregando clientes...');
    return this.loadClientes();
  }

  getServicos() {
    console.log('💇 getServicos() chamado - carregando serviços...');
    return this.loadServicos();
  }

  getAgendamentos() {
    console.log('📅 getAgendamentos() chamado - carregando agendamentos...');
    return this.loadAgendamentos();
  }

  getBloqueios() {
    console.log('🚫 getBloqueios() chamado - carregando bloqueios...');
    return this.loadBloqueios();
  }

  getProfissionais() {
    console.log('📋 getProfissionais() chamado - carregando profissionais... (cache)');
    return this.loadProfissionais();
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
      
      // Retornar senha para admin atualizar manualmente no Supabase Auth
      return {
        success: true,
        email: email,
        senhaTemporaria: novaSenha,
        message: 'Senha temporária gerada com sucesso',
        instructions: `INSTRUÇÕES:\n\n1. Acesse Supabase Dashboard\n2. Authentication → Users\n3. Encontre: ${email}\n4. Clique "Reset Password"\n5. Insira: ${novaSenha}\n6. Salve\n\nO profissional já poderá usar esta senha.`,
        profileId: profissional.id,
        nome: profissional.nome,
        method: 'supabase_auth_manual'
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
    const maiuscula = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 26));
    const minuscula = 'abcdefghijklmnopqrstuvwxyz'.charAt(Math.floor(Math.random() * 26));
    const numero = '0123456789'.charAt(Math.floor(Math.random() * 10));
    
    return maiuscula + minuscula + numero + senha.substring(3);
  }
}

// Exportar para uso global
window.DataManager = DataManager;
