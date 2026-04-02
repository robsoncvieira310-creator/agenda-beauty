// Gerenciamento centralizado de dados com Supabase
// DataManager - Gerenciamento de dados e cache
// VERSÃO: 1.4.0 - VERSÃO LIMPA
console.log('💾 DataManager V1.4.0 carregado - Versão limpa');

class DataManager {
  constructor(supabase) {
    if (!supabase) {
      throw new Error('Supabase client é obrigatório para DataManager');
    }

    this.supabase = supabase;
    this.clientes = [];
    this.servicos = [];
    this.profissionais = [];
    this.agendamentos = [];
    this.bloqueios = [];
    
    // Cache para performance - USANDO MAP PARA CONSISTÊNCIA
    // Polyfill para garantir compatibilidade
    if (typeof Map !== 'undefined') {
      this.cache = new Map();
      console.log('✅ Cache criado com Map() nativo');
    } else {
      // Fallback para navegadores antigos
      this.cache = {};
      console.log('⚠️ Cache criado com objeto simples (fallback)');
    }
    
    console.log('✅ DataManager criado com cliente Supabase e cache implementado');
    console.log('🔍 Cache type:', typeof this.cache, 'has method:', typeof this.cache.has);
  }

  // Métodos unificados de cache (compatíveis com Map e Object)
  cacheSet(key, value) {
    try {
      if (this.cache instanceof Map) {
        this.cache.set(key, value);
      } else {
        this.cache[key] = value;
      }
    } catch (error) {
      console.warn('⚠️ Erro ao definir cache (não bloqueia fluxo):', error.message);
      // Não lança erro para não quebrar o fluxo principal
    }
  }

  cacheGet(key) {
    if (this.cache instanceof Map) {
      return this.cache.get(key);
    } else {
      return this.cache[key];
    }
  }

  cacheHas(key) {
    if (this.cache instanceof Map) {
      return this.cache.has(key) && this.cache.get(key) !== null;
    } else {
      return this.cache.hasOwnProperty(key) && this.cache[key] !== null;
    }
  }

  cacheDelete(key) {
    try {
      if (this.cache instanceof Map) {
        this.cache.delete(key);
      } else {
        delete this.cache[key];
      }
    } catch (error) {
      console.warn('⚠️ Erro ao deletar cache (não bloqueia fluxo):', error.message);
      // Não lança erro para não quebrar o fluxo principal
    }
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
        this.cacheSet('clientes', this.clientes);
        console.log('💾 Clientes salvos no cache:', this.clientes.length);
      }
      
      return this.clientes;
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      this.clientes = [];
      return this.clientes;
    }
  }

  async addCliente(dados) {
    try {
      console.log('➕ Adicionando cliente:', dados);
      
      const { data, error } = await this.supabase
        .from('clientes')
        .insert([dados])
        .select()
        .single();
        
      if (error) {
        console.error('❌ Erro ao inserir cliente:', error);
        throw new Error(`Erro ao inserir cliente: ${error.message}`);
      }
      
      console.log('✅ Cliente criado com sucesso:', data);
      
      // Adicionar ao cache local
      this.clientes.push(data);
      
      // Limpar cache para forçar recarregamento
      this.cacheSet('clientes', null);
      
      return data;
      
    } catch (error) {
      console.error('❌ Erro ao criar cliente:', error);
      throw error;
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
        this.cacheSet('servicos', this.servicos);
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
      console.log('🔍 Carregando profissionais da tabela profissionais com merge manual para profiles...');
      
      // ✅ VERIFICAR SESSÃO ANTES DA QUERY
      if (!window.authManager || !window.authManager.currentUserProfile) {
        console.error('❌ DATA_MANAGER: Nenhum usuário autenticado para carregar profissionais');
        this.profissionais = [];
        return this.profissionais;
      }

      const currentUserProfile = window.authManager.currentUserProfile;
      console.log('👤 DATA_MANAGER: Usuário autenticado:', currentUserProfile.email, 'Role:', currentUserProfile.role);
      
      // Verificar cache primeiro
      if (this.cacheHas('profissionais')) {
        console.log('📦 Retornando profissionais do cache:', this.cacheGet('profissionais').length);
        this.profissionais = this.cacheGet('profissionais');
        return this.profissionais;
      }
      
      console.log('⚠️ Cache vazio, carregando do Supabase com merge manual (profissionais + profiles)...');
      
      // ✅ ETAPA 1: Buscar profissionais
      console.log('🔍 ETAPA 1: Buscando profissionais...');
      let query = this.supabase
        .from('profissionais')
        .select('*');

      // ✅ FILTRAR BASEADO NO ROLE DO USUÁRIO
      if (currentUserProfile.role === 'admin') {
        // Admin: ver todos os profissionais
        console.log('👑 DATA_MANAGER: Admin detectado - carregando todos os profissionais');
      } else if (currentUserProfile.role === 'profissional') {
        // Profissional: ver apenas seu próprio registro
        query = query.eq('profile_id', currentUserProfile.id);
        console.log('👩 DATA_MANAGER: Profissional detectado - carregando apenas seu registro');
      } else {
        console.error('❌ DATA_MANAGER: Role não permitido:', currentUserProfile.role);
        this.profissionais = [];
        return this.profissionais;
      }

      const { data: profissionais, error: profissionaisError } = await query;

      if (profissionaisError) {
        console.error('❌ DATA_MANAGER: Erro ao buscar profissionais:', profissionaisError);
        
        // ❌ NÃO USAR FALLBACK - PROPAGAR ERRO
        if (profissionaisError.code === '42501' || profissionaisError.message.includes('row-level security')) {
          throw new Error(`Erro de permissão RLS: ${profissionaisError.message}. Verifique as políticas de segurança.`);
        }
        
        this.profissionais = [];
        return this.profissionais;
      }
      
      console.log('✅ DATA_MANAGER: Profissionais encontrados:', profissionais.length);
      
      // ✅ ETAPA 2: Extrair profile_ids válidos
      console.log('🔍 ETAPA 2: Extraindo profile_ids válidos...');
      const profileIds = profissionais
        .map(p => p.profile_id)
        .filter(Boolean); // Remove null, undefined, 0, false, ""
      
      console.log("🔍 DEBUG: IDs para profiles:", profileIds);
      
      if (profileIds.length === 0) {
        console.log('⚠️ Nenhum profile_id válido encontrado, retornando profissionais sem dados de perfil');
        this.profissionais = profissionais.map(p => ({
          id: p.id,
          profile_id: p.profile_id,
          nome: 'Sem nome',
          email: 'Sem email',
          telefone: 'Sem telefone',
          role: 'profissional',
          created_at: p.created_at
        }));
        this.cacheSet('profissionais', this.profissionais);
        return this.profissionais;
      }
      
      // ✅ ETAPA 3: Buscar profiles
      console.log('🔍 ETAPA 3: Buscando profiles...');
      const { data: profiles, error: profilesError } = await this.supabase
        .from('profiles')
        .select('*')
        .in('id', profileIds);
      
      if (profilesError) {
        console.error('❌ DATA_MANAGER: Erro ao buscar profiles:', profilesError);
        // Continuar com dados parciais
        this.profissionais = profissionais.map(p => ({
          id: p.id,
          profile_id: p.profile_id,
          nome: 'Sem nome',
          email: 'Sem email',
          telefone: 'Sem telefone',
          role: 'profissional',
          created_at: p.created_at
        }));
        this.cacheSet('profissionais', this.profissionais);
        return this.profissionais;
      }
      
      console.log('✅ DATA_MANAGER: Profiles encontrados:', profiles.length);
      
      // ✅ ETAPA 4: Criar mapa para merge manual
      console.log('🔍 ETAPA 4: Criando mapa de profiles...');
      const profilesMap = {};
      profiles.forEach(p => {
        profilesMap[p.id] = p;
      });
      
      console.log("🔍 DEBUG: ProfilesMap criado com:", Object.keys(profilesMap).length, "profiles");
      
      // ✅ ETAPA 5: Merge manual
      console.log('🔍 ETAPA 5: Fazendo merge manual...');
      this.profissionais = profissionais.map(p => {
        const profile = profilesMap[p.profile_id];
        
        return {
          id: p.id,
          profile_id: p.profile_id,
          nome: profile?.nome || 'Sem nome',
          email: profile?.email || 'Sem email',
          telefone: profile?.telefone || 'Sem telefone',
          role: profile?.role || 'profissional',
          created_at: p.created_at
        };
      });
      
      console.log('✅ DATA_MANAGER: Merge manual (profissionais + profiles) concluído:', this.profissionais.length);
      
      // 🔍 DEBUG: Verificar resultado final
      const semNome = this.profissionais.filter(p => p.nome === 'Sem nome').length;
      const semEmail = this.profissionais.filter(p => p.email === 'Sem email').length;
      const semTelefone = this.profissionais.filter(p => p.telefone === 'Sem telefone').length;
      
      console.log("🔍 DEBUG: Resultado final - Sem nome:", semNome, "Sem email:", semEmail, "Sem telefone:", semTelefone);
      
      // ✅ ORDENAR POR NOME DO PROFILE (CLIENT-SIDE)
      this.profissionais.sort((a, b) => a.nome.localeCompare(b.nome));
      
      console.log('✅ DATA_MANAGER: Profissionais mapeados (merge manual) com dados completos:', this.profissionais.length);
      
      // Salvar no cache (merge manual)
      this.cacheSet('profissionais', this.profissionais);
      console.log('💾 DATA_MANAGER: Profissionais (merge manual) salvos no cache:', this.profissionais.length);
      
      return this.profissionais;
    } catch (error) {
      console.error('❌ DATA_MANAGER: Erro crítico ao carregar profissionais:', error);
      this.profissionais = [];
      throw error; // ❌ NÃO ENGOLIR ERROS
    }
  }

  async loadAgendamentos() {
    try {
      console.log("🔍 Carregando agendamentos...");
      
      // CORREÇÃO: Se cache foi limpo, recarregar do banco
      if (!this.cacheHas('agendamentos')) {
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
          this.cacheSet('agendamentos', this.agendamentos);
        } else {
          // PROFSSIONAL: Lógica específica (se necessário)
          this.agendamentos = [];
          this.cacheSet('agendamentos', this.agendamentos);
        }
      } else {
        console.log("📦 Usando agendamentos do cache:", this.cacheGet('agendamentos').length);
        this.agendamentos = this.cacheGet('agendamentos');
      }
      
      return this.agendamentos;
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      this.agendamentos = [];
      return this.agendamentos;
    }
  }

  async getProfissionalLogado() {
    // ❌ NÃO IGNORAR RLS - VERIFICAR SESSÃO REAL
    if (!window.authManager || !window.authManager.currentUserProfile) {
      console.log('DATA_MANAGER: Nenhum usuário autenticado');
      return null;
    }

    const profile = window.authManager.currentUserProfile;
    
    // ✅ VERIFICAR SE É PROFISSIONAL
    if (profile.role !== 'profissional') {
      console.log('DATA_MANAGER: Usuário não é profissional:', profile.role);
      return null;
    }

    // ✅ BUSCAR PROFISSIONAL REAL VIA PROFILE_ID
    try {
      const { data, error } = await this.supabase
        .from('profissionais')
        .select('*')
        .eq('profile_id', profile.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('DATA_MANAGER: Profissional não encontrado para este profile');
          return null;
        }
        console.error('DATA_MANAGER: Erro ao buscar profissional:', error);
        throw error;
      }

      console.log('DATA_MANAGER: Profissional encontrado:', data);
      return data;

    } catch (error) {
      console.error('DATA_MANAGER: Erro crítico ao buscar profissional:', error);
      throw error;
    }
  }

  async addProfissional(dados) {
    try {
      console.log('🚀 USANDO FETCH (NOVO FLUXO) - Criando profissional via Edge Function...', dados);
      
      // Validar dados obrigatórios
      if (!dados.nome || !dados.email || !dados.password || !dados.telefone) {
        throw new Error('Campos obrigatórios: nome, email, password, telefone');
      }
      
      // Validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(dados.email)) {
        throw new Error('Email inválido');
      }
      
      // Validar senha
      if (dados.password.length < 6) {
        throw new Error('Senha deve ter pelo menos 6 caracteres');
      }
      
      // 🔍 DIAGNÓSTICO - Verificar sessão e token
      const { data: { session } } = await this.supabase.auth.getSession()
      
      console.log('🔐 SESSION DEBUG:', {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email
      })
      
      if (!session) {
        console.error('❌ Usuário não autenticado - session null')
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }
      
      // ⚠️ GARANTIR QUE TOKEN NÃO É UNDEFINED
      if (!session?.access_token) {
        console.error('❌ Token de autenticação inválido')
        throw new Error('Token de autenticação inválido');
      }
      
      console.log('🔑 TOKEN:', session.access_token.slice(0, 10) + '...')
      
      // 🧨 TIMEOUT - Evita travamento silencioso
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000) // 10s
      
      // 🔥 CHAMADA DIRETA COM FETCH - COM RETRY AUTOMÁTICO
      const callFunction = async () => {
        const functionUrl = `${this.supabase.supabaseUrl}/functions/v1/create-profissional`
        
        console.log('🌐 CHAMANDO URL:', functionUrl)
        
        // 🧪 LOGS DE DIAGNÓSTICO
        console.log('🧪 SESSION COMPLETA:', session)
        console.log('🧪 TOKEN:', session?.access_token)
        
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            nome: dados.nome,
            email: dados.email,
            password: dados.password,
            telefone: dados.telefone
          }),
          signal: controller.signal
        })
        
        clearTimeout(timeout)
        
        console.log('📡 RESPONSE STATUS:', response.status)
        console.log('📡 RESPONSE OK:', response.ok)
        
        // 🧠 PADRONIZAR RETORNO
        if (!response.ok) {
          const errorText = await response.text()
          console.error('❌ ERRO COMPLETO DA API:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          })
          
          let errorMessage = 'Erro na comunicação com o servidor'
          try {
            const errorJson = JSON.parse(errorText)
            errorMessage = errorJson.error || errorMessage
          } catch (parseError) {
            errorMessage = errorText || errorMessage
          }
          
          throw {
            success: false,
            message: errorMessage
          }
        }
        
        const data = await response.json()
        console.log('📥 RESPOSTA EDGE FUNCTION:', data)
        
        return {
          success: true,
          data
        }
      }
      
      // 🚀 RETRY AUTOMÁTICO - APENAS PARA ERROS DE REDE
      for (let i = 0; i < 2; i++) {
        try {
          const result = await callFunction()
          console.log('✅ Profissional criado com sucesso:', result.data);
          
          // Limpar cache para forçar recarregamento
          this.cacheSet('profissionais', null);
          
          return result.data
          
        } catch (error) {
          // Verificar se é erro de rede (vale retry)
          const isNetworkError = error.message && (
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError') ||
            error.message.includes('timeout') ||
            error.message.includes('ECONNRESET') ||
            error.message.includes('ENOTFOUND')
          );
          
          if (i === 1 || !isNetworkError) {
            // Última tentativa ou erro não é de rede - não retryar
            console.error('❌ Erro definitivo ao criar profissional:', error)
            if (!isNetworkError && i === 0) {
              console.error('❌ Erro interno (não é de rede) - sem retry:', error.message)
            }
            throw error
          }
          
          console.warn('🔁 Retry da requisição (erro de rede)...', error.message)
        }
      }
      
    } catch (error) {
      console.error('❌ Erro ao criar profissional:', error);
      throw error;
    }
  }

  async deleteProfissional(profile_id) {
    try {
      console.log('🗑️ Deletando profissional via Edge Function...', profile_id);
      
      // 🔍 DIAGNÓSTICO - Verificar sessão e token
      const { data: { session } } = await this.supabase.auth.getSession()
      
      console.log('🔐 SESSION DEBUG:', {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email
      })
      
      if (!session) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }
      
      // 🔑 VALIDAR TOKEN
      if (!session?.access_token) {
        throw new Error('Token de autenticação inválido');
      }
      
      console.log('🔑 TOKEN:', session.access_token.slice(0, 10) + '...');
      
      // 🧨 TIMEOUT - Evita travamento silencioso
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000) // 10s
      
      // 🔥 CHAMADA DIRETA COM FETCH
      const functionUrl = `${this.supabase.supabaseUrl}/functions/v1/delete-profissional`
      
      console.log('🌐 CHAMANDO DELETE URL:', functionUrl)
      
      // 🧪 LOGS DE DIAGNÓSTICO
      console.log('🧪 SESSION COMPLETA:', session)
      console.log('🧪 TOKEN:', session?.access_token)
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          profile_id: profile_id
        }),
        signal: controller.signal
      })
      
      clearTimeout(timeout)
      
      console.log('📡 DELETE RESPONSE STATUS:', response.status)
      console.log('📡 DELETE RESPONSE OK:', response.ok)
      
      // 🧪 LOG COMPLETO DA RESPOSTA
      const responseText = await response.text()
      console.log('📡 DELETE RESPONSE TEXT:', responseText)
      
      let responseData
      try {
        responseData = JSON.parse(responseText)
      } catch (parseError) {
        console.error('❌ ERRO PARSE JSON:', parseError)
        throw new Error('Resposta inválida do servidor')
      }
      
      console.log('📡 DELETE RESPONSE DATA:', responseData)
      
      if (!response.ok) {
        const errorMessage = responseData?.error || `Erro HTTP ${response.status}`
        console.error('❌ ERRO DELETE FUNCTION:', errorMessage)
        throw new Error(errorMessage)
      }
      
      if (!responseData.success) {
        const errorMessage = responseData?.message || responseData?.error || 'Erro desconhecido'
        console.error('❌ ERRO DELETE BUSINESS:', errorMessage)
        throw new Error(errorMessage)
      }
      
      console.log('✅ Profissional deletado com sucesso:', responseData)
      
      // Limpar cache
      if (this.cache && this.cache instanceof Map) {
        this.cache.delete('profissionais');
      } else if (this.cache) {
        // Fallback para objeto simples (se existir)
        delete this.cache.profissionais;
      }
      
      return responseData
      
    } catch (error) {
      console.error('❌ Erro ao deletar profissional:', error)
      throw error
    }
  }

  async updateProfissional(id, dados) {
    try {
      console.log('🔧 Atualizando profissional:', id, dados);
      
      // 1. Atualizar profile (se tiver profile_id) - AGORA INCLUI TELEFONE
      if (dados.profile_id) {
        const { error: profileError } = await this.supabase
          .from('profiles')
          .update({
            nome: dados.nome,
            email: dados.email,
            telefone: dados.telefone, // ✅ NOVO: Telefone agora em profiles
            role: 'profissional'
          })
          .eq('id', dados.profile_id);
          
        if (profileError) {
          console.error('❌ Erro ao atualizar profile:', profileError);
          throw new Error(`Erro ao atualizar profile: ${profileError.message}`);
        }
        
        console.log('✅ Profile atualizado com sucesso');
      }
      
      // 2. Atualizar profissionais (APENAS CAMPOS ESPECÍFICOS - SEM TELEFONE)
      const profissionalUpdate = {};
      // Não atualizar mais telefone na tabela profissionais
      
      const { data, error } = await this.supabase
        .from('profissionais')
        .update(profissionalUpdate)
        .eq('id', id)
        .select()
        .single();
        
      if (error) {
        console.error('❌ Erro ao atualizar profissional:', error);
        throw new Error(`Erro ao atualizar profissional: ${error.message}`);
      }
      
      console.log('✅ Profissional atualizado com sucesso:', data);
      
      // 3. Limpar cache
      this.cacheSet('profissionais', null);
      
      // 4. Atualizar lista local
      const index = this.profissionais.findIndex(p => p.id === id);
      if (index !== -1) {
        this.profissionais[index] = {
          ...this.profissionais[index],
          nome: dados.nome, // Do profile
          email: dados.email, // Do profile
          telefone: dados.telefone // Do profile (agora vem do profile)
        };
      }
      
      return data;
      
    } catch (error) {
      console.error('❌ Erro ao atualizar profissional:', error);
      throw error;
    }
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
      this.cacheSet('agendamentos', null);
      
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
      this.cacheSet('agendamentos', null);
      
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
      this.cacheSet('agendamentos', null);
      
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
      this.cacheSet('bloqueios', null);
      
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
      this.cacheSet('bloqueios', null);
      
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
      this.cacheSet('bloqueios', null);
      
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
