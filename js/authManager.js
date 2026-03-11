/**
 * AuthManager Simplificado - Teste V1.3
 * Agenda Beauty V1.3
 */

console.log('🔍 AUTH_MANAGER: Início do script');

// Classe simplificada para teste
class AuthManager {
  constructor() {
    console.log('� AUTH_MANAGER: Construtor iniciado');
    this.currentUser = null;
    this.currentUserProfile = null;
    console.log('🔍 AUTH_MANAGER: Construtor finalizado');
  }

  async initialize() {
    console.log('🔍 AUTH_MANAGER: Inicializando...');
    return { authenticated: false };
  }

  async login(email, password) {
    console.log('🔍 AUTH_MANAGER: Login simplificado');
    return { success: false, error: 'Simplificado' };
  }

  async logout() {
    console.log('🔍 AUTH_MANAGER: Logout simplificado');
    return { success: true };
  }
}

// Criar instância global
console.log('🔍 AUTH_MANAGER: Criando instância global');
window.authManager = new AuthManager();
console.log('✅ AUTH_MANAGER: Instância criada:', !!window.authManager);
console.log('✅ AUTH_MANAGER: Script completamente carregado');
