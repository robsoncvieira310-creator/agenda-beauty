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

// Exportar para uso global
window.API_CONFIG = API_CONFIG;
window.ApiClient = ApiClient;
window.DateUtils = DateUtils;
window.UIUtils = UIUtils;
window.FormManager = FormManager;
