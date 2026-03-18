/**
 * SidebarManager - Controle da Sidebar Colapsível
 * Agenda Beauty V1.5
 * 
 * Responsabilidades:
 * - Controlar toggle da sidebar
 * - Gerenciar animações e transições
 * - Manter estado da sidebar
 * - Comportamento similar ao Google Calendar
 */

class SidebarManager {
  constructor() {
    this.sidebar = null;
    this.menuToggle = null;
    this.isCollapsed = false;
    
    this.init();
  }

  init() {
    // Obter elementos do DOM
    this.sidebar = document.getElementById('sidebar');

    if (!this.sidebar) {
      console.error('SidebarManager: Elementos necessários não encontrados');
      return;
    }

    // Criar e inserir botão dinamicamente
    this.createToggleButton();

    // Adicionar listener para tecla ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.isCollapsed) {
        this.toggle();
      }
    });

    // Restaurar estado salvo
    this.restoreState();

    console.log('✅ SidebarManager inicializado com sucesso');
  }

  createToggleButton() {
    // Criar botão
    this.menuToggle = document.createElement('button');
    this.menuToggle.className = 'menu-toggle';
    this.menuToggle.setAttribute('aria-expanded', 'true');
    this.menuToggle.setAttribute('title', 'Fechar Menu');
    
    this.menuToggle.innerHTML = '☰';
    
    // Adicionar evento de clique
    this.menuToggle.addEventListener('click', () => {
      this.toggle();
    });
  }

  handleResize() {
    // Método vazio para evitar erro
    // Lógica de resize pode ser implementada futuramente
  }

    // Adicionar linhas do hambúrguer
    for (let i = 0; i < 3; i++) {
      const line = document.createElement('span');
      line.className = 'hamburger-line';
      this.menuToggle.appendChild(line);
    }

    // Adicionar event listener
    this.menuToggle.addEventListener('click', () => this.toggle());

    // Adicionar evento de teclado (acessibilidade)
    this.menuToggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle();
      }
    });

    // Inserir no DOM baseado no estado inicial
    this.updateButtonPosition();
  }

  updateButtonPosition() {
    // Remover botão do DOM atual
    if (this.menuToggle.parentNode) {
      this.menuToggle.parentNode.removeChild(this.menuToggle);
    }

    if (this.isCollapsed) {
      // Sidebar fechada - botão no header (antes do conteúdo)
      const content = document.querySelector('.content');
      if (content) {
        content.insertBefore(this.menuToggle, content.firstChild);
      }
    } else {
      // Sidebar aberta - botão dentro da sidebar
      this.sidebar.insertBefore(this.menuToggle, this.sidebar.firstChild);
    }
  }

  toggle() {
    this.isCollapsed = !this.isCollapsed;
    
    // Atualizar classes CSS da sidebar
    if (this.isCollapsed) {
      this.sidebar.classList.add('collapsed');
      this.menuToggle.classList.remove('active');
      this.menuToggle.setAttribute('aria-expanded', 'false');
      this.menuToggle.setAttribute('title', 'Abrir Menu');
    } else {
      this.sidebar.classList.remove('collapsed');
      this.menuToggle.classList.add('active');
      this.menuToggle.setAttribute('aria-expanded', 'true');
      this.menuToggle.setAttribute('title', 'Fechar Menu');
    }
    
    // Atualizar posição do botão no DOM
    this.updateButtonPosition();
    
    // Salvar estado no localStorage
    this.saveState();
    
    // Disparar evento personalizado
    this.dispatchToggleEvent();
  }

  saveState() {
    try {
      localStorage.setItem('sidebarCollapsed', this.isCollapsed.toString());
    } catch (error) {
      console.warn('SidebarManager: Erro ao salvar estado:', error);
    }
  }

  restoreState() {
    try {
      const savedState = localStorage.getItem('sidebarCollapsed');
      if (savedState === 'true') {
        this.isCollapsed = false; // Invertido pois vamos chamar toggle()
        this.toggle();
      } else {
        // Garantir que o botão comece com o estado correto
        this.menuToggle.classList.add('active');
        this.menuToggle.setAttribute('aria-expanded', 'true');
        this.menuToggle.setAttribute('title', 'Fechar Menu');
      }
    } catch (error) {
      console.warn('SidebarManager: Erro ao restaurar estado:', error);
    }
  }

  dispatchToggleEvent() {
    const event = new CustomEvent('sidebarToggle', {
      detail: {
        isCollapsed: this.isCollapsed,
        sidebar: this.sidebar
      }
    });
    document.dispatchEvent(event);
  }

  // Métodos públicos
  expand() {
    if (this.isCollapsed) {
      this.toggle();
    }
  }

  collapse() {
    if (!this.isCollapsed) {
      this.toggle();
    }
  }

  getState() {
    return {
      isCollapsed: this.isCollapsed,
      sidebar: this.sidebar
    };
  }
}

// Inicializar automaticamente
let sidebarManager;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    sidebarManager = new SidebarManager();
    window.sidebarManager = sidebarManager;
  });
} else {
  sidebarManager = new SidebarManager();
  window.sidebarManager = sidebarManager;
}

// Exportar para uso global
window.SidebarManager = SidebarManager;
