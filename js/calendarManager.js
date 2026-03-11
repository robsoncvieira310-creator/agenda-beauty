// Gerenciamento do calendário FullCalendar
class CalendarManager {
  constructor(calendarId) {
    this.calendar = null;
    this.calendarId = calendarId;
    this.eventos = [];
  }

  async initialize() {
    try {
      await this.loadInitialData();
      this.createCalendar();
      this.setupEventHandlers();
    } catch (error) {
      console.error('Erro ao inicializar calendário:', error);
      UIUtils.showAlert('Erro ao carregar calendário', 'error');
    }
  }

  async loadInitialData() {
    console.log("🔄 Carregando dados iniciais do calendário...");
    
    // CORREÇÃO: Carregar clientes, serviços e profissionais PRIMEIRO
    const [clientes, servicos, profissionais] = await Promise.all([
      dataManager.getClientes(),
      dataManager.getServicos(),
      dataManager.getProfissionais()
    ]);
    
    console.log("✅ Dados de referência carregados:", { clientes, servicos, profissionais });
    
    // AGORA carregar agendamentos e bloqueios
    const [agendamentos, bloqueios] = await Promise.all([
      dataManager.loadAgendamentos(),
      dataManager.loadBloqueios()
    ]);

    console.log("✅ Todos os dados carregados:", { clientes, servicos, profissionais, agendamentos, bloqueios });
    this.eventos = this.processarEventos(agendamentos, bloqueios);
  }

  createCalendar() {
    const calendarEl = document.getElementById(this.calendarId);
    if (!calendarEl) {
      throw new Error(`Elemento #${this.calendarId} não encontrado`);
    }

    this.calendar = new FullCalendar.Calendar(calendarEl, {
      locale: "pt-br",
      height: "auto",
      slotMinTime: "08:00:00",
      slotMaxTime: "19:00:00",
      initialView: "timeGridWeek",

      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "timeGridDay,timeGridWeek,dayGridMonth"
      },

      editable: true,
      selectable: true,

      events: this.eventos,

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
    
    // Inicializar melhorias após renderizar
    if (window.CalendarEnhancements) {
      this.enhancements = new window.CalendarEnhancements(this);
    }
  }

  processarEventos(agendamentos, bloqueios) {
    const eventosAg = agendamentos.map(a => {
      const corBase = dataManager.coresProfissionais[a.profissional] || "#3b82f6";
      const corStatus = dataManager.gerarCorPorStatus(a.status, corBase);
      
      return {
        id: String(a.id),
        title: `${a.cliente} - ${a.servico} (${a.profissional})`,
        start: a.inicio,
        end: a.fim,
        editable: true,
        extendedProps: {
          tipo: "agendamento",
          realId: a.id,
          cliente: a.cliente,
          servico: a.servico,
          profissional: a.profissional,
          status: a.status || "agendado",
          observacoes: a.observacoes || ""
        },
        backgroundColor: corStatus,
        borderColor: corStatus,
        classNames: [`status-${a.status || "agendado"}`]
      };
    });

    const eventosBlq = [];
    
    bloqueios.forEach(b => {
      const base = {
        title: b.titulo || "Bloqueio",
        start: b.inicio,
        end: b.fim,
        classNames: ["bloqueio"],
        editable: false,
        extendedProps: {
          tipo: "bloqueio",
          realId: b.id,
          titulo: b.titulo || "",
          motivo: b.motivo || "",
          tipoBloqueio: b.tipo || "",
          profissionalId: b.profissional_id || null
        }
      };

      if (b.profissional_id) {
        const prof = dataManager.profissionaisPorId[b.profissional_id];
        if (prof) {
          eventosBlq.push({
            id: `b-${b.id}-${prof.id}`,
            title: `${b.titulo || "Bloqueio"} (${prof.nome})`,
            start: b.inicio,
            end: b.fim,
            classNames: ["bloqueio"],
            editable: false,
            extendedProps: {
              tipo: "bloqueio",
              realId: b.id,
              titulo: b.titulo || "",
              motivo: b.motivo || "",
              tipoBloqueio: b.tipo || "",
              profissionalId: b.profissional_id,
              profissional: prof.nome
            }
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
      const agendamentoOriginal = dataManager.agendamentos.find(a => a.id == modalData.realId);
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

    if (tipo === "bloqueio") {
      info.revert();
      UIUtils.showAlert('Edite bloqueios pelo modal', 'warning');
      return;
    }

    try {
      // Simplificar - não usar recursos
      const profissionalNovo = ev.extendedProps.profissional;

      await dataManager.updateAgendamento(ev.id, {
        profissional: profissionalNovo,
        inicio: ev.start,
        fim: ev.end
      });

      await this.refreshEvents();
      UIUtils.showAlert('Agendamento movido com sucesso', 'success');
    } catch (error) {
      info.revert();
      UIUtils.showAlert('Erro ao mover agendamento', 'error');
    }
  }

  async handleEventResize(info) {
    const ev = info.event;
    const tipo = ev.extendedProps && ev.extendedProps.tipo;

    if (tipo === "bloqueio") {
      info.revert();
      UIUtils.showAlert('Edite bloqueios pelo modal', 'warning');
      return;
    }

    try {
      await dataManager.updateAgendamento(ev.id, {
        inicio: ev.start,
        fim: ev.end
      });

      await this.refreshEvents();
      UIUtils.showAlert('Duração atualizada com sucesso', 'success');
    } catch (error) {
      info.revert();
      UIUtils.showAlert('Erro ao redimensionar agendamento', 'error');
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
      
      // Remover eventos existentes
      this.calendar.removeAllEvents();
      
      // Adicionar novos eventos
      this.eventos.forEach(evento => {
        this.calendar.addEvent(evento);
      });
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
