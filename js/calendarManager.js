// Gerenciamento do calendário FullCalendar
// VERSÃO: 8.3.0 - CONFLITO COM TRIGGER RESOLVIDO
// CACHE-BREAKER: 20260313250000&t=1710255600000
console.log('🗓️ CalendarManager V8.3.0 carregado - Conflito com trigger resolvido');

class CalendarManager {
  constructor(calendarId) {
    this.calendar = null;
    this.calendarId = calendarId;
    this.eventos = [];
    
    // Mapa de cores baseado em serviços (nova lógica)
    this.coresServicos = {
      // Manicure
      'manicure': '#e91e63',           // Rosa
      'manicure tradicional': '#e91e63',
      'manicure francesa': '#c2185b',
      'manicure com esmaltação': '#d81b60',
      
      // Pedicure
      'pedicure': '#2196f3',           // Azul
      'pedicure tradicional': '#2196f3',
      'pedicure com esmaltação': '#1976d2',
      
      // Alongamento
      'alongamento': '#4caf50',         // Verde
      'alongamento em gel': '#4caf50',
      'alongamento acrílico': '#388e3c',
      'alongamento de fibra': '#43a047',
      
      // Manutenção
      'manutenção': '#ff9800',         // Laranja
      'manutenção alongamento': '#f57c00',
      'reforço': '#ff6f00',
      'manutenção de gel': '#ef6c00',
      
      // Tratamentos
      'tratamento': '#9c27b0',        // Roxo
      'tratamento cutícula': '#7b1fa2',
      'hidratação': '#8e24aa',
      'spa das mãos': '#6a1b9a',
      
      // Serviços diversos
      'depilação': '#795548',          // Marrom
      'design': '#607d8b',             // Azul cinza
      'massagem': '#00bcd4',           // Ciano
      
      // Categoria genérica
      'outros': '#607d8b',             // Azul cinza
      'geral': '#78909c'               // Cinza
    };
  }

  // Método para obter cor baseada no serviço (nova lógica)
  getCorPorServico(nomeServico, servicoId) {
    // Primeiro, tentar obter cor personalizada do serviço pelo ID
    if (servicoId && window.dataManager.servicosPorId && window.dataManager.servicosPorId[servicoId]) {
      const servico = window.dataManager.servicosPorId[servicoId];
      if (servico.cor) {
        return servico.cor;
      }
    }
    
    // Cores padrão por categoria de serviço
    const coresPadrao = {
      'corte': '#4a90e2',
      'manicure': '#e24a90',
      'pedicure': '#90e24a',
      'depilacao': '#e2904a',
      'tratamento': '#4ae290',
      'default': '#78909c'
    };
    
    // Verificar se o nome contém alguma categoria
    const nomeLower = (nomeServico || '').toLowerCase();
    for (const [categoria, cor] of Object.entries(coresPadrao)) {
      if (nomeLower.includes(categoria) && categoria !== 'default') {
        return cor;
      }
    }
    
    return coresPadrao.default;
  }
  
  // Métodos auxiliares para obter nomes por ID
  getNomeCliente(clienteId) {
    if (!clienteId) return 'Cliente não informado';
    
    const cliente = window.dataManager.clientesPorId[clienteId];
    return cliente ? cliente.nome : `Cliente ${clienteId}`;
  }
  
  getNomeServico(servicoId) {
    if (!servicoId) return 'Serviço não informado';
    
    const servico = window.dataManager.servicosPorId[servicoId];
    return servico ? servico.nome : `Serviço ${servicoId}`;
  }
  
  getNomeProfissional(profissionalId) {
    if (!profissionalId) return 'Profissional não informado';
    
    const profissional = window.dataManager.profissionaisPorId[profissionalId];
    if (profissional && profissional.nome) {
      return profissional.nome;
    }
    
    // CORREÇÃO: Tentar encontrar no array principal
    const profissionalAlt = window.dataManager.profissionais.find(p => p.id == profissionalId);
    if (profissionalAlt && profissionalAlt.nome) {
      return profissionalAlt.nome;
    }
    
    return `Profissional não encontrado (${profissionalId})`;
  }

  async initialize() {
    try {
      await this.loadInitialData();
      this.createCalendar();
      this.setupEventHandlers();
      
      // CORREÇÃO CRÍTICA: Adicionar eventos após criar o calendário
      console.log("🔍 DEBUG - Calendário criado, adicionando eventos...");
      this.adicionarEventosAoCalendario();
      
    } catch (error) {
      console.error('Erro ao inicializar calendário:', error);
      UIUtils.showAlert('Erro ao carregar calendário', 'error');
    }
  }

  async loadInitialData() {
    console.log("🔄 Carregando dados iniciais do calendário...");
    
    // CORREÇÃO: Carregar clientes, serviços e profissionais PRIMEIRO
    const [clientes, servicos, profissionais] = await Promise.all([
      window.dataManager.getClientes(),
      window.dataManager.getServicos(),
      window.dataManager.getProfissionais()
    ]);
    
    console.log("✅ Dados de referência carregados:", { clientes, servicos, profissionais });
    
    // AGORA carregar agendamentos e bloqueios
    const [agendamentos, bloqueios] = await Promise.all([
      window.dataManager.loadAgendamentos(),
      window.dataManager.loadBloqueios()
    ]);

    console.log("✅ Todos os dados carregados:", { clientes, servicos, profissionais, agendamentos, bloqueios });
    
    // DEBUG: Verificar estrutura dos agendamentos
    console.log("🔍 DEBUG - Estrutura dos agendamentos:", agendamentos);
    if (agendamentos && agendamentos.length > 0) {
      console.log("🔍 DEBUG - Primeiro agendamento:", agendamentos[0]);
      console.log("🔍 DEBUG - Campos do agendamento:", Object.keys(agendamentos[0]));
    }
    
    this.eventos = this.processarEventos(agendamentos, bloqueios);
    
    // DEBUG: Verificar eventos processados
    console.log("🔍 DEBUG - Eventos processados:", this.eventos);
    console.log("🔍 DEBUG - Quantidade de eventos:", this.eventos.length);
    
    // CORREÇÃO: Adicionar eventos ao calendário após processar
    // NÃO chamar aqui - será chamado no initialize() após createCalendar()
  }
  
  // CORREÇÃO: Método separado para adicionar eventos
  adicionarEventosAoCalendario() {
    try {
      console.log("🔍 DEBUG - Adicionando eventos ao calendário...");
      
      // Remover eventos existentes
      this.calendar.removeAllEvents();
      
      // Adicionar novos eventos
      let eventosAdicionados = 0;
      this.eventos.forEach(evento => {
        console.log("🔍 DEBUG - Adicionando evento:", evento);
        
        const eventoCompleto = {
          ...evento,
          editable: true,
          startEditable: true,
          durationEditable: true,
          extendedProps: evento.extendedProps || {}
        };
        
        this.calendar.addEvent(eventoCompleto);
        eventosAdicionados++;
      });
      
      console.log("🔍 DEBUG - Eventos adicionados:", eventosAdicionados);
      console.log("🔍 DEBUG - Eventos no calendário:", this.calendar.getEvents());
      
      // Forçar renderização
      this.calendar.render();
      
    } catch (error) {
      console.error('❌ Erro ao adicionar eventos:', error);
    }
  }

  createCalendar() {
    const calendarEl = document.getElementById(this.calendarId);
    if (!calendarEl) {
      throw new Error(`Elemento #${this.calendarId} não encontrado`);
    }

    this.calendar = new FullCalendar.Calendar(calendarEl, {
      locale: "pt-br",
      height: "auto",
      aspectRatio: 1.8,
      slotMinTime: "06:00:00",
      slotMaxTime: "23:00:00",
      slotDuration: "00:30:00",
      slotLabelInterval: "01:00:00",
      slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      initialView: "timeGridWeek",

      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek"
      },

      // Configurações Google Agenda style
      allDaySlot: false,
      nowIndicator: true,
      scrollTime: "08:00:00",
      businessHours: {
        daysOfWeek: [1, 2, 3, 4, 5], // Segunda a Sexta
        startTime: '09:00',
        endTime: '18:00'
      },

      // Traduções personalizadas
      buttonText: {
        today:    'Hoje',
        month:    'Mês',
        week:     'Semana',
        day:      'Dia',
        list:     'Lista'
      },
      
      allDayText: 'Dia inteiro',
      moreLinkText: function(n) {
        return '+ mais ' + n
      },
      noEventsText: 'Nenhum evento para mostrar',
      
      // Configurações de tooltip e mensagens
      // eventLimitText removido - obsoleto no FullCalendar v6
      
      // Títulos das views
      views: {
        month: {
          titleFormat: { month: 'long', year: 'numeric' }
        },
        week: {
          titleFormat: { day: 'numeric', month: 'short', year: 'numeric' }
        },
        day: {
          titleFormat: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
        },
        listWeek: {
          titleFormat: { month: 'long', year: 'numeric' }
        }
      },
      
      // Formatação de datas
      dayHeaderFormat: { weekday: 'short' },
      slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      
      // Configurações explícitas para drag and drop
      editable: true,
      eventStartEditable: true,
      eventDurationEditable: true,
      selectable: true,
      droppable: true,

      // CORREÇÃO: Não definir eventos aqui - serão adicionados via addEvent()
      events: [],

      selectAllow: (selectInfo) => {
        return this.verificarDisponibilidade(selectInfo);
      },

      select: (info) => {
        this.handleSelect(info);
      },

      eventClick: (info) => {
        this.handleEventClick(info);
      },

      eventDrop: async (info) => {
        await this.handleEventDrop(info);
      },

      eventResize: async (info) => {
        await this.handleEventResize(info);
      },

      // Adicionar data attributes para tooltips
      eventDidMount: (info) => {
        const event = info.event;
        const el = info.el;
        
        // Adicionar data attributes para tooltips e estilos
        el.setAttribute('data-status', event.extendedProps.status || 'agendado');
        el.setAttribute('data-profissional', event.extendedProps.profissional || '');
        el.setAttribute('data-cliente', event.extendedProps.cliente || '');
        
        // Adicionar referência ao evento para tooltips
        el.fcEvent = event;
      }
    });

    this.calendar.render();
    
    // CORREÇÃO: Verificar e habilitar drag & drop
    console.log("🔍 DEBUG - Verificando suporte a drag & drop");
    console.log("🔍 DEBUG - Configurações do calendário:", {
      editable: this.calendar.getOption('editable'),
      eventStartEditable: this.calendar.getOption('eventStartEditable'),
      eventDurationEditable: this.calendar.getOption('eventDurationEditable'),
      droppable: this.calendar.getOption('droppable')
    });
    
    // Inicializar melhorias após renderizar
    if (window.CalendarEnhancements) {
      this.enhancements = new window.CalendarEnhancements(this);
    }
  }

  processarEventos(agendamentos, bloqueios) {
    console.log("🔍 DEBUG - processarEventos iniciado");
    console.log("🔍 DEBUG - agendamentos recebidos:", agendamentos);
    console.log("🔍 DEBUG - bloqueios recebidos:", bloqueios);
    
    const eventosAg = agendamentos.map(a => {
      console.log("🔍 DEBUG - Processando agendamento:", a);
      
      // CORREÇÃO: Mapear campos corretos do banco
      const cliente = this.getNomeCliente(a.cliente_id);
      const servico = this.getNomeServico(a.servico_id);
      const profissional = this.getNomeProfissional(a.profissional_id);
      
      console.log("🔍 DEBUG - Nomes resolvidos:", { cliente, servico, profissional });
      
      // NOVA LÓGICA: Cor baseada no serviço (personalizada ou padrão)
      const corServico = this.getCorPorServico(servico, a.servico_id);
      const corStatus = window.dataManager.gerarCorPorStatus(a.status, corServico);
      
      console.log("🔍 DEBUG - Cores geradas:", { corServico, corStatus });
      
      const evento = {
        id: String(a.id),
        title: `${cliente} - ${servico}`,
        start: a.data_inicio,  // CORREÇÃO: usar data_inicio
        end: a.data_fim,       // CORREÇÃO: usar data_fim
        // CORREÇÃO: Propriedades explícitas para drag & drop
        editable: true,
        startEditable: true,
        durationEditable: true,
        extendedProps: {
          tipo: "agendamento",
          realId: a.id,
          cliente_id: a.cliente_id,
          servico_id: a.servico_id,
          profissional_id: a.profissional_id,
          cliente: cliente,
          servico: servico,
          profissional: profissional,
          status: a.status || "agendado",
          observacoes: a.observacoes || ""
        },
        // Estilo Google Agenda com cores baseadas em serviço
        backgroundColor: corServico,
        borderColor: corServico,
        textColor: "#ffffff",
        classNames: [`evento-agendamento`, `status-${a.status || "agendado"}`, `servico-${a.servico_id}`],
        // Formatação do título
        display: 'block'
      };
      
      console.log("🔍 DEBUG - Evento criado:", evento);
      return evento;
    });

    console.log("🔍 DEBUG - Eventos de agendamento criados:", eventosAg);

    const eventosBlq = [];
    
    bloqueios.forEach(b => {
      const base = {
        title: b.titulo || "Bloqueio",
        start: b.inicio,
        end: b.fim,
        classNames: ["evento-bloqueio"],
        editable: false,
        extendedProps: {
          tipo: "bloqueio",
          realId: b.id,
          titulo: b.titulo || "",
          motivo: b.motivo || "",
          tipoBloqueio: b.tipo || "",
          profissionalId: b.profissional_id || null
        },
        // Estilo Google Agenda para bloqueios
        backgroundColor: "#5f6368",
        borderColor: "#3c4043",
        textColor: "#ffffff",
        display: 'block'
      };

      if (b.profissional_id) {
        const prof = window.dataManager.profissionaisPorId[b.profissional_id];
        if (prof) {
          eventosBlq.push({
            id: `b-${b.id}-${prof.id}`,
            title: `${b.titulo || "Bloqueio"} (${prof.nome})`,
            start: b.inicio,
            end: b.fim,
            classNames: ["evento-bloqueio"],
            editable: false,
            extendedProps: {
              tipo: "bloqueio",
              realId: b.id,
              titulo: b.titulo || "",
              motivo: b.motivo || "",
              tipoBloqueio: b.tipo || "",
              profissionalId: b.profissional_id,
              profissional: prof.nome
            },
            // Estilo Google Agenda para bloqueios
            backgroundColor: "#5f6368",
            borderColor: "#3c4043",
            textColor: "#ffffff",
            display: 'block'
          });
        }
      } else {
        eventosBlq.push({
          ...base,
          id: `b-${b.id}`,
          title: b.titulo || "Bloqueio Geral"
        });
      }
    });

    return [...eventosAg, ...eventosBlq];
  }

  verificarDisponibilidade(selectInfo) {
    const events = this.calendar.getEvents().filter(ev => 
      ev.extendedProps && ev.extendedProps.tipo === "bloqueio"
    );
    
    const inicioSel = selectInfo.start;
    const fimSel = selectInfo.end;
    const resourceId = selectInfo.resource && selectInfo.resource.id;

    for (const ev of events) {
      // Remover verificação de recursos que não existe
      const mesmoProf = true; // Simplificar por enquanto
      
      if (!mesmoProf) continue;
      
      if (!(fimSel <= ev.start || inicioSel >= ev.end)) {
        return false;
      }
    }
    
    return true;
  }

  handleSelect(info) {
    this.calendar.unselect();
    
    const modalData = {
      tipo: 'agendamento',
      inicio: DateUtils.toInputDateTimeValue(info.start),
      fim: DateUtils.toInputDateTimeValue(info.end),
      profissional: null // Simplificar - não usar recursos
    };

    this.abrirModalAgendamento(modalData);
  }

  handleEventClick(info) {
    const ev = info.event;
    const tipo = ev.extendedProps && ev.extendedProps.tipo;

    console.log('🔍 Evento clicado:', {
      id: ev.id,
      title: ev.title,
      tipo: tipo,
      extendedProps: ev.extendedProps
    });

    if (tipo === "bloqueio") {
      console.log('🔧 Abrindo modal de bloqueio...');
      this.abrirModalBloqueio(ev.extendedProps);
    } else {
      console.log('🔧 Abrindo modal de agendamento para edição...');
      const modalData = {
        ...ev.extendedProps,               // Primeiro os dados do evento
        tipo: 'edicao',                    // DEPOIS sobrescreve com 'edicao'
        inicio: DateUtils.toInputDateTimeValue(ev.start),
        fim: DateUtils.toInputDateTimeValue(ev.end)
      };
      
      // CORREÇÃO: Adicionar IDs que estão no agendamento original
      const agendamentoOriginal = window.dataManager.agendamentos.find(a => a.id == modalData.realId);
      if (agendamentoOriginal) {
        console.log('🔍 Agendamento original encontrado:', agendamentoOriginal);
        modalData.cliente_id = agendamentoOriginal.cliente_id;
        modalData.servico_id = agendamentoOriginal.servico_id;
        modalData.profissional_id = agendamentoOriginal.profissional_id;
        console.log('✅ IDs adicionados:', {
          cliente_id: modalData.cliente_id,
          servico_id: modalData.servico_id,
          profissional_id: modalData.profissional_id
        });
      } else {
        console.warn('⚠️ Agendamento original não encontrado para ID:', modalData.realId);
      }
      
      console.log('📦 Dados sendo enviados para o modal:', modalData);
      this.abrirModalAgendamento(modalData);
    }
  }

  async handleEventDrop(info) {
    const ev = info.event;
    const tipo = ev.extendedProps && ev.extendedProps.tipo;
    const eventoData = ev.extendedProps;

    console.log('🔄 EventDrop acionado:', {
      id: ev.id,
      title: ev.title,
      tipo: tipo,
      oldStart: info.oldEvent.start,
      newStart: ev.start,
      oldEnd: info.oldEvent.end,
      newEnd: ev.end
    });

    console.log('📦 Dados completos do evento:', eventoData);
    console.log('🔍 IDs disponíveis:', {
      cliente_id: eventoData.cliente_id,
      servico_id: eventoData.servico_id,
      profissional_id: eventoData.profissional_id
    });

    if (tipo === "bloqueio") {
      console.log('🚫 Bloqueio detectado, revertendo...');
      info.revert();
      UIUtils.showAlert('Edite bloqueios pelo modal', 'warning');
      return;
    }

    try {
      // Obter dados do evento - CORREÇÃO: Extrair IDs corretamente
      console.log('📦 Dados do evento:', eventoData);

      // CORREÇÃO: Extrair IDs dos dados do evento
      // CORREÇÃO CRÍTICA: Converter para horário local antes de enviar
      const dadosAtualizacao = {
        cliente_id: eventoData.cliente_id,
        servico_id: eventoData.servico_id,
        profissional_id: eventoData.profissional_id,
        data_inicio: new Date(ev.start.getTime() - ev.start.getTimezoneOffset() * 60000).toISOString().slice(0, 19),
        data_fim: new Date(ev.end.getTime() - ev.end.getTimezoneOffset() * 60000).toISOString().slice(0, 19),
        status: eventoData.status || 'agendado',
        observacoes: eventoData.observacoes || null
      };

      console.log('📝 Dados formatados para atualização:', dadosAtualizacao);
      console.log('🔍 Horários do evento:', {
        start: ev.start,
        end: ev.end,
        startISO: ev.start.toISOString(),
        endISO: ev.end.toISOString(),
        startLocal: new Date(ev.start.getTime() - ev.start.getTimezoneOffset() * 60000).toISOString().slice(0, 19),
        endLocal: new Date(ev.end.getTime() - ev.end.getTimezoneOffset() * 60000).toISOString().slice(0, 19)
      });

      await window.dataManager.updateAgendamento(ev.id, dadosAtualizacao);

      // Limpar cache para forçar recarregamento
      window.dataManager.cache.agendamentos = null;

      await this.refreshEvents();
      UIUtils.showAlert('Agendamento movido com sucesso', 'success');
      console.log('✅ Agendamento movido com sucesso');
    } catch (error) {
      console.error('❌ Erro ao mover agendamento:', error);
      info.revert();
      UIUtils.showAlert('Erro ao mover agendamento: ' + error.message, 'error');
    }
  }

  async handleEventResize(info) {
    const ev = info.event;
    const tipo = ev.extendedProps && ev.extendedProps.tipo;
    const eventoData = ev.extendedProps;

    console.log('📏 EventResize acionado:', {
      id: ev.id,
      title: ev.title,
      tipo: tipo,
      oldStart: info.oldEvent.start,
      newStart: ev.start,
      oldEnd: info.oldEvent.end,
      newEnd: ev.end
    });

    console.log('📦 Dados completos do evento:', eventoData);
    console.log('🔍 IDs disponíveis:', {
      cliente_id: eventoData.cliente_id,
      servico_id: eventoData.servico_id,
      profissional_id: eventoData.profissional_id
    });

    if (tipo === "bloqueio") {
      console.log('🚫 Bloqueio detectado, revertendo...');
      info.revert();
      UIUtils.showAlert('Edite bloqueios pelo modal', 'warning');
      return;
    }

    try {
      // Obter dados do evento
      console.log('📦 Dados do evento:', eventoData);

      // CORREÇÃO: Extrair IDs dos dados do evento
      // CORREÇÃO CRÍTICA: Converter para horário local antes de enviar
      const dadosAtualizacao = {
        cliente_id: eventoData.cliente_id,
        servico_id: eventoData.servico_id,
        profissional_id: eventoData.profissional_id,
        data_inicio: new Date(ev.start.getTime() - ev.start.getTimezoneOffset() * 60000).toISOString().slice(0, 19),
        data_fim: new Date(ev.end.getTime() - ev.end.getTimezoneOffset() * 60000).toISOString().slice(0, 19),
        status: eventoData.status || 'agendado',
        observacoes: eventoData.observacoes || null
      };

      console.log('📝 Atualizando duração do agendamento:', dadosAtualizacao);
      console.log('🔍 Horários do evento:', {
        start: ev.start,
        end: ev.end,
        startISO: ev.start.toISOString(),
        endISO: ev.end.toISOString(),
        startLocal: new Date(ev.start.getTime() - ev.start.getTimezoneOffset() * 60000).toISOString().slice(0, 19),
        endLocal: new Date(ev.end.getTime() - ev.end.getTimezoneOffset() * 60000).toISOString().slice(0, 19)
      });

      await window.dataManager.updateAgendamento(ev.id, dadosAtualizacao);

      // Limpar cache para forçar recarregamento
      window.dataManager.cache.agendamentos = null;

      await this.refreshEvents();
      UIUtils.showAlert('Duração atualizada com sucesso', 'success');
      console.log('✅ Duração do agendamento atualizada com sucesso');
    } catch (error) {
      console.error('❌ Erro ao redimensionar agendamento:', error);
      info.revert();
      UIUtils.showAlert('Erro ao redimensionar agendamento: ' + error.message, 'error');
    }
  }

  abrirModalAgendamento(data) {
    // Disparar evento customizado para o modal
    const event = new CustomEvent('abrirModalAgendamento', { detail: data });
    document.dispatchEvent(event);
  }

  abrirModalBloqueio(data) {
    // Disparar evento customizado para o modal
    const event = new CustomEvent('abrirModalBloqueio', { detail: data });
    document.dispatchEvent(event);
  }

  setupEventHandlers() {
    // Escutar eventos dos modais
    document.addEventListener('modalAgendamentoSalvo', () => {
      this.refreshEvents();
    });

    document.addEventListener('modalBloqueioSalvo', () => {
      this.refreshEvents();
    });
  }

  async refreshEvents() {
    try {
      console.log("🔍 DEBUG - refreshEvents iniciado");
      await this.loadInitialData();
      
      // CORREÇÃO: Usar o novo método para adicionar eventos
      this.adicionarEventosAoCalendario();
      
    } catch (error) {
      console.error('Erro ao atualizar eventos:', error);
      UIUtils.showAlert('Erro ao atualizar calendário', 'error');
    }
  }

  getCalendar() {
    return this.calendar;
  }
}

// Exportar para uso global
window.CalendarManager = CalendarManager;
