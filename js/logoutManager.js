/**
 * LogoutManager - Gerenciamento Centralizado de Logout
 * Agenda Beauty V1.5
 * 
 * Responsabilidades:
 * - Centralizar lógica de logout
 * - Padronizar botão de logout
 * - Eliminar código duplicado
 * - Manter comportamento consistente
 */

class LogoutManager {
  constructor() {
    this.logoutButton = null;
    this.isInitialized = false;
    
    // EVITAR MÚLTIPLAS INSTÂNCIAS
    if (window.logoutManager) {
      console.warn('⚠️ LOGOUT_MANAGER: Já existe uma instância, usando a existente');
      return window.logoutManager;
    }
    
    this.init();
  }

  init() {
    // EVITAR MÚLTIPLAS INICIALIZAÇÕES
    if (this.isInitialized) {
      console.log('ℹ️ LOGOUT_MANAGER: Já inicializado, ignorando...');
      return;
    }
    
    // Verificar se já existe um botão de logout no HTML
    this.logoutButton = document.getElementById('logoutButton');
    
    if (this.logoutButton) {
      // Se existe, padronizar seu comportamento
      this.standardizeExistingButton();
    } else {
      // Se não existe, criar um botão padrão
      this.createStandardButton();
    }

    // Configurar evento de logout
    this.setupLogoutEvent();
    
    // Marcar como inicializado
    this.isInitialized = true;
    
    // Definir como instância global
    window.logoutManager = this;
    
    // INICIAR OBSERVADOR PARA PROTEGER BOTÃO
    this.startButtonObserver();
    
    console.log('✅ LOGOUT_MANAGER: Inicializado com sucesso');
  }

  startButtonObserver() {
    if (!this.logoutButton) return;
    
    // Criar observador para detectar alterações no botão
    this.buttonObserver = new MutationObserver((mutations) => {
      let needsFix = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          if (mutation.attributeName === 'style') {
            // Verificar se estilos de visibilidade foram removidos
            const style = this.logoutButton.style;
            if (style.display !== 'flex' || style.visibility !== 'visible' || style.opacity !== '1') {
              needsFix = true;
            }
          }
          if (mutation.attributeName === 'class') {
            // Verificar se classe foi alterada
            if (!this.logoutButton.classList.contains('logout-btn')) {
              needsFix = true;
            }
          }
        }
      });
      
      if (needsFix) {
        console.log('🔧 LOGOUT_MANAGER: Detectada alteração no botão, corrigindo...');
        setTimeout(() => this.forceButtonVisibility(), 10);
      }
    });
    
    // Iniciar observação
    this.buttonObserver.observe(this.logoutButton, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    console.log('🔍 LOGOUT_MANAGER: Observador de botão iniciado');
  }

  createLogoutButton() {
    // Verificar se já existe um botão
    this.logoutButton = document.getElementById('logoutButton');
    
    if (this.logoutButton) {
      // Se existe, padronizar seu comportamento
      this.standardizeExistingButton();
    } else {
      // Se não existe, criar um botão padrão
      this.createStandardButton();
    }
  }

  standardizeExistingButton() {
    // Padronizar aparência e comportamento do botão existente
    this.logoutButton.className = 'btn btn-danger logout-btn';
    this.logoutButton.innerHTML = '🚪 Sair';
    
    // NÃO REMOVER ESTILOS INLINE - pode conter posicionamento forçado
    // Apenas remover estilos que conflitam, mas manter posicionamento
    const estilosParaManter = ['position', 'display', 'visibility', 'opacity', 'bottom', 'left', 'right', 'z-index'];
    const estiloAtual = this.logoutButton.style;
    const novosEstilos = {};
    
    // Manter apenas estilos de posicionamento
    estilosParaManter.forEach(prop => {
      if (estiloAtual[prop]) {
        novosEstilos[prop] = estiloAtual[prop];
      }
    });
    
    // Limpar todos os estilos
    this.logoutButton.removeAttribute('style');
    
    // Restaurar apenas estilos de posicionamento
    Object.entries(novosEstilos).forEach(([prop, value]) => {
      this.logoutButton.style[prop] = value;
    });
    
    // GARANTIR VISIBILIDADE CONTÍNUA
    this.forceButtonVisibility();
    
    console.log('✅ LOGOUT_MANAGER: Botão existente padronizado (posicionamento mantido)');
  }

  forceButtonVisibility() {
    if (!this.logoutButton) return;
    
    // Forçar estilos de visibilidade com position fixed e tamanho consistente
    this.logoutButton.style.setProperty('display', 'flex', 'important');
    this.logoutButton.style.setProperty('visibility', 'visible', 'important');
    this.logoutButton.style.setProperty('opacity', '1', 'important');
    this.logoutButton.style.setProperty('position', 'fixed', 'important');
    this.logoutButton.style.setProperty('bottom', '20px', 'important');
    this.logoutButton.style.setProperty('left', '20px', 'important');
    this.logoutButton.style.setProperty('right', 'auto', 'important');
    this.logoutButton.style.setProperty('z-index', '999999', 'important');
    
    // Garantir tamanho consistente
    this.logoutButton.style.setProperty('width', 'auto', 'important');
    this.logoutButton.style.setProperty('min-width', '150px', 'important');
    this.logoutButton.style.setProperty('max-width', '200px', 'important');
    this.logoutButton.style.setProperty('height', 'auto', 'important');
    this.logoutButton.style.setProperty('min-height', '43px', 'important');
    this.logoutButton.style.setProperty('max-height', '43px', 'important');
    this.logoutButton.style.setProperty('white-space', 'nowrap', 'important');
    this.logoutButton.style.setProperty('overflow', 'hidden', 'important');
    this.logoutButton.style.setProperty('text-overflow', 'ellipsis', 'important');
    
    // Garantir que o botão não seja escondido pela sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('collapsed')) {
      console.log('🔧 LOGOUT_MANAGER: Sidebar está colapsada, expandindo para mostrar botão');
      sidebar.classList.remove('collapsed');
    }
    
    console.log('🔧 LOGOUT_MANAGER: Visibilidade e tamanho do botão forçados com position fixed');
  }

  createStandardButton() {
    // Criar botão padrão
    this.logoutButton = document.createElement('button');
    this.logoutButton.id = 'logoutButton';
    this.logoutButton.className = 'btn btn-danger logout-btn';
    this.logoutButton.innerHTML = '🚪 Sair';
    
    // Adicionar ao final do body
    document.body.appendChild(this.logoutButton);
    
    console.log('✅ LOGOUT_MANAGER: Botão padrão criado');
  }

  setupLogoutEvent() {
    if (!this.logoutButton) {
      console.error('❌ LOGOUT_MANAGER: Botão não encontrado');
      return;
    }

    // Remover eventos anteriores para evitar duplicação
    this.logoutButton.replaceWith(this.logoutButton.cloneNode(true));
    this.logoutButton = document.getElementById('logoutButton');

    // Adicionar evento de clique
    this.logoutButton.addEventListener('click', async (event) => {
      event.preventDefault();
      await this.handleLogout();
    });

    console.log('✅ LOGOUT_MANAGER: Evento de logout configurado');
  }

  async handleLogout() {
    console.log('🚪 LOGOUT_MANAGER: Botão clicado');

    // Confirmar logout usando ConfirmDialog padrão do sistema
    const confirmed = await window.ConfirmDialog.confirmDelete({
      title: 'Sair do Sistema',
      message: 'Tem certeza que deseja sair do sistema?',
      itemName: '',
      confirmText: 'Sair',
      cancelText: 'Cancelar'
    });
    
    if (!confirmed) {
      console.log('⏹️ LOGOUT_MANAGER: Cancelado pelo usuário');
      return;
    }

    try {
      // Executar logout usando AuthManager
      if (window.authManager) {
        const result = await window.authManager.logout();
        
        if (result.success) {
          console.log('✅ LOGOUT_MANAGER: Logout realizado com sucesso!');
          this.redirectToLogin();
        } else {
          console.error('❌ LOGOUT_MANAGER: Erro no logout:', result.error);
          alert('Erro ao fazer logout: ' + result.error);
        }
      } else {
        // Fallback: logout direto do Supabase
        console.log('⚠️ LOGOUT_MANAGER: AuthManager não encontrado, usando fallback');
        const { error } = await window.supabase.auth.signOut();
        
        if (error) {
          console.error('❌ LOGOUT_MANAGER: Erro no fallback:', error);
          alert('Erro ao sair: ' + error.message);
        } else {
          console.log('✅ LOGOUT_MANAGER: Logout fallback realizado com sucesso!');
          this.redirectToLogin();
        }
      }
    } catch (error) {
      console.error('❌ LOGOUT_MANAGER: Erro inesperado:', error);
      alert('Ocorreu um erro inesperado ao fazer logout');
    }
  }

  redirectToLogin() {
    // Limpar dados da sessão
    try {
      localStorage.removeItem('sidebarCollapsed');
      sessionStorage.clear();
    } catch (error) {
      console.warn('⚠️ LOGOUT_MANAGER: Erro ao limpar storage:', error);
    }

    // Redirecionar para login
    window.location.href = 'login.html';
  }

  // Métodos públicos
  getButton() {
    return this.logoutButton;
  }

  updateButtonText(text) {
    if (this.logoutButton) {
      this.logoutButton.innerHTML = text;
    }
  }

  destroy() {
    // Limpar eventos e referências
    if (this.logoutButton) {
      this.logoutButton.replaceWith(this.logoutButton.cloneNode(true));
    }
    
    this.logoutButton = null;
    this.isInitialized = false;
    
    console.log('✅ LOGOUT_MANAGER: Destruído com sucesso');
  }
}

// Inicializar automaticamente quando o DOM estiver pronto
let logoutManager;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    logoutManager = new LogoutManager();
    window.logoutManager = logoutManager;
  });
} else {
  logoutManager = new LogoutManager();
  window.logoutManager = logoutManager;
}

// Exportar para uso global
window.LogoutManager = LogoutManager;

// Disparar evento quando estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  if (window.logoutManager) {
    window.dispatchEvent(new CustomEvent('logoutManagerReady'));
  }
});

console.log('✅ LOGOUT_MANAGER: Script carregado com sucesso');
