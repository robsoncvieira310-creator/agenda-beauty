// Gerenciamento comum de páginas
// DEPENDÊNCIAS: window.services, window.showAlert, window.showLoading, window.hideLoading
// 🎯 FASE 2.6.2: Implementa LifecycleContract

window.PageManager = class PageManager extends LifecycleContract {
  constructor() {
    super('PageManager');
    
    // 🔒 SINGLETON PROTECTION
    if (window.__PAGE_MANAGER_SINGLETON__) {
      throw new Error('[BOOTSTRAP FATAL] Duplicate PageManager instance');
    }
    window.__PAGE_MANAGER_SINGLETON__ = true;

    // 🎯 FASE 2.6.2: STATE ONLY - Zero side-effects no constructor
    this.currentPage = '';
    this._domReady = false;
    
    console.log('[PageManager] constructed (PASSIVE MODE)');
  }

  // ================================
  // 🎯 FASE 2.6.2: LIFECYCLE IMPLEMENTATION
  // ================================
  
  activate() {
    if (this._lifecycleActive) return;
    
    console.log('[PageManager] activating...');
    
    // 🎯 FASE 2.6.2: Verificar se DOM já está pronto ou aguardar
    if (document.readyState === 'loading') {
      // Aguardar DOMContentLoaded
      this.addEventListener(document, 'DOMContentLoaded', () => {
        this._domReady = true;
        this.initializePage();
        this.setupModals();
      });
    } else {
      // DOM já está pronto
      this._domReady = true;
      this.initializePage();
      this.setupModals();
    }
    
    this._lifecycleActive = true;
    console.log('[PageManager] activated');
    return true;
  }
  
  deactivate() {
    if (!this._lifecycleActive) return;
    
    console.log('[PageManager] deactivating...');
    
    // Cleanup via LifecycleContract
    super.deactivate();
    
    this.currentPage = '';
    this._domReady = false;
    
    console.log('[PageManager] deactivated');
  }
  
  destroy() {
    console.log('[PageManager] destroying...');
    
    // Remover singleton flag
    window.__PAGE_MANAGER_SINGLETON__ = false;
    
    super.destroy();
  }
  
  // 🎯 DEPRECATED: setupEventListeners removido - usar activate()

  async initializePage() {
    // 🔒 PIPE CHECK: PageManager só executa em READY stage
    const pipeState = window.__BOOTSTRAP_PIPE?.getState();
    if (pipeState?.stage !== 'READY') {
      throw new Error('[BOOTSTRAP FATAL] Invalid state transition or missing state flag');
    }

    console.log('[PAGE]', 'initializePage_start', Date.now());
    console.log('[CHECK]', 'services_at_init', {
      exists: !!window.services,
      servicos: !!window.services?.servicos,
      clientes: !!window.services?.clientes,
      profissionais: !!window.services?.profissionais
    });
    try {
      console.log('🚀 Inicializando página...');
      
      // Carregar dados base
      await this.loadBaseData();
      
      // Configurar elementos comuns
      this.setupCommonElements();
      
      // Inicializar página específica
      await this.initializeSpecificPage();
      
      console.log('✅ Página inicializada com sucesso');
      console.log('[PAGE]', 'initializePage_end', Date.now());
    } catch (error) {
      console.error('❌ Erro ao inicializar página:', error);
      console.log('[CHECK]', 'services_at_error', {
        exists: !!window.services,
        error: error.message,
        stack: error.stack
      });
      this.showError('Erro ao carregar página. Recarregue.');
    }
  }

  async loadBaseData() {
    console.log("📊 Carregando dados base...");
    console.log('[CHECK]', 'services_at_loadBaseData', {
      exists: !!window.services,
      servicos: !!window.services?.servicos,
      clientes: !!window.services?.clientes,
      profissionais: !!window.services?.profissionais
    });
    // Carregar dados necessários para todas as páginas
    const promises = [];

    // Todas as páginas precisam de clientes, serviços e profissionais
    console.log("🔍 Adicionando loadServicos() às promises...");
    if (!window.services || !window.services.servicos) {
      console.log('[CHECK]', 'services_undefined_at_loadBaseData', {
        services_type: typeof window.services,
        services_value: window.services
      });
      throw new Error('services not available at loadBaseData');
    }
    promises.push(window.services.servicos.list());
    promises.push(window.services.clientes.list());
    promises.push(window.services.profissionais.list());
    
    // Páginas específicas podem precisar de mais dados
    if (this.needsAgendamentos()) {
      promises.push(window.services.agendamentos.list());
    }
    
    await Promise.all(promises);
    console.log("✅ Dados base carregados");
  }

  setupCommonElements() {
    // Configurar botão de atualização (se existir)
    const btnAtualizar = document.getElementById('btnAtualizar');
    if (btnAtualizar) {
      btnAtualizar.addEventListener('click', () => this.refreshData());
    }

    // REMOVIDO: Sistema antigo de busca conflitando com autocomplete da agenda
    // const buscaInput = document.querySelector('input[id*="busca"]');
    // if (buscaInput) {
    //   buscaInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    // }
  }

  setupModals() {
    // Botões de fechar modal
    document.querySelectorAll('.btn-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });

    // Fechar modal clicando fora
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal();
        }
      });
    });

    // Enter no formulário
    document.querySelectorAll('.modal input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const btnSalvar = document.querySelector('.modal-footer .btn-primary');
          if (btnSalvar) btnSalvar.click();
        }
      });
    });
  }

  async refreshData() {
    const btn = document.getElementById('btnAtualizar');
    if (btn) showLoading(btn);

    try {
      await this.loadBaseData();
      await this.renderPage();
      await this.updateStatistics();
      showAlert('Dados atualizados com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao atualizar dados:', error);
      showAlert('Erro ao atualizar dados', 'error');
    } finally {
      if (btn) hideLoading(btn);
    }
  }

  handleSearch(term) {
    // Implementado nas subclasses
  }

  async initializeSpecificPage() {
    // Implementado nas subclasses
  }

  async renderPage() {
    // Implementado nas subclasses
  }

  async updateStatistics() {
    // Implementado nas subclasses
  }

  needsAgendamentos() {
    return false; // Implementado nas subclasses
  }

  // Métodos utilitários
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    } else {
      console.error(`Modal #${modalId} não encontrado`);
    }
  }

  closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.style.display = 'none';
    });
    document.body.style.overflow = 'auto';
  }

  showError(message) {
    showAlert(message, 'error');
  }

  showSuccess(message) {
    showAlert(message, 'success');
  }

  showWarning(message) {
    showAlert(message, 'warning');
  }

  // Validação de formulários
  validateForm(requiredFields) {
    const errors = [];
    
    requiredFields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (!field || !field.value.trim()) {
        errors.push(`Campo ${fieldId} é obrigatório`);
      }
    });
    
    return errors;
  }

  // Limpar formulário
  clearForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
      form.querySelectorAll('input, textarea, select').forEach(field => {
        if (field.type === 'checkbox' || field.type === 'radio') {
          field.checked = false;
        } else {
          field.value = '';
        }
      });
    }
  }

  // Preencher select
  populateSelect(selectId, options, placeholder = 'Selecione...') {
    const select = document.getElementById(selectId);
    if (!select) {
      console.error(`Select #${selectId} não encontrado`);
      return;
    }

    select.innerHTML = `<option value="">${placeholder}</option>`;
    
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value || option;
      optionElement.textContent = option.label || option;
      
      // Adicionar data attributes se existirem
      if (option.data) {
        Object.keys(option.data).forEach(key => {
          optionElement.dataset[key] = option.data[key];
        });
      }
      
      select.appendChild(optionElement);
    });
  }

  // Renderizar empty state
  renderEmptyState(container, message, icon = '📋', action = null) {
    const containerElement = typeof container === 'string' ? document.getElementById(container) : container;
    if (!containerElement) return;

    containerElement.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <div class="empty-text">${message}</div>
        ${action ? `<button class="btn btn-primary" onclick="${action}">${action}</button>` : ''}
      </div>
    `;
  }

  // Formatar valores
  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  }

  formatPhone(phone) {
    if (!phone) return '-';
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(date);
  }
}

// Exportar para uso global
window.PageManager = PageManager;
