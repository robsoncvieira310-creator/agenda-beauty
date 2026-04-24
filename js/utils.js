// ============================================
// UTILS - Global Module (exposto via window.*)
// ============================================

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
async function apiRequest(endpoint, options = {}) {
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

async function apiGet(endpoint) {
  return apiRequest(endpoint);
}

async function apiPost(endpoint, data) {
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

async function apiPut(endpoint, data) {
  return apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

async function apiDelete(endpoint) {
  return apiRequest(endpoint, {
    method: 'DELETE'
  });
}

// ============================================
// UTILITÁRIOS DE DATA
// ============================================

function toInputDateTimeValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromInputDateTimeValue(value) {
  return new Date(value);
}

function formatDateTime(date) {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTime(date) {
  const d = new Date(date);
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ============================================
// GERENCIAMENTO DE UI
// ============================================

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function showAlert(message, type = 'info') {
  // Criar alerta customizado em vez de alert()
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;

  // Estilos para centralizar no topo da tela
  alertDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    min-width: 300px;
    max-width: 500px;
    text-align: center;
    padding: 12px 20px;
    border-radius: 4px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    opacity: 0;
    transition: all 0.3s ease;
  `;

  // Estilo por tipo
  switch(type) {
    case 'success':
      alertDiv.style.backgroundColor = '#10b981';
      alertDiv.style.color = 'white';
      alertDiv.style.border = '1px solid #059669';
      break;
    case 'error':
      alertDiv.style.backgroundColor = '#ef4444';
      alertDiv.style.color = 'white';
      alertDiv.style.border = '1px solid #dc2626';
      break;
    case 'warning':
      alertDiv.style.backgroundColor = '#f59e0b';
      alertDiv.style.color = 'white';
      alertDiv.style.border = '1px solid #d97706';
      break;
    default:
      alertDiv.style.backgroundColor = '#3b82f6';
      alertDiv.style.color = 'white';
      alertDiv.style.border = '1px solid #2563eb';
  }

  // Verificar se existe um modal aberto
  const modal = document.querySelector('.modal[style*="display: flex"], .modal[style*="display:flex"]');

  if (modal) {
    // Inserir no topo do modal-content mas manter centralizado na tela
    document.body.appendChild(alertDiv);
  } else {
    // Comportamento padrão (fora de modal)
    document.body.appendChild(alertDiv);
  }

  // Animar entrada
  setTimeout(() => {
    alertDiv.style.opacity = '1';
    alertDiv.style.transform = 'translateX(-50%) translateY(0)';
  }, 100);

  setTimeout(() => {
    alertDiv.style.opacity = '0';
    alertDiv.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.parentNode.removeChild(alertDiv);
      }
    }, 300);
  }, 3000);
}

function showLoading(element) {
  if (element) {
    element.disabled = true;
    element.dataset.originalText = element.textContent;
    element.textContent = 'Carregando...';
  }
}

function hideLoading(element) {
  if (element && element.dataset.originalText) {
    element.disabled = false;
    element.textContent = element.dataset.originalText;
    delete element.dataset.originalText;
  }
}

// ============================================
// GERENCIAMENTO DE FORMULÁRIOS
// ============================================

function clearForm(formId) {
  const form = document.getElementById(formId);
  if (form) {
    form.reset();
  }
}

function validateRequired(fields) {
  const missing = [];

  fields.forEach(field => {
    const element = document.getElementById(field);
    if (!element || !element.value.trim()) {
      missing.push(field);
    }
  });

  return missing;
}

function validateFormFields(config) {
  const { formId, requiredFields, customMessage } = config;
  const missing = [];
  
  requiredFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (!field || !field.value.trim()) {
      missing.push(fieldId);
    }
  });
  
  if (missing.length > 0) {
    showAlert(customMessage || 'Campos obrigatórios não preenchidos', 'error');
    return false;
  }
  
  return true;
}

function getFormData(fields) {
  const data = {};

  fields.forEach(field => {
    const element = document.getElementById(field);
    if (element) {
      data[field] = element.value;
    }
  });

  return data;
}

// ============================================
// DIÁLOGO DE CONFIRMAÇÃO
// ============================================

let confirmResolve = null;

function closeConfirmDialog() {
  const modal = document.getElementById('confirmDeleteModal');
  if (modal) {
    modal.remove();
  }
}

async function confirmDelete(options = {}) {
  const {
    title = 'Confirmar Exclusão',
    message = 'Tem certeza que deseja excluir este item?',
    itemName = '',
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
            <button type="button" class="btn-close" id="btnCloseConfirm"></button>
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
            <button type="button" class="btn btn-secondary" id="btnCancelConfirm">
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
    confirmResolve = resolve;

    const confirmBtn = document.getElementById('btnConfirmDelete');
    const cancelBtn = document.getElementById('btnCancelConfirm');
    const closeBtn = document.getElementById('btnCloseConfirm');
    const modal = document.getElementById('confirmDeleteModal');

    const cleanup = () => {
      closeConfirmDialog();
      document.removeEventListener('keydown', escHandler);
    };

    const confirmHandler = () => {
      cleanup();
      resolve(true);
    };

    const cancelHandler = () => {
      cleanup();
      resolve(false);
    };

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(false);
      }
    };

    confirmBtn.addEventListener('click', confirmHandler);
    cancelBtn.addEventListener('click', cancelHandler);
    closeBtn.addEventListener('click', cancelHandler);

    // Fechar modal ao clicar fora
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(false);
      }
    });

    // Fechar modal ao pressionar ESC
    document.addEventListener('keydown', escHandler);
  });
}

// ============================================
// EXPOSIÇÃO GLOBAL (non-module)
// ============================================
window.API_CONFIG = API_CONFIG;
window.apiRequest = apiRequest;
window.apiGet = apiGet;
window.apiPost = apiPost;
window.apiPut = apiPut;
window.apiDelete = apiDelete;
window.toInputDateTimeValue = toInputDateTimeValue;
window.fromInputDateTimeValue = fromInputDateTimeValue;
window.formatDateTime = formatDateTime;
window.formatTime = formatTime;
window.showModal = showModal;
window.hideModal = hideModal;
window.showAlert = showAlert;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.clearForm = clearForm;
window.validateRequired = validateRequired;
window.validateFormFields = validateFormFields;
window.getFormData = getFormData;
window.closeConfirmDialog = closeConfirmDialog;
window.confirmDelete = confirmDelete;
