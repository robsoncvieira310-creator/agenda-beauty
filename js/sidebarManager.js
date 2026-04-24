/**
 * SidebarManager - Controle da Sidebar Colapsível
 * Agenda Beauty V1.5
 * 
 * Responsabilidades:
 * - Controlar toggle da sidebar
 * - Gerenciar animações e transições
 * - Manter estado da sidebar
 * - Comportamento similar ao Google Calendar
 * 
 * 🎯 FASE 2.6.2: Implementa LifecycleContract
 */

class SidebarManager extends LifecycleContract {
  constructor(context = null) {
    super('SidebarManager');
    
    // 🎯 FASE 6: INSTRUMENTAÇÃO - Contar instanciações
    console.count('[SidebarManager] constructor');
    
    // 🎯 FASE 3.0.1.1: INVARIANTE OBRIGATÓRIO - Contexto deve ser válido
    if (!context || !context.authFSM) {
      console.error('[INVARIANT][SidebarManager] Contexto inválido - authFSM requerido');
    }
    
    // 🎯 FASE 2.6.2: STATE ONLY - Zero side-effects no constructor
    this.sidebar = null;
    this.menuToggle = null;
    this.isCollapsed = false;
    this._boundToggle = null;
    this._boundKeyHandler = null;
    this._context = context; // Referência ao contexto de boot
  }

  // ================================
  // 🎯 FASE 2.6.2: LIFECYCLE IMPLEMENTATION
  // ================================
  
  activate() {
    if (this._lifecycleActive) return;
    
    console.log('[SidebarManager] activating...');
    
    // Obter elementos do DOM
    this.sidebar = document.getElementById('sidebar');

    if (!this.sidebar) {
      console.error('SidebarManager: Elementos necessários não encontrados');
      return false;
    }

    // Criar botão dinamicamente
    this.createToggleButton();

    // POSICIONAR BOTÃO INICIALMENTE
    this.updateButtonPosition();

    // Registrar listeners via LifecycleContract
    this._boundKeyHandler = (e) => {
      if (e.key === 'Escape' && !this.isCollapsed) {
        this.toggle();
      }
    };
    this.addEventListener(document, 'keydown', this._boundKeyHandler);

    // Restaurar estado salvo
    this.restoreState();
    
    // Marcar como ativo
    this._lifecycleActive = true;

    console.log('✅ SidebarManager activated');
    return true;
  }
  
  deactivate() {
    if (!this._lifecycleActive) return;
    
    console.log('[SidebarManager] deactivating...');
    
    // Cleanup via LifecycleContract (unbindAll, clearAllTimers)
    super.deactivate();
    
    // Remover botão do DOM
    if (this.menuToggle?.parentNode) {
      this.menuToggle.parentNode.removeChild(this.menuToggle);
    }
    
    this.sidebar = null;
    this.menuToggle = null;
    
    console.log('[SidebarManager] deactivated');
  }
  
  destroy() {
    console.log('[SidebarManager] destroying...');
    super.destroy();
  }

  createToggleButton() {
    // Criar botão
    this.menuToggle = document.createElement('button');
    this.menuToggle.className = 'menu-toggle';
    this.menuToggle.setAttribute('aria-expanded', 'true');
    this.menuToggle.setAttribute('title', 'Fechar Menu');
    
    this.menuToggle.innerHTML = '☰';
    
    // 🎯 FASE 2.6.2: Usar addEventListener do LifecycleContract para cleanup automático
    this._boundToggle = () => this.toggle();
    this.addEventListener(this.menuToggle, 'click', this._boundToggle);
  }

  handleResize() {
    // Método vazio para evitar erro
    // Lógica de resize pode ser implementada futuramente
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
      // SEMPRE começar com sidebar aberta para garantir visibilidade do botão logout
      // Não restaurar estado colapsado para evitar problemas
      console.log('🔧 SIDEBAR_MANAGER: Forçando sidebar aberta para garantir visibilidade do botão logout');
      this.isCollapsed = false;
      this.sidebar.classList.remove('collapsed');
      this.updateButtonPosition();
    } catch (error) {
      console.warn('⚠️ SIDEBAR_MANAGER: Erro ao restaurar estado:', error);
      // Em caso de erro, garantir que sidebar comece aberta
      this.isCollapsed = false;
      this.sidebar.classList.remove('collapsed');
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

// 🎯 FASE 3.0.1.1: MÓDULO PASSIVO - Nenhuma execução automática
// Inicialização 100% controlada pelo CompositionRoot
// ZERO listeners no parse
// ZERO execução fora do boot pipeline

// Exportar classe para uso pelo CompositionRoot
window.SidebarManager = SidebarManager;
