// ================================
// LIFECYCLE CONTRACT SYSTEM (FASE 2.6.2)
// ================================
// Responsabilidade: Garantir determinismo total via lifecycle explícito
//
// INVARIANTES:
// ✅ constructor → STATE ONLY (zero side-effects)
// ✅ activate() → side effects permitidos (listeners, timers)
// ✅ deactivate() → cleanup obrigatório
// ✅ destroy() → full teardown
//
// ❌ PROIBIDO: listeners/timers em constructor ou init()

// ================================
// INTERFACE: ILifecycleContract
// ================================
// Contrato que TODOS os managers DEVEM seguir
const ILifecycleContract = {
  // State initialization (síncrono, zero side-effects)
  init() {},
  
  // Activation (side effects permitidos: listeners, timers, DOM)
  activate() {},
  
  // Deactivation (cleanup obrigatório)
  deactivate() {},
  
  // Full destruction (teardown completo)
  destroy() {},
  
  // Check if active
  isActive() { return false; }
};

// ================================
// LIFECYCLE REGISTRY
// ================================
// Single source of truth para lifecycle de todos os managers
window.LifecycleRegistry = class LifecycleRegistry {
  static _instance = null;
  
  static getInstance() {
    if (!LifecycleRegistry._instance) {
      LifecycleRegistry._instance = new LifecycleRegistry();
    }
    return LifecycleRegistry._instance;
  }
  
  static reset() {
    if (LifecycleRegistry._instance) {
      LifecycleRegistry._instance.destroyAll();
      LifecycleRegistry._instance = null;
    }
  }

  constructor() {
    // Map: name -> { instance, state, metadata }
    this._registry = new Map();
    
    // Estado do sistema
    this._systemActive = false;
    
    console.log('[LifecycleRegistry] initialized');
  }

  // ================================
  // REGISTRATION
  // ================================
  
  register(name, instance, options = {}) {
    if (this._registry.has(name)) {
      console.warn(`[LifecycleRegistry] ${name} already registered, skipping`);
      return false;
    }
    
    // Validar que implementa interface mínima
    if (!this._validateContract(instance)) {
      console.error(`[LifecycleRegistry] ${name} does not implement ILifecycleContract`);
      return false;
    }
    
    this._registry.set(name, {
      instance,
      state: 'REGISTERED', // REGISTERED -> ACTIVATING -> ACTIVE -> DEACTIVATING -> INACTIVE
      metadata: {
        registeredAt: Date.now(),
        activatedAt: null,
        deactivatedAt: null,
        ...options
      }
    });
    
    console.log(`[LifecycleRegistry] ${name} registered`);
    return true;
  }
  
  unregister(name) {
    const entry = this._registry.get(name);
    if (!entry) return false;
    
    // Forçar deactivation se ainda ativo
    if (entry.state === 'ACTIVE' || entry.state === 'ACTIVATING') {
      this.deactivate(name);
    }
    
    this._registry.delete(name);
    console.log(`[LifecycleRegistry] ${name} unregistered`);
    return true;
  }

  // ================================
  // LIFECYCLE CONTROL
  // ================================
  
  activate(name) {
    const entry = this._registry.get(name);
    if (!entry) {
      console.error(`[LifecycleRegistry] ${name} not registered`);
      return false;
    }
    
    if (entry.state === 'ACTIVE') {
      console.log(`[LifecycleRegistry] ${name} already active`);
      return true;
    }
    
    if (entry.state === 'ACTIVATING') {
      console.warn(`[LifecycleRegistry] ${name} already activating`);
      return false;
    }
    
    console.log(`[LifecycleRegistry] activating ${name}...`);
    entry.state = 'ACTIVATING';
    
    try {
      // Chamar método de ativação
      if (typeof entry.instance.activate === 'function') {
        entry.instance.activate();
      }
      
      entry.state = 'ACTIVE';
      entry.metadata.activatedAt = Date.now();
      console.log(`[LifecycleRegistry] ${name} ACTIVE`);
      return true;
    } catch (e) {
      entry.state = 'ERROR';
      console.error(`[LifecycleRegistry] ${name} activation failed:`, e);
      return false;
    }
  }
  
  deactivate(name) {
    const entry = this._registry.get(name);
    if (!entry) return false;
    
    if (entry.state === 'INACTIVE' || entry.state === 'REGISTERED') {
      return true;
    }
    
    if (entry.state === 'DEACTIVATING') {
      console.warn(`[LifecycleRegistry] ${name} already deactivating`);
      return false;
    }
    
    console.log(`[LifecycleRegistry] deactivating ${name}...`);
    entry.state = 'DEACTIVATING';
    
    try {
      // Chamar método de deactivation
      if (typeof entry.instance.deactivate === 'function') {
        entry.instance.deactivate();
      }
      
      entry.state = 'INACTIVE';
      entry.metadata.deactivatedAt = Date.now();
      console.log(`[LifecycleRegistry] ${name} INACTIVE`);
      return true;
    } catch (e) {
      entry.state = 'ERROR';
      console.error(`[LifecycleRegistry] ${name} deactivation failed:`, e);
      return false;
    }
  }
  
  destroy(name) {
    const entry = this._registry.get(name);
    if (!entry) return false;
    
    // Garantir deactivation primeiro
    this.deactivate(name);
    
    console.log(`[LifecycleRegistry] destroying ${name}...`);
    
    try {
      if (typeof entry.instance.destroy === 'function') {
        entry.instance.destroy();
      }
      
      this._registry.delete(name);
      console.log(`[LifecycleRegistry] ${name} DESTROYED`);
      return true;
    } catch (e) {
      console.error(`[LifecycleRegistry] ${name} destruction failed:`, e);
      return false;
    }
  }

  // ================================
  // BULK OPERATIONS
  // ================================
  
  activateAll() {
    console.log('[LifecycleRegistry] activating all...');
    const results = {};
    for (const [name] of this._registry) {
      results[name] = this.activate(name);
    }
    this._systemActive = true;
    return results;
  }
  
  deactivateAll() {
    console.log('[LifecycleRegistry] deactivating all...');
    const results = {};
    for (const [name] of this._registry) {
      results[name] = this.deactivate(name);
    }
    this._systemActive = false;
    return results;
  }
  
  destroyAll() {
    console.log('[LifecycleRegistry] destroying all...');
    const names = Array.from(this._registry.keys());
    for (const name of names) {
      this.destroy(name);
    }
    this._systemActive = false;
  }

  // ================================
  // QUERIES
  // ================================
  
  isActive(name) {
    const entry = this._registry.get(name);
    return entry?.state === 'ACTIVE';
  }
  
  getState(name) {
    return this._registry.get(name)?.state || 'UNKNOWN';
  }
  
  getInstance(name) {
    return this._registry.get(name)?.instance || null;
  }
  
  getAllActive() {
    return Array.from(this._registry.entries())
      .filter(([, entry]) => entry.state === 'ACTIVE')
      .map(([name]) => name);
  }
  
  getAllNames() {
    return Array.from(this._registry.keys());
  }
  
  getStatus() {
    const status = {};
    for (const [name, entry] of this._registry) {
      status[name] = {
        state: entry.state,
        active: entry.state === 'ACTIVE',
        metadata: { ...entry.metadata }
      };
    }
    return status;
  }

  // ================================
  // VALIDATION
  // ================================
  
  _validateContract(instance) {
    // Verificar métodos obrigatórios mínimos
    const required = ['activate', 'deactivate'];
    for (const method of required) {
      if (typeof instance[method] !== 'function') {
        console.error(`[LifecycleRegistry] Missing required method: ${method}`);
        return false;
      }
    }
    return true;
  }
  
  // ================================
  // SINGLETON ENFORCEMENT
  // ================================
  
  enforceSingleActive(name) {
    const active = this.getAllActive();
    if (active.includes(name)) {
      // Deactivate todos os outros do mesmo tipo
      for (const other of active) {
        if (other !== name && other.startsWith(name)) {
          console.log(`[LifecycleRegistry] enforcing singleton: deactivating ${other}`);
          this.deactivate(other);
        }
      }
    }
  }
};

// ================================
// BASE CLASS: LifecycleContract
// ================================
// Classe base que todos os managers DEVEM estender
window.LifecycleContract = class LifecycleContract {
  constructor(name) {
    // 🎯 FASE 2.6.2: STATE ONLY - Zero side-effects aqui
    this._lifecycleName = name || this.constructor.name;
    this._lifecycleActive = false;
    this._lifecycleBindings = new Map(); // armazenar bindings para cleanup
    this._lifecycleTimers = new Set(); // armazenar timer ids
    this._lifecycleListeners = new Map(); // armazenar listeners por elemento
    
    // 🎯 FASE 2.6.3: Firewall bypass detection
    this._firewallBypassed = false;
    
    console.log(`[${this._lifecycleName}] constructed (PASSIVE MODE)`);
  }
  
  // ================================
  // INTERFACE IMPLEMENTATION
  // ================================
  
  // Override em subclasses - inicialização de estado (zero side-effects)
  init() {
    console.log(`[${this._lifecycleName}] init()`);
  }
  
  // Override em subclasses - ativação (side effects permitidos)
  // 🚨 ATENÇÃO: Só pode ser chamado via ExecutionFirewall em strict mode
  activate() {
    if (this._lifecycleActive) {
      console.log(`[${this._lifecycleName}] already active`);
      return;
    }
    
    // 🎯 FASE 2.6.3: Verificar se passou pelo ExecutionFirewall
    const firewall = window.ExecutionFirewall?.getInstance?.();
    if (firewall && firewall._strictMode && !this._firewallBypassed) {
      throw new window.ExecutionViolation(
        'LifecycleContract.activate',
        `Direct activation of ${this._lifecycleName} blocked - use ExecutionFirewall.execute('${this._lifecycleName}', 'activate')`,
        { manager: this._lifecycleName }
      );
    }
    
    console.log(`[${this._lifecycleName}] activating...`);
    this._lifecycleActive = true;
    
    // Reset bypass flag
    this._firewallBypassed = false;
    
    // Subclasses devem chamar super.activate() e depois bind()
    this.bind();
  }
  
  // 🎯 FASE 2.6.3: Internal methods for firewall use only
  _activateFromFirewall() {
    this._firewallBypassed = true;
    return this.activate();
  }
  
  _deactivateFromFirewall() {
    return this.deactivate();
  }
  
  // Override em subclasses - deactivation (cleanup obrigatório)
  deactivate() {
    if (!this._lifecycleActive) {
      return;
    }
    
    console.log(`[${this._lifecycleName}] deactivating...`);
    
    // Cleanup automático
    this.unbindAll();
    this.clearAllTimers();
    
    this._lifecycleActive = false;
    console.log(`[${this._lifecycleName}] deactivated`);
  }
  
  // Override em subclasses - destruição completa
  destroy() {
    console.log(`[${this._lifecycleName}] destroying...`);
    
    // Garantir deactivation
    this.deactivate();
    
    // Cleanup final
    this._lifecycleBindings.clear();
    this._lifecycleListeners.clear();
    this._lifecycleTimers.clear();
    
    console.log(`[${this._lifecycleName}] destroyed`);
  }
  
  isActive() {
    return this._lifecycleActive;
  }

  // ================================
  // HELPER METHODS (PROTECTED)
  // ================================
  
  // Registrar binding para cleanup automático
  _registerBinding(name, fn) {
    this._lifecycleBindings.set(name, fn);
  }
  
  // Criar bound function e registrar
  _bind(methodName) {
    if (!this[methodName]) {
      console.warn(`[${this._lifecycleName}] method ${methodName} not found`);
      return null;
    }
    const bound = this[methodName].bind(this);
    this._registerBinding(methodName, bound);
    return bound;
  }
  
  // Registrar timer para cleanup automático
  _registerTimer(timerId) {
    this._lifecycleTimers.add(timerId);
    return timerId;
  }
  
  // Criar e registrar setTimeout
  _setTimeout(fn, delay) {
    const id = setTimeout(() => {
      this._lifecycleTimers.delete(id);
      fn();
    }, delay);
    this._registerTimer(id);
    return id;
  }
  
  // Criar e registrar setInterval
  _setInterval(fn, delay) {
    const id = setInterval(fn, delay);
    this._registerTimer(id);
    return id;
  }
  
  // Limpar todos os timers
  clearAllTimers() {
    for (const id of this._lifecycleTimers) {
      clearTimeout(id);
      clearInterval(id);
    }
    this._lifecycleTimers.clear();
    console.log(`[${this._lifecycleName}] all timers cleared`);
  }
  
  // Adicionar event listener e registrar para cleanup
  addEventListener(element, event, handler, options = {}) {
    if (!element) {
      console.warn(`[${this._lifecycleName}] cannot add listener to null element`);
      return;
    }
    
    element.addEventListener(event, handler, options);
    
    // Registrar para cleanup
    const key = `${element.constructor.name}_${event}_${Math.random().toString(36).substr(2, 5)}`;
    if (!this._lifecycleListeners.has(element)) {
      this._lifecycleListeners.set(element, []);
    }
    this._lifecycleListeners.get(element).push({ event, handler, options, key });
    
    return key;
  }
  
  // Remover todos os listeners registrados
  unbindAll() {
    // Remover DOM listeners
    for (const [element, listeners] of this._lifecycleListeners) {
      for (const { event, handler, options } of listeners) {
        try {
          element.removeEventListener(event, handler, options);
        } catch (e) {
          // Ignorar erros de remoção
        }
      }
    }
    this._lifecycleListeners.clear();
    
    console.log(`[${this._lifecycleName}] all listeners unbound`);
  }
  
  // Método para subclasses implementarem binding específico
  bind() {
    // Override em subclasses
    console.log(`[${this._lifecycleName}] bind()`);
  }
};

// ================================
// GLOBAL ACCESS
// ================================
window.ILifecycleContract = ILifecycleContract;

console.log('[LifecycleContract] system loaded - FASE 2.6.2');
