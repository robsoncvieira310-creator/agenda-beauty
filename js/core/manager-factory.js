// ================================
// MANAGER FACTORY — FASE 2.6 CLOSURE
// ================================
// FACTORY CONVENIENCE — NÃO SECURITY LAYER
//
// RESPONSABILIDADE:
// → Helper para criação de managers
// → Registro automático no LifecycleRegistry
// → NÃO é enforcement layer
// → NÃO bloqueia new Class() em JS puro
//
// FLUXO CORRETO:
// BootOrchestrator → ExecutionFirewall (enforcement) → ManagerFactory (convenience)
//
// ⚠️ HONESTIDADE TÉCNICA:
//    Este arquivo é CONVENIÊNCIA, não SEGURANÇA.
//    Use via BootOrchestrator para consistência.
//    new Class() ainda funciona em JS puro.
// ================================

window.ManagerFactory = class ManagerFactory {
  static _instance = null;
  
  static getInstance() {
    if (!ManagerFactory._instance) {
      ManagerFactory._instance = new ManagerFactory();
    }
    return ManagerFactory._instance;
  }

  constructor() {
    // Registry local para tracking (não enforcement)
    this._created = new Map();
  }

  /**
   * Criar instância de manager
   * 
   * ⚠️ NOTA: Isto é CONVENIÊNCIA, não enforcement.
   * new Class() ainda funciona em JavaScript puro.
   * Use este método por CONVENÇÃO, não por obrigação técnica.
   * 
   * @param {Class} ManagerClass - Classe do manager
   * @param {string} name - Nome único para registro
   * @param {Array} args - Argumentos para constructor
   * @returns {Object} Instância criada
   */
  create(ManagerClass, name, args = []) {
    if (!ManagerClass) {
      throw new Error(`[ManagerFactory] Cannot create ${name}: Class is null`);
    }
    
    // Verificar se já existe (convenção, não enforcement)
    if (this._created.has(name)) {
      console.warn(`[ManagerFactory] ${name} already created - returning existing instance`);
      return this._created.get(name).instance;
    }
    
    // Criar instância
    console.log(`[ManagerFactory] Creating ${name}...`);
    const instance = new ManagerClass(...args);
    
    // Registrar localmente
    this._created.set(name, {
      instance,
      className: ManagerClass.name,
      createdAt: Date.now()
    });
    
    // Registrar no LifecycleRegistry global (se disponível)
    const registry = window.LifecycleRegistry?.getInstance?.();
    if (registry && !registry.has(name)) {
      registry.register(name, instance);
    }
    
    console.log(`[ManagerFactory] ${name} created`);
    return instance;
  }
  
  /**
   * Verificar se instância existe
   */
  has(name) {
    return this._created.has(name);
  }
  
  /**
   * Obter instância existente
   */
  get(name) {
    return this._created.get(name)?.instance || null;
  }
  
  /**
   * Listar todas as instâncias criadas
   */
  getAll() {
    return Array.from(this._created.keys());
  }
  
  /**
   * Reset (para testes)
   */
  reset() {
    this._created.clear();
    console.log('[ManagerFactory] reset complete');
  }
};

console.log('[ManagerFactory] FASE 2.6 CLOSURE loaded');
console.log('[ManagerFactory] ℹ️ Convenience layer, NOT security layer');
console.log('[ManagerFactory] ℹ️ new Class() still works in pure JS');
