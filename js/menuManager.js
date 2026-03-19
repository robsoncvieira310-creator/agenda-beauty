/**
 * MenuManager - Controle de Permissões do Menu
 * Agenda Beauty V1.3
 * 
 * Responsabilidades:
 * - Controlar visibilidade do menu baseado no role
 * - Mostrar/ocultar itens conforme permissões
 * - Gerenciar navegação do usuário
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
        { href: 'agenda.html', icon: '📅', text: 'Agenda', id: 'nav-agenda' },
        { href: 'clientes.html', icon: '👥', text: 'Clientes', id: 'nav-clientes' }
      ]
    };
    
    // Forçar inicialização imediata
    this.setup();
  }

  setup() {
    console.log('🔐 MENU_MANAGER: Configurando menu...');
    
    // Aguardar AuthManager estar disponível
    if (typeof window.authManager === 'undefined') {
      console.log('⏳ MENU_MANAGER: Aguardando AuthManager...');
      setTimeout(() => this.setup(), 100);
      return;
    }
    
    // Aguardar profile do usuário estar disponível
    this.waitForUserProfile().then(() => {
      this.updateMenu();
      // LogoutManager cuidará do botão de logout
      console.log('✅ MENU_MANAGER: LogoutManager gerenciará o botão de logout');
    });
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

  /**
   * Atualiza o menu baseado no role do usuário
   */
  updateMenu() {
    const role = window.currentUserProfile?.role;
    const nav = document.querySelector('nav');
    
    if (!nav) {
      console.error('❌ MENU_MANAGER: Navegação não encontrada');
      return;
    }

    console.log(`🔐 MENU_MANAGER: Atualizando menu para role: ${role}`);
    
    // Limpar menu atual
    nav.innerHTML = '';
    
    // Obter itens permitidos para o role
    const allowedItems = this.menuItems[role] || this.menuItems.profissional;
    
    // Renderizar itens permitidos
    allowedItems.forEach(item => {
      const navItem = document.createElement('a');
      navItem.href = item.href;
      navItem.className = 'nav-item';
      navItem.id = item.id;
      
      // Verificar se é a página atual
      const currentPage = window.location.pathname.split('/').pop();
      if (item.href === currentPage) {
        navItem.classList.add('active');
      }
      
      navItem.innerHTML = `
        <span class="nav-icon">${item.icon}</span>
        <span class="nav-text">${item.text}</span>
      `;
      
      nav.appendChild(navItem);
    });

    // Adicionar separador antes do logout
    const separator = document.createElement('div');
    separator.style.cssText = `
      height: 1px;
      background: rgba(255, 255, 255, 0.1);
      margin: 10px 0;
    `;
    nav.appendChild(separator);

    console.log(`✅ MENU_MANAGER: Menu atualizado com ${allowedItems.length} itens`);
    
    // Log para diagnóstico
    if (role === 'admin') {
      console.log('👑 MENU_MANAGER: ROLE_ADMIN - Menu completo ativado');
    } else if (role === 'profissional') {
      console.log('👩 MENU_MANAGER: ROLE_PROFISSIONAL - Menu restrito ativado');
    }
  }

  
  /**
   * Mostra uma mensagem toast
   */
  showToast(message, type = 'info') {
    // Remover toast existente
    const existingToast = document.querySelector('.menu-toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    // Criar novo toast
    const toast = document.createElement('div');
    toast.className = `menu-toast toast-${type}`;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#3b82f6'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      max-width: 300px;
      word-wrap: break-word;
      animation: slideInRight 0.3s ease-out;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Auto-remover após 3 segundos
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 300);
      }
    }, 3000);
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
   * Esconde elementos baseado em permissões
   */
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
    
    // Esconder botões de excluir em serviços
    if (!this.hasPermission('servicos')) {
      document.querySelectorAll('[data-action="delete-servico"]').forEach(btn => {
        btn.style.display = 'none';
      });
      console.log('🔐 MENU_MANAGER: Botões de excluir serviços ocultos');
    }
    
    // Esconder botões de excluir em profissionais
    if (!this.hasPermission('profissionais')) {
      document.querySelectorAll('[data-action="delete-profissional"]').forEach(btn => {
        btn.style.display = 'none';
      });
      console.log('🔐 MENU_MANAGER: Botões de excluir profissionais ocultos');
    }
  }
}

// Adicionar animações CSS para toast
const toastStyles = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;

// Adicionar estilos ao head
const styleSheet = document.createElement('style');
styleSheet.textContent = toastStyles;
document.head.appendChild(styleSheet);

// A instância será criada apenas se necessária
console.log('✅ MENU_MANAGER: Script carregado (instância não automática)');
