// ================================
// FSM RENDER INTEGRATION - Composition Root Extension
// ================================
// ETAPA 4: Integração com AuthFSM via Composition Root
// 
// ANÁLISE DE RISCO: MÉDIO
// Impacto: Modifica boot sequence existente
// Mitigação: Feature flag, ativação gradual, rollback via kernel
//
// PRINCÍPIO: Zero regressão - sistema legado continua funcionando
//            até ViewManager ser explicitamente ativado

// ================================
// IIFE - ISOLAMENTO DE ESCOPO
// ================================
(function() {

// ================================
// FEATURE FLAG - Controle de Ativação
// ================================
window.__FSM_RENDER_CONFIG__ = {
  // 🎯 Controla se FSM-driven render está ativo
  // FALSE = sistema legado (multi-page) continua funcionando
  // TRUE = FSM-driven render assume controle
  ENABLED: false,
  
  // 🎯 Modo híbrido: permite transição gradual
  // Se true, ViewManager renderiza mas não bloqueia navegação legada
  HYBRID_MODE: true,
  
  // 🎯 Debug mode
  DEBUG: true,
  
  // 🎯 Rollback imediato via kernel
  rollback() {
    this.ENABLED = false;
    console.log('[FSM RENDER] Rollback executado - modo legado restaurado');
    window.location.reload();
  }
};

// ================================
// INTEGRATION CHECKPOINT
// ================================
function validateIntegrationPrerequisites() {
  const checks = {
    viewManager: !!window.ViewManager,
    authFSM: !!window.authFSM,
    compositionRoot: !!window.CompositionRoot,
    kernel: !!window.__BOOT_KERNEL__
  };

  const allPassed = Object.values(checks).every(v => v);
  
  if (!allPassed) {
    console.warn('[FSM RENDER INTEGRATION] Prerequisitos não atendidos:', checks);
    return false;
  }

  return true;
}

// ================================
// COMPOSITION ROOT EXTENSION
// ================================

/**
 * Estende CompositionRoot com ViewManager
 * SEM modificar a classe original - monkey patch seguro
 */
function extendCompositionRoot() {
  const originalBootstrap = window.CompositionRoot.prototype._executeBootstrap;
  
  // 🎯 Patch: Adiciona ViewManager ao final do bootstrap
  window.CompositionRoot.prototype._executeBootstrap = async function(uiAdapter, CURRENT_BOOT_ID) {
    // Executar bootstrap original
    const result = await originalBootstrap.call(this, uiAdapter, CURRENT_BOOT_ID);
    
    // 🎯 FSM Render: Inicializar APENAS se feature flag ativado
    if (window.__FSM_RENDER_CONFIG__.ENABLED) {
      console.log('[FSM RENDER] Inicializando ViewManager...');
      
      try {
        // Criar ViewManager com authFSM
        this.viewManager = window.createFSMViewManager(this.authFSM);
        
        // Ativar (subscribe ao FSM)
        this.viewManager.activate();
        
        console.log('[FSM RENDER] ViewManager ativado com sucesso');
        
        // 🎯 Híbrido: Em modo híbrido, não interferir com navegação legada
        if (!window.__FSM_RENDER_CONFIG__.HYBRID_MODE) {
          // Modo full: ViewManager controla 100% da renderização
          console.log('[FSM RENDER] Modo FULL ativado - renderização FSM-driven exclusiva');
        } else {
          console.log('[FSM RENDER] Modo HYBRID ativado - coexistência com sistema legado');
        }
        
      } catch (error) {
        console.error('[FSM RENDER] Falha ao inicializar ViewManager:', error);
        // 🎯 Zero regressão: falha não quebra boot
        // Sistema continua em modo legado
      }
    } else {
      console.log('[FSM RENDER] Feature flag DISABLED - usando sistema legado');
    }
    
    return result;
  };

  console.log('[FSM RENDER INTEGRATION] CompositionRoot estendido com ViewManager');
}

// ================================
// BOOT KERNEL EXTENSION
// ================================

/**
 * Adiciona controle de rollback ao kernel
 */
function extendBootKernel() {
  const kernel = window.__BOOT_KERNEL__;
  if (!kernel) return;

  // 🎯 API pública para ativar/desativar FSM render
  kernel.enableFSMRender = function(options = {}) {
    window.__FSM_RENDER_CONFIG__.ENABLED = true;
    window.__FSM_RENDER_CONFIG__.HYBRID_MODE = options.hybrid !== false;
    
    console.log('[KERNEL] FSM Render ativado:', {
      hybrid: window.__FSM_RENDER_CONFIG__.HYBRID_MODE,
      timestamp: Date.now()
    });
    
    // Se já existe viewManager, ativar
    const root = window.__APP_CONTEXT__;
    if (root?.viewManager && !root.viewManager._activated) {
      root.viewManager.activate();
    }
  };

  kernel.disableFSMRender = function() {
    window.__FSM_RENDER_CONFIG__.rollback();
  };

  kernel.getFSMRenderStatus = function() {
    return {
      enabled: window.__FSM_RENDER_CONFIG__.ENABLED,
      hybrid: window.__FSM_RENDER_CONFIG__.HYBRID_MODE,
      viewManagerActive: window.__APP_CONTEXT__?.viewManager?._activated || false
    };
  };

  console.log('[FSM RENDER INTEGRATION] BootKernel estendido com controles FSM Render');
}

// ================================
// SAFE INITIALIZATION
// ================================

/**
 * Inicializa integração APENAS quando seguro
 */
function safeInitialize() {
  // 🎯 Guard: Verificar se já foi inicializado
  if (window.__FSM_RENDER_INTEGRATED__) {
    return;
  }

  // 🎯 Guard: Validar prerequisitos
  if (!validateIntegrationPrerequisites()) {
    console.log('[FSM RENDER INTEGRATION] Aguardando prerequisitos...');
    
    // Tentar novamente após 100ms (defer)
    setTimeout(safeInitialize, 100);
    return;
  }

  // 🎯 Executar extensões
  extendCompositionRoot();
  extendBootKernel();

  window.__FSM_RENDER_INTEGRATED__ = true;
  console.log('[FSM RENDER INTEGRATION] Integração completa');
}

// ================================
// AUTO-INIT
// ================================

// Inicializar quando DOM estiver pronto ou imediatamente se já estiver
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeInitialize);
} else {
  safeInitialize();
}

// ================================
// PUBLIC API
// ================================

/**
 * Ativa FSM-driven render manualmente
 * Para uso em console ou eventos
 */
window.enableFSMRender = function(hybrid = true) {
  if (!window.__BOOT_KERNEL__) {
    console.error('[enableFSMRender] Kernel não disponível');
    return;
  }
  
  window.__BOOT_KERNEL__.enableFSMRender({ hybrid });
  
  // Se já booted, recarregar para ativar
  if (window.__APP_BOOTSTRAPPED__) {
    console.log('[enableFSMRender] Recarregando para aplicar mudanças...');
    // Em modo híbrido, não precisa reload
    if (!hybrid) {
      window.location.reload();
    }
  }
};

/**
 * Desativa FSM-driven render
 */
window.disableFSMRender = function() {
  window.__FSM_RENDER_CONFIG__.rollback();
};

console.log('[FSM RENDER INTEGRATION] Módulo carregado - aguardando inicialização segura');

// Fechar IIFE
})();
