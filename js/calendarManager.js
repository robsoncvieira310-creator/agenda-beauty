// Gerenciamento do calendário FullCalendar
// VERSÃO: 8.5.0 - GLOBAL MODULE (window.*)
// CACHE-BREAKER: 20260313250000
console.log('🗓️ CalendarManager V8.5.0 carregado - Global Module');

// DEPENDÊNCIAS: window.services, window.showAlert

window.CalendarManager = class CalendarManager {
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
    // TODO: Implementar lookup de serviço via service
    // Por enquanto, usar cores padrão por categoria
    
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
    
    // Usar dados carregados para lookup de cliente
    if (this.clientes && this.clientes.length > 0) {
      const cliente = this.clientes.find(c => c.id === clienteId);
      return cliente ? cliente.nome : `Cliente ${clienteId}`;
    }
    
    return `Cliente ${clienteId}`;
  }
  
  getNomeServico(servicoId) {
    if (!servicoId) return 'Serviço não informado';
    
    // Usar dados carregados para lookup de serviço
    if (this.servicos && this.servicos.length > 0) {
      const servico = this.servicos.find(s => s.id === servicoId);
      return servico ? servico.nome : `Serviço ${servicoId}`;
    }
    
    return `Serviço ${servicoId}`;
  }
  
  getNomeProfissional(profissionalId) {
    if (!profissionalId) return 'Profissional não informado';
    
    // Usar dados carregados para lookup de profissional
    if (this.profissionais && this.profissionais.length > 0) {
      const profissional = this.profissionais.find(p => p.id === profissionalId);
      return profissional ? profissional.nome : 'Sem nome';
    }
    
    return 'Sem nome';
  }

  async initialize() {
    try {
      await this.loadInitialData();
      this.createCalendar();
      this.setupEventHandlers();
      
      // CORREÇÃO CRÍTICA: Adicionar eventos após criar o calendário
      this.adicionarEventosAoCalendario();
      
    } catch (error) {
      console.error('Erro ao inicializar calendário:', error);
      showAlert('Erro ao carregar calendário', 'error');
    }
  }

  async loadInitialData() {
    
    // CORREÇÃO: Carregar clientes, serviços e profissionais PRIMEIRO
    const [clientes, servicos, profissionais] = await Promise.all([
      window.services.clientes.list(),
      window.services.servicos.list(),
      window.services.profissionais.list(),
    ]);
    
        
    // Armazenar dados de referência para lookup posterior
    this.clientes = clientes;
    this.servicos = servicos;
    this.profissionais = profissionais;
    
    // AGORA carregar agendamentos e bloqueios
    const [agendamentos, bloqueios] = await Promise.all([
      window.services.agendamentos.list(),
      window.services.bloqueios.list()
    ]);

        
    this.eventos = this.processarEventos(agendamentos, bloqueios);
    
    // CORREÇÃO: Adicionar eventos ao calendário após processar
    // NÃO chamar aqui - será chamado no initialize() após createCalendar()
  }
  
  // CORREÇÃO: Método separado para adicionar eventos
  adicionarEventosAoCalendario() {
    try {
      // Remover eventos existentes
      this.calendar.removeAllEvents();
      
      // Adicionar novos eventos
      let eventosAdicionados = 0;
      this.eventos.forEach(evento => {
        
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
    
    // Inicializar melhorias após renderizar
    if (window.CalendarEnhancements) {
      this.enhancements = new window.CalendarEnhancements(this);
    }
  }

  processarEventos(agendamentos, bloqueios) {
    const eventosAg = agendamentos.map(a => {
      
      // CORREÇÃO: Mapear campos corretos do banco
      const cliente = this.getNomeCliente(a.cliente_id);
      const servico = this.getNomeServico(a.servico_id);
      const profissional = this.getNomeProfissional(a.profissional_id);
      
      // NOVA LÓGICA: Cor baseada no serviço (personalizada ou padrão)
      const corServico = this.getCorPorServico(servico, a.servico_id);
      // TODO: Mover gerarCorPorStatus para utils
      const corStatus = corServico;
      
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
      
      return evento;
    });

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
        // TODO: Implementar lookup de profissional
        const prof = null;
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
      inicio: window.toInputDateTimeValue(info.start),
      fim: window.toInputDateTimeValue(info.end),
      profissional: null // Simplificar - não usar recursos
    };

    this.abrirModalAgendamento(modalData);
  }

  async handleEventClick(info) {
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
        inicio: window.toInputDateTimeValue(ev.start),
        fim: window.toInputDateTimeValue(ev.end)
      };
      
      // CORREÇÃO: Adicionar IDs que estão no agendamento original
      const agendamentos = await window.services.agendamentos.list();
      const agendamentoOriginal = agendamentos.find(a => a.id == modalData.realId);
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
      showAlert('Edite bloqueios pelo modal', 'warning');
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

      await window.services.agendamentos.update(ev.id, dadosAtualizacao);

      // Cache é gerenciado automaticamente pelo DataCore

      await this.refreshEvents();
      showAlert('Agendamento movido com sucesso', 'success');
      console.log('✅ Agendamento movido com sucesso');
    } catch (error) {
      console.error('❌ Erro ao mover agendamento:', error);
      info.revert();
      showAlert('Erro ao mover agendamento: ' + error.message, 'error');
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
      showAlert('Edite bloqueios pelo modal', 'warning');
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

      await window.services.agendamentos.update(ev.id, dadosAtualizacao);

      // Cache é gerenciado automaticamente pelo DataCore

      await this.refreshEvents();
      showAlert('Duração atualizada com sucesso', 'success');
      console.log('✅ Duração do agendamento atualizada com sucesso');
    } catch (error) {
      console.error('❌ Erro ao redimensionar agendamento:', error);
      info.revert();
      showAlert('Erro ao redimensionar agendamento: ' + error.message, 'error');
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
      await this.loadInitialData();
      
      // CORREÇÃO: Usar o novo método para adicionar eventos
      this.adicionarEventosAoCalendario();
      
    } catch (error) {
      console.error('Erro ao atualizar eventos:', error);
      showAlert('Erro ao atualizar calendário', 'error');
    }
  }

  getCalendar() {
    return this.calendar;
  }
}

// Exportar para uso global
window.CalendarManager = CalendarManager;
