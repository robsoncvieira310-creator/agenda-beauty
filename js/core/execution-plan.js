// ================================
// EXECUTION PLAN — FASE 2.8
// ================================
// IMMUTABLE BOOTSTRAP PLAN — Intermediate Representation (IR)
//
// PROPRIEDADES:
// → Imutável (freeze + hash)
// → Deterministic output
// → Versioned
// → Auditável
//
// CONCEITO:
// O sistema deixa de decidir o que fazer em runtime
// e passa a executar um plano previamente compilado.
//
// FLUXO:
// SEC (Compiler) → ExecutionPlan (immutable) → BootOrchestrator (blind executor)
// ================================

window.ExecutionPlan = class ExecutionPlan {
  /**
   * Criar plano de execução imutável
   * @param {Object} config - Configuração do plano
   * @param {Array} config.steps - Passos do plano
   * @param {string} config.version - Versão do plano
   * @param {number} config.timestamp - Timestamp de compilação
   * @param {string} config.bootId - ID do ciclo de boot
   */
  constructor({ steps = [], version = '1.0.0', timestamp = Date.now(), bootId = null }) {
    // Propriedades imutáveis
    this._version = version;
    this._timestamp = timestamp;
    this._bootId = bootId || `boot_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Passos do plano (array imutável)
    this._steps = Object.freeze([...steps]);
    
    // Índices computados (para performance)
    this._stepIndex = new Map(steps.map((s, i) => [s.id, i]));
    
    // Ordem de execução (topological sort já resolvido)
    this._order = Object.freeze(steps.map(s => s.id));
    
    // Checksum do plano (hash simples)
    this._checksum = this._computeChecksum();
    
    // Congelar instância inteira
    Object.freeze(this);
    
    // Validar integridade
    this._validate();
  }

  // ================================
  // GETTERS (read-only)
  // ================================

  get version() { return this._version; }
  get timestamp() { return this._timestamp; }
  get bootId() { return this._bootId; }
  get checksum() { return this._checksum; }
  get steps() { return this._steps; }
  get order() { return this._order; }
  get stepCount() { return this._steps.length; }

  // ================================
  // QUERY API (read-only)
  // ================================

  /**
   * Obter passo por ID
   */
  getStep(id) {
    const idx = this._stepIndex.get(id);
    return idx !== undefined ? this._steps[idx] : null;
  }

  /**
   * Obter passo por índice
   */
  getStepAt(index) {
    return this._steps[index] || null;
  }

  /**
   * Verificar se passo existe
   */
  hasStep(id) {
    return this._stepIndex.has(id);
  }

  /**
   * Obter índice de um passo
   */
  getStepIndex(id) {
    return this._stepIndex.get(id);
  }

  /**
   * Listar passos por fase
   */
  getStepsByPhase(phase) {
    return this._steps.filter(s => s.phase === phase);
  }

  /**
   * Obter passos críticos
   */
  getCriticalSteps() {
    return this._steps.filter(s => s.critical);
  }

  /**
   * Verificar se todas as dependências de um passo estão satisfeitas
   */
  areDependenciesMet(stepId, executedSet) {
    const step = this.getStep(stepId);
    if (!step) return false;
    
    for (const dep of step.dependencies) {
      if (!executedSet.has(dep)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Obter próximo passo executável
   */
  getNextExecutable(executedSet, failedSet = new Set()) {
    for (const stepId of this._order) {
      if (executedSet.has(stepId) || failedSet.has(stepId)) {
        continue;
      }
      
      const step = this.getStep(stepId);
      const depsMet = step.dependencies.every(d => executedSet.has(d));
      
      if (depsMet) {
        return step;
      }
    }
    return null;
  }

  // ================================
  // VALIDATION & SERIALIZATION
  // ================================

  /**
   * Validar integridade do plano
   */
  _validate() {
    // Verificar ciclos
    const visited = new Set();
    const recursionStack = new Set();
    
    const visit = (stepId) => {
      if (recursionStack.has(stepId)) {
        throw new Error(`[ExecutionPlan] Circular dependency detected: ${stepId}`);
      }
      if (visited.has(stepId)) return;
      
      visited.add(stepId);
      recursionStack.add(stepId);
      
      const step = this.getStep(stepId);
      if (step) {
        for (const dep of step.dependencies) {
          if (this.hasStep(dep)) {
            visit(dep);
          }
        }
      }
      
      recursionStack.delete(stepId);
    };
    
    for (const stepId of this._order) {
      if (!visited.has(stepId)) {
        visit(stepId);
      }
    }
    
    // Verificar passos órfãos (não no order)
    const orphanSteps = this._steps.filter(s => !this._order.includes(s.id));
    if (orphanSteps.length > 0) {
      throw new Error(`[ExecutionPlan] Orphan steps: ${orphanSteps.map(s => s.id).join(', ')}`);
    }
  }

  /**
   * Computar checksum simples
   */
  _computeChecksum() {
    const data = JSON.stringify({
      version: this._version,
      steps: this._steps.map(s => ({
        id: s.id,
        phase: s.phase,
        dependencies: s.dependencies,
        critical: s.critical
      })),
      order: this._order
    });
    
    // Hash simples (FNV-1a inspired)
    let hash = 2166136261;
    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * Verificar se checksum é válido
   */
  verifyChecksum() {
    const expected = this._computeChecksum();
    return expected === this._checksum;
  }

  /**
   * Exportar plano (para auditoria/persistência)
   */
  export() {
    return {
      version: this._version,
      timestamp: this._timestamp,
      bootId: this._bootId,
      checksum: this._checksum,
      stepCount: this._steps.length,
      steps: this._steps.map(s => ({
        id: s.id,
        phase: s.phase,
        action: s.action,
        dependencies: s.dependencies,
        critical: s.critical,
        hasFallback: !!s.fallback
      })),
      order: this._order
    };
  }

  /**
   * Serializar para JSON
   */
  toJSON() {
    return JSON.stringify(this.export());
  }

  /**
   * Criar a partir de dados exportados
   */
  static fromExported(data) {
    const plan = new ExecutionPlan({
      steps: data.steps.map(s => ({
        id: s.id,
        phase: s.phase,
        action: s.action,
        dependencies: s.dependencies,
        critical: s.critical,
        fallback: s.fallback
      })),
      version: data.version,
      timestamp: data.timestamp,
      bootId: data.bootId
    });
    
    // Verificar checksum
    if (plan.checksum !== data.checksum) {
      throw new Error(`[ExecutionPlan] Checksum mismatch: expected ${data.checksum}, got ${plan.checksum}`);
    }
    
    return plan;
  }

  /**
   * Criar plano vazio (para testes)
   */
  static empty() {
    return new ExecutionPlan({ steps: [], version: '0.0.0' });
  }
};

// ================================
// EXECUTION STEP (estrutura de passo)
// ================================

window.ExecutionStep = class ExecutionStep {
  constructor({
    id,
    phase,
    action,
    dependencies = [],
    critical = true,
    fallback = null,
    metadata = {}
  }) {
    this.id = id;
    this.phase = phase;
    this.action = action;
    this.dependencies = Object.freeze([...dependencies]);
    this.critical = critical;
    this.fallback = fallback;
    this.metadata = Object.freeze({ ...metadata });
    
    Object.freeze(this);
  }

  /**
   * Descrever passo para logging
   */
  describe() {
    return `[${this.phase}] ${this.id} (${this.critical ? 'CRITICAL' : 'optional'})`;
  }
};

console.log('[ExecutionPlan] FASE 2.8 loaded');
console.log('[ExecutionPlan] Immutable bootstrap plan IR');
