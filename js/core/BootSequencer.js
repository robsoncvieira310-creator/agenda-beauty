// ================================
// BOOT SEQUENCER - Orquestrador Determinístico de Inicialização
// ================================
// REGRAS CRÍTICAS:
// ✅ Controle explícito de sequência via fila interna
// ✅ Cada etapa só executa após conclusão explícita da anterior
// ✅ Bloqueio de execução fora de ordem
// ✅ Independente de qualquer FSM existente
// ✅ Logs claros de transição de etapa
//
// ❌ PROIBIDO: FSM para controle de ordem de boot
// ❌ PROIBIDO: Estados adicionais de Bootstrap FSM
// ❌ PROIBIDO: Derivar estado de AuthFSM dentro do sequencer
// ❌ PROIBIDO: Misturar eventos de domínio com eventos de infraestrutura

// ================================
// IIFE - ISOLAMENTO DE ESCOPO
// ================================
(function() {

// FASE 4: LOG DE CARREGAMENTO - detectar execução dupla
console.log('[LOAD] BootSequencer loading, existing?', !!window.BootSequencer, 'timestamp:', Date.now());

// 🔒 PROTEÇÃO CONTRA RELOAD DUPLICADO
if (window.BootSequencer) {
  console.warn('[LOAD] BootSequencer already loaded, skipping...');
  return;
}

// ================================
// DEPENDENCY GRAPH - ÚNICA FONTE DE VERDADE
// ================================
// Grafo de dependências do boot - ordem derivada automaticamente
const BOOT_GRAPH = Object.freeze({
  AUTH_RESTORE: [],
  AUTH_STABLE: ['AUTH_RESTORE'],
  SERVICES_INIT: ['AUTH_STABLE'],
  PAGE_MANAGER_READY: ['SERVICES_INIT'],
  UNLOCK_UI: ['PAGE_MANAGER_READY']
});

// Extrair steps do grafo (para compatibilidade)
const BOOT_STEPS = Object.freeze(Object.keys(BOOT_GRAPH));

// ================================
// BOOT SEQUENCER CLASS
// ================================
window.BootSequencer = class BootSequencer {
  constructor(options = {}) {
    // 🔒 VALIDAÇÃO: Impedir instanciação múltipla
    if (window.__bootSequencerInstance) {
      console.warn('[BootSequencer] Instance already exists, returning singleton');
      return window.__bootSequencerInstance;
    }

    // Configurações
    this.debug = options.debug ?? true;
    this.timeoutMs = options.timeoutMs ?? 30000; // Timeout global de 30s

    // Estado interno (não é FSM - é controle de execução sequencial)
    this.currentStepIndex = -1; // -1 = não iniciado
    this.isRunning = false;
    this.isComplete = false;
    this.startedAt = null;
    this.completedAt = null;

    // ============================================================
    // CAMADA 1: DEPENDENCY GRAPH ENGINE (NOVO)
    // ============================================================
    this._dependencyGraph = { ...BOOT_GRAPH }; // Grafo de dependências
    this._stepState = new Map(); // stepName -> 'pending' | 'running' | 'completed' | 'failed'
    this._stepResults = new Map(); // stepName -> result
    this._executionOrder = null; // Ordem topológica resolvida (cache)

    // ============================================================
    // CAMADA 2: EXECUTION STATE
    // ============================================================
    this._failedStep = null; // Step que falhou (para fail-fast)
    this._abortController = new AbortController(); // Para cancelar execução

    // ============================================================
    // CAMADA 3: REGISTRY (COMPATIBILIDADE)
    // ============================================================
    this.stepQueue = [...BOOT_STEPS]; // Mantido para compatibilidade externa
    this.stepHandlers = new Map(); // stepName -> { execute: fn, onComplete: fn, dependsOn: [] }

    // Registro de listeners de transição
    this.transitionListeners = new Set();

    // Registro de execução (para logs e debugging)
    this.executionLog = [];

    // 🔒 SINGLETON: Armazenar instância
    window.__bootSequencerInstance = this;

    this._log('info', 'BootSequencer initialized', {
      steps: this.stepQueue,
      timeoutMs: this.timeoutMs
    });
  }

  // ================================
  // STEP REGISTRATION
  // ================================

  /**
   * Registra handler para uma etapa específica
   * @param {string} stepName - Nome da etapa (deve estar em BOOT_STEPS)
   * @param {Function} executeFn - Função async que executa a etapa
   * @param {Object|Function} optionsOrCallback - Opções { dependsOn: [] } ou callback onComplete (legacy)
   * @param {Function} legacyOnComplete - Callback opcional após conclusão (legacy)
   */
  registerStep(stepName, executeFn, optionsOrCallback = null, legacyOnComplete = null) {
    // 🔒 VALIDAÇÃO: Etapa deve existir no grafo
    if (!BOOT_STEPS.includes(stepName)) {
      throw new Error(`[BootSequencer] Invalid step: ${stepName}. Valid steps: ${BOOT_STEPS.join(', ')}`);
    }

    // 🔒 VALIDAÇÃO: Handler deve ser função
    if (typeof executeFn !== 'function') {
      throw new Error(`[BootSequencer] executeFn must be a function for step: ${stepName}`);
    }

    // Parse arguments (suporta assinatura legacy e nova)
    let options = {};
    let onCompleteFn = null;

    if (typeof optionsOrCallback === 'function') {
      // Legacy: (step, handler, onComplete)
      onCompleteFn = optionsOrCallback;
    } else if (optionsOrCallback && typeof optionsOrCallback === 'object') {
      // Nova: (step, handler, { dependsOn: [] }, onComplete)
      options = optionsOrCallback;
      onCompleteFn = legacyOnComplete;
    } else if (legacyOnComplete) {
      onCompleteFn = legacyOnComplete;
    }

    // 🔒 VALIDAÇÃO: dependências devem existir no grafo
    const dependsOn = options.dependsOn || BOOT_GRAPH[stepName] || [];
    for (const dep of dependsOn) {
      if (!BOOT_STEPS.includes(dep)) {
        throw new Error(`[BootSequencer] Invalid dependency '${dep}' for step '${stepName}'`);
      }
    }

    this.stepHandlers.set(stepName, {
      execute: executeFn,
      onComplete: onCompleteFn,
      dependsOn: dependsOn
    });

    // Inicializar estado do step
    this._stepState.set(stepName, 'pending');

    this._log('debug', `Step registered: ${stepName}`, { dependsOn });
    return this; // Chainable
  }

  // ================================
  // TOPOLOGICAL SORT ENGINE
  // ================================

  /**
   * Resolve ordem de execução via topological sort
   * @private
   */
  _resolveExecutionOrder() {
    if (this._executionOrder) {
      return this._executionOrder;
    }

    const graph = this._dependencyGraph;
    const steps = Object.keys(graph);
    const inDegree = new Map();
    const adjacency = new Map();

    // Inicializar
    for (const step of steps) {
      inDegree.set(step, 0);
      adjacency.set(step, []);
    }

    // Construir grafo
    for (const [step, deps] of Object.entries(graph)) {
      for (const dep of deps) {
        adjacency.get(dep).push(step);
        inDegree.set(step, inDegree.get(step) + 1);
      }
    }

    // Kahn's algorithm
    const queue = [];
    const result = [];

    for (const [step, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(step);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift();
      result.push(current);

      for (const neighbor of adjacency.get(current)) {
        const newDegree = inDegree.get(neighbor) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // 🔒 VALIDAÇÃO: Detectar ciclo
    if (result.length !== steps.length) {
      throw new Error('[BootSequencer] Cyclic dependency detected in boot graph');
    }

    this._executionOrder = result;
    this._log('debug', 'Execution order resolved', { order: result });
    return result;
  }

  /**
   * Verifica se todas as dependências de um step foram resolvidas
   * @private
   */
  _areDependenciesResolved(stepName) {
    const handler = this.stepHandlers.get(stepName);
    if (!handler) return false;

    const deps = handler.dependsOn || [];
    return deps.every(dep => this._stepState.get(dep) === 'completed');
  }

  /**
   * Verifica se o boot deve falhar (fail-fast)
   * @private
   */
  _shouldAbort() {
    return this._failedStep !== null || this._abortController.signal.aborted;
  }

  // ================================
  // STEP EXECUTION CONTROL (DETERMINÍSTICO)
  // ================================

  /**
   * Inicia a sequência de boot determinística baseada no grafo
   * @returns {Promise<void>}
   */
  async start() {
    // 🔒 BLOQUEIO: Impedir múltiplas execuções
    if (this.isRunning) {
      this._log('warn', 'Boot sequence already running');
      return;
    }

    if (this.isComplete) {
      this._log('warn', 'Boot sequence already completed');
      return;
    }

    this.isRunning = true;
    this.startedAt = Date.now();

    this._log('info', '=== BOOT SEQUENCE STARTED (GRAPH-BASED) ===', {
      graph: this._dependencyGraph,
      timestamp: this.startedAt
    });

    try {
      // 1. RESOLVER ORDEM TOPOLÓGICA
      const executionOrder = this._resolveExecutionOrder();

      // 2. EXECUTAR STEPS EM ORDEM DETERMINÍSTICA
      for (let i = 0; i < executionOrder.length; i++) {
        const stepName = executionOrder[i];

        // 🔒 FAIL-FAST: Verificar se deve abortar
        if (this._shouldAbort()) {
          throw new Error(`[BootSequencer] Boot aborted due to failure in step: ${this._failedStep}`);
        }

        // 🔒 VALIDAÇÃO: Verificar dependências resolvidas
        if (!this._areDependenciesResolved(stepName)) {
          const handler = this.stepHandlers.get(stepName);
          const pendingDeps = (handler?.dependsOn || []).filter(
            dep => this._stepState.get(dep) !== 'completed'
          );
          throw new Error(
            `[BootSequencer] Dependencies not resolved for '${stepName}'. ` +
            `Pending: ${pendingDeps.join(', ')}`
          );
        }

        // Executar step
        await this._executeStep(stepName, i);

        // Atualizar estado (step já marca como 'completed' internamente)
        this._stepResults.set(stepName, this.executionLog[this.executionLog.length - 1]?.result);
      }

      this.isComplete = true;
      this.completedAt = Date.now();
      const duration = this.completedAt - this.startedAt;

      this._log('info', '=== BOOT SEQUENCE COMPLETED ===', {
        duration: `${duration}ms`,
        totalSteps: executionOrder.length,
        executionOrder,
        log: this.executionLog
      });

      this._notifyBootComplete();

    } catch (error) {
      this._failedStep = this._failedStep || this.getCurrentStep();
      this._log('error', '=== BOOT SEQUENCE FAILED ===', {
        step: this._failedStep,
        error: error.message,
        duration: `${Date.now() - this.startedAt}ms`
      });
      this._notifyBootFailed(error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Executa uma etapa individual com controle de timeout e logging
   * @private
   */
  async _executeStep(stepName, index) {
    const stepStart = Date.now();
    this.currentStepIndex = index;

    // Atualizar estado para 'running'
    this._stepState.set(stepName, 'running');

    const executionOrder = this._executionOrder || this.stepQueue;
    this._log('info', `[${index + 1}/${executionOrder.length}] Executing step: ${stepName}`);

    // 🔒 BLOQUEIO: Verificar se handler está registrado
    const handler = this.stepHandlers.get(stepName);
    if (!handler) {
      this._stepState.set(stepName, 'failed');
      this._failedStep = stepName;
      throw new Error(`[BootSequencer] No handler registered for step: ${stepName}`);
    }

    // Notificar listeners de início de etapa
    this._notifyTransition('step_start', stepName, index);

    try {
      // Executar com timeout
      const result = await this._executeWithTimeout(
        () => handler.execute(),
        stepName
      );

      const stepDuration = Date.now() - stepStart;

      // Marcar como completado
      this._stepState.set(stepName, 'completed');

      // Registrar execução
      this.executionLog.push({
        step: stepName,
        index: index,
        status: 'completed',
        duration: stepDuration,
        result: result,
        timestamp: Date.now()
      });

      // Callback de conclusão opcional
      if (handler.onComplete) {
        await handler.onComplete(result);
      }

      this._log('info', `[${index + 1}/${executionOrder.length}] Step completed: ${stepName}`, {
        duration: `${stepDuration}ms`
      });

      // Notificar listeners de conclusão
      this._notifyTransition('step_complete', stepName, index, result);

      return result;

    } catch (error) {
      const stepDuration = Date.now() - stepStart;

      // Marcar como falho
      this._stepState.set(stepName, 'failed');
      this._failedStep = stepName;

      this.executionLog.push({
        step: stepName,
        index: index,
        status: 'failed',
        duration: stepDuration,
        error: error.message,
        timestamp: Date.now()
      });

      // Notificar falha
      this._notifyTransition('step_failed', stepName, index, { error: error.message });

      throw error;
    }
  }

  /**
   * Executa função com timeout
   * @private
   */
  async _executeWithTimeout(fn, stepName) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`[BootSequencer] Step timeout: ${stepName} exceeded ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      Promise.resolve(fn())
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  // ================================
  // EXPLICIT ADVANCEMENT (mecanismo de avanço)
  // ================================

  /**
   * Avança explicitamente para a próxima etapa (usado para controle manual)
   * @returns {Promise<void>}
   */
  async advance() {
    if (!this.isRunning) {
      throw new Error('[BootSequencer] Cannot advance - sequence not running');
    }

    if (this.isComplete) {
      this._log('warn', 'Cannot advance - sequence already complete');
      return;
    }

    const nextIndex = this.currentStepIndex + 1;

    if (nextIndex >= this.stepQueue.length) {
      this._log('warn', 'Already at final step');
      return;
    }

    const stepName = this.stepQueue[nextIndex];
    await this._executeStep(stepName, nextIndex);
  }

  /**
   * Completa a etapa atual e avança (usado por handlers internos)
   * @param {string} stepName - Nome da etapa sendo completada
   * @param {*} result - Resultado da etapa
   */
  completeStep(stepName, result) {
    // 🔒 VALIDAÇÃO: Só permite completar a etapa atual
    const currentStep = this.stepQueue[this.currentStepIndex];
    if (stepName !== currentStep) {
      throw new Error(`[BootSequencer] Cannot complete ${stepName} - current step is ${currentStep}`);
    }

    this._log('debug', `Step explicitly completed: ${stepName}`, { result });
    return result;
  }

  // ================================
  // ORDER ENFORCEMENT (bloqueio fora de ordem)
  // ================================

  /**
   * Verifica se uma etapa específica pode ser executada
   * @param {string} stepName - Nome da etapa
   * @returns {boolean}
   */
  canExecute(stepName) {
    const targetIndex = this.stepQueue.indexOf(stepName);

    if (targetIndex === -1) {
      return false;
    }

    // Só permite se for a próxima etapa na sequência
    return targetIndex === this.currentStepIndex + 1;
  }

  /**
   * Verifica se uma etapa já foi completada
   * @param {string} stepName - Nome da etapa
   * @returns {boolean}
   */
  isStepComplete(stepName) {
    const targetIndex = this.stepQueue.indexOf(stepName);
    return targetIndex !== -1 && targetIndex < this.currentStepIndex;
  }

  /**
   * Retorna a etapa atual
   * @returns {string|null}
   */
  getCurrentStep() {
    if (this.currentStepIndex < 0 || this.currentStepIndex >= this.stepQueue.length) {
      return null;
    }
    return this.stepQueue[this.currentStepIndex];
  }

  // ================================
  // SUBSCRIPTION / LISTENERS
  // ================================

  /**
   * Inscreve listener para transições de etapa
   * @param {Function} callback - Recebe { type, step, index, result? }
   * @returns {Function} Função para cancelar subscription
   */
  onTransition(callback) {
    if (typeof callback !== 'function') {
      throw new Error('[BootSequencer] Callback must be a function');
    }

    this.transitionListeners.add(callback);

    // Retorna função de unsubscribe
    return () => {
      this.transitionListeners.delete(callback);
    };
  }

  /**
   * Notifica todos os listeners de transição
   * @private
   */
  _notifyTransition(type, step, index, result = null) {
    const event = {
      type,
      step,
      index,
      timestamp: Date.now(),
      result
    };

    for (const listener of this.transitionListeners) {
      try {
        listener(event);
      } catch (error) {
        this._log('error', 'Transition listener error:', error.message);
      }
    }
  }

  /**
   * Notifica conclusão do boot
   * @private
   */
  _notifyBootComplete() {
    const event = {
      type: 'boot_complete',
      timestamp: Date.now(),
      executionOrder: this._executionOrder,
      log: [...this.executionLog]
    };

    for (const listener of this.transitionListeners) {
      try {
        listener(event);
      } catch (error) {
        this._log('error', 'Boot complete listener error:', error.message);
      }
    }
  }

  /**
   * Notifica falha do boot
   * @private
   */
  _notifyBootFailed(error) {
    const event = {
      type: 'boot_failed',
      timestamp: Date.now(),
      failedStep: this._failedStep,
      error: error.message,
      log: [...this.executionLog]
    };

    for (const listener of this.transitionListeners) {
      try {
        listener(event);
      } catch (err) {
        this._log('error', 'Boot failed listener error:', err.message);
      }
    }
  }

  // ================================
  // STATUS & DIAGNOSTICS
  // ================================

  /**
   * Retorna status atual do sequencer
   * @returns {Object}
   */
  getStatus() {
    // Construir mapa de estados para todos os steps
    const stepStates = {};
    for (const step of BOOT_STEPS) {
      stepStates[step] = this._stepState.get(step) || 'pending';
    }

    const executionOrder = this._executionOrder || [];
    const totalSteps = executionOrder.length || this.stepQueue.length;

    return {
      isRunning: this.isRunning,
      isComplete: this.isComplete,
      currentStep: this.getCurrentStep(),
      currentStepIndex: this.currentStepIndex,
      totalSteps,
      progress: this.isComplete ? 100 : Math.round(((this.currentStepIndex + 1) / totalSteps) * 100),
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      executionLog: [...this.executionLog],
      stepStates,
      dependencyGraph: { ...this._dependencyGraph },
      executionOrder: [...executionOrder],
      failedStep: this._failedStep
    };
  }

  /**
   * Retorna relatório completo de execução
   * @returns {Object}
   */
  getReport() {
    const status = this.getStatus();
    const duration = status.completedAt ? status.completedAt - status.startedAt : null;

    // Validar completude do grafo
    const registeredSteps = Array.from(this.stepHandlers.keys());
    const allSteps = Object.keys(this._dependencyGraph);
    const missingSteps = allSteps.filter(s => !registeredSteps.includes(s));
    const orphanSteps = registeredSteps.filter(s => !allSteps.includes(s));

    return {
      ...status,
      duration: duration ? `${duration}ms` : 'N/A',
      registeredSteps,
      unregisteredSteps: allSteps.filter(s => !registeredSteps.includes(s)),
      missingSteps,
      orphanSteps,
      graphValid: missingSteps.length === 0 && orphanSteps.length === 0,
      stepResults: Object.fromEntries(this._stepResults)
    };
  }

  // ================================
  // LOGGING
  // ================================

  /**
   * Log interno com níveis
   * @private
   */
  _log(level, message, data = null) {
    if (!this.debug && level === 'debug') return;

    const prefix = '[BootSequencer]';
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];

    const logData = {
      timestamp,
      level,
      message,
      ...data
    };

    switch (level) {
      case 'error':
        console.error(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'info':
        console.log(prefix, message, data || '');
        break;
      case 'debug':
        console.log(prefix, '[DEBUG]', message, data || '');
        break;
    }
  }

  // ================================
  // UTILITY METHODS
  // ================================

  /**
   * Reseta o sequencer (para testes ou re-bootstrap)
   * ⚠️ Use com cautela - pode quebrar estado da aplicação
   */
  reset() {
    if (this.isRunning) {
      this._log('warn', 'Cannot reset while running');
      return false;
    }

    this.currentStepIndex = -1;
    this.isRunning = false;
    this.isComplete = false;
    this.startedAt = null;
    this.completedAt = null;
    this.executionLog = [];
    this.stepHandlers.clear();
    this.transitionListeners.clear();

    // Resetar camadas internas do grafo
    this._executionOrder = null;
    this._failedStep = null;
    this._abortController = new AbortController();
    this._stepState.clear();
    this._stepResults.clear();

    this._log('info', 'BootSequencer reset');
    return true;
  }

  /**
   * Aborta execução em andamento
   */
  abort() {
    this._abortController.abort();
    this._log('warn', 'Boot sequence aborted');
  }
}

// ================================
// FACTORY FUNCTION
// ================================

/**
 * Cria e retorna instância singleton do BootSequencer
 * @param {Object} options - Configurações opcionais
 * @returns {BootSequencer}
 */
window.createBootSequencer = function(options = {}) {
  // Retorna instância existente ou cria nova
  if (window.__bootSequencerInstance) {
    return window.__bootSequencerInstance;
  }
  return new window.BootSequencer(options);
};

// ================================
// STEP CONSTANTS (exportadas)
// ================================
window.BOOT_STEPS = BOOT_STEPS;
window.BOOT_GRAPH = BOOT_GRAPH;

console.log('[LOAD] BootSequencer loaded successfully');

// Fechar IIFE
})();
