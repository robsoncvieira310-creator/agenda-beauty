// ================================
// AUTH AUTHORIZATION - Camada de Validação de Autorização
// ================================
// Responsabilidade: Validar permissões alinhadas com RLS do Supabase
// Suporte ao modelo híbrido: JWT (app_metadata) + profiles.role (legado)
//
// Regras de autorização (ALINHADAS COM RLS):
// - UPDATE profiles: Permitir se isAdmin(currentUser) || currentUser.id === targetProfile.id
// ================================

// ================================
// IIFE - ISOLAMENTO DE ESCOPO
// ================================
(function() {

// FASE 1: LOG DE CARREGAMENTO
console.log('[LOAD] AuthAuthorization loading, existing?', !!window.AuthAuthorization, 'timestamp:', Date.now());

// 🔒 PROTEÇÃO CONTRA RELOAD DUPLICADO
if (window.AuthAuthorization) {
  console.warn('[LOAD] AuthAuthorization already loaded, skipping...');
  return;
}

// ================================
// CONSTANTES DE DECISÃO
// ================================
const AUTH_DECISION = Object.freeze({
  ALLOWED: 'ALLOWED',
  DENIED: 'DENIED',
  ERROR: 'ERROR'
});

const AUTH_ERROR_CODES = Object.freeze({
  INVALID_USER: 'INVALID_USER',
  INVALID_TARGET: 'INVALID_TARGET',
  RLS_BLOCKED: 'RLS_BLOCKED',
  NOT_FOUND: 'NOT_FOUND',
  AUTHORIZATION_DENIED: 'AUTHORIZATION_DENIED'
});

// ================================
// LOGGING ESTRUTURADO
// ================================
function logAuthCheck(payload) {
  console.log('[AUTH][CHECK]', JSON.stringify(payload, null, 2));
}

function logAuthDenied(payload) {
  console.warn('[AUTH][DENIED]', JSON.stringify(payload, null, 2));
}

function logAuthAllowed(payload) {
  console.log('[AUTH][ALLOWED]', JSON.stringify(payload, null, 2));
}

// ================================
// AUTH AUTHORIZATION CLASS
// ================================
window.AuthAuthorization = class AuthAuthorization {
  constructor(authFSM) {
    this.fsm = authFSM;
  }

  // ================================
  // OBTENÇÃO DO USUÁRIO ATUAL (SINGLE SOURCE OF TRUTH)
  // ================================
  
  /**
   * Obtém o usuário atual da FSM (única fonte de verdade)
   * @returns {Object|null} Usuário atual com dados completos
   */
  getCurrentUser() {
    if (!this.fsm) {
      console.error('[AUTH] FSM não disponível');
      return null;
    }

    const state = this.fsm.getState();
    if (!state || !state.isAuthenticated) {
      return null;
    }

    // Extrair usuário da sessão FSM
    const session = state.session;
    if (!session || !session.user) {
      return null;
    }

    return session.user;
  }

  /**
   * Verifica se o usuário atual é admin (modelo híbrido)
   * PRIORIDADE 1: JWT app_metadata.role === 'admin'
   * FALLBACK: profiles.role === 'admin' (legado)
   * 
   * @param {Object} user - Usuário (opcional, usa currentUser se omitido)
   * @returns {boolean}
   */
  isAdmin(user = null) {
    const currentUser = user || this.getCurrentUser();
    
    if (!currentUser) {
      return false;
    }

    // PRIORIDADE 1: JWT (novo modelo)
    const jwtRole = currentUser.app_metadata?.role;
    const isAdminJWT = jwtRole === 'admin';

    // FALLBACK: profiles.role (legado)
    // Nota: Este campo pode não estar disponível em todos os casos,
    // mas é mantido para compatibilidade durante a transição
    const profileRole = currentUser.user_metadata?.role || currentUser.role;
    const isAdminProfile = profileRole === 'admin';

    const decision = isAdminJWT || isAdminProfile;

    logAuthCheck({
      currentUserId: currentUser.id,
      isAdminJWT,
      isAdminProfile,
      jwtRole,
      profileRole,
      decision,
      source: 'isAdmin'
    });

    return decision;
  }

  // ================================
  // VALIDAÇÃO DE PERMISSÕES (ALINHADA COM RLS)
  // ================================

  /**
   * Verifica se pode editar um profile (ALINHADO COM RLS)
   * RLS: UPDATE profiles WHERE auth.uid() = id OR EXISTS (admin check)
   * 
   * @param {Object} params
   * @param {Object} params.currentUser - Usuário atual (opcional)
   * @param {Object} params.targetProfile - Profile alvo
   * @param {string} params.targetProfile.id - ID do profile alvo
   * @returns {Object} Resultado da autorização { allowed, reason, code }
   */
  canEditProfile({ currentUser, targetProfile }) {
    // Guard: validar inputs
    const user = currentUser || this.getCurrentUser();
    
    if (!user) {
      const result = { 
        allowed: false, 
        reason: 'Usuário não autenticado',
        code: AUTH_ERROR_CODES.INVALID_USER
      };
      logAuthDenied({ ...result, context: 'canEditProfile' });
      return result;
    }

    if (!targetProfile || !targetProfile.id) {
      const result = { 
        allowed: false, 
        reason: 'Profile alvo inválido',
        code: AUTH_ERROR_CODES.INVALID_TARGET
      };
      logAuthDenied({ ...result, currentUserId: user.id, context: 'canEditProfile' });
      return result;
    }

    // REGRA DE AUTORIZAÇÃO (ALINHADA COM RLS):
    // Permitir se: isAdmin(currentUser) || currentUser.id === targetProfile.id
    const userIsAdmin = this.isAdmin(user);
    const isOwnProfile = user.id === targetProfile.id;
    const allowed = userIsAdmin || isOwnProfile;

    const result = {
      allowed,
      isAdmin: userIsAdmin,
      isOwnProfile,
      currentUserId: user.id,
      targetProfileId: targetProfile.id,
      reason: allowed 
        ? (userIsAdmin ? 'Admin pode editar qualquer profile' : 'Usuário pode editar próprio profile')
        : 'Usuário não tem permissão para editar este profile',
      code: allowed ? null : AUTH_ERROR_CODES.AUTHORIZATION_DENIED
    };

    if (allowed) {
      logAuthAllowed({
        currentUserId: user.id,
        targetProfileId: targetProfile.id,
        isAdmin: userIsAdmin,
        isOwnProfile,
        decision: 'ALLOWED',
        context: 'canEditProfile'
      });
    } else {
      logAuthDenied({
        currentUserId: user.id,
        targetProfileId: targetProfile.id,
        isAdmin: userIsAdmin,
        isOwnProfile,
        decision: 'DENIED',
        context: 'canEditProfile'
      });
    }

    return result;
  }

  /**
   * Verifica se pode visualizar um profile
   * @param {Object} params
   * @param {Object} params.currentUser - Usuário atual (opcional)
   * @param {Object} params.targetProfile - Profile alvo
   * @returns {Object} Resultado da autorização
   */
  canViewProfile({ currentUser, targetProfile }) {
    const user = currentUser || this.getCurrentUser();
    
    if (!user) {
      return { 
        allowed: false, 
        reason: 'Usuário não autenticado',
        code: AUTH_ERROR_CODES.INVALID_USER
      };
    }

    if (!targetProfile || !targetProfile.id) {
      return { 
        allowed: false, 
        reason: 'Profile alvo inválido',
        code: AUTH_ERROR_CODES.INVALID_TARGET
      };
    }

    // Regra de visualização: Admin pode ver todos, usuário comum só vê próprio ou público
    const userIsAdmin = this.isAdmin(user);
    const isOwnProfile = user.id === targetProfile.id;
    const allowed = userIsAdmin || isOwnProfile;

    return {
      allowed,
      isAdmin: userIsAdmin,
      isOwnProfile,
      currentUserId: user.id,
      targetProfileId: targetProfile.id,
      reason: allowed 
        ? 'Acesso permitido'
        : 'Sem permissão para visualizar este profile',
      code: allowed ? null : AUTH_ERROR_CODES.AUTHORIZATION_DENIED
    };
  }

  // ================================
  // UTILITÁRIOS DE AUTORIZAÇÃO
  // ================================

  /**
   * Lança erro se autorização negada
   * @param {Object} authResult - Resultado de canEditProfile/canViewProfile
   * @throws Error se não autorizado
   */
  assertAllowed(authResult) {
    if (!authResult.allowed) {
      const error = new Error(authResult.reason || 'AUTHORIZATION_DENIED');
      error.code = authResult.code || AUTH_ERROR_CODES.AUTHORIZATION_DENIED;
      error.authResult = authResult;
      throw error;
    }
  }

  /**
   * Formata resultado para UI (sem expor detalhes internos)
   * @param {Object} authResult - Resultado da verificação
   * @returns {Object} { allowed, message }
   */
  formatForUI(authResult) {
    return {
      allowed: authResult.allowed,
      message: authResult.reason,
      // Não expor IDs ou flags internos para UI
    };
  }
}

// ================================
// DETECÇÃO DE RLS BLOCKS NO DATACORE
// ================================

/**
 * Analisa resposta do Supabase/DataCore para detectar bloqueio RLS
 * @param {Object} response - Resposta do DataCore
 * @param {string} operation - Operação executada (update, delete, etc)
 * @param {string} table - Tabela afetada
 * @throws Error se detectar bloqueio RLS ou resposta vazia suspeita
 */
window.AuthAuthorization.detectRlsBlock = function(response, operation, table) {
  // Caso 1: Resposta vazia (array vazio) em operação que deveria retornar dados
  if (Array.isArray(response) && response.length === 0) {
    const error = new Error(`RLS_BLOCKED_OR_NOT_FOUND: ${operation} em ${table} retornou vazio`);
    error.code = AUTH_ERROR_CODES.RLS_BLOCKED;
    error.operation = operation;
    error.table = table;
    error.response = response;
    
    console.error('[AUTH][RLS_DETECTED]', {
      operation,
      table,
      responseType: 'empty_array',
      hint: 'RLS pode estar bloqueando ou registro não existe'
    });
    
    throw error;
  }

  // Caso 2: Resposta null/undefined
  if (response === null || response === undefined) {
    const error = new Error(`RLS_BLOCKED_OR_NOT_FOUND: ${operation} em ${table} retornou null`);
    error.code = AUTH_ERROR_CODES.RLS_BLOCKED;
    error.operation = operation;
    error.table = table;
    
    console.error('[AUTH][RLS_DETECTED]', {
      operation,
      table,
      responseType: 'null'
    });
    
    throw error;
  }

  // Caso 3: Objeto com count: 0 (padrão Supabase em updates bloqueados)
  if (typeof response === 'object' && response.count === 0 && !response.id) {
    const error = new Error(`RLS_BLOCKED: ${operation} em ${table} retornou count:0 sem dados`);
    error.code = AUTH_ERROR_CODES.RLS_BLOCKED;
    error.operation = operation;
    error.table = table;
    error.response = response;
    
    console.error('[AUTH][RLS_DETECTED]', {
      operation,
      table,
      responseType: 'count_zero'
    });
    
    throw error;
  }

  // ✅ Tudo OK
  return true;
};

// ================================
// SINGLETON INSTANCE
// ================================
// Criar instância global quando AuthFSM estiver disponível
window.createAuthAuthorization = function() {
  if (!window.AuthFSM) {
    console.error('[AUTH] AuthFSM não disponível para criar AuthAuthorization');
    return null;
  }

  // Usar a instância global do AuthFSM (window.authFSM) se existir
  const fsm = window.authFSM || window.AuthFSM;
  
  if (!fsm) {
    console.error('[AUTH] Nenhuma instância de AuthFSM encontrada');
    return null;
  }

  const authz = new window.AuthAuthorization(fsm);
  
  console.log('[AUTH] AuthAuthorization criado com sucesso');
  return authz;
};

// ================================
// EXPORTS
// ================================
window.AUTH_DECISION = AUTH_DECISION;
window.AUTH_ERROR_CODES = AUTH_ERROR_CODES;

console.log('[AUTH] AuthAuthorization carregado');

// Fechar IIFE
})();
