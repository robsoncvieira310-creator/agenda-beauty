// Melhorias para o calendário: Filtros, Tooltips e Notificações
class CalendarEnhancements {
  constructor(calendarManager) {
    this.calendarManager = calendarManager;
    this.currentFilter = 'todos';
    this.tooltipTimeout = null;
    this.setupFilters();
    this.setupTooltips();
    this.setupNotifications();
    this.setupKeyboardShortcuts();
  }

  // 1. FILTROS POR PROFISSIONAL
  setupFilters() {
    const filterChips = document.querySelectorAll('.filter-chip');
    
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        // Remover active de todos
        filterChips.forEach(c => c.classList.remove('active'));
        // Adicionar active no clicado
        chip.classList.add('active');
        
        const profissional = chip.dataset.profissional;
        this.filterByProfissional(profissional);
      });
    });
  }

  filterByProfissional(profissional) {
    this.currentFilter = profissional;
    const calendar = this.calendarManager.getCalendar();
    
    if (!calendar) return;
    
    // Obter todos os eventos
    const allEvents = calendar.getEvents();
    
    // Mostrar/ocultar eventos baseado no filtro
    allEvents.forEach(event => {
      const eventProfissional = event.extendedProps?.profissional;
      
      if (profissional === 'todos') {
        // Mostrar todos
        event.setProp('display', 'auto');
      } else {
        // Mostrar apenas do profissional selecionado
        const shouldShow = eventProfissional === profissional;
        event.setProp('display', shouldShow ? 'auto' : 'none');
      }
    });
    
    // Notificar sobre filtro
    const message = profissional === 'todos' 
      ? 'Mostrando todos os profissionais' 
      : `Filtrando por: ${profissional}`;
    
    this.showNotification('info', 'Filtro Aplicado', message);
  }

  // 2. TOOLTIPS
  setupTooltips() {
    // Adicionar tooltip aos eventos do calendário
    document.addEventListener('mouseover', (e) => {
      const eventEl = e.target.closest('.fc-event');
      if (eventEl) {
        this.showTooltip(eventEl, e);
      }
    });

    document.addEventListener('mouseout', (e) => {
      const eventEl = e.target.closest('.fc-event');
      if (eventEl) {
        this.hideTooltip();
      }
    });
  }

  showTooltip(eventEl, mouseEvent) {
    // Limpar timeout anterior
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }

    // Delay para mostrar tooltip
    this.tooltipTimeout = setTimeout(() => {
      const tooltip = document.getElementById('tooltipContainer');
      if (!tooltip) return;

      // Obter dados do evento
      const fcEvent = eventEl.fcEvent || eventEl._fcEvent;
      if (!fcEvent) return;

      const props = fcEvent.extendedProps;
      const isBlocked = props.tipo === 'bloqueio';
      
      let content = '';
      if (isBlocked) {
        content = `
          <strong>🔒 ${fcEvent.title}</strong><br>
          ${props.motivo || 'Sem motivo'}<br>
          <small>${this.formatTime(fcEvent.start)} - ${this.formatTime(fcEvent.end)}</small>
        `;
      } else {
        content = `
          <strong>👤 ${props.cliente}</strong><br>
          💇 ${props.servico}<br>
          👨‍💼 ${props.profissional}<br>
          📊 ${this.getStatusEmoji(props.status)} ${props.status}<br>
          <small>${this.formatTime(fcEvent.start)} - ${this.formatTime(fcEvent.end)}</small>
        `;
      }

      tooltip.innerHTML = content;
      
      // Posicionar tooltip
      const rect = eventEl.getBoundingClientRect();
      tooltip.style.left = rect.left + 'px';
      tooltip.style.top = (rect.bottom + 5) + 'px';
      tooltip.classList.add('show');
    }, 500);
  }

  hideTooltip() {
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }
    
    const tooltip = document.getElementById('tooltipContainer');
    if (tooltip) {
      tooltip.classList.remove('show');
    }
  }

  // 3. NOTIFICAÇÕES
  setupNotifications() {
    // Verificar agendamentos próximos a cada minuto
    setInterval(() => {
      this.checkUpcomingAppointments();
    }, 60000); // 1 minuto
  }

  showNotification(type, title, message, duration = 5000) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <button class="notification-close">&times;</button>
      <div class="notification-title">${title}</div>
      <div class="notification-message">${message}</div>
    `;

    container.appendChild(notification);

    // Animar entrada
    setTimeout(() => notification.classList.add('show'), 10);

    // Fechar automaticamente
    setTimeout(() => {
      this.closeNotification(notification);
    }, duration);

    // Fechar manualmente
    notification.querySelector('.notification-close').addEventListener('click', () => {
      this.closeNotification(notification);
    });
  }

  closeNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }

  checkUpcomingAppointments() {
    const now = new Date();
    const next15Min = new Date(now.getTime() + 15 * 60000);
    
    const calendar = this.calendarManager.getCalendar();
    if (!calendar) return;

    const events = calendar.getEvents();
    
    events.forEach(event => {
      if (event.extendedProps.tipo === 'bloqueio') return;
      
      const eventStart = new Date(event.start);
      
      // Verificar se o evento começa em 15 minutos
      if (eventStart >= now && eventStart <= next15Min) {
        const props = event.extendedProps;
        this.showNotification(
          'warning',
          '⏰ Lembrete de Agendamento',
          `${props.cliente} chega em breve às ${this.formatTime(eventStart)} para ${props.servico}`,
          8000
        );
      }
    });
  }

  // 4. ATALHOS DE TECLADO
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+N: Novo agendamento
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        this.openNewAppointment();
      }
      
      // Esc: Fechar modal
      if (e.key === 'Escape') {
        this.closeModals();
      }
      
      // Ctrl+H: Hoje
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        this.goToToday();
      }
      
      // Ctrl+R: Atualizar
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        this.refreshCalendar();
      }
    });
  }

  openNewAppointment() {
    // Abrir modal para novo agendamento
    const modalManager = window.modalManager;
    if (modalManager) {
      modalManager.abrirModalAgendamento({ tipo: 'novo' });
    }
  }

  closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.style.display = 'none';
    });
    document.body.style.overflow = 'auto';
  }

  goToToday() {
    const calendar = this.calendarManager.getCalendar();
    if (calendar) {
      calendar.today();
      this.showNotification('info', '📅 Navegação', 'Indo para hoje');
    }
  }

  refreshCalendar() {
    if (this.calendarManager) {
      this.calendarManager.refreshEvents();
      this.showNotification('success', '🔄 Atualizado', 'Calendário atualizado');
    }
  }

  // UTILITÁRIOS
  formatTime(date) {
    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusEmoji(status) {
    const emojis = {
      'agendado': '📅',
      'confirmado': '✅',
      'em_andamento': '⏳',
      'concluido': '✔️',
      'cancelado': '❌',
      'nao_compareceu': '⚠️'
    };
    return emojis[status] || '📅';
  }
}

// Adicionar ao CalendarManager
window.CalendarEnhancements = CalendarEnhancements;
