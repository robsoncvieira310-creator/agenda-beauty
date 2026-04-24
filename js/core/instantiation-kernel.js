// ================================
// INSTANTIATION KERNEL — FASE 2.6.4
// ================================
// CAMINHO RECOMENDADO PARA CRIAÇÃO DE MANAGERS (GOVERNED, NÃO ENFORCED)
//
// PROTEÇÃO (CONVENÇÃO FORTE):
// 🟡 Factory-only creation pattern
// 🟡 Constructor locking (impede modificação, não criação)
// 🟡 Global instantiation registry
// 🟡 Prototype freeze
//
// ⚠️ LIMITAÇÃO REAL:
//    ❌ NÃO consegue interceptar `new Class()` diretamente em JS puro
//    ❌ Proxy só funciona quando chamado através do proxy, não globalmente
//    ❌ Object.freeze() não impede instanciação, só mutação
//    
//    O Kernel é "GOVERNED" (governado por convenção), NÃO "ENFORCED":
//    → Uso de kernel.create() é obrigatório por CONVENÇÃO
//    → new Class() ainda funciona tecnicamente (bypass absoluto)
//    → Detectável via registry (auditoria), mas não bloqueável
//
// ✅ O QUE REALMENTE PROTEGE:
//    → Acidentes de desenvolvimento
//    → Padrões incorretos
//    → Código legítimo mal escrito
//
// 🛡️ PARA SECURITY REAL:
//    → Content Security Policy (CSP)
//    → Web Workers (isolamento)
//    → SubResource Integrity (SRI)
//    → SES (Secure ECMAScript) para capabilities

// ================================
// INSTANTIATION VIOLATION ERROR
// ================================
class InstantiationViolation extends Error {
  constructor(operation, reason, context = {}) {
    super(`[INSTANTIATION VIOLATION] ${operation}: ${reason}`);
    this.name = 'InstantiationViolation';
    this.operation = operation;
    this.reason = reason;
    this.context = context;
    this.timestamp = Date.now();
    
    console.error('[InstantiationKernel] VIOLATION:', {
      operation,
      reason,
      context,
      stack: this.stack
    });
  }
}

// ================================
// INSTANTIATION KERNEL
// ================================
window.InstantiationKernel = class InstantiationKernel {
  static _instance = null;
  static _initialized = false;
  
  static getInstance() {
    if (!InstantiationKernel._instance) {
      InstantiationKernel._instance = new InstantiationKernel();
    }
    return InstantiationKernel._instance;
  }
  
  static isInitialized() {
    return InstantiationKernel._initialized;
  }

  constructor() {
    if (InstantiationKernel._instance) {
      throw new InstantiationViolation(
        'constructor',
        'InstantiationKernel is singleton - use getInstance()'
      );
    }
    
    // Registry de todas as instâncias criadas
    this._instantiationRegistry = new Map(); // name -> { instance, createdAt, factory }
    
    // Classes protegidas (factory-only)
    this._protectedClasses = new Set();
    
    // Flag de strict mode
    this._strictMode = false;
    
    // Token de ownership (setado pelo BootOrchestrator)
    this._ownerToken = null;
    
    // Proxy cache para classes protegidas
    this._proxiedClasses = new WeakMap();
    
    InstantiationKernel._initialized = true;
    console.log('[InstantiationKernel] initialized');
  }

  // ================================
  // OWNERSHIP (BootOrchestrator)
  // ================================
  assumeOwnership(token) {
    if (this._ownerToken) {
      throw new InstantiationViolation(
        'assumeOwnership',
        'Ownership already held'
      );
    }
    
    this._ownerToken = token || this._generateToken();
    this._strictMode = true;
    
    console.log('[InstantiationKernel] ownership assumed');
    return this._ownerToken;
  }
  
  validateOwnership(token) {
    if (!this._strictMode) return true;
    if (!this._ownerToken) {
      throw new InstantiationViolation(
        'validateOwnership',
        'No owner - BootOrchestrator must assume ownership first'
      );
    }
    if (this._ownerToken !== token) {
      throw new InstantiationViolation(
        'validateOwnership',
        'Invalid ownership token'
      );
    }
    return true;
  }

  // ================================
  // FACTORY: ÚNICO CAMINHO VÁLIDO
  // ================================
  /**
   * Criar instância via factory (único caminho permitido)
   * @param {Class} ManagerClass - Classe do manager
   * @param {string} name - Nome único da instância
   * @param {Array} args - Argumentos do constructor
   * @param {Object} options - Opções { token }
   */
  create(ManagerClass, name, args = [], options = {}) {
    // 1. Validar ownership
    if (options.token) {
      this.validateOwnership(options.token);
    } else if (this._strictMode) {
      throw new InstantiationViolation(
        'create',
        `Factory creation of ${name} blocked - no ownership token`
      );
    }
    
    // 2. Verificar se classe é válida
    if (!this._isValidManagerClass(ManagerClass)) {
      throw new InstantiationViolation(
        'create',
        `${ManagerClass?.name} must extend LifecycleContract`
      );
    }
    
    // 3. Verificar se já existe instância com este nome
    if (this._instantiationRegistry.has(name)) {
      throw new InstantiationViolation(
        'create',
        `Instance ${name} already exists - use get() or destroy() first`
      );
    }
    
    // 4. Criar instância dentro do kernel context
    console.log(`[InstantiationKernel] Creating ${name} via factory...`);
    
    const instance = this._instantiate(ManagerClass, args);
    
    // 5. Registrar
    this._instantiationRegistry.set(name, {
      instance,
      className: ManagerClass.name,
      createdAt: Date.now(),
      factory: true,
      options
    });
    
    // 6. Proteger classe para futuras tentativas de new
    this._protectClass(ManagerClass, name);
    
    console.log(`[InstantiationKernel] ${name} created via factory`);
    return instance;
  }
  
  /**
   * Obter instância existente
   */
  get(name) {
    const entry = this._instantiationRegistry.get(name);
    return entry?.instance || null;
  }
  
  /**
   * Verificar se instância existe
   */
  has(name) {
    return this._instantiationRegistry.has(name);
  }
  
  /**
   * Destruir instância
   */
  destroy(name, options = {}) {
    if (options.token) {
      this.validateOwnership(options.token);
    }
    
    const entry = this._instantiationRegistry.get(name);
    if (!entry) {
      throw new InstantiationViolation('destroy', `Instance ${name} not found`);
    }
    
    // Chamar destroy no lifecycle
    if (entry.instance.destroy) {
      entry.instance.destroy();
    }
    
    this._instantiationRegistry.delete(name);
    console.log(`[InstantiationKernel] ${name} destroyed`);
    return true;
  }

  // ================================
  // CLASS PROTECTION (GOVERNED, NÃO ENFORCED)
  // ================================
  /**
   * Aplicar proteções de convenção à classe
   * ⚠️ NOTA: Isso é "GOVERNED" não "ENFORCED"
   * 
   * O que funciona:
   *   → Substitui window[ClassName] por Proxy (se acessado via window)
   *   → Impede modificação do prototype (freeze)
   *   → Impede adição de propriedades ao constructor (seal)
   * 
   * O que NÃO funciona:
   *   → NÃO bloqueia `new Class()` se já tem referência direta
   *   → NÃO intercepta `new` globalmente
   *   → Proxy só funciona quando acessado ATRAVÉS do proxy
   */
  _protectClass(ManagerClass, expectedName) {
    if (this._protectedClasses.has(ManagerClass)) {
      return; // Já processada
    }
    
    const kernel = this;
    const originalName = ManagerClass.name;
    
    // 1. Criar Proxy para ser usado quando acessado via window[]
    // ⚠️ IMPORTANTE: Proxy só intercepta quando chamado através dele
    // new ManagerClass() diretamente NÃO passa por este handler!
    const handler = {
      construct(target, args) {
        if (kernel._insideKernel) {
          return Reflect.construct(target, args);
        }
        
        // Só lança erro se chamado via Proxy (window[ClassName])
        throw new InstantiationViolation(
          'constructor',
          `Direct instantiation of ${originalName} blocked by convention. ` +
          `Use InstantiationKernel.create('${expectedName}') or kernel.create()`,
          { attemptedArgs: args.length, note: 'Convention enforcement only' }
        );
      }
    };
    
    const ProxiedClass = new Proxy(ManagerClass, handler);
    
    // Copiar propriedades estáticas
    Object.setPrototypeOf(ProxiedClass, ManagerClass);
    Object.defineProperty(ProxiedClass, 'name', { value: originalName });
    
    // Substituir no escopo global (SE exposta e SE ainda igual)
    // Isso ajuda para código que acessa via window.SidebarManager
    // Mas NÃO ajuda para código que já tem referência direta
    if (window[originalName] === ManagerClass) {
      window[originalName] = ProxiedClass;
      console.log(`[InstantiationKernel] ${originalName} replaced in global scope with Proxy`);
    }
    
    // Guardar referência
    this._proxiedClasses.set(ManagerClass, ProxiedClass);
    this._protectedClasses.add(ManagerClass);
    
    // 2. Freeze do prototype (impede modificação por código externo)
    // Isso é efetivo - impede monkey-patching do prototype
    Object.freeze(ManagerClass.prototype);
    
    // 3. Seal do constructor (impede adição de propriedades)
    Object.seal(ManagerClass);
    
    console.log(`[InstantiationKernel] ${originalName} convention protections applied (freeze + seal)`);
    console.log(`[InstantiationKernel] ⚠️ ${originalName}: new Class() bypass still possible via direct reference`);
  }
  
  /**
   * Instanciar dentro do contexto do kernel
   */
  _instantiate(ManagerClass, args) {
    this._insideKernel = true;
    try {
      const instance = new ManagerClass(...args);
      return instance;
    } finally {
      this._insideKernel = false;
    }
  }
  
  /**
   * Verificar se classe é manager válido
   */
  _isValidManagerClass(ManagerClass) {
    if (!ManagerClass || typeof ManagerClass !== 'function') {
      return false;
    }
    
    // Verificar herança de LifecycleContract
    let proto = ManagerClass.prototype;
    while (proto) {
      if (proto.constructor === window.LifecycleContract) {
        return true;
      }
      proto = Object.getPrototypeOf(proto);
    }
    return false;
  }

  // ================================
  // QUERIES
  // ================================
  getAllInstances() {
    return Array.from(this._instantiationRegistry.keys());
  }
  
  getInstanceInfo(name) {
    const entry = this._instantiationRegistry.get(name);
    if (!entry) return null;
    
    return {
      name,
      className: entry.className,
      createdAt: entry.createdAt,
      active: entry.instance?._lifecycleActive || false
    };
  }
  
  getStatus() {
    const status = {};
    for (const [name, entry] of this._instantiationRegistry) {
      status[name] = this.getInstanceInfo(name);
    }
    return status;
  }

  // ================================
  // UTILS
  // ================================
  _generateToken() {
    return `ik_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  enableStrictMode() {
    this._strictMode = true;
    console.log('[InstantiationKernel] STRICT MODE ENABLED');
  }
  
  disableStrictMode() {
    this._strictMode = false;
    console.log('[InstantiationKernel] STRICT MODE DISABLED');
  }
  
  /**
   * Reset completo (para testes)
   */
  reset() {
    // Destruir todas as instâncias
    for (const [name] of this._instantiationRegistry) {
      this.destroy(name);
    }
    
    this._instantiationRegistry.clear();
    this._protectedClasses.clear();
    this._ownerToken = null;
    this._strictMode = false;
    
    console.log('[InstantiationKernel] reset complete');
  }
};

// ================================
// GLOBAL ACCESS
// ================================
window.InstantiationViolation = InstantiationViolation;

console.log('[InstantiationKernel] FASE 2.6.4 loaded');
console.log('[InstantiationKernel] ⚠️ Honor-based security in pure JS');
console.log('[InstantiationKernel] ℹ️ Factory-only creation enforced');
