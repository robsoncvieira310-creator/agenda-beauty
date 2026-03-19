// Lógica específica da página de agenda
class AgendaPage extends PageManager {
  constructor() {
    super();
    this.currentPage = 'agenda';
    this.calendarManager = null;
    this.modalManager = null;
  }

  needsAgendamentos() {
    return true; // Agenda precisa de todos os dados
  }

  async initializeSpecificPage() {
    console.log('📅 Inicializando página de agenda...');
    
    try {
      // MELHORIA V1.4: Inicialização robusta com fallbacks
      const initPromises = [];
      
      // Inicializar componentes específicos
      initPromises.push(this.initializeCalendar());
      initPromises.push(this.initializeModal());
      
      // Aguardar inicialização básica
      await Promise.allSettled(initPromises);
      
      // Configurar botões específicos
      this.setupAgendaButtons();
      
      // MELHORIA V1.4: Configurar filtros dinâmicos com controle de acesso
      await this.setupFiltros();
      
      // Carregar estatísticas
      await this.updateStatistics();
      
      // Aplicar filtros se houver profissional logado
      const profissionalLogado = await window.dataManager.getProfissionalLogado();
      if (profissionalLogado) {
        this.aplicarFiltros();
      }
      
      console.log(' Página de agenda inicializada com sucesso');
      
    } catch (error) {
      console.error(' Erro na inicialização da agenda:', error);
      this.showError('Erro ao carregar página de agenda');
    }
  }

  async initializeCalendar() {
    try {
      // Validar se CalendarManager está disponível
      if (!window.CalendarManager) {
        throw new Error("CalendarManager não carregado");
      }
      
      this.calendarManager = new window.CalendarManager('calendar');
      await this.calendarManager.initialize();
    } catch (error) {
      console.error('Erro ao inicializar calendário:', error);
      this.showError('Erro ao carregar calendário');
    }
  }

  async initializeModal() {
    try {
      this.modalManager = new ModalManager();
    } catch (error) {
      console.error('Erro ao inicializar modal manager:', error);
      this.showError('Erro ao carregar modais');
    }
  }

  setupAgendaButtons() {
    // Botão Novo Agendamento
    const btnNovoAgendamento = document.getElementById('btnNovoAgendamento');
    if (btnNovoAgendamento) {
      btnNovoAgendamento.addEventListener('click', () => {
        if (this.modalManager) {
          this.modalManager.abrirModalAgendamento({ tipo: 'novo' });
        }
      });
    }

    // Botão Hoje
    const btnHoje = document.getElementById('btnHoje');
    if (btnHoje) {
      btnHoje.addEventListener('click', () => {
        if (this.calendarManager) {
          const calendar = this.calendarManager.getCalendar();
          calendar.today();
        }
      });
    }

    // Botão Atualizar (sobrescrever comportamento padrão)
    const btnAtualizar = document.getElementById('btnAtualizar');
    if (btnAtualizar) {
      // Remover listener padrão e adicionar específico
      btnAtualizar.replaceWith(btnAtualizar.cloneNode(true));
      const newBtnAtualizar = document.getElementById('btnAtualizar');
      
      newBtnAtualizar.addEventListener('click', async () => {
        UIUtils.showLoading(newBtnAtualizar);
        
        try {
          if (this.calendarManager) {
            await this.calendarManager.refreshEvents();
          }
          await this.updateStatistics();
          this.showSuccess('Agenda atualizada com sucesso');
        } catch (error) {
          this.showError('Erro ao atualizar agenda');
        } finally {
          UIUtils.hideLoading(newBtnAtualizar);
        }
      });
    }
  }

  async updateStatistics() {
    try {
      const agendamentos = window.dataManager.agendamentos;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      // MELHORIA V1.4: Cálculos detalhados de estatísticas
      // Agendamentos hoje
      const agendamentosHoje = agendamentos.filter(a => {
        const dataAg = new Date(a.data_inicio || a.inicio);
        return dataAg >= hoje && dataAg < amanha;
      });

      // Confirmados hoje
      const confirmadosHoje = agendamentosHoje.filter(a => 
        a.status === 'confirmado' || a.status === 'confirmado'
      );

      // Próximos agendamentos (próximos 7 dias)
      const proximosAgendamentos = agendamentos.filter(a => {
        const dataAg = new Date(a.data_inicio || a.inicio);
        return dataAg > hoje && dataAg < new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
      });

      // MELHORIA V1.4: Atualizar DOM com validação
      const totalElement = document.getElementById('totalAgendamentos');
      const confirmadosElement = document.getElementById('confirmadosHoje');
      const proximosElement = document.getElementById('proximosAgendamentos');

      if (totalElement) {
        totalElement.textContent = agendamentosHoje.length;
        totalElement.classList.add('stat-updated');
        setTimeout(() => totalElement.classList.remove('stat-updated'), 500);
      }
      
      if (confirmadosElement) {
        confirmadosElement.textContent = confirmadosHoje.length;
        confirmadosElement.classList.add('stat-updated');
        setTimeout(() => confirmadosElement.classList.remove('stat-updated'), 500);
      }
      
      if (proximosElement) {
        proximosElement.textContent = proximosAgendamentos.length;
        proximosElement.classList.add('stat-updated');
        setTimeout(() => proximosElement.classList.remove('stat-updated'), 500);
      }

      // Log detalhado para debug (removível em produção)
      console.log('📊 Estatísticas atualizadas:', {
        hoje: agendamentosHoje.length,
        confirmados: confirmadosHoje.length,
        proximos: proximosAgendamentos.length
      });

    } catch (error) {
      console.error('❌ Erro ao atualizar estatísticas:', error);
    }
  }

  setupAutoRefresh() {
    // Atualizar a cada 30 segundos
    setInterval(() => {
      this.updateStatistics();
    }, 30000);
  }

  // NOVA IMPLEMENTAÇÃO V1.2 - CONFIGURAR FILTROS DINÂMICOS
  async setupFiltros() {
    console.log(' Configurando filtros dinâmicos...');
    
    try {
      // MELHORIA V1.4: CONTROLE DE ACESSO MULTI-PROFISSIONAIS
      // Obter profissional logado
      const profissionalLogado = await window.dataManager.getProfissionalLogado();
      
      if (profissionalLogado) {
        // Se for profissional, mostrar apenas seus agendamentos
        const filtroProfissional = document.getElementById('filtroProfissional');
        if (filtroProfissional) {
          filtroProfissional.innerHTML = `<option value="${profissionalLogado.nome}" selected>${profissionalLogado.nome}</option>`;
          filtroProfissional.disabled = true; // Desabilitar pois só pode ver o próprio
          console.log(' Filtro de profissional configurado para profissional logado:', profissionalLogado.nome);
        }
      } else {
        // Se for admin, mostrar todos os profissionais
        const profissionais = await window.dataManager.getProfissionais();
        
        // Preencher filtro de profissionais
        const filtroProfissional = document.getElementById('filtroProfissional');
        if (filtroProfissional) {
          filtroProfissional.innerHTML = '<option value="">Todos</option>';
          profissionais.forEach(profissional => {
            const option = document.createElement('option');
            option.value = profissional.nome;
            option.textContent = profissional.nome;
            filtroProfissional.appendChild(option);
          });
          console.log(' Filtro de profissional configurado para admin - todos visíveis');
        }
      }
      
      // Preencher filtro de serviços
      const servicos = await window.dataManager.getServicos();
      const filtroServico = document.getElementById('filtroServico');
      if (filtroServico) {
        filtroServico.innerHTML = '<option value="">Todos</option>';
        servicos.forEach(servico => {
          const option = document.createElement('option');
          option.value = servico.nome;
          option.textContent = servico.nome;
          filtroServico.appendChild(option);
        });
      }
      
      // Adicionar event listeners
      this.setupFiltrosListeners();
      
      // MELHORIA V1.4: Aplicar filtros iniciais baseados no profissional
      if (profissionalLogado) {
        setTimeout(() => this.aplicarFiltros(), 100);
      }
      
      console.log(' Filtros configurados com sucesso');
    } catch (error) {
      console.error(' Erro ao configurar filtros:', error);
    }
  }

  setupFiltrosListeners() {
    // Filtro por profissional
    const filtroProfissional = document.getElementById('filtroProfissional');
    if (filtroProfissional) {
      filtroProfissional.addEventListener('change', () => {
        this.aplicarFiltros();
        this.atualizarEstiloFiltro(filtroProfissional);
      });
    }
    
    // Filtro por serviço
    const filtroServico = document.getElementById('filtroServico');
    if (filtroServico) {
      filtroServico.addEventListener('change', () => {
        this.aplicarFiltros();
        this.atualizarEstiloFiltro(filtroServico);
      });
    }
    
    // Filtro por cliente (digitando)
    const filtroCliente = document.getElementById('filtroCliente');
    if (filtroCliente) {
      filtroCliente.addEventListener('input', () => {
        this.aplicarFiltros();
        this.atualizarEstiloFiltro(filtroCliente);
      });
    }
    
    // Botão limpar filtros
    const btnLimparFiltros = document.getElementById('btnLimparFiltros');
    if (btnLimparFiltros) {
      btnLimparFiltros.addEventListener('click', () => {
        this.limparFiltros();
      });
    }
  }

  aplicarFiltros() {
    if (!this.calendarManager) {
      console.log('❌ CalendarManager não disponível');
      return;
    }
    
    const profissional = document.getElementById('filtroProfissional')?.value || '';
    const servico = document.getElementById('filtroServico')?.value || '';
    const cliente = document.getElementById('filtroCliente')?.value || '';
    
    console.log('🔍 Aplicando filtros:', { profissional, servico, cliente });
    
    try {
      // Obter todos os eventos atuais
      const eventosAtuais = this.calendarManager.calendar.getEvents();
      console.log('🔍 Total de eventos atuais:', eventosAtuais.length);
      
      // Remover todos os eventos do calendário
      eventosAtuais.forEach(evento => evento.remove());
      
      // Obter dados filtrados do DataManager
      const agendamentos = window.dataManager.agendamentos || [];
      const bloqueios = window.dataManager.bloqueios || [];
      
      console.log('🔍 Agendamentos no DataManager:', agendamentos.length);
      console.log('🔍 Bloqueios no DataManager:', bloqueios.length);
      
      // MELHORIA V1.4: Filtragem robusta com validação
      const agendamentosFiltrados = agendamentos.filter(agendamento => {
        const matchProfissional = !profissional || 
          (agendamento.profissional && agendamento.profissional === profissional);
        const matchServico = !servico || 
          (agendamento.servico && agendamento.servico === servico);
        const matchCliente = !cliente || 
          (agendamento.cliente && agendamento.cliente.toLowerCase().includes(cliente.toLowerCase()));
        
        const match = matchProfissional && matchServico && matchCliente;
        
        // Log detalhado apenas se houver filtros ativos
        if (profissional || servico || cliente) {
          console.log(`🔍 Agendamento "${agendamento.cliente || 'N/A'} - ${agendamento.servico || 'N/A'}" - Matches:`, {
            match,
            matchProfissional,
            matchServico,
            matchCliente,
            agendamentoProfissional: agendamento.profissional,
            agendamentoServico: agendamento.servico,
            agendamentoCliente: agendamento.cliente
          });
        }
        
        return match;
      });
      
      console.log(`🔍 Agendamentos filtrados: ${agendamentosFiltrados.length}/${agendamentos.length}`);
      
      // Usar o método processarEventos do CalendarManager
      const eventosFormatados = this.calendarManager.processarEventos(agendamentosFiltrados, bloqueios);
      
      // Adicionar eventos ao calendário
      eventosFormatados.forEach(evento => {
        this.calendarManager.calendar.addEvent(evento);
      });
      
      console.log(`✅ Filtros aplicados: ${eventosFormatados.length} eventos adicionados`);
      
      // MELHORIA V1.4: Atualizar estatísticas após filtrar
      this.updateStatistics();
      
    } catch (error) {
      console.error('❌ Erro ao aplicar filtros:', error);
      // Tentar recarregar eventos sem filtros em caso de erro
      this.calendarManager.refreshEvents();
    }
  }

  limparFiltros() {
    console.log('🗑️ Limpando filtros...');
    
    // Limpar valores dos filtros
    const filtroProfissional = document.getElementById('filtroProfissional');
    const filtroServico = document.getElementById('filtroServico');
    const filtroCliente = document.getElementById('filtroCliente');
    
    if (filtroProfissional) {
      filtroProfissional.value = '';
      this.atualizarEstiloFiltro(filtroProfissional);
    }
    
    if (filtroServico) {
      filtroServico.value = '';
      this.atualizarEstiloFiltro(filtroServico);
    }
    
    if (filtroCliente) {
      filtroCliente.value = '';
      this.atualizarEstiloFiltro(filtroCliente);
    }
    
    // Aplicar filtros vazios (mostrar tudo)
    this.aplicarFiltros();
  }

  atualizarEstiloFiltro(elemento) {
    if (elemento.value) {
      elemento.classList.add('has-filter');
    } else {
      elemento.classList.remove('has-filter');
    }
  }

  // Sobrescrever renderPage para agenda
  async renderPage() {
    // Agenda não usa renderPage padrão
    // O calendário é renderizado pelo CalendarManager
  }

  // Sobrescrever handleSearch para agenda
  handleSearch(term) {
    // Implementar busca no calendário se necessário
    console.log('Buscar na agenda:', term);
  }

  // Sobrescrever refreshData para agenda
  async refreshData() {
    const btn = document.getElementById('btnAtualizar');
    if (btn) UIUtils.showLoading(btn);
    
    try {
      // MELHORIA V1.4: Carregamento otimizado com fallback
      await this.loadBaseData();
      
      if (this.calendarManager) {
        await this.calendarManager.refreshEvents();
      }
      
      await this.updateStatistics();
      this.showSuccess('Dados atualizados com sucesso');
      
      // MELHORIA V1.4: Aplicar filtros atuais após refresh
      setTimeout(() => this.aplicarFiltros(), 100);
      
    } catch (error) {
      console.error('❌ Erro ao atualizar dados:', error);
      this.showError('Erro ao atualizar dados');
      
      // MELHORIA V1.4: Tentar recuperação automática
      try {
        if (this.calendarManager) {
          await this.calendarManager.refreshEvents();
        }
      } catch (recoveryError) {
        console.error('❌ Erro na recuperação:', recoveryError);
      }
    } finally {
      if (btn) UIUtils.hideLoading(btn);
    }
  }

  async loadBaseData() {
    // Carregar dados necessários para todas as páginas
    const promises = [];
    
    // Todas as páginas precisam de clientes, serviços e profissionais
    promises.push(dataManager.loadClientes());
    promises.push(dataManager.loadServicos());
    promises.push(dataManager.loadProfissionais());
    
    // Páginas específicas podem precisar de mais dados
    if (this.needsAgendamentos()) {
      promises.push(dataManager.loadAgendamentos());
      promises.push(dataManager.loadBloqueios()); // Adicionar bloqueios
    }
    
    await Promise.all(promises);
  }

  // Métodos específicos da agenda
  async goToToday() {
    if (this.calendarManager) {
      const calendar = this.calendarManager.getCalendar();
      calendar.today();
    }
  }

  async refreshCalendar() {
    if (this.calendarManager) {
      await this.calendarManager.refreshEvents();
    }
  }

  openQuickBlock() {
    if (this.modalManager) {
      this.modalManager.abrirModalBloqueio({ tipo: 'novo' });
    }
  }
}

// Exportar para uso global
window.AgendaPage = AgendaPage;
