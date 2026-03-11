// ModalManager - Gerenciamento de modais e formulários
// VERSÃO: 1.3.0 - CORREÇÃO DEFINITIVA DE CONFLITO
// CACHE-BREAKER: 20260311140300
// IMPORTANTE: LIMPAR CACHE COM CTRL+SHIFT+DELETE

class ModalManager {
  constructor() {
    this.modalAtual = null;
    this.registroAtual = null;
    console.log('🚀 MODALMANAGER V1.3.0 INICIALIZADO - CACHE-BREAKER: 20260311140300');
    console.log('🚀 TIMESTAMP:', new Date().toISOString());
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Escutar eventos do calendário
    document.addEventListener('abrirModalAgendamento', (e) => {
      this.abrirModalAgendamento(e.detail);
    });

    document.addEventListener('abrirModalBloqueio', (e) => {
      this.abrirModalBloqueio(e.detail);
    });

    // Botões de fechar
    document.getElementById('btnFecharModal')?.addEventListener('click', () => {
      this.fecharModal();
    });

    document.getElementById('btnExcluir')?.addEventListener('click', () => {
      this.excluirRegistro();
    });

    document.getElementById('btnSalvar')?.addEventListener('click', () => {
      this.salvarRegistro();
    });

    // Mudança de tipo de registro
    document.getElementById('tipoRegistro')?.addEventListener('change', (e) => {
      this.alternarTipoRegistro(e.target.value);
    });

    // Mudança de serviço para calcular duração
    document.getElementById('servico')?.addEventListener('change', () => {
      this.calcularDuracaoServico();
    });

    // Fechar modal ao clicar fora
    document.getElementById('formAgendamento')?.addEventListener('click', (e) => {
      if (e.target.id === 'formAgendamento') {
        this.fecharModal();
      }
    });
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
    
    UIUtils.showModal('formAgendamento');
  }

  async carregarDadosFormulario() {
    console.log("🔄 Carregando dados do formulário...");
    
    try {
      // Carregar clientes
      console.log("🔍 Carregando clientes...");
      const clientes = await dataManager.getClientes();
      this.preencherSelect('cliente', clientes, 'nome');
      
      // Carregar serviços
      console.log("🔍 Carregando serviços...");
      const servicos = await dataManager.getServicos();
      this.preencherSelect('servico', servicos, 'nome');
      
      // Carregar profissionais
      console.log("🔍 Carregando profissionais...");
      const profissionais = await dataManager.getProfissionais();
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
    
    UIUtils.showModal('formAgendamento');
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
    document.getElementById('inicioBloqueio').value = DateUtils.toInputDateTimeValue(inicio);
    document.getElementById('fimBloqueio').value = DateUtils.toInputDateTimeValue(fim);
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

    const servicoSelect = document.getElementById('servico');
    const duracao = parseInt(servicoSelect.selectedOptions[0]?.dataset.duracao_minutos || "0", 10);
    
    if (!duracao) return;

    const inicioVal = document.getElementById('inicio').value;
    if (!inicioVal) return;

    const inicio = DateUtils.fromInputDateTimeValue(inicioVal);
    const fim = new Date(inicio.getTime() + duracao * 60000);
    document.getElementById('fim').value = DateUtils.toInputDateTimeValue(fim);
  }

  async salvarRegistro() {
    const btnSalvar = document.getElementById('btnSalvar');
    UIUtils.showLoading(btnSalvar);

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
      UIUtils.showAlert(error.message || 'Erro ao salvar registro', 'error');
    } finally {
      UIUtils.hideLoading(btnSalvar);
    }
  }

  async salvarAgendamento() {
    console.log('🔍 Iniciando salvarAgendamento...');
    
    const camposObrigatorios = ['cliente', 'servico', 'profissional', 'inicio', 'fim'];
    const camposFaltantes = FormManager.validateRequired(camposObrigatorios);
    
    if (camposFaltantes.length > 0) {
      throw new Error('Preencha todos os campos obrigatórios');
    }

    const dados = FormManager.getFormData([
      'cliente', 'servico', 'profissional', 'status', 
      'inicio', 'fim', 'observacoes'
    ]);
    
    console.log('🔍 Dados do agendamento a serem salvos:', dados);
      
      // LOG DETALHADO: Verificar todos os campos do formulário
      console.log('🔍 ANÁLISE COMPLETA DOS DADOS:');
      Object.keys(dados).forEach(key => {
        console.log(`  ${key}:`, dados[key], `(Tipo: ${typeof dados[key]})`);
      });

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
      const profissional = Number(dados.profissional); // CORREÇÃO: Converter para número
      const novoInicio = new Date(dados.inicio);
      const novoFim = new Date(dados.fim);

      console.log('🔍 Dados para verificação de conflito:', {
        profissional,
        novoInicio,
        novoFim,
        idExcluir: this.registroAtual?.realId
      });

      // Verificar conflito de horário (exceto se for edição do mesmo agendamento)
      const conflito = await this.verificarConflitoAgendamento(
        profissional, 
        novoInicio, 
        novoFim, 
        this.registroAtual?.realId
      );

      console.log('🔍 Resultado da verificação de conflito:', conflito);
      console.log('🔍 conflito.conflito:', conflito?.conflito);
      console.log('🔍 Verificação final (conflito && conflito.conflito):', conflito && conflito.conflito);

      if (conflito && conflito.conflito) {
        console.log('❌ Conflito detectado, lançando erro...');
        throw new Error('Este profissional já possui um agendamento nesse horário.');
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
      await dataManager.updateAgendamento(this.registroAtual.realId, dados);
      this.showToast('Agendamento atualizado com sucesso', 'success');
    } else {
      console.log('➕ Criando novo agendamento...');
      console.log('🔍 Dados para novo agendamento:', dados);
      await dataManager.addAgendamento(dados);
      this.showToast('Agendamento criado com sucesso', 'success');
      console.log('✅ Novo agendamento salvo no banco');
      
      // CORREÇÃO: Limpar cache de agendamentos para forçar recarregamento
      console.log('🗑️ Limpando cache de agendamentos...');
      dataManager.cache.agendamentos = null;
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
      UIUtils.hideModal('formAgendamento');
      console.log('✅ Modal fechado');
    }, 500); // Pequeno delay para garantir que o calendário atualize primeiro
  }

  async salvarBloqueio() {
    const camposObrigatorios = ['tituloBloqueio', 'inicio', 'fim'];
    const camposFaltantes = FormManager.validateRequired(camposObrigatorios);
    
    if (camposFaltantes.length > 0) {
      throw new Error('Preencha todos os campos obrigatórios');
    }

    const dados = FormManager.getFormData(['tituloBloqueio', 'inicio', 'fim']);

    if (this.registroAtual && this.registroAtual.tipo === 'edicao') {
      await dataManager.updateBloqueio(this.registroAtual.realId, dados);
      this.showToast('Bloqueio atualizado com sucesso', 'success');
    } else {
      await dataManager.addBloqueio(dados);
      this.showToast('Bloqueio criado com sucesso', 'success');
    }
  }

  // NOVA IMPLEMENTAÇÃO V1.2 - VERIFICAR CONFLITO DE AGENDAMENTO
  async verificarConflitoAgendamento(profissional, novoInicio, novoFim, idExcluir = null) {
    try {
      console.log('🔍 Verificando conflito de agendamento:', {
        profissional,
        novoInicio,
        novoFim,
        idExcluir,
        totalAgendamentos: dataManager.agendamentos.length
      });
      
      // Obter todos os agendamentos existentes
      const agendamentos = dataManager.agendamentos;
      
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
          novoFim
        });
        
        // CORREÇÃO: Verificar sobreposição de horários
        const temConflito = (
          novoInicio < existenteFim && novoFim > existenteInicio
        );
        
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
    
    if (!confirm('Deseja realmente excluir este registro?')) {
      return;
    }

    try {
      if (this.modalAtual === 'agendamento') {
        await dataManager.deleteAgendamento(this.registroAtual.realId);
        UIUtils.showAlert('Agendamento excluído com sucesso', 'success');
      } else if (this.modalAtual === 'bloqueio') {
        await dataManager.deleteBloqueio(this.registroAtual.realId);
        UIUtils.showAlert('Bloqueio excluído com sucesso', 'success');
      }
      
      this.fecharModal();
      
      // Disparar evento de sucesso
      const eventoSucesso = this.modalAtual === 'agendamento' 
        ? 'modalAgendamentoSalvo' 
        : 'modalBloqueioSalvo';
      
      document.dispatchEvent(new CustomEvent(eventoSucesso));
      
    } catch (error) {
      console.error('Erro ao excluir registro:', error);
      UIUtils.showAlert(error.message || 'Erro ao excluir registro', 'error');
    }
  }

  fecharModal() {
    UIUtils.hideModal('formAgendamento');
    this.registroAtual = null;
    this.modalAtual = null;
  }
}

// Exportar para uso global
window.ModalManager = ModalManager;
