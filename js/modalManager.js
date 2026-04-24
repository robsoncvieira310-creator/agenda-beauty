// ModalManager - Gerenciamento de modais e formulários
// VERSÃO: 1.6.0 - GLOBAL MODULE (window.*)
// CACHE-BREAKER: 20260311140500
// 🎯 FASE 2.6.2: Implementa LifecycleContract

// DEPENDÊNCIAS: window.services, window.showAlert, window.showLoading, window.hideLoading, etc.

window.ModalManager = class ModalManager extends LifecycleContract {
  constructor() {
    super('ModalManager');
    
    // 🎯 FASE 2.6.2: STATE ONLY - Zero side-effects no constructor
    this.modalAtual = null;
    this.registroAtual = null;
    
    // Bound handlers para cleanup
    this._handlers = {};
  }

  // ================================
  // 🎯 FASE 2.6.2: LIFECYCLE IMPLEMENTATION
  // ================================
  
  activate() {
    if (this._lifecycleActive) return;
    
    console.log('[ModalManager] activating...');
    
    this._setupEventListeners();
    
    this._lifecycleActive = true;
    console.log('✅ ModalManager activated');
    return true;
  }
  
  deactivate() {
    if (!this._lifecycleActive) return;
    
    console.log('[ModalManager] deactivating...');
    
    // Cleanup via LifecycleContract
    super.deactivate();
    
    this.modalAtual = null;
    this.registroAtual = null;
    
    console.log('[ModalManager] deactivated');
  }
  
  destroy() {
    console.log('[ModalManager] destroying...');
    super.destroy();
  }

  _setupEventListeners() {
    // 🎯 FASE 2.6.2: Usar addEventListener do LifecycleContract para cleanup automático
    
    // Escutar eventos do calendário
    this._handlers.abrirModalAgendamento = (e) => this.abrirModalAgendamento(e.detail);
    this.addEventListener(document, 'abrirModalAgendamento', this._handlers.abrirModalAgendamento);

    this._handlers.abrirModalBloqueio = (e) => this.abrirModalBloqueio(e.detail);
    this.addEventListener(document, 'abrirModalBloqueio', this._handlers.abrirModalBloqueio);

    // Event listeners do modal de conflito
    this._handlers.fecharModalConflito = () => this.fecharModalConflito();
    this.addEventListener(document.getElementById('btnFecharModalConflito'), 'click', this._handlers.fecharModalConflito);

    this._handlers.cancelarConflito = () => this.cancelarConflito();
    this.addEventListener(document.getElementById('btnCancelarConflito'), 'click', this._handlers.cancelarConflito);

    this._handlers.confirmarConflito = () => this.confirmarConflito();
    this.addEventListener(document.getElementById('btnConfirmarConflito'), 'click', this._handlers.confirmarConflito);

    // Botões de fechar
    const btnFechar = document.getElementById('btnFecharModal');
    if (btnFechar) {
      this._handlers.fecharModal = () => this.fecharModal();
      this.addEventListener(btnFechar, 'click', this._handlers.fecharModal);
    }

    const btnExcluir = document.getElementById('btnExcluir');
    if (btnExcluir) {
      this._handlers.excluirRegistro = () => this.excluirRegistro();
      this.addEventListener(btnExcluir, 'click', this._handlers.excluirRegistro);
    }

    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) {
      this._handlers.salvarRegistro = () => this.salvarRegistro();
      this.addEventListener(btnSalvar, 'click', this._handlers.salvarRegistro);
    }

    // Mudança de tipo de registro
    const tipoRegistro = document.getElementById('tipoRegistro');
    if (tipoRegistro) {
      this._handlers.tipoChange = (e) => this.alternarTipoRegistro(e.target.value);
      this.addEventListener(tipoRegistro, 'change', this._handlers.tipoChange);
    }

    // Mudança de serviço para calcular duração
    const servico = document.getElementById('servico');
    if (servico) {
      this._handlers.servicoChange = () => this.calcularDuracaoServico();
      this.addEventListener(servico, 'change', this._handlers.servicoChange);
    }

    // Fechar modal ao clicar fora
    const formAgendamento = document.getElementById('formAgendamento');
    if (formAgendamento) {
      this._handlers.clickOutside = (e) => {
        if (e.target.id === 'formAgendamento') {
          this.fecharModal();
        }
      };
      this.addEventListener(formAgendamento, 'click', this._handlers.clickOutside);
    }
  }

  abrirModalAgendamento(data) {
    console.log('🚀 abrirModalAgendamento chamado com dados:', data);
    console.log('🔍 Tipo do registro:', data.tipo);
    
    this.registroAtual = data;
    this.modalAtual = 'agendamento';
    
    const modal = document.getElementById('formAgendamento');
    const titulo = document.getElementById('modalTitulo');
    const btnExcluir = document.getElementById('btnExcluir');

    console.log('🔍 Elementos encontrados:', {
      modal: !!modal,
      titulo: !!titulo,
      btnExcluir: !!btnExcluir
    });

    // Configurar modal
    if (data.tipo === 'edicao') {
      console.log('✅ Configurando para EDIÇÃO');
      titulo.textContent = 'Editar Agendamento';
      this.limparFormularioAgendamento();
    } else {
      console.log('❌ Configurando para NOVO agendamento (tipo:', data.tipo, ')');
      titulo.textContent = 'Novo Agendamento';
      btnExcluir.style.display = 'none';
      this.limparFormularioAgendamento();
      this.preencherDadosIniciais(data);
    }

    // Configurar autocomplete para os campos do modal
    this.setupModalAutocomplete();

    // Mostrar campos de agendamento
    this.alternarTipoRegistro('agendamento');
    
    // Carregar dados do formulário primeiro
    this.carregarDadosFormulario().then(() => {
      // CORREÇÃO: Configurar botão excluir e preencher formulário DEPOIS de carregar dados
      if (data.tipo === 'edicao') {
        console.log('🔧 Configurando botão excluir para edição...');
        console.log('🔍 Botão excluir encontrado:', !!btnExcluir);
        console.log('🔍 Display atual do botão:', btnExcluir.style.display);
        
        // Forçar visibilidade do botão
        btnExcluir.style.display = 'inline-flex';
        btnExcluir.style.visibility = 'visible';
        btnExcluir.classList.remove('d-none');
        
        console.log('✅ Botão excluir configurado:', btnExcluir.style.display);
        this.preencherFormularioAgendamento(data);
      } else {
        console.log('🔧 Escondendo botão excluir para novo agendamento...');
        btnExcluir.style.display = 'none';
      }
    });
    
    showModal('formAgendamento');
  }

  async carregarDadosFormulario() {
    console.log("🔄 Carregando dados do formulário...");
    
    try {
      // Carregar clientes
      console.log("🔍 Carregando clientes...");
      const clientes = await window.services.clientes.list();
      this.preencherSelect('cliente', clientes, 'nome');
      
      // Carregar serviços
      console.log("🔍 Carregando serviços...");
      const servicos = await window.services.servicos.list();
      this.preencherSelect('servico', servicos, 'nome');
      
      // Carregar profissionais
      console.log("🔍 Carregando profissionais...");
      const profissionais = await window.services.profissionais.list();
      this.preencherSelect('profissional', profissionais, 'nome');
      
      console.log("✅ Dados do formulário carregados com sucesso");
    } catch (error) {
      console.error("❌ Erro ao carregar dados do formulário:", error);
    }
  }

  preencherSelect(selectId, lista, campoNome) {
    const select = document.getElementById(selectId);
    if (!select) {
      console.error(`❌ Select #${selectId} não encontrado`);
      return;
    }

    // Limpar opções existentes
    select.innerHTML = '';
    
    // Adicionar opção vazia
    const optionVazia = document.createElement('option');
    optionVazia.value = '';
    optionVazia.textContent = 'Selecione...';
    select.appendChild(optionVazia);
    
    // Adicionar opções da lista
    lista.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item[campoNome];
      select.appendChild(option);
    });
    
    console.log(`✅ Select #${selectId} preenchido com ${lista.length} opções`);
  }

  abrirModalBloqueio(data) {
    this.registroAtual = data;
    this.modalAtual = 'bloqueio';
    
    const modal = document.getElementById('formAgendamento');
    const titulo = document.getElementById('modalTitulo');
    const btnExcluir = document.getElementById('btnExcluir');

    // Configurar modal
    if (data.tipo === 'edicao') {
      titulo.textContent = 'Editar Bloqueio';
      btnExcluir.style.display = 'inline-block';
      this.preencherFormularioBloqueio(data);
    } else {
      titulo.textContent = 'Novo Bloqueio';
      btnExcluir.style.display = 'none';
      this.limparFormularioBloqueio();
      this.preencherDadosIniciaisBloqueio(data);
    }

    // Mostrar campos de bloqueio
    this.alternarTipoRegistro('bloqueio');
    
    showModal('formAgendamento');
  }

  preencherFormularioAgendamento(data) {
    console.log('🔍 Preenchendo formulário com dados:', data);
    
    // CORREÇÃO: Pequeno delay para garantir que os selects estão preenchidos
    setTimeout(() => {
      // Usar IDs em vez de nomes para os selects
      const clienteSelect = document.getElementById('cliente');
      const servicoSelect = document.getElementById('servico');
      const profissionalSelect = document.getElementById('profissional');
      
      console.log('🔍 Verificando selects:', {
        cliente: !!clienteSelect,
        servico: !!servicoSelect,
        profissional: !!profissionalSelect
      });
      
      console.log('🔍 Opções disponíveis:', {
        clienteOptions: clienteSelect ? clienteSelect.options.length : 0,
        servicoOptions: servicoSelect ? servicoSelect.options.length : 0,
        profissionalOptions: profissionalSelect ? profissionalSelect.options.length : 0
      });
      
      if (clienteSelect) clienteSelect.value = data.cliente_id || '';
      if (servicoSelect) servicoSelect.value = data.servico_id || '';
      if (profissionalSelect) profissionalSelect.value = data.profissional_id || '';
      document.getElementById('status').value = data.status || 'agendado';
      document.getElementById('inicio').value = data.inicio || '';
      document.getElementById('fim').value = data.fim || '';
      document.getElementById('observacoes').value = data.observacoes || '';
      
      console.log('✅ Formulário preenchido com IDs:', {
        cliente_id: data.cliente_id,
        servico_id: data.servico_id,
        profissional_id: data.profissional_id,
        cliente_value: clienteSelect ? clienteSelect.value : 'select não encontrado',
        servico_value: servicoSelect ? servicoSelect.value : 'select não encontrado',
        profissional_value: profissionalSelect ? profissionalSelect.value : 'select não encontrado'
      });
    }, 100); // 100ms de delay para garantir que os selects estão prontos
  }

  preencherFormularioBloqueio(data) {
    document.getElementById('tituloBloqueio').value = data.titulo || '';
    document.getElementById('motivoBloqueio').value = data.motivo || '';
    document.getElementById('tipoBloqueio').value = data.tipoBloqueio || 'bloqueio';
    document.getElementById('inicioBloqueio').value = data.inicio || '';
    document.getElementById('fimBloqueio').value = data.fim || '';
    document.getElementById('observacoesBloqueio').value = data.observacoes || '';
    
    // Profissional
    const profissionalSelect = document.getElementById('profissionalBloqueio');
    if (data.profissionalId) {
      profissionalSelect.value = data.profissionalId;
    } else {
      profissionalSelect.value = '';
    }
  }

  preencherDadosIniciais(data) {
    document.getElementById('inicio').value = data.inicio || '';
    document.getElementById('fim').value = data.fim || '';
    document.getElementById('observacoes').value = '';
    document.getElementById('status').value = 'agendado';

    if (data.profissional) {
      document.getElementById('profissional').value = data.profissional;
    }

    this.calcularDuracaoServico();
  }

  preencherDadosIniciaisBloqueio(data) {
    const agora = new Date();
    const inicio = new Date(agora.getTime());
    const fim = new Date(agora.getTime() + 60 * 60000);

    document.getElementById('tituloBloqueio').value = '';
    document.getElementById('motivoBloqueio').value = '';
    document.getElementById('tipoBloqueio').value = 'bloqueio';
    document.getElementById('inicioBloqueio').value = toInputDateTimeValue(inicio);
    document.getElementById('fimBloqueio').value = toInputDateTimeValue(fim);
    document.getElementById('observacoesBloqueio').value = '';
    document.getElementById('profissionalBloqueio').value = '';
  }

  limparFormularioAgendamento() {
    document.getElementById('cliente').value = '';
    document.getElementById('servico').value = '';
    document.getElementById('profissional').value = '';
    document.getElementById('status').value = 'agendado';
    document.getElementById('inicio').value = '';
    document.getElementById('fim').value = '';
    document.getElementById('observacoes').value = '';
  }

  limparFormularioBloqueio() {
    document.getElementById('tituloBloqueio').value = '';
    document.getElementById('motivoBloqueio').value = '';
    document.getElementById('tipoBloqueio').value = 'bloqueio';
    document.getElementById('inicioBloqueio').value = '';
    document.getElementById('fimBloqueio').value = '';
    document.getElementById('observacoesBloqueio').value = '';
    document.getElementById('profissionalBloqueio').value = '';
  }

  alternarTipoRegistro(tipo) {
    const camposAgendamento = document.getElementById('camposAgendamento');
    const camposBloqueio = document.getElementById('camposBloqueio');

    if (tipo === 'agendamento') {
      camposAgendamento.style.display = 'block';
      camposBloqueio.style.display = 'none';
    } else {
      camposAgendamento.style.display = 'none';
      camposBloqueio.style.display = 'block';
    }
  }

  calcularDuracaoServico() {
    const tipoRegistro = document.getElementById('tipoRegistro').value;
    if (tipoRegistro !== 'agendamento') return;

    const servicoInput = document.getElementById('servico');
    const selectedId = servicoInput.dataset.selectedId;
    
    if (!selectedId) return;

    // Buscar duração do serviço pelo ID
    const servico = this.servicosCache?.find(s => s.id == selectedId);
    const duracao = parseInt(servico?.duracao_min || servico?.duracao_minutos || "0", 10);
    
    if (!duracao) return;

    const inicioVal = document.getElementById('inicio').value;
    if (!inicioVal) return;

    const inicio = fromInputDateTimeValue(inicioVal);
    const fim = new Date(inicio.getTime() + duracao * 60000);
    document.getElementById('fim').value = toInputDateTimeValue(fim);
  }

  async salvarRegistro() {
    const btnSalvar = document.getElementById('btnSalvar');
    showLoading(btnSalvar);

    try {
      if (this.modalAtual === 'agendamento') {
        await this.salvarAgendamento();
      } else if (this.modalAtual === 'bloqueio') {
        await this.salvarBloqueio();
      }
      
      this.fecharModal();
      
      // Disparar evento de sucesso
      const eventoSucesso = this.modalAtual === 'agendamento' 
        ? 'modalAgendamentoSalvo' 
        : 'modalBloqueioSalvo';
      
      document.dispatchEvent(new CustomEvent(eventoSucesso));
      
    } catch (error) {
      console.error('Erro ao salvar registro:', error);
      showAlert(error.message || 'Erro ao salvar registro', 'error');
    } finally {
      hideLoading(btnSalvar);
    }
  }

  async salvarAgendamento() {
    console.log('🔍 Iniciando salvarAgendamento...');
    
    const camposObrigatorios = ['cliente', 'servico', 'profissional', 'inicio', 'fim'];
    const camposFaltantes = validateRequired(camposObrigatorios);

    if (camposFaltantes.length > 0) {
      throw new Error('Preencha todos os campos obrigatórios');
    }

    // VERIFICAÇÃO: Obter IDs corretos do autocomplete
    console.log('🔍 VERIFICAÇÃO DE AUTOCOMPLETE ANTES DE COLETAR:');
    const dadosForm = this.getAutocompleteFormData([
      'cliente', 'servico', 'profissional', 'status',
      'inicio', 'fim', 'observacoes'
    ]);
    
    // CORREÇÃO: Mapear para os nomes de campos corretos do banco
    const dados = {
      cliente_id: dadosForm.cliente,
      profissional_id: dadosForm.profissional,
      servico_id: dadosForm.servico,
      status: dadosForm.status || 'agendado',
      data_inicio: dadosForm.inicio,
      data_fim: dadosForm.fim,
      observacoes: dadosForm.observacoes
    };
    
    console.log('🔍 Dados do agendamento a serem salvos:', dados);
      
      // LOG DETALHADO: Verificar todos os campos do formulário
      console.log('🔍 ANÁLISE COMPLETA DOS DADOS:');
      Object.keys(dados).forEach(key => {
        console.log(`  ${key}:`, dados[key], `(Tipo: ${typeof dados[key]})`);
      });

      // VERIFICAÇÃO: Validar IDs antes de enviar
      console.log('🔍 VERIFICAÇÃO DE IDs:');
      // IDs podem ser UUIDs longos ou IDs numéricos curtos, mas não nomes
      if (dados.cliente_id && isNaN(Number(dados.cliente_id)) && dados.cliente_id.length < 10 && !dados.cliente_id.includes('-')) {
        console.error('❌ cliente_id parece ser nome em vez de ID:', dados.cliente_id);
      }
      if (dados.profissional_id && isNaN(Number(dados.profissional_id)) && dados.profissional_id.length < 10 && !dados.profissional_id.includes('-')) {
        console.error('❌ profissional_id parece ser nome em vez de ID:', dados.profissional_id);
      }
      if (dados.servico_id && isNaN(Number(dados.servico_id)) && dados.servico_id.length < 10 && !dados.servico_id.includes('-')) {
        console.error('❌ servico_id parece ser nome em vez de ID:', dados.servico_id);
      }

    // VERSÃO ORIGINAL
    // if (this.registroAtual && this.registroAtual.tipo === 'edicao') {
    //   await dataManager.updateAgendamento(this.registroAtual.realId, dados);
    //   UIUtils.showAlert('Agendamento atualizado com sucesso', 'success');
    // } else {
    //   await dataManager.addAgendamento(dados);
    //   UIUtils.showAlert('Agendamento criado com sucesso', 'success');
    // }

    // NOVA IMPLEMENTAÇÃO V1.2 - EVITAR DUPLO AGENDAMENTO
    try {
      const profissional = Number(dados.profissional_id); // CORREÇÃO: Usar profissional_id
      const novoInicio = new Date(dados.data_inicio); // CORREÇÃO: Usar data_inicio
      const novoFim = new Date(dados.data_fim); // CORREÇÃO: Usar data_fim

      console.log('🔍 Dados para verificação de conflito:', {
        profissional,
        profissional_id: dados.profissional_id,
        novoInicio,
        novoFim,
        novoInicioStr: novoInicio.toString(),
        novoFimStr: novoFim.toString(),
        idExcluir: this.registroAtual?.realId
      });

      // Verificar conflito de horário com outros agendamentos (exceto se for edição do mesmo agendamento)
      const conflitoAgendamento = await this.verificarConflitoAgendamento(
        profissional, 
        novoInicio, 
        novoFim, 
        this.registroAtual?.realId
      );

      console.log('🔍 Resultado da verificação de conflito com agendamentos:', conflitoAgendamento);

      if (conflitoAgendamento && conflitoAgendamento.conflito) {
        console.log('❌ Conflito com agendamento detectado, mostrando modal de confirmação...');
        
        // Mostrar modal de confirmação com detalhes do conflito
        const confirmado = await this.mostrarModalConflito(conflitoAgendamento);
        
        if (!confirmado) {
          // Usuário cancelou, não salvar
          return false;
        }
        
        console.log('✅ Usuário confirmou, prosseguindo com agendamento mesmo com conflito...');
      }

      // Verificar conflito com bloqueios de horário
      const conflitoBloqueio = await this.verificarConflitoBloqueio(
        profissional, 
        novoInicio, 
        novoFim
      );

      console.log('🔍 Resultado da verificação de conflito com bloqueios:', conflitoBloqueio);

      if (conflitoBloqueio && conflitoBloqueio.conflito) {
        console.log('❌ Conflito com bloqueio detectado, lançando erro...');
        throw new Error(conflitoBloqueio.mensagem || 'Este profissional possui um bloqueio nesse horário.');
      }

      console.log('✅ Sem conflito, prosseguindo com salvamento...');
    } catch (error) {
      console.error('❌ Erro na verificação de conflito:', error);
      throw error; // Re-lançar o erro
    }

    // Se não houver conflito, prosseguir com salvamento
    console.log('🔍 Verificando tipo de operação:', this.registroAtual?.tipo);
    
    if (this.registroAtual && this.registroAtual.tipo === 'edicao') {
      console.log('🔧 Atualizando agendamento existente...');
      await window.services.agendamentos.update(this.registroAtual.realId, dados);
      this.showToast('Agendamento atualizado com sucesso', 'success');
    } else {
      console.log('➕ Criando novo agendamento...');
      console.log('🔍 Dados para novo agendamento:', dados);
      await window.services.agendamentos.create(dados);
      this.showToast('Operação realizada com sucesso', 'success');
      console.log('✅ Novo agendamento salvo no banco');
      
      // CORREÇÃO: Limpar cache de agendamentos para forçar recarregamento
      console.log('🗑️ Limpando cache de agendamentos...');
      // Cache é gerenciado automaticamente pelo DataCore
      console.log('✅ Cache de agendamentos limpo');
    }
    
    // CORREÇÃO: Forçar atualização do calendário após salvamento
    console.log('🔄 Atualizando calendário após salvamento...');
    
    // Disparar evento para notificar o calendário (APENAS ISTO!)
    document.dispatchEvent(new CustomEvent('modalAgendamentoSalvo'));
    
    console.log('✅ Evento de atualização disparado - aguardando processamento...');
    
    // CORREÇÃO: Fechar modal após salvamento bem-sucedido
    setTimeout(() => {
      console.log('🔒 Fechando modal...');
      hideModal('formAgendamento');
      console.log('✅ Modal fechado');
    }, 500); // Pequeno delay para garantir que o calendário atualize primeiro
  }

  async salvarBloqueio() {
    const camposObrigatorios = ['tituloBloqueio', 'inicio', 'fim'];
    const camposFaltantes = validateRequired(camposObrigatorios);

    if (camposFaltantes.length > 0) {
      throw new Error('Preencha todos os campos obrigatórios');
    }

    const dados = getFormData(['tituloBloqueio', 'inicio', 'fim']);

    if (this.registroAtual && this.registroAtual.tipo === 'edicao') {
      await window.services.bloqueios.update(this.registroAtual.realId, dados);
      this.showToast('Bloqueio atualizado com sucesso', 'success');
    } else {
      await window.services.bloqueios.create(dados);
      this.showToast('Bloqueio criado com sucesso', 'success');
    }
  }

  // NOVA IMPLEMENTAÇÃO V1.2 - VERIFICAR CONFLITO COM BLOQUEIOS
  async verificarConflitoBloqueio(profissional, novoInicio, novoFim) {
    try {
      console.log('🔍 Verificando conflito com bloqueios:', {
        profissional,
        novoInicio,
        novoFim
      });
      
      // Buscar todos os bloqueios
      const bloqueios = await window.services.bloqueios.list();
      
      // Se não há bloqueios, não pode haver conflito
      if (bloqueios.length === 0) {
        console.log('✅ Nenhum bloqueio existente, sem conflito');
        return { conflito: false };
      }
      
      // Converter profissional para número
      const profissionalId = Number(profissional);
      console.log('🔍 Profissional ID (convertido):', profissionalId);
      
      // Filtrar bloqueios do mesmo profissional (ou bloqueios gerais sem profissional)
      const bloqueiosRelevantes = bloqueios.filter(b => {
        const bloqueioProfissionalId = Number(b.profissional_id);
        // Verificar se é bloqueio do mesmo profissional OU bloqueio geral (sem profissional)
        const mesmoProfissional = bloqueioProfissionalId === profissionalId || !b.profissional_id;
        
        console.log(`🔍 Bloqueio ${b.id}: profissional_id=${bloqueioProfissionalId}, mesmoProfissional=${mesmoProfissional}`);
        
        return mesmoProfissional;
      });
      
      console.log(`🔍 Bloqueios relevantes: ${bloqueiosRelevantes.length}`);
      
      // Se não há bloqueios relevantes, não pode haver conflito
      if (bloqueiosRelevantes.length === 0) {
        console.log('✅ Nenhum bloqueio relevante, sem conflito');
        return { conflito: false };
      }
      
      // Verificar conflito para cada bloqueio relevante
      for (const bloqueio of bloqueiosRelevantes) {
        const bloqueioInicio = new Date(bloqueio.inicio);
        const bloqueioFim = new Date(bloqueio.fim);
        
        console.log(`🔍 Verificando sobreposição com bloqueio:`, {
          bloqueioTitulo: bloqueio.titulo,
          bloqueioInicio,
          bloqueioFim,
          novoInicio,
          novoFim
        });
        
        // Verificar sobreposição de horários
        const temConflito = (
          novoInicio < bloqueioFim && novoFim > bloqueioInicio
        );
        
        if (temConflito) {
          console.log('❌ Conflito com bloqueio detectado:', bloqueio);
          return {
            conflito: true,
            bloqueio: bloqueio,
            mensagem: `Conflito com bloqueio: ${bloqueio.titulo || 'Horário bloqueado'}`
          };
        }
      }
      
      console.log('✅ Nenhum conflito com bloqueios detectado');
      return { conflito: false };
    } catch (error) {
      console.error('Erro ao verificar conflito com bloqueios:', error);
      // Em caso de erro, permitir salvamento para não bloquear sistema
      return { conflito: false };
    }
  }

  // NOVA IMPLEMENTAÇÃO V1.2 - VERIFICAR CONFLITO DE AGENDAMENTO
  async verificarConflitoAgendamento(profissional, novoInicio, novoFim, idExcluir = null) {
    try {
      // ✅ FASE 1: Eliminar duplicação - chamada única
      const agendamentos = await window.services.agendamentos.list();

      console.log('🔍 Verificando conflito de agendamento:', {
        profissional,
        novoInicio,
        novoFim,
        idExcluir,
        totalAgendamentos: agendamentos.length
      });
      
      // Se não há agendamentos, não pode haver conflito
      if (agendamentos.length === 0) {
        console.log('✅ Nenhum agendamento existente, sem conflito');
        return { conflito: false };
      }
      
      // CORREÇÃO: Converter para número
      const profissionalId = Number(profissional);
      console.log('🔍 Profissional ID (convertido):', profissionalId);
      
      // Filtrar agendamentos do mesmo profissional
      const agendamentosProfissional = agendamentos.filter(a => {
        // CORREÇÃO: Converter profissional_id para número para comparação
        const agProfissionalId = Number(a.profissional_id || a.profissional);
        const mesmoProfissional = agProfissionalId === profissionalId;
        const naoEOMesmo = a.id !== idExcluir;
        
        console.log(`🔍 Agendamento ${a.id}: profissional_id=${agProfissionalId}, mesmoProfissional=${mesmoProfissional}, naoEOMesmo=${naoEOMesmo}`);
        
        return mesmoProfissional && naoEOMesmo;
      });
      
      console.log(`🔍 Agendamentos do profissional ${profissionalId}: ${agendamentosProfissional.length}`);
      
      // Se não há agendamentos deste profissional, não pode haver conflito
      if (agendamentosProfissional.length === 0) {
        console.log('✅ Nenhum agendamento deste profissional, sem conflito');
        return { conflito: false };
      }
      
      // Verificar conflito para cada agendamento existente
      for (const agendamento of agendamentosProfissional) {
        const existenteInicio = new Date(agendamento.data_inicio || agendamento.inicio);
        const existenteFim = new Date(agendamento.data_fim || agendamento.fim);
        
        console.log(`🔍 Verificando sobreposição:`, {
          existenteInicio,
          existenteFim,
          novoInicio,
          novoFim,
          existenteInicioStr: existenteInicio.toString(),
          existenteFimStr: existenteFim.toString(),
          novoInicioStr: novoInicio.toString(),
          novoFimStr: novoFim.toString()
        });
        
        // CORREÇÃO: Verificar sobreposição de horários
        const condicao1 = novoInicio < existenteFim;
        const condicao2 = novoFim > existenteInicio;
        const temConflito = condicao1 && condicao2;
        
        console.log(`🔍 Análise de sobreposição:`, {
          condicao1: `${novoInicio} < ${existenteFim} = ${condicao1}`,
          condicao2: `${novoFim} > ${existenteInicio} = ${condicao2}`,
          temConflito: `${condicao1} && ${condicao2} = ${temConflito}`
        });
        
        if (temConflito) {
          console.log('❌ Conflito detectado:', agendamento);
          return {
            conflito: true,
            agendamento: agendamento,
            mensagem: `Conflito com agendamento existente: ${agendamento.cliente} - ${agendamento.servico}`
          };
        }
      }
      
      console.log('✅ Nenhum conflito detectado');
      const resultado = { conflito: false };
      console.log('🔍 Retornando resultado:', resultado);
      return resultado;
    } catch (error) {
      console.error('Erro ao verificar conflito de agendamento:', error);
      // Em caso de erro, permitir salvamento para não bloquear sistema
      return { conflito: false };
    }
  }

  // NOVA IMPLEMENTAÇÃO V1.2 - TOAST NOTIFICATIONS
  showToast(message, type = 'success') {
    // Criar elemento toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Adicionar estilos inline
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
      max-width: 300px;
      word-wrap: break-word;
    `;
    
    // Estilo por tipo
    switch(type) {
      case 'success':
        toast.style.backgroundColor = '#10b981';
        break;
      case 'error':
        toast.style.backgroundColor = '#ef4444';
        break;
      case 'warning':
        toast.style.backgroundColor = '#f59e0b';
        break;
      default:
        toast.style.backgroundColor = '#6b7280';
    }
    
    // Adicionar ao DOM
    document.body.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Remover após 3 segundos
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  async excluirRegistro() {
    if (!this.registroAtual) return;
    
    const confirmacao = await window.confirmDelete({
      title: 'Excluir Registro',
      message: 'Deseja realmente excluir este registro?',
      itemName: this.registroAtual.titulo || 'Registro selecionado',
      confirmText: 'Excluir'
    });

    if (!confirmacao) {
      return;
    }

    try {
      if (this.modalAtual === 'agendamento') {
        await window.services.agendamentos.delete(this.registroAtual.realId);
        showAlert('Agendamento excluído com sucesso', 'success');
      } else if (this.modalAtual === 'bloqueio') {
        await window.services.bloqueios.delete(this.registroAtual.realId);
        showAlert('Bloqueio excluído com sucesso', 'success');
      }
      
      this.fecharModal();
      
      // Disparar evento de sucesso
      const eventoSucesso = this.modalAtual === 'agendamento' 
        ? 'modalAgendamentoSalvo' 
        : 'modalBloqueioSalvo';
      
      document.dispatchEvent(new CustomEvent(eventoSucesso));
      
    } catch (error) {
      console.error('Erro ao excluir registro:', error);
      showAlert(error.message || 'Erro ao excluir registro', 'error');
    }
  }

  fecharModal() {
    hideModal('formAgendamento');
    this.registroAtual = null;
    this.modalAtual = null;
  }

  // ================================
  // MÉTODOS DE AUTOCOMPLETE PARA MODAL
  // ================================

  setupModalAutocomplete() {
    // Carregar cache de serviços para calcularDuracaoServico
    this.loadServicosCache();
    this.setupModalClienteAutocomplete();
    this.setupModalServicoAutocomplete();
    this.setupModalProfissionalAutocomplete();
    console.log('🔧 Autocomplete reabilitado com IDs corretos');
  }

  async loadServicosCache() {
    try {
      this.servicosCache = await window.services.servicos.list();
    } catch (error) {
      console.error('Erro ao carregar cache de serviços:', error);
      this.servicosCache = [];
    }
  }

  getAutocompleteFormData(fields) {
    const data = {};

    fields.forEach(field => {
      const element = document.getElementById(field);
      if (element) {
        // Para campos de autocomplete, precisamos obter o ID selecionado
        if (field === 'cliente' || field === 'servico' || field === 'profissional') {
          // Verificar se é um campo de autocomplete (input) ou select normal
          if (element.tagName === 'INPUT') {
            // Campo autocomplete - obter o ID do atributo data-selected-id ou do valor se já for ID
            const selectedId = element.getAttribute('data-selected-id');
            data[field] = selectedId || element.value;
            console.log(`🔍 Campo ${field} (autocomplete):`, { 
              text: element.value, 
              id: selectedId, 
              final: data[field] 
            });
          } else if (element.tagName === 'SELECT') {
            // Campo select normal - obter o value diretamente
            data[field] = element.value;
            console.log(`🔍 Campo ${field} (select):`, { 
              value: element.value,
              text: element.options[element.selectedIndex]?.text 
            });
          }
        } else {
          // Outros campos normais
          data[field] = element.value;
        }
      }
    });

    return data;
  }

  setupModalClienteAutocomplete() {
    const inputElement = document.getElementById('cliente');
    const dropdown = document.getElementById('clienteModalDropdown');
    
    if (!inputElement || !dropdown) return;

    let selectedIndex = -1;
    let clientes = [];
    let debounceTimer = null;

    // Carregar clientes disponíveis
    const loadClientes = async () => {
      try {
        const todosClientes = await window.services.clientes.list();
        clientes = todosClientes.map(c => ({
          text: c.nome,
          value: c.nome,  // Input mostra o nome
          id: c.id       // ID guardado separadamente
        }));
      } catch (error) {
        console.error('Erro ao carregar clientes:', error);
      }
    };

    // Método para buscar sugestões
    const fetchSuggestions = (query) => {
      if (!query) {
        // Mostrar todos os clientes
        this.showModalClienteSuggestions(clientes, '');
        return;
      }

      const queryLower = query.toLowerCase();
      const filtered = clientes.filter(c => 
        c.text.toLowerCase().includes(queryLower)
      );
      
      this.showModalClienteSuggestions(filtered, query);
    };

    // Debounce
    const debouncedFetch = (query) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchSuggestions(query), 200);
    };

    // Event listeners
    inputElement.addEventListener('input', (e) => {
      selectedIndex = -1;
      debouncedFetch(e.target.value);
    });

    // Mostrar sugestões ao focar no campo
    inputElement.addEventListener('focus', async () => {
      // Fechar todos os outros dropdowns primeiro
      this.hideAllModalDropdowns();
      await loadClientes();
      this.showModalClienteSuggestions(clientes, '');
    });

    // Event listeners de teclado
    inputElement.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('.autocomplete-item');
      
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            this.updateSelection(items, selectedIndex);
            break;
            
          case 'ArrowUp':
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            this.updateSelection(items, selectedIndex);
            break;
            
          case 'Enter':
            e.preventDefault();
            if (selectedIndex >= 0 && items[selectedIndex]) {
              items[selectedIndex].click();
            }
            break;
            
          case 'Escape':
            this.hideModalClienteDropdown();
            break;
        }
      }
    });

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-container')) {
        this.hideModalClienteDropdown();
      }
    });

    // Carregar clientes iniciais
    loadClientes();
  }

  setupModalServicoAutocomplete() {
    const inputElement = document.getElementById('servico');
    const dropdown = document.getElementById('servicoModalDropdown');
    
    if (!inputElement || !dropdown) return;

    let selectedIndex = -1;
    let servicos = [];
    let debounceTimer = null;

    // Carregar serviços disponíveis
    const loadServicos = async () => {
      try {
        const todosServicos = await window.services.servicos.list();
        servicos = todosServicos.map(s => ({
          text: s.nome,
          value: s.nome,  // Input mostra o nome
          id: s.id        // ID guardado separadamente
        }));
      } catch (error) {
        console.error('Erro ao carregar serviços:', error);
      }
    };

    // Método para buscar sugestões
    const fetchSuggestions = (query) => {
      if (!query) {
        // Mostrar todos os serviços
        this.showModalServicoSuggestions(servicos, '');
        return;
      }

      const queryLower = query.toLowerCase();
      const filtered = servicos.filter(s => 
        s.text.toLowerCase().includes(queryLower)
      );
      
      this.showModalServicoSuggestions(filtered, query);
    };

    // Debounce
    const debouncedFetch = (query) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchSuggestions(query), 200);
    };

    // Event listeners
    inputElement.addEventListener('input', (e) => {
      selectedIndex = -1;
      debouncedFetch(e.target.value);
    });

    // Mostrar sugestões ao focar no campo
    inputElement.addEventListener('focus', async () => {
      // Fechar todos os outros dropdowns primeiro
      this.hideAllModalDropdowns();
      await loadServicos();
      this.showModalServicoSuggestions(servicos, '');
    });

    // Event listeners de teclado
    inputElement.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('.autocomplete-item');
      
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            this.updateSelection(items, selectedIndex);
            break;
            
          case 'ArrowUp':
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            this.updateSelection(items, selectedIndex);
            break;
            
          case 'Enter':
            e.preventDefault();
            if (selectedIndex >= 0 && items[selectedIndex]) {
              items[selectedIndex].click();
            }
            break;
            
          case 'Escape':
            this.hideModalServicoDropdown();
            break;
        }
      }
    });

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-container')) {
        this.hideModalServicoDropdown();
      }
    });

    // Carregar serviços iniciais
    loadServicos();
  }

  setupModalProfissionalAutocomplete() {
    const inputElement = document.getElementById('profissional');
    const dropdown = document.getElementById('profissionalModalDropdown');
    
    if (!inputElement || !dropdown) return;

    let selectedIndex = -1;
    let profissionais = [];
    let debounceTimer = null;

    // Carregar profissionais disponíveis
    const loadProfissionais = async () => {
      try {
        const todosProfissionais = await window.services.profissionais.list();
        console.log('🔍 Profissionais carregados:', todosProfissionais);
        profissionais = todosProfissionais.map(p => ({
          text: p.nome,
          value: p.nome,  // Input mostra o nome
          id: p.id        // ID guardado separadamente
        }));
        console.log('🔍 Profissionais mapeados para autocomplete:', profissionais);
      } catch (error) {
        console.error('Erro ao carregar profissionais:', error);
      }
    };

    // Método para buscar sugestões
    const fetchSuggestions = (query) => {
      if (!query) {
        // Mostrar todos os profissionais
        this.showModalProfissionalSuggestions(profissionais, '');
        return;
      }

      const queryLower = query.toLowerCase();
      const filtered = profissionais.filter(p => 
        p.text.toLowerCase().includes(queryLower)
      );
      
      this.showModalProfissionalSuggestions(filtered, query);
    };

    // Debounce
    const debouncedFetch = (query) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchSuggestions(query), 200);
    };

    // Event listeners
    inputElement.addEventListener('input', (e) => {
      selectedIndex = -1;
      debouncedFetch(e.target.value);
    });

    // Mostrar sugestões ao focar no campo
    inputElement.addEventListener('focus', async () => {
      // Fechar todos os outros dropdowns primeiro
      this.hideAllModalDropdowns();
      await loadProfissionais();
      this.showModalProfissionalSuggestions(profissionais, '');
    });

    // Event listeners de teclado
    inputElement.addEventListener('keydown', (e) => {
      const items = dropdown.querySelectorAll('.autocomplete-item');
      
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            this.updateSelection(items, selectedIndex);
            break;
            
          case 'ArrowUp':
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            this.updateSelection(items, selectedIndex);
            break;
            
          case 'Enter':
            e.preventDefault();
            if (selectedIndex >= 0 && items[selectedIndex]) {
              items[selectedIndex].click();
            }
            break;
            
          case 'Escape':
            this.hideModalProfissionalDropdown();
            break;
        }
      }
    });

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-container')) {
        this.hideModalProfissionalDropdown();
      }
    });

    // Carregar profissionais iniciais
    loadProfissionais();
  }

  // Métodos auxiliares para mostrar sugestões do modal
  showModalClienteSuggestions(suggestions, query) {
    const dropdown = document.getElementById('clienteModalDropdown');
    
    if (suggestions.length === 0) {
      dropdown.innerHTML = '<div class="autocomplete-no-results">Nenhum cliente encontrado</div>';
      dropdown.classList.add('show');
      return;
    }

    dropdown.innerHTML = '';
    suggestions.forEach(cliente => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.innerHTML = this.highlightText(cliente.text, query);
      item.dataset.value = cliente.value;
      item.dataset.id = cliente.id;
      
      item.addEventListener('click', () => {
        document.getElementById('cliente').value = cliente.value;
        document.getElementById('cliente').dataset.selectedId = cliente.id;
        this.hideModalClienteDropdown();
        this.calcularDuracaoServico();
      });
      
      dropdown.appendChild(item);
    });
    
    dropdown.classList.add('show');
  }

  showModalServicoSuggestions(suggestions, query) {
    const dropdown = document.getElementById('servicoModalDropdown');
    
    if (suggestions.length === 0) {
      dropdown.innerHTML = '<div class="autocomplete-no-results">Nenhum serviço encontrado</div>';
      dropdown.classList.add('show');
      return;
    }

    dropdown.innerHTML = '';
    suggestions.forEach(servico => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.innerHTML = this.highlightText(servico.text, query);
      item.dataset.value = servico.value;
      item.dataset.id = servico.id;
      
      item.addEventListener('click', () => {
        document.getElementById('servico').value = servico.value;
        document.getElementById('servico').dataset.selectedId = servico.id;
        this.hideModalServicoDropdown();
        this.calcularDuracaoServico();
      });
      
      dropdown.appendChild(item);
    });
    
    dropdown.classList.add('show');
  }

  showModalProfissionalSuggestions(suggestions, query) {
    const dropdown = document.getElementById('profissionalModalDropdown');
    
    if (suggestions.length === 0) {
      dropdown.innerHTML = '<div class="autocomplete-no-results">Nenhum profissional encontrado</div>';
      dropdown.classList.add('show');
      return;
    }

    dropdown.innerHTML = '';
    suggestions.forEach(profissional => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.innerHTML = this.highlightText(profissional.text, query);
      item.dataset.value = profissional.value;
      item.dataset.id = profissional.id;
      
      item.addEventListener('click', () => {
        console.log('🔍 Profissional selecionado:', profissional);
        document.getElementById('profissional').value = profissional.value;
        document.getElementById('profissional').dataset.selectedId = profissional.id;
        console.log('🔍 Dataset após seleção:', {
          value: document.getElementById('profissional').value,
          selectedId: document.getElementById('profissional').dataset.selectedId
        });
        this.hideModalProfissionalDropdown();
      });
      
      dropdown.appendChild(item);
    });
    
    dropdown.classList.add('show');
  }

  // Métodos para esconder dropdowns do modal
  hideModalClienteDropdown() {
    const dropdown = document.getElementById('clienteModalDropdown');
    dropdown.classList.remove('show');
  }

  hideModalServicoDropdown() {
    const dropdown = document.getElementById('servicoModalDropdown');
    dropdown.classList.remove('show');
  }

  hideModalProfissionalDropdown() {
    const dropdown = document.getElementById('profissionalModalDropdown');
    dropdown.classList.remove('show');
  }

  // Método utilitário para highlight
  highlightText(text, query) {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
  }

  // Método utilitário para atualizar seleção
  updateSelection(items, selectedIndex) {
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === selectedIndex);
    });
  }

  // Fechar todos os dropdowns do modal
  hideAllModalDropdowns() {
    this.hideModalClienteDropdown();
    this.hideModalServicoDropdown();
    this.hideModalProfissionalDropdown();
  }

  // ================================
  // MÉTODOS DO MODAL DE CONFLITO
  // ================================

  async mostrarModalConflito(conflitoAgendamento) {
    // Preencher detalhes do conflito primeiro
    await this.preencherDetalhesConflito(conflitoAgendamento);

    return new Promise((resolve) => {
      // Armazenar o resolve para usar depois
      this._conflitoResolve = resolve;
      this._conflitoAgendamento = conflitoAgendamento;

      // Mostrar modal
      showModal('modalConflito');

      // Adicionar handler para ESC
      this._handlers.escConflito = (e) => {
        if (e.key === 'Escape') {
          this.cancelarConflito();
        }
      };
      document.addEventListener('keydown', this._handlers.escConflito);
    });
  }

  async preencherDetalhesConflito(conflitoAgendamento) {
    const detalhesDiv = document.getElementById('detalhesConflito');
    const agendamento = conflitoAgendamento.agendamento;

    // Formatar datas
    const inicio = new Date(agendamento.data_inicio || agendamento.inicio);
    const fim = new Date(agendamento.data_fim || agendamento.fim);
    
    const dataFormatada = inicio.toLocaleDateString('pt-BR');
    const horaInicio = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const horaFim = fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Buscar nomes de cliente e serviço
    let nomeCliente = 'Não informado';
    let nomeServico = 'Não informado';

    try {
      // Buscar cliente pelo ID
      if (agendamento.cliente_id) {
        const cliente = await window.services.clientes.getById(agendamento.cliente_id);
        nomeCliente = cliente?.nome || 'Não informado';
      }

      // Buscar serviço pelo ID
      if (agendamento.servico_id) {
        const servico = await window.services.servicos.getById(agendamento.servico_id);
        nomeServico = servico?.nome || 'Não informado';
      }
    } catch (error) {
      console.error('Erro ao buscar dados do agendamento conflitante:', error);
    }

    detalhesDiv.innerHTML = `
      <h5>Agendamento Existente:</h5>
      <div class="conflito-item">
        <span class="conflito-label">Cliente:</span>
        <span class="conflito-value">${nomeCliente}</span>
      </div>
      <div class="conflito-item">
        <span class="conflito-label">Serviço:</span>
        <span class="conflito-value">${nomeServico}</span>
      </div>
      <div class="conflito-item">
        <span class="conflito-label">Data:</span>
        <span class="conflito-value">${dataFormatada}</span>
      </div>
      <div class="conflito-item">
        <span class="conflito-label">Horário:</span>
        <span class="conflito-value">${horaInicio} - ${horaFim}</span>
      </div>
      <div class="conflito-item">
        <span class="conflito-label">Status:</span>
        <span class="conflito-value">${this.formatarStatus(agendamento.status)}</span>
      </div>
    `;
  }

  formatarStatus(status) {
    const statusMap = {
      'agendado': '📅 Agendado',
      'confirmado': '✅ Confirmado',
      'em_andamento': '⏳ Em Andamento',
      'concluido': '✔️ Concluído',
      'cancelado': '❌ Cancelado',
      'nao_compareceu': '⚠️ Não Compareceu'
    };
    return statusMap[status] || status || 'Não definido';
  }

  fecharModalConflito() {
    hideModal('modalConflito');
    this.limparModalConflito();
  }

  cancelarConflito() {
    // Usuário cancelou - resolve com false
    if (this._conflitoResolve) {
      this._conflitoResolve(false);
      this._conflitoResolve = null;
    }
    this.fecharModalConflito();
  }

  confirmarConflito() {
    // Usuário confirmou - resolve com true
    if (this._conflitoResolve) {
      this._conflitoResolve(true);
      this._conflitoResolve = null;
    }
    this.fecharModalConflito();
  }

  limparModalConflito() {
    // Limpar variáveis
    this._conflitoResolve = null;
    this._conflitoAgendamento = null;

    // Remover handler ESC
    if (this._handlers.escConflito) {
      document.removeEventListener('keydown', this._handlers.escConflito);
      this._handlers.escConflito = null;
    }

    // Limpar detalhes
    const detalhesDiv = document.getElementById('detalhesConflito');
    if (detalhesDiv) {
      detalhesDiv.innerHTML = '';
    }
  }
}

// Exportar para uso global
window.ModalManager = ModalManager;
