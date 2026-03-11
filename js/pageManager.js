// Gerenciamento comum de páginas
class PageManager {
  constructor() {
    this.currentPage = '';
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Configurar navegação
    document.addEventListener('DOMContentLoaded', () => {
      this.initializePage();
    });
  }

  async initializePage() {
    try {
      console.log('🚀 Inicializando página...');
      
      // Carregar dados base
      await this.loadBaseData();
      
      // Configurar elementos comuns
      this.setupCommonElements();
      
      // Inicializar página específica
      await this.initializeSpecificPage();
      
      console.log('✅ Página inicializada com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar página:', error);
      this.showError('Erro ao carregar página. Recarregue.');
    }
  }

  async loadBaseData() {
    console.log("📊 Carregando dados base...");
    // Carregar dados necessários para todas as páginas
    const promises = [];
    
    // Todas as páginas precisam de clientes, serviços e profissionais
    console.log("🔍 Adicionando loadServicos() às promises...");
    promises.push(dataManager.loadServicos());
    promises.push(dataManager.loadClientes());
    promises.push(dataManager.loadProfissionais());
    
    // Páginas específicas podem precisar de mais dados
    if (this.needsAgendamentos()) {
      promises.push(dataManager.loadAgendamentos());
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

    // Configurar busca (se existir)
    const buscaInput = document.querySelector('input[id*="busca"]');
    if (buscaInput) {
      buscaInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // Configurar modais
    this.setupModals();
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
    if (btn) UIUtils.showLoading(btn);
    
    try {
      await this.loadBaseData();
      await this.renderPage();
      await this.updateStatistics();
      UIUtils.showAlert('Dados atualizados com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao atualizar dados:', error);
      UIUtils.showAlert('Erro ao atualizar dados', 'error');
    } finally {
      if (btn) UIUtils.hideLoading(btn);
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
    UIUtils.showAlert(message, 'error');
  }

  showSuccess(message) {
    UIUtils.showAlert(message, 'success');
  }

  showWarning(message) {
    UIUtils.showAlert(message, 'warning');
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
