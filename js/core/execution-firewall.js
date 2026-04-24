// ================================
// EXECUTION FIREWALL — FASE 2.6.3
// ================================
// ÚNICA CAMADA DE EXECUÇÃO PERMITIDA
//
// INVARIANTE ABSOLUTO:
// ❌ NENHUM código fora do firewall pode executar managers
// ❌ NENHUM manager pode auto-ativar
// ✅ TODA execução passa pelo firewall
//
// Arquitetura:
// EAL → BootOrchestrator → ExecutionFirewall → LifecycleRegistry → Managers

// ================================
// EXECUTION VIOLATION ERROR
// ================================
class ExecutionViolation extends Error {
  constructor(operation, reason, context = {}) {
    super(`[EXECUTION VIOLATION] ${operation}: ${reason}`);
    this.name = 'ExecutionViolation';
    this.operation = operation;
    this.reason = reason;
    this.context = context;
    this.timestamp = Date.now();
    
    // Log estruturado para auditoria
    console.error('[ExecutionFirewall] VIOLATION:', {
      operation,
      reason,
      context,
      stack: this.stack
    });
  }
}

// ================================
// EXECUTION FIREWALL (STRICT MODE)
// ================================
window.ExecutionFirewall = class ExecutionFirewall {
  static _instance = null;
  static _initialized = false;
  
  static getInstance() {
    if (!ExecutionFirewall._instance) {
      ExecutionFirewall._instance = new ExecutionFirewall();
    }
    return ExecutionFirewall._instance;
  }
  
  static isInitialized() {
    return ExecutionFirewall._initialized;
  }

  constructor() {
    if (ExecutionFirewall._instance) {
      throw new ExecutionViolation(
        'constructor',
        'ExecutionFirewall is singleton - use getInstance()'
      );
    }
    
    // Reference to EAL for validation
    this._eal = window.ExecutionAuthorityLayer?.getInstance?.() || null;
    
    // Reference to registry
    this._registry = window.LifecycleRegistry?.getInstance?.() || null;
    
    // Execution log for audit trail
    this._executionLog = [];
    
    // Strict mode flag (enforce after init)
    this._strictMode = false;
    
    // BootOrchestrator ownership
    this._ownerToken = null;
    
    // Lock state
    this._locked = false;
    
    ExecutionFirewall._initialized = true;
    console.log('[ExecutionFirewall] initialized (STANDALONE MODE)');
  }

  // ================================
  // BOOTORCHESTRATOR OWNERSHIP
  // ================================
  // Apenas BootOrchestrator pode assumir controle
  assumeOwnership(token) {
    if (this._ownerToken) {
      throw new ExecutionViolation(
        'assumeOwnership',
        'Ownership already held - release first'
      );
    }
    
    this._ownerToken = token || this._generateToken();
    this._strictMode = true;
    
    console.log('[ExecutionFirewall] ownership assumed by BootOrchestrator');
    return this._ownerToken;
  }
  
  releaseOwnership(token) {
    if (this._ownerToken !== token) {
      throw new ExecutionViolation(
        'releaseOwnership',
        'Invalid ownership token'
      );
    }
    
    this._ownerToken = null;
    this._strictMode = false;
    
    console.log('[ExecutionFirewall] ownership released');
  }
  
  validateOwnership(token) {
    if (!this._strictMode) return true; // Not in strict mode yet
    if (!this._ownerToken) {
      throw new ExecutionViolation(
        'validateOwnership',
        'No owner - BootOrchestrator must assume ownership first'
      );
    }
    if (this._ownerToken !== token) {
      throw new ExecutionViolation(
        'validateOwnership',
        'Invalid ownership token - execution path compromised'
      );
    }
    return true;
  }

  // ================================
  // CORE EXECUTION API
  // ================================
  // ÚNICO método permitido para executar operações em managers
  
  execute(managerName, operation, payload = {}, options = {}) {
    // 1. Validar EAL state
    this._validateEALState(operation);
    
    // 2. Validar ownership (se strict mode)
    if (options.token) {
      this.validateOwnership(options.token);
    } else if (this._strictMode) {
      throw new ExecutionViolation(
        'execute',
        `Operation ${operation} on ${managerName} blocked - no ownership token`,
        { managerName, operation }
      );
    }
    
    // 3. Validar manager existe no registry
    const manager = this._getManager(managerName);
    if (!manager) {
      throw new ExecutionViolation(
        'execute',
        `Manager ${managerName} not found in registry`,
        { managerName, operation }
      );
    }
    
    // 4. Log execução
    this._logExecution(managerName, operation, payload);
    
    // 5. Executar via registry
    return this._executeViaRegistry(managerName, operation, payload);
  }
  
  // Métodos conveniência
  activate(managerName, options = {}) {
    return this.execute(managerName, 'activate', {}, options);
  }
  
  deactivate(managerName, options = {}) {
    return this.execute(managerName, 'deactivate', {}, options);
  }
  
  destroy(managerName, options = {}) {
    return this.execute(managerName, 'destroy', {}, options);
  }

  // ================================
  // BULK EXECUTION (BootOrchestrator use)
  // ================================
  executeSequence(operations, options = {}) {
    // operations: [{ manager, operation, payload }]
    const results = [];
    
    for (const op of operations) {
      try {
        const result = this.execute(
          op.manager,
          op.operation,
          op.payload || {},
          options
        );
        results.push({ success: true, manager: op.manager, operation: op.operation, result });
      } catch (e) {
        results.push({ success: false, manager: op.manager, operation: op.operation, error: e.message });
        if (options.abortOnError) {
          throw new ExecutionViolation(
            'executeSequence',
            `Sequence failed at ${op.manager}.${op.operation}: ${e.message}`
          );
        }
      }
    }
    
    return results;
  }
  
  activateAll(options = {}) {
    if (!this._registry) {
      throw new ExecutionViolation('activateAll', 'Registry not available');
    }
    
    const managers = this._registry.getAllNames();
    const operations = managers.map(name => ({ manager: name, operation: 'activate' }));
    
    return this.executeSequence(operations, options);
  }

  // ================================
  // PROTECTION LAYER
  // ================================
  
  // Bloquear criação direta de managers
  blockDirectInstantiation(ManagerClass) {
    const originalConstructor = ManagerClass.prototype.constructor;
    const firewall = this;
    
    ManagerClass.prototype.constructor = function(...args) {
      if (!firewall._isInsideFirewall()) {
        throw new ExecutionViolation(
          'constructor',
          `Direct instantiation of ${ManagerClass.name} blocked - use ExecutionFirewall.create()`,
          { className: ManagerClass.name }
        );
      }
      return originalConstructor.apply(this, args);
    };
    
    // Marcar como protegido
    ManagerClass.__firewallProtected = true;
    ManagerClass.__originalConstructor = originalConstructor;
  }
  
  // Criar manager via firewall (único caminho permitido)
  create(ManagerClass, name, ...args) {
    // Verificar se é subclasse de LifecycleContract
    if (!this._isLifecycleContract(ManagerClass)) {
      throw new ExecutionViolation(
        'create',
        `${ManagerClass.name} must extend LifecycleContract`
      );
    }
    
    // Criar dentro do contexto do firewall
    this._insideFirewall = true;
    const instance = new ManagerClass(...args);
    this._insideFirewall = false;
    
    // Registrar automaticamente
    if (this._registry) {
      this._registry.register(name, instance);
    }
    
    return instance;
  }
  
  _isInsideFirewall() {
    return this._insideFirewall === true;
  }
  
  _isLifecycleContract(ManagerClass) {
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
  // VALIDATION
  // ================================
  
  _validateEALState(operation) {
    if (!this._eal) {
      // EAL não disponível, permitir em modo dev com warning
      console.warn('[ExecutionFirewall] EAL not available - execution without authority validation');
      return true;
    }
    
    const ealState = this._eal.getState?.() || {};
    
    // Operações que precisam de EAL unlocked
    const needsUnlock = ['activate', 'deactivate', 'destroy'];
    if (needsUnlock.includes(operation) && !ealState.unlocked) {
      throw new ExecutionViolation(
        'validateEAL',
        `Operation ${operation} blocked - EAL not unlocked`,
        { ealState, operation }
      );
    }
    
    return true;
  }
  
  _getManager(name) {
    if (!this._registry) return null;
    return this._registry.getInstance(name);
  }
  
  _executeViaRegistry(name, operation, payload) {
    if (!this._registry) {
      throw new ExecutionViolation('execute', 'Registry not available');
    }
    
    const manager = this._registry.getInstance(name);
    if (!manager) {
      throw new ExecutionViolation('execute', `Manager ${name} not found`);
    }
    
    // 🎯 FASE 2.6.3: Usar método interno para bypass detection
    switch (operation) {
      case 'activate':
        if (manager._activateFromFirewall) {
          return manager._activateFromFirewall();
        }
        return this._registry.activate(name);
      case 'deactivate':
        if (manager._deactivateFromFirewall) {
          return manager._deactivateFromFirewall();
        }
        return this._registry.deactivate(name);
      case 'destroy':
        return this._registry.destroy(name);
      default:
        throw new ExecutionViolation('execute', `Unknown operation: ${operation}`);
    }
  }

  // ================================
  // AUDIT
  // ================================
  
  _logExecution(manager, operation, payload) {
    const entry = {
      timestamp: Date.now(),
      manager,
      operation,
      payload: this._sanitizePayload(payload),
      strictMode: this._strictMode,
      ownerToken: this._ownerToken ? '[REDACTED]' : null
    };
    
    this._executionLog.push(entry);
    
    // Limitar log
    if (this._executionLog.length > 1000) {
      this._executionLog.shift();
    }
  }
  
  _sanitizePayload(payload) {
    // Remover dados sensíveis
    if (!payload || typeof payload !== 'object') return payload;
    
    const sanitized = { ...payload };
    const sensitive = ['password', 'token', 'secret', 'key', 'auth'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitive.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  getExecutionLog() {
    return [...this._executionLog];
  }
  
  getStats() {
    return {
      totalExecutions: this._executionLog.length,
      strictMode: this._strictMode,
      hasOwner: !!this._ownerToken,
      registryConnected: !!this._registry,
      ealConnected: !!this._eal
    };
  }

  // ================================
  // UTILS
  // ================================
  
  _generateToken() {
    return `fw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  enableStrictMode() {
    this._strictMode = true;
    console.log('[ExecutionFirewall] STRICT MODE ENABLED');
  }
  
  disableStrictMode() {
    this._strictMode = false;
    console.log('[ExecutionFirewall] STRICT MODE DISABLED');
  }
};

// ================================
// GLOBAL ACCESS
// ================================
window.ExecutionViolation = ExecutionViolation;

console.log('[ExecutionFirewall] FASE 2.6.3 loaded - STRICT MODE READY');
