/**
 * MenuManager - Controle de Permissões do Menu
 * Agenda Beauty V1.3
 * 
 * Responsabilidades:
 * - Controlar visibilidade do menu baseado no role
 * - Mostrar/ocultar itens conforme permissões
 * - Adicionar botão de logout
 */

class MenuManager {
  constructor() {
    this.menuItems = {
      // Itens visíveis para ADMIN
      admin: [
        { href: 'index.html', icon: '🏠', text: 'Início', id: 'nav-dashboard' },
        { href: 'agenda.html', icon: '📅', text: 'Agenda', id: 'nav-agenda' },
        { href: 'clientes.html', icon: '👥', text: 'Clientes', id: 'nav-clientes' },
        { href: 'servicos.html', icon: '💇', text: 'Serviços', id: 'nav-servicos' },
        { href: 'profissionais.html', icon: '👩', text: 'Profissionais', id: 'nav-profissionais' }
      ],
      // Itens visíveis para PROFISSIONAL
      profissional: [
        { href: 'index.html', icon: '🏠', text: 'Início', id: 'nav-dashboard' },
        { href: 'agenda.html', icon: '📅', text: 'Agenda', id: 'nav-agenda' },
        { href: 'clientes.html', icon: '👥', text: 'Clientes', id: 'nav-clientes' }
      ]
    };

    this.currentUser = null;
    
    this.init();
  }

  async init() {
    // Esperar o DOM carregar
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  async setup() {
    // Obter usuário atual
    await this.getCurrentUser();
    
    // Configurar menu baseado no role
    this.setupMenu();
    
    // Adicionar botão de logout
    this.addLogoutButton();
    
    console.log('✅ MenuManager inicializado com sucesso');
  }

  async getCurrentUser() {
    try {
      // Aguardar o profile estar disponível
      await this.waitForUserProfile();
      
      if (window.currentUserProfile) {
        this.currentUser = window.currentUserProfile;
        console.log('🔐 MENU_MANAGER: Usuário carregado:', this.currentUser.role);
      } else {
        console.warn('🔐 MENU_MANAGER: Nenhum usuário encontrado');
      }
    } catch (error) {
      console.error('🔐 MENU_MANAGER: Erro ao obter usuário:', error);
    }
  }

  /**
   * Aguarda o profile do usuário estar disponível
   */
  waitForUserProfile() {
    return new Promise((resolve) => {
      const checkProfile = () => {
        if (window.currentUserProfile) {
          console.log('✅ MENU_MANAGER: Profile encontrado:', window.currentUserProfile);
          resolve();
        } else {
          console.log('⏳ MENU_MANAGER: Aguardando profile...');
          setTimeout(checkProfile, 100);
        }
      };
      
      checkProfile();
    });
  }

  setupMenu() {
    if (!this.currentUser) {
      console.warn('🔐 MENU_MANAGER: Nenhum usuário para configurar menu');
      return;
    }

    const userRole = this.currentUser.role;
    const allowedItems = this.menuItems[userRole] || [];

    // Limpar menu atual
    const nav = document.querySelector('.sidebar nav');
    if (nav) {
      nav.innerHTML = '';
      
      // Adicionar itens permitidos
      allowedItems.forEach(item => {
        const navItem = document.createElement('a');
        navItem.href = item.href;
        navItem.className = 'nav-item';
        navItem.id = item.id;
        
        navItem.innerHTML = `
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-text">${item.text}</span>
        `;
        
        // Marcar item ativo baseado na página atual
        if (window.location.pathname.includes(item.href) || 
            (item.href === 'index.html' && window.location.pathname.endsWith('/'))) {
          navItem.classList.add('active');
        }
        
        nav.appendChild(navItem);
      });

      console.log(`🔐 MENU_MANAGER: Menu configurado para role ${userRole} com ${allowedItems.length} itens`);
    }

    // Esconder elementos não autorizados
    this.hideUnauthorizedElements();
  }

  addLogoutButton() {
    // O botão de logout agora está no HTML dentro da sidebar-footer
    // Apenas adicionar o evento de clique
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
      logoutBtn.onclick = () => this.logout();
      console.log('🔐 MENU_MANAGER: Botão de logout configurado na sidebar');
    }
  }

  async logout() {
    try {
      console.log('🔐 MENU_MANAGER: Iniciando logout...');
      
      // Mostrar loading
      this.showToast('Fazendo logout...', 'info');
      
      // Fazer logout via AuthManager
      if (window.authManager && typeof window.authManager.logout === 'function') {
        await window.authManager.logout();
      } else {
        // Fallback: limpar localStorage e redirecionar
        localStorage.clear();
        window.location.href = 'index.html';
      }
      
    } catch (error) {
      console.error('🔐 MENU_MANAGER: Erro no logout:', error);
      this.showToast('Erro ao fazer logout', 'error');
    }
  }

  hideUnauthorizedElements() {
    console.log('🔐 MENU_MANAGER: Escondendo elementos não autorizados...');
    
    // Esconder botões de novo serviço
    if (!this.hasPermission('servicos')) {
      const btnNovoServico = document.getElementById('btnNovoServico');
      if (btnNovoServico) {
        btnNovoServico.style.display = 'none';
        console.log('🔐 MENU_MANAGER: Botão Novo Serviço oculto');
      }
    }
    
    // Esconder botões de novo profissional
    if (!this.hasPermission('profissionais')) {
      const btnNovoProfissional = document.getElementById('btnNovoProfissional');
      if (btnNovoProfissional) {
        btnNovoProfissional.style.display = 'none';
        console.log('🔐 MENU_MANAGER: Botão Novo Profissional oculto');
      }
    }
  }

  /**
   * Verifica se usuário tem permissão para acessar determinada funcionalidade
   */
  hasPermission(feature) {
    const role = window.currentUserProfile?.role;
    
    const permissions = {
      admin: [
        'dashboard', 'agenda', 'clientes', 'servicos', 'profissionais', 'relatorios'
      ],
      profissional: [
        'agenda', 'clientes'
      ]
    };
    
    const userPermissions = permissions[role] || [];
    const hasPermission = userPermissions.includes(feature);
    
    console.log(`🔐 MENU_MANAGER: Verificando permissão para ${feature}: ${hasPermission}`);
    return hasPermission;
  }

  /**
   * Mostra toast de notificação
   */
  showToast(message, type = 'info') {
    // Criar elemento toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Estilos do toast
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: '10000',
      fontSize: '14px',
      fontWeight: '500',
      opacity: '0',
      transform: 'translateX(100%)',
      transition: 'all 0.3s ease'
    });
    
    // Adicionar ao DOM
    document.body.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Remover após 3 segundos
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 300);
      }
    }, 3000);
  }
}

// Inicializar automaticamente
let menuManager;

// Esperar o DOM carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    menuManager = new MenuManager();
    window.menuManager = menuManager;
  });
} else {
  menuManager = new MenuManager();
  window.menuManager = menuManager;
}

// Exportar para uso global
window.MenuManager = MenuManager;
