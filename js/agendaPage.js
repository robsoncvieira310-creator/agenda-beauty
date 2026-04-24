// Lógica específica da página de agenda
// DEPENDÊNCIAS: window.services, window.PageManager, window.showLoading, window.hideLoading

window.AgendaPage = class AgendaPage extends window.PageManager {
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
    
    // Inicializar componentes específicos
    await this.initializeCalendar();
    await this.initializeModal();
    
    // Configurar botões específicos
    this.setupAgendaButtons();
    
    // NOVA IMPLEMENTAÇÃO V1.2 - CONFIGURAR FILTROS DINÂMICOS
    await this.setupFiltros();
    
    // Carregar estatísticas
    await this.updateStatistics();
    
    // Configurar atualização automática
    this.setupAutoRefresh();
  }

  async initializeCalendar() {
    try {
      this.calendarManager = new CalendarManager('calendar');
      await this.calendarManager.initialize();
    } catch (error) {
      console.error('Erro ao inicializar calendário:', error);
      this.showError('Erro ao carregar calendário');
    }
  }

  async initializeModal() {
    try {
      this.modalManager = new ModalManager();
      this.modalManager.activate();
    } catch (error) {
      console.error('Erro ao inicializar modal manager:', error);
      this.showError('Erro ao carregar modais');
    }
  }

  setupAgendaButtons() {
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
        showLoading(newBtnAtualizar);
        
        try {
          if (this.calendarManager) {
            await this.calendarManager.refreshEvents();
          }
          await this.updateStatistics();
          this.showSuccess('Agenda atualizada com sucesso');
        } catch (error) {
          this.showError('Erro ao atualizar agenda');
        } finally {
          hideLoading(newBtnAtualizar);
        }
      });
    }
  }

  async updateStatistics() {
    try {
      const agendamentos = await services.agendamentos.list();
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      // Agendamentos hoje
      const agendamentosHoje = agendamentos.filter(a => {
        const dataAg = new Date(a.inicio);
        return dataAg >= hoje && dataAg < amanha;
      });

      // Confirmados hoje
      const confirmadosHoje = agendamentosHoje.filter(a => a.status === 'confirmado');

      // Próximos agendamentos (próximos 7 dias)
      const proximosAgendamentos = agendamentos.filter(a => {
        const dataAg = new Date(a.inicio);
        return dataAg > hoje && dataAg < new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
      });

      // Atualizar DOM
      const totalElement = document.getElementById('totalAgendamentos');
      const confirmadosElement = document.getElementById('confirmadosHoje');
      const proximosElement = document.getElementById('proximosAgendamentos');

      if (totalElement) totalElement.textContent = agendamentosHoje.length;
      if (confirmadosElement) confirmadosElement.textContent = confirmadosHoje.length;
      if (proximosElement) proximosElement.textContent = proximosAgendamentos.length;
    } catch (error) {
      console.error('Erro ao atualizar estatísticas:', error);
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
    
    try {
      // NOVA IMPLEMENTAÇÃO MULTI-PROFISSIONAIS
      // Obter profissional logado de forma segura
      let profissionalLogado = null;
      try {
        profissionalLogado = await services.profissionais.getProfissionalLogado();
      } catch (error) {
        console.warn('[AgendaPage] Erro ao obter profissional logado:', error);
        // Continua como admin se falhar
      }
      
      if (profissionalLogado) {
        // Se for profissional, esconder filtro de profissionais e mostrar apenas ele
        const filtroProfissional = document.getElementById('filtroProfissional');
        if (filtroProfissional) {
          filtroProfissional.innerHTML = `<option value="${profissionalLogado.nome}" selected>${profissionalLogado.nome}</option>`;
          filtroProfissional.disabled = true; // Desabilitar pois só pode ver o próprio
                  }
      } else {
        // Se for admin, mostrar todos os profissionais
        const profissionais = await services.profissionais.list();
        
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
                  }
      }
      
      // Preencher filtro de serviços
      const servicos = await services.servicos.list();
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
      
          } catch (error) {
      console.error('❌ Erro ao configurar filtros:', error);
    }
  }

  setupFiltrosListeners() {
    // Filtro por profissional (com autocomplete)
    const filtroProfissional = document.getElementById('filtroProfissional');
    if (filtroProfissional) {
      this.setupProfissionalAutocomplete(filtroProfissional);
    }
    
    // Filtro por serviço (com autocomplete)
    const filtroServico = document.getElementById('filtroServico');
    if (filtroServico) {
      this.setupServicoAutocomplete(filtroServico);
    }
    
    // Filtro por cliente (com autocomplete)
    const filtroCliente = document.getElementById('filtroCliente');
    if (filtroCliente) {
      this.setupClienteAutocomplete(filtroCliente);
    }
    
    // Filtro por data (com autocomplete)
    const filtroData = document.getElementById('filtroData');
    if (filtroData) {
      this.setupDataAutocomplete(filtroData);
    }
    
    // Botão limpar filtros
    const btnLimparFiltros = document.getElementById('btnLimparFiltros');
    if (btnLimparFiltros) {
      btnLimparFiltros.addEventListener('click', () => {
        this.limparFiltros();
      });
    }
  }

  async aplicarFiltros() {
    if (!this.calendarManager) {
      console.log('❌ CalendarManager não disponível');
      return;
    }

    const profissionalInput = document.getElementById('filtroProfissional');
    const servicoInput = document.getElementById('filtroServico');
    const clienteInput = document.getElementById('filtroCliente');
    const dataInput = document.getElementById('filtroData');
    
    // Usar ID do dataset quando disponível, senão usar texto
    const profissional = profissionalInput?.dataset.selectedId || profissionalInput?.value || '';
    const servico = servicoInput?.dataset.selectedId || servicoInput?.value || '';
    const cliente = clienteInput?.dataset.selectedId || clienteInput?.value || '';
    const data = dataInput?.value || '';

    console.log('🔍 Aplicando filtros:', { profissional, servico, cliente, data });
    console.log('🔍 CalendarManager disponível:', !!this.calendarManager);
    console.log('🔍 Calendar disponível:', !!this.calendarManager.calendar);

    // Obter todos os eventos atuais
    const eventosAtuais = this.calendarManager.calendar.getEvents();
    console.log('🔍 Total de eventos atuais:', eventosAtuais.length);

    // Log detalhado dos eventos
    eventosAtuais.forEach((evento, index) => {
      console.log(`🔍 Evento ${index}:`, {
        title: evento.title,
        tipo: evento.extendedProps?.tipo,
        profissional: evento.extendedProps?.profissional,
        servico: evento.extendedProps?.servico,
        cliente: evento.extendedProps?.cliente
      });
    });

    // Remover todos os eventos do calendário
    eventosAtuais.forEach(evento => evento.remove());

    // Obter dados filtrados via Services
    const agendamentos = await services.agendamentos.list();
    const bloqueios = await services.bloqueios.list();
    
    console.log('🔍 Agendamentos no DataManager:', agendamentos.length);
    console.log('🔍 Bloqueios no DataManager:', bloqueios.length);
    
    // Log detalhado dos bloqueios para diagnóstico
    bloqueios.forEach((bloqueio, index) => {
      console.log(`🔍 Bloqueio ${index} completo:`, bloqueio);
      console.log(`🔍 Bloqueio ${index} - ID do banco:`, bloqueio.id);
      console.log(`🔍 Bloqueio ${index} - Tem ID numérico?:`, !isNaN(parseInt(bloqueio.id)));
    });
    
    // Log detalhado dos agendamentos para diagnóstico
    agendamentos.forEach((agendamento, index) => {
      console.log(`🔍 Agendamento ${index} completo:`, agendamento);
    });
    
    // Buscar clientes uma vez se necessário para filtro de cliente
    let clientes = [];
    if (cliente) {
      clientes = await services.clientes.list();
    }
    
    // Filtrar agendamentos
    const agendamentosFiltrados = agendamentos.filter(agendamento => {
      // Filtro por data específico
      let matchData = true;
      if (data) {
        matchData = this.agendamentoNaData(agendamento, data);
      }
      
      // Senão, usar filtros individuais
      let matchProfissional = !profissional;
      if (profissional) {
        // Tentar匹配 por ID primeiro (mais preciso)
        if (!isNaN(profissional)) {
          matchProfissional = agendamento.profissional_id?.toString() === profissional.toString();
        } else {
          // Se não for número, tentar匹配 por nome
          matchProfissional = agendamento.profissional?.toLowerCase().includes(profissional.toLowerCase());
        }
      }
      
      let matchServico = !servico;
      if (servico) {
        // Tentar匹配 por ID primeiro (mais preciso)
        if (!isNaN(servico)) {
          matchServico = agendamento.servico_id?.toString() === servico.toString();
        } else {
          // Se não for número, tentar匹配 por nome
          matchServico = agendamento.servico?.toLowerCase().includes(servico.toLowerCase());
        }
      }
      
      // Se há filtro de cliente, buscar nome resolvido
      let matchCliente = !cliente;
      if (cliente) {
        const clienteEncontrado = clientes.find(c => c.id === agendamento.cliente_id);
        const nomeCliente = clienteEncontrado?.nome || '';
        matchCliente = nomeCliente.toLowerCase().includes(cliente.toLowerCase());
      }
      
      return matchProfissional && matchServico && matchCliente && matchData;
    });
    
    console.log(`🔍 Agendamentos filtrados: ${agendamentosFiltrados.length}/${agendamentos.length}`);
    
    // Limpar todos os eventos do calendário antes de adicionar novos
    this.calendarManager.calendar.removeAllEvents();
    
    // Usar o método processarEventos do CalendarManager
    const eventosFormatados = this.calendarManager.processarEventos(agendamentosFiltrados, bloqueios);
    
    // Adicionar eventos ao calendário
    eventosFormatados.forEach(evento => {
      this.calendarManager.calendar.addEvent(evento);
    });
    
    // Se houver filtro de data, navegar até essa data
    if (data) {
      const dataFiltroObj = this.parseDataBrasil(data);
      if (dataFiltroObj) {
        this.calendarManager.calendar.gotoDate(dataFiltroObj);
        console.log(`🗓️ Calendário navegado para: ${data}`);
      }
    }
    
    console.log(`✅ Filtros aplicados: ${eventosFormatados.length} eventos adicionados`);
  }

  limparFiltros() {
    console.log('🗑️ Limpando filtros...');
    
    // Limpar valores dos filtros
    const filtroProfissional = document.getElementById('filtroProfissional');
    const filtroServico = document.getElementById('filtroServico');
    const filtroCliente = document.getElementById('filtroCliente');
    const filtroData = document.getElementById('filtroData');
    
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
    
    if (filtroData) {
      filtroData.value = '';
      this.atualizarEstiloFiltro(filtroData);
      this.hideDataDropdown();
    }
    
    // Esconder todos os dropdowns de autocomplete
    this.hideProfissionalDropdown();
    this.hideServicoDropdown();
    this.hideClienteDropdown();
    this.hideDataDropdown();
    
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

  // Método para filtrar opções de um select em tempo real
  filtrarSelectOptions(selectElement, searchTerm) {
    const options = selectElement.querySelectorAll('option');
    const term = searchTerm.toLowerCase();
    
    options.forEach(option => {
      if (option.value === '') {
        // Manter sempre a opção "Todos" visível
        option.style.display = 'block';
        return;
      }
      
      const texto = option.textContent.toLowerCase();
      const corresponde = texto.includes(term);
      option.style.display = corresponde ? 'block' : 'none';
    });
  }

  // Setup do autocomplete para campo de profissional
  setupProfissionalAutocomplete(inputElement) {
    const dropdown = document.getElementById('profissionalDropdown');
    let selectedIndex = -1;
    let profissionais = [];
    let debounceTimer = null;

    // Carregar profissionais disponíveis
    const loadProfissionais = async () => {
      try {
        const todosProfissionais = await services.profissionais.list();
        profissionais = todosProfissionais.map(p => ({
          text: p.nome,
          value: p.nome,
          id: p.id
        }));
      } catch (error) {
        console.error('Erro ao carregar profissionais:', error);
      }
    };

    // Método para buscar sugestões
    const fetchSuggestions = (query) => {
      if (!query) {
        // Mostrar todos os profissionais
        this.showProfissionalSuggestions(profissionais, '');
        return;
      }

      const queryLower = query.toLowerCase();
      const filtered = profissionais.filter(p => 
        p.text.toLowerCase().includes(queryLower)
      );
      
      this.showProfissionalSuggestions(filtered, query);
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
      
      // Aplicar filtros e atualizar estilo
      this.aplicarFiltros();
      this.atualizarEstiloFiltro(inputElement);
    });

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
            this.hideProfissionalDropdown();
            break;
        }
      }
    });

    // Mostrar sugestões ao focar no campo
    inputElement.addEventListener('focus', async () => {
      // Fechar todos os outros dropdowns primeiro
      this.hideAllDropdowns();
      await loadProfissionais();
      // Mostrar todas as sugestões quando o campo recebe foco
      this.showProfissionalSuggestions(profissionais, '');
    });

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-container')) {
        this.hideProfissionalDropdown();
      }
    });

    // Carregar profissionais iniciais
    loadProfissionais();
  }

  // Mostrar sugestões de profissional
  showProfissionalSuggestions(suggestions, query) {
    const dropdown = document.getElementById('profissionalDropdown');
    
    if (suggestions.length === 0) {
      dropdown.innerHTML = '<div class="autocomplete-no-results">Nenhum profissional encontrado</div>';
      dropdown.classList.add('show');
      return;
    }

    const itemsHtml = suggestions.map((suggestion, index) => {
      const highlightedText = this.highlightMatch(suggestion.text, query);
      return `
        <div class="autocomplete-item" data-value="${suggestion.value}" data-id="${suggestion.id}" data-index="${index}">
          <span>${highlightedText}</span>
          <span class="type">Profissional</span>
        </div>
      `;
    }).join('');

    dropdown.innerHTML = itemsHtml;
    dropdown.classList.add('show');

    // Adicionar click handlers
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const value = item.dataset.value;
        const id = item.dataset.id;
        const inputElement = document.getElementById('filtroProfissional');
        
        // Armazenar texto no input e ID no dataset
        inputElement.value = value;
        inputElement.dataset.selectedId = id;
        
        console.log('🔍 Profissional selecionado no filtro:', { text: value, id: id });
        
        // Aplicar filtros
        this.aplicarFiltros();
        
        // Fechar dropdown
        this.hideProfissionalDropdown();
      });
    });
  }

  // Esconder dropdown de profissional
  hideProfissionalDropdown() {
    const dropdown = document.getElementById('profissionalDropdown');
    dropdown.classList.remove('show');
    dropdown.innerHTML = '';
  }

  // Setup do autocomplete para campo de serviço
  setupServicoAutocomplete(inputElement) {
    const dropdown = document.getElementById('servicoDropdown');
    let selectedIndex = -1;
    let servicos = [];
    let debounceTimer = null;

    // Carregar serviços disponíveis
    const loadServicos = async () => {
      try {
        const todosServicos = await services.servicos.list();
        servicos = todosServicos.map(s => ({
          text: s.nome,
          value: s.nome,
          id: s.id
        }));
      } catch (error) {
        console.error('Erro ao carregar serviços:', error);
      }
    };

    // Método para buscar sugestões
    const fetchSuggestions = (query) => {
      if (!query) {
        // Mostrar todos os serviços
        this.showServicoSuggestions(servicos, '');
        return;
      }

      const queryLower = query.toLowerCase();
      const filtered = servicos.filter(s => 
        s.text.toLowerCase().includes(queryLower)
      );
      
      this.showServicoSuggestions(filtered, query);
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
      
      // Aplicar filtros e atualizar estilo
      this.aplicarFiltros();
      this.atualizarEstiloFiltro(inputElement);
    });

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
            this.hideServicoDropdown();
            break;
        }
      }
    });

    // Mostrar sugestões ao focar no campo
    inputElement.addEventListener('focus', async () => {
      // Fechar todos os outros dropdowns primeiro
      this.hideAllDropdowns();
      await loadServicos();
      // Mostrar todas as sugestões quando o campo recebe foco
      this.showServicoSuggestions(servicos, '');
    });

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-container')) {
        this.hideServicoDropdown();
      }
    });

    // Carregar serviços iniciais
    loadServicos();
  }

  // Mostrar sugestões de serviço
  showServicoSuggestions(suggestions, query) {
    const dropdown = document.getElementById('servicoDropdown');
    
    if (suggestions.length === 0) {
      dropdown.innerHTML = '<div class="autocomplete-no-results">Nenhum serviço encontrado</div>';
      dropdown.classList.add('show');
      return;
    }

    const itemsHtml = suggestions.map((suggestion, index) => {
      const highlightedText = this.highlightMatch(suggestion.text, query);
      return `
        <div class="autocomplete-item" data-value="${suggestion.value}" data-id="${suggestion.id}" data-index="${index}">
          <span>${highlightedText}</span>
          <span class="type">Serviço</span>
        </div>
      `;
    }).join('');

    dropdown.innerHTML = itemsHtml;
    dropdown.classList.add('show');

    // Adicionar click handlers
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const value = item.dataset.value;
        const id = item.dataset.id;
        const inputElement = document.getElementById('filtroServico');
        
        // Armazenar texto no input e ID no dataset
        inputElement.value = value;
        inputElement.dataset.selectedId = id;
        
        console.log('🔍 Serviço selecionado no filtro:', { text: value, id: id });
        
        // Aplicar filtros
        this.aplicarFiltros();
        
        // Fechar dropdown
        this.hideServicoDropdown();
      });
    });
  }

  // Esconder dropdown de serviço
  hideServicoDropdown() {
    const dropdown = document.getElementById('servicoDropdown');
    dropdown.classList.remove('show');
    dropdown.innerHTML = '';
  }

  // Setup do autocomplete para campo de cliente
  setupClienteAutocomplete(inputElement) {
    const dropdown = document.getElementById('clienteDropdown');
    let selectedIndex = -1;
    let clientes = [];
    let debounceTimer = null;

    // Carregar clientes disponíveis
    const loadClientes = async () => {
      try {
        const todosClientes = await services.clientes.list();
        clientes = todosClientes.map(c => ({
          text: c.nome,
          value: c.nome,
          id: c.id
        }));
      } catch (error) {
        console.error('Erro ao carregar clientes:', error);
      }
    };

    // Método para buscar sugestões
    const fetchSuggestions = (query) => {
      if (!query) {
        // Mostrar todos os clientes
        this.showClienteSuggestions(clientes, '');
        return;
      }

      const queryLower = query.toLowerCase();
      const filtered = clientes.filter(c => 
        c.text.toLowerCase().includes(queryLower)
      );
      
      this.showClienteSuggestions(filtered, query);
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
      
      // Aplicar filtros e atualizar estilo
      this.aplicarFiltros();
      this.atualizarEstiloFiltro(inputElement);
    });

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
            this.hideClienteDropdown();
            break;
        }
      }
    });

    // Mostrar sugestões ao focar no campo
    inputElement.addEventListener('focus', async () => {
      // Fechar todos os outros dropdowns primeiro
      this.hideAllDropdowns();
      await loadClientes();
      // Mostrar todas as sugestões quando o campo recebe foco
      this.showClienteSuggestions(clientes, '');
    });

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-container')) {
        this.hideClienteDropdown();
      }
    });

    // Carregar clientes iniciais
    loadClientes();
  }

  // Mostrar sugestões de cliente
  showClienteSuggestions(suggestions, query) {
    const dropdown = document.getElementById('clienteDropdown');
    
    if (suggestions.length === 0) {
      dropdown.innerHTML = '<div class="autocomplete-no-results">Nenhum cliente encontrado</div>';
      dropdown.classList.add('show');
      return;
    }

    const itemsHtml = suggestions.map((suggestion, index) => {
      const highlightedText = this.highlightMatch(suggestion.text, query);
      return `
        <div class="autocomplete-item" data-value="${suggestion.value}" data-id="${suggestion.id}" data-index="${index}">
          <span>${highlightedText}</span>
          <span class="type">Cliente</span>
        </div>
      `;
    }).join('');

    dropdown.innerHTML = itemsHtml;
    dropdown.classList.add('show');

    // Adicionar click handlers
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const value = item.dataset.value;
        const id = item.dataset.id;
        const inputElement = document.getElementById('filtroCliente');
        
        // Armazenar texto no input e ID no dataset
        inputElement.value = value;
        inputElement.dataset.selectedId = id;
        
        console.log('🔍 Cliente selecionado no filtro:', { text: value, id: id });
        
        // Aplicar filtros
        this.aplicarFiltros();
        
        // Fechar dropdown
        this.hideClienteDropdown();
      });
    });
  }

  // Esconder dropdown de cliente
  hideClienteDropdown() {
    const dropdown = document.getElementById('clienteDropdown');
    dropdown.classList.remove('show');
    dropdown.innerHTML = '';
  }

  // Setup do autocomplete para campo de data
  setupDataAutocomplete(inputElement) {
    const dropdown = document.getElementById('dataDropdown');
    let selectedIndex = -1;
    let datas = [];
    let debounceTimer = null;

    // Formatar data automaticamente (DD/MM/AAAA)
    const formatarData = (value) => {
      // Remove caracteres não numéricos
      let numeros = value.replace(/\D/g, '');
      
      // Limita a 8 dígitos
      if (numeros.length > 8) {
        numeros = numeros.slice(0, 8);
      }
      
      // Adiciona barras automaticamente
      if (numeros.length >= 2) {
        let formatado = numeros.slice(0, 2);
        if (numeros.length > 2) {
          formatado += '/' + numeros.slice(2, 4);
        }
        if (numeros.length > 4) {
          formatado += '/' + numeros.slice(4, 8);
        }
        return formatado;
      }
      
      return numeros;
    };

    // Validar data
    const validarData = (dataStr) => {
      if (!dataStr || dataStr.length !== 10) return false;
      
      const partes = dataStr.split('/');
      if (partes.length !== 3) return false;
      
      const dia = parseInt(partes[0]);
      const mes = parseInt(partes[1]);
      const ano = parseInt(partes[2]);
      
      if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return false;
      if (dia < 1 || dia > 31) return false;
      if (mes < 1 || mes > 12) return false;
      if (ano < 1900 || ano > 2100) return false;
      
      return true;
    };

    // Método para buscar datas do cliente selecionado
    const fetchDatasCliente = async () => {
      const clienteSelecionado = document.getElementById('filtroCliente')?.value || '';
      
      console.log('🔍 Buscando datas para cliente:', clienteSelecionado || 'TODOS');
      
      if (!clienteSelecionado) {
        // Se não há cliente selecionado, buscar todas as datas
        try {
          const agendamentos = await services.agendamentos.list();
          console.log('🔍 Total de agendamentos encontrados:', agendamentos.length);
          
          const datasUnicas = new Set();
          
          agendamentos.forEach((agendamento, index) => {
            console.log(`🔍 Estrutura COMPLETA agendamento ${index} (todas datas):`, agendamento);
            console.log(`🔍 Campos de data agendamento ${index}:`, {
              id: agendamento.id,
              cliente: agendamento.cliente,
              data_inicio: agendamento.data_inicio,
              data_fim: agendamento.data_fim,
              created_at: agendamento.created_at,
              updated_at: agendamento.updated_at,
              datetime: agendamento.datetime,
              date: agendamento.date
            });
            
            // Tentar diferentes campos de data
            const camposData = ['data_inicio', 'data', 'date', 'created_at', 'datetime'];
            let dataEncontrada = null;
            
            for (const campo of camposData) {
              if (agendamento[campo]) {
                console.log(`🔍 Tentando campo ${campo}:`, agendamento[campo]);
                dataEncontrada = agendamento[campo];
                break;
              }
            }
            
            if (dataEncontrada) {
              try {
                const data = new Date(dataEncontrada);
                const dataFormatada = this.formatarDataParaExibicao(data);
                datasUnicas.add(dataFormatada);
                console.log(`🔍 Data adicionada: ${dataFormatada} (original: ${dataEncontrada})`);
              } catch (error) {
                console.log(`❌ Erro ao converter data ${dataEncontrada}:`, error);
              }
            } else {
              console.log(`⚠️ Agendamento ${index} sem campo de data válido`);
            }
          });
          
          // Converter para array e ordenar da mais recente para mais antiga
          datas = Array.from(datasUnicas).sort((a, b) => {
            const dateA = this.parseDataBrasil(a);
            const dateB = this.parseDataBrasil(b);
            return dateB - dateA; // Ordem decrescente (mais recente primeiro)
          });
          
          console.log('🔍 Datas únicas encontradas (todas):', datas);
          
        } catch (error) {
          console.error('Erro ao buscar datas:', error);
          datas = [];
        }
      } else {
        // Buscar datas do cliente específico
        try {
          const agendamentos = await services.agendamentos.list();
          console.log('🔍 Total de agendamentos encontrados:', agendamentos.length);
          
          const datasCliente = new Set();
          
          // Buscar todos os clientes para resolver nomes
          const clientes = await services.clientes.list();
          const clienteMap = new Map();
          clientes.forEach(cliente => {
            clienteMap.set(cliente.id, cliente.nome);
          });
          
          agendamentos.forEach((agendamento, index) => {
            const nomeCliente = clienteMap.get(agendamento.cliente_id) || 'Cliente não encontrado';
            console.log(`🔍 Estrutura COMPLETA agendamento ${index}:`, agendamento);
            console.log(`🔍 Verificando agendamento ${index} para cliente ${clienteSelecionado}:`, {
              cliente_id: agendamento.cliente_id,
              nome_cliente: nomeCliente,
              cliente_match: nomeCliente.toLowerCase().includes(clienteSelecionado.toLowerCase()),
              id: agendamento.id,
              data_inicio: agendamento.data_inicio,
              data_fim: agendamento.data_fim,
              status: agendamento.status
            });
            
            if (nomeCliente.toLowerCase().includes(clienteSelecionado.toLowerCase())) {
              // Tentar diferentes campos de data
              const camposData = ['data_inicio', 'data', 'date', 'created_at', 'datetime'];
              let dataEncontrada = null;
              
              for (const campo of camposData) {
                if (agendamento[campo]) {
                  console.log(`🔍 Cliente ${clienteSelecionado} - campo ${campo}:`, agendamento[campo]);
                  dataEncontrada = agendamento[campo];
                  break;
                }
              }
              
              if (dataEncontrada) {
                try {
                  const data = new Date(dataEncontrada);
                  const dataFormatada = this.formatarDataParaExibicao(data);
                  datasCliente.add(dataFormatada);
                  console.log(`🔍 Data cliente adicionada: ${dataFormatada} (original: ${dataEncontrada})`);
                } catch (error) {
                  console.log(`❌ Erro ao converter data cliente ${dataEncontrada}:`, error);
                }
              } else {
                console.log(`⚠️ Agendamento cliente ${index} sem campo de data válido`);
              }
            }
          });
          
          // Converter para array e ordenar da mais recente para mais antiga
          datas = Array.from(datasCliente).sort((a, b) => {
            const dateA = this.parseDataBrasil(a);
            const dateB = this.parseDataBrasil(b);
            return dateB - dateA; // Ordem decrescente (mais recente primeiro)
          });
          
          console.log('🔍 Datas encontradas para cliente', clienteSelecionado, ':', datas);
          
        } catch (error) {
          console.error('Erro ao buscar datas do cliente:', error);
          datas = [];
        }
      }
      
      this.showDataSuggestions(datas);
    };

    // Debounce
    const debouncedFetch = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchDatasCliente(), 200);
    };

    // Event listeners
    inputElement.addEventListener('input', (e) => {
      selectedIndex = -1;
      
      // Formatar data automaticamente
      const valorFormatado = formatarData(e.target.value);
      if (e.target.value !== valorFormatado) {
        e.target.value = valorFormatado;
      }
      
      // Se tem data completa, aplicar filtros (sem buscar sugestões)
      if (validarData(valorFormatado)) {
        // Aplicar filtros apenas com data completa e válida
        this.aplicarFiltros();
        this.atualizarEstiloFiltro(inputElement);
      } else {
        this.hideDataDropdown();
        // Não aplicar filtros com data incompleta
        this.atualizarEstiloFiltro(inputElement);
      }
    });

    // Mostrar sugestões ao focar no campo
    inputElement.addEventListener('focus', () => {
      // Fechar todos os outros dropdowns primeiro
      this.hideAllDropdowns();
      
      // Verificar se há cliente selecionado para mostrar datas específicas
      const filtroCliente = document.getElementById('filtroCliente');
      const clienteSelecionado = filtroCliente ? filtroCliente.value.trim() : '';
      
      if (clienteSelecionado) {
        // Mostrar datas do cliente selecionado
        fetchDatasCliente();
      } else {
        // Não mostrar sugestões se não houver cliente selecionado
        // Usuário pode digitar a data manualmente para filtrar
        this.hideDataDropdown();
      }
    });

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
            this.hideDataDropdown();
            break;
        }
      }
    });

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-container')) {
        this.hideDataDropdown();
      }
    });
  }

  // Mostrar sugestões de data
  showDataSuggestions(suggestions) {
    const dropdown = document.getElementById('dataDropdown');
    
    if (suggestions.length === 0) {
      dropdown.innerHTML = '<div class="autocomplete-no-results">Nenhuma data encontrada</div>';
      dropdown.classList.add('show');
      return;
    }

    const itemsHtml = suggestions.map((suggestion, index) => {
      return `
        <div class="autocomplete-item" data-value="${suggestion}" data-index="${index}">
          <span>${suggestion}</span>
          <span class="type">Data</span>
        </div>
      `;
    }).join('');

    dropdown.innerHTML = itemsHtml;
    dropdown.classList.add('show');

    // Adicionar click handlers
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const value = item.dataset.value;
        document.getElementById('filtroData').value = value;
        
        // Aplicar filtros
        this.aplicarFiltros();
        
        // Fechar dropdown
        this.hideDataDropdown();
      });
    });
  }

  // Esconder dropdown de data
  hideDataDropdown() {
    const dropdown = document.getElementById('dataDropdown');
    dropdown.classList.remove('show');
    dropdown.innerHTML = '';
  }

  // Verificar se agendamento está na data específica
  agendamentoNaData(agendamento, dataFiltro) {
    if (!agendamento.data_inicio) return false;
    
    const dataAgendamento = new Date(agendamento.data_inicio);
    const dataFiltroObj = this.parseDataBrasil(dataFiltro);
    
    if (!dataFiltroObj) return false;
    
    // Logs para depuração
    console.log(`🔍 Comparando datas:`, {
      data_inicio: agendamento.data_inicio,
      dataAgendamento: dataAgendamento.toDateString(),
      dataFiltro: dataFiltro,
      dataFiltroObj: dataFiltroObj.toDateString(),
      match: dataAgendamento.toDateString() === dataFiltroObj.toDateString()
    });
    
    // Comparar apenas dia, mês e ano (ignorar hora)
    return dataAgendamento.toDateString() === dataFiltroObj.toDateString();
  }

  // Formatar data para exibição (DD/MM/AAAA)
  formatarDataParaExibicao(data) {
    if (!data) return '';
    
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    
    return `${dia}/${mes}/${ano}`;
  }

  // Parse de data no formato brasileiro (DD/MM/AAAA)
  parseDataBrasil(dataStr) {
    if (!dataStr || dataStr.length !== 10) return null;
    
    const partes = dataStr.split('/');
    if (partes.length !== 3) return null;
    
    const dia = parseInt(partes[0]);
    const mes = parseInt(partes[1]) - 1; // Mês em JS é 0-11
    const ano = parseInt(partes[2]);
    
    if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null;
    
    const data = new Date(ano, mes, dia);
    
    // Validar se a data é válida
    if (data.getDate() !== dia || data.getMonth() !== mes || data.getFullYear() !== ano) {
      return null;
    }
    
    return data;
  }

  // Mostrar autocomplete com sugestões
  showAutocomplete(suggestions, query) {
    const dropdown = document.getElementById('autocompleteDropdown');
    
    if (suggestions.length === 0) {
      dropdown.innerHTML = '<div class="autocomplete-no-results">Nenhum resultado encontrado</div>';
      dropdown.classList.add('show');
      return;
    }

    const itemsHtml = suggestions.map((suggestion, index) => {
      const highlightedText = this.highlightMatch(suggestion.text, query);
      return `
        <div class="autocomplete-item" data-index="${index}">
          <span>${highlightedText}</span>
          <span class="type">${suggestion.type}</span>
        </div>
      `;
    }).join('');

    dropdown.innerHTML = itemsHtml;
    dropdown.classList.add('show');

    // Adicionar click handlers
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        const suggestion = suggestions[index];
        
        // Preencher o campo com o texto completo
        // Nota: filtroGeral não existe no HTML, removendo referência incorreta
        console.log('Autocomplete: filtroGeral removido - elemento não existe no HTML');
        
        // Aplicar filtros
        this.aplicarFiltros();
        
        // Fechar dropdown
        this.hideAutocomplete();
      });
    });
  }

  // Esconder autocomplete
  hideAutocomplete() {
    const dropdown = document.getElementById('autocompleteDropdown');
    dropdown.classList.remove('show');
    dropdown.innerHTML = '';
  }

  // Atualizar seleção com teclado
  updateSelection(items, selectedIndex) {
    items.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  // Destacar parte correspondente do texto
  highlightMatch(text, query) {
    if (!query) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
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
    if (btn) showLoading(btn);
    
    try {
      await this.loadBaseData();
      
      if (this.calendarManager) {
        await this.calendarManager.refreshEvents();
      }
      
      await this.updateStatistics();
      this.showSuccess('Dados atualizados com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar dados:', error);
      this.showError('Erro ao atualizar dados');
    } finally {
      if (btn) hideLoading(btn);
    }
  }

  async loadBaseData() {
    // Carregar dados necessários para todas as páginas
    const promises = [];
    
    // Todas as páginas precisam de clientes, serviços e profissionais
    promises.push(services.clientes.list());
    promises.push(services.servicos.list());
    promises.push(services.profissionais.list());
    
    // Páginas específicas podem precisar de mais dados
    if (this.needsAgendamentos()) {
      promises.push(services.agendamentos.list());
      promises.push(services.bloqueios.list()); // Adicionar bloqueios
    }
    
    await Promise.all(promises);
  }

  // Fechar todos os dropdowns de autocomplete
  hideAllDropdowns() {
    this.hideProfissionalDropdown();
    this.hideServicoDropdown();
    this.hideClienteDropdown();
    this.hideDataDropdown();
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
