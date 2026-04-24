// ================================
// BASE SERVICE - Interface CRUD Padronizada
// ================================
// Contrato único para todos os services:
// - list(params?): Promise<T[]>
// - getById(id): Promise<T | null>
// - create(data): Promise<T>
// - update(id, data): Promise<T>
// - delete(id): Promise<{id, deleted}>
//
// Injeta DataCore via constructor - SEM dependência de global/window

// ================================
// IIFE - ISOLAMENTO DE ESCOPO
// ================================
(function() {

// FASE 4: LOG DE CARREGAMENTO - detectar execução dupla
console.log('[LOAD] BaseService loading, existing?', !!window.BaseService, 'timestamp:', Date.now());

// 🔒 PROTEÇÃO CONTRA RELOAD DUPLICADO
if (window.BaseService) {
  console.warn('[LOAD] BaseService already loaded, skipping...');
  return;
}

// 🔒 VALIDAÇÃO DE DEPENDÊNCIAS CRÍTICAS
if (!window.DataCore) {
  throw new Error('[BOOTSTRAP FATAL] BaseService: window.DataCore missing. Ensure DataCore.js loads before services.');
}

window.BaseService = class BaseService {
  constructor(core, table) {
    if (!core) {
      throw new Error('DataCore é obrigatório - injeção via constructor');
    }
    this.core = core;
    this.table = table;
  }

  // ================================
  // 🎯 FASE 4: PROTEÇÃO CONTRA BYPASS DE PRIMEIRO LOGIN
  // ================================

  _assertCanAccessApp() {
    const state = window.authFSM?.getState?.();
    if (state?.requiresPasswordChange) {
      const error = new Error('ACCESS_BLOCKED_FIRST_LOGIN: Troca de senha obrigatória não concluída');
      error.code = 'FIRST_LOGIN_REQUIRED';
      error.status = 403;
      throw error;
    }
  }

  // ================================
  // READ OPERATIONS (PROTEGIDAS - FASE 4)
  // ================================

  async list(options = {}) {
    this._assertCanAccessApp(); // 🎯 FASE 4: Bloquear leitura se primeiro login pendente
    return this.core.query(this.table, options);
  }

  async getById(id) {
    this._assertCanAccessApp(); // 🎯 FASE 4: Bloquear leitura se primeiro login pendente
    const data = await this.core.query(this.table, { eq: { id } });
    return data[0] || null;
  }

  // ================================
  // WRITE OPERATIONS (PROTEGIDAS)
  // ================================

  async create(data) {
    this._assertCanAccessApp(); // 🎯 FASE 4: Bloquear se primeiro login pendente
    this._validate(data);
    const result = await this.core.insert(this.table, data);
    this.core.invalidate(this.table);
    return result;
  }

  async update(id, data) {
    this._assertCanAccessApp(); // 🎯 FASE 4: Bloquear se primeiro login pendente
    this._validate(data, true);
    const result = await this.core.update(this.table, id, data);
    this.core.invalidate(this.table);
    return result;
  }

  async delete(id) {
    this._assertCanAccessApp(); // 🎯 FASE 4: Bloquear se primeiro login pendente
    await this.core.delete(this.table, id);
    this.core.invalidate(this.table);
    return { id, deleted: true };
  }

  // ================================
  // VALIDATION HOOK (override nas subclasses)
  // ================================

  _validate(data, isUpdate = false) {
    // Hook para subclasses implementarem validação específica
    // Lançar Error se inválido
  }

  // ================================
  // CACHE CONTROL
  // ================================

  invalidateCache() {
    this.core.invalidate(this.table);
  }

  clearAllCache() {
    this.core.clearCache();
  }
}

// Fechar IIFE
})();

