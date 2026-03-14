// Configuração centralizada da API
const API_CONFIG = {
  BASE_URL: "http://localhost:3000",
  ENDPOINTS: {
    CLIENTES: "/clientes",
    SERVICOS: "/servicos",
    PROFISSIONAIS: "/profissionais",
    AGENDAMENTOS: "/agendamentos",
    BLOQUEIOS: "/bloqueios"
  }
};

// Helper para fazer requisições
class ApiClient {
  static async request(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  static async get(endpoint) {
    return this.request(endpoint);
  }

  static async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  static async delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE'
    });
  }
}

// Utilitários de data
class DateUtils {
  static toInputDateTimeValue(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  static fromInputDateTimeValue(value) {
    return new Date(value);
  }

  static formatDateTime(date) {
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  static formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// Gerenciamento de UI
class UIUtils {
  static showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  static hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  static showAlert(message, type = 'info') {
    // Criar alerta customizado em vez de alert()
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
      alertDiv.remove();
    }, 3000);
  }

  static showLoading(element) {
    if (element) {
      element.disabled = true;
      element.dataset.originalText = element.textContent;
      element.textContent = 'Carregando...';
    }
  }

  static hideLoading(element) {
    if (element && element.dataset.originalText) {
      element.disabled = false;
      element.textContent = element.dataset.originalText;
      delete element.dataset.originalText;
    }
  }
}

// Gerenciamento de formulários
class FormManager {
  static clearForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
      form.reset();
    }
  }

  static validateRequired(fields) {
    const missing = [];
    
    fields.forEach(field => {
      const element = document.getElementById(field);
      if (!element || !element.value.trim()) {
        missing.push(field);
      }
    });
    
    return missing;
  }

  static getFormData(fields) {
    const data = {};
    
    fields.forEach(field => {
      const element = document.getElementById(field);
      if (element) {
        data[field] = element.value;
      }
    });
    
    return data;
  }
}

// Função padrão de confirmação de exclusão
class ConfirmDialog {
  static async confirmDelete(options = {}) {
    const {
      title = 'Confirmar Exclusão',
      message = 'Tem certeza que deseja excluir este item?',
      itemName = '',
      type = 'default',
      confirmText = 'Excluir',
      cancelText = 'Cancelar'
    } = options;

    // Criar modal de confirmação
    const modalHtml = `
      <div class="modal fade" id="confirmDeleteModal" tabindex="-1" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; align-items: center; justify-content: center;">
        <div class="modal-dialog modal-dialog-centered" style="position: relative; max-width: 500px; width: 90%; margin: 0;">
          <div class="modal-content">
            <div class="modal-header border-0">
              <h5 class="modal-title">
                <span class="text-danger">⚠️</span> ${title}
              </h5>
              <button type="button" class="btn-close" onclick="ConfirmDialog.close()"></button>
            </div>
            <div class="modal-body">
              <div class="d-flex align-items-center mb-3">
                <div class="flex-shrink-0">
                  <div class="rounded-circle bg-danger bg-opacity-10 p-3">
                    <i class="fas fa-trash-alt text-danger fs-4"></i>
                  </div>
                </div>
                <div class="flex-grow-1 ms-3">
                  <p class="mb-0">${message}</p>
                  ${itemName ? `<p class="mb-0 fw-bold text-danger">${itemName}</p>` : ''}
                  <small class="text-muted">Esta ação não pode ser desfeita.</small>
                </div>
              </div>
            </div>
            <div class="modal-footer border-0">
              <button type="button" class="btn btn-secondary" onclick="ConfirmDialog.close()">
                ${cancelText}
              </button>
              <button type="button" class="btn btn-danger" id="btnConfirmDelete">
                <i class="fas fa-trash-alt me-2"></i>${confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Adicionar modal ao body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    return new Promise((resolve) => {
      const confirmBtn = document.getElementById('btnConfirmDelete');
      const modal = document.getElementById('confirmDeleteModal');

      confirmBtn.addEventListener('click', () => {
        this.close();
        resolve(true);
      });

      // Fechar modal ao clicar fora
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.close();
          resolve(false);
        }
      });

      // Fechar modal ao pressionar ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.close();
          resolve(false);
        }
      });
    });
  }

  static close() {
    const modal = document.getElementById('confirmDeleteModal');
    if (modal) {
      modal.remove();
    }
  }
}

// Exportar para uso global
window.API_CONFIG = API_CONFIG;
window.ApiClient = ApiClient;
window.UIUtils = UIUtils;
window.FormManager = FormManager;
window.ConfirmDialog = ConfirmDialog;
