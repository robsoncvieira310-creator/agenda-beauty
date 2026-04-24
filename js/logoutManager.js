// ================================
// LOGOUT MANAGER - FSM-DRIVEN
// ================================
// 🎯 Conecta botão de logout ao AuthFSM via LOGOUT_REQUEST
// Solução determinística sem race condition

(function() {
  'use strict';

  // 🎯 Guard: Só executa uma vez
  if (window.__logoutManagerFSMInitialized) {
    console.log('[LogoutManager] Já inicializado, ignorando');
    return;
  }
  window.__logoutManagerFSMInitialized = true;

  console.log('[LogoutManager] Inicializando (FSM-driven)...');

  /**
   * Configura o botão de logout conectando ao AuthFSM
   * Aguarda authFSM estar disponível (resolve race condition)
   */
  function setupLogoutButton() {
    // 🎯 Guard: Verificar se authFSM está disponível
    if (!window.authFSM) {
      console.log('[LogoutManager] Aguardando authFSM...');
      setTimeout(setupLogoutButton, 100);
      return;
    }

    // 🎯 Guard: Verificar se botão existe no DOM
    const logoutButton = document.getElementById('logoutButton');
    if (!logoutButton) {
      console.warn('[LogoutManager] Botão #logoutButton não encontrado');
      return;
    }

    // 🎯 Verificar se já tem event listener (evitar duplicação)
    if (logoutButton.__fsmLogoutConnected) {
      console.log('[LogoutManager] Botão já conectado ao FSM');
      return;
    }

    // 🎯 Conectar ao FSM: dispatch LOGOUT_REQUEST com confirmação
    logoutButton.addEventListener('click', async (event) => {
      event.preventDefault();
      console.log('[LogoutManager] Logout clicado, mostrando confirmação...');

      // 🎯 Usar modal de confirmação existente
      const confirmacao = await window.confirmDelete({
        title: 'Confirmar Logout',
        message: 'Deseja realmente sair do sistema?',
        itemName: '',
        confirmText: 'Sair',
        cancelText: 'Cancelar'
      });

      if (!confirmacao) {
        console.log('[LogoutManager] Logout cancelado pelo usuário');
        return;
      }

      console.log('[LogoutManager] Logout confirmado, dispatching LOGOUT_REQUEST...');
      // 🎯 CORRETO: dispatch recebe string do evento, não objeto
      window.authFSM.dispatch('LOGOUT_REQUEST');
    });

    // Marcar como conectado
    logoutButton.__fsmLogoutConnected = true;
    console.log('[LogoutManager] Botão conectado ao FSM com sucesso');
  }

  // 🎯 Resolver race condition: aguardar DOM + authFSM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLogoutButton);
  } else {
    // DOM já pronto, iniciar imediatamente
    setupLogoutButton();
  }

  console.log('[LogoutManager] Módulo FSM carregado');
})();
