// ================================
// EXECUTION AUTHORITY LAYER (EAL)
// Camada Global de Controle de Execução - Circuit Breaker Determinístico
// ================================
// Responsabilidade: Controlar autorização temporal de execução de runtime
// Estado: LOCKED | UNLOCKED
// Comportamento: gate() enfileira quando LOCKED, executa imediatamente quando UNLOCKED
//
// REGRAS INVARIANTES:
// ✅ Não modifica SessionBus
// ✅ Não modifica AuthFSM
// ✅ Não adiciona lógica de negócio
// ✅ Não cria timers de sistema
// ✅ Não interfere em eventos existentes
// ✅ Apenas infraestrutura de controle global
// ================================
(function() {
  'use strict';

  // Prevenir múltiplas instanciações
  if (window.__EAL__) {
    console.log('[EAL] Already initialized, skipping');
    return;
  }

  // ================================
  // EXECUTION AUTHORITY LAYER CLASS
  // ================================
  class ExecutionAuthorityLayer {
    constructor() {
      // Estado interno determinístico
      this._state = 'LOCKED';  // "LOCKED" | "UNLOCKED"
      this._queue = [];        // Array<Function> - fila FIFO
      this._executionCount = 0; // Contador de execuções para tracing
      this._queuedCount = 0;    // Contador de funções enfileiradas
      this._instanceId = `eal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(`[EAL] Initialized | state: ${this._state} | instance: ${this._instanceId}`);
    }

    // ================================
    // API PÚBLICA
    // ================================

    /**
     * Trava a execução - estado LOCKED
     * Todas as chamadas gate() subsequentes serão enfileiradas
     */
    lock() {
      const previousState = this._state;
      this._state = 'LOCKED';
      
      console.log(`[EAL] lock() | ${previousState} → LOCKED | queue: ${this._queue.length}`);
      
      return this; // Chainable
    }

    /**
     * Libera a execução - estado UNLOCKED
     * Executa todas as funções enfileiradas em ordem FIFO
     */
    unlock() {
      const previousState = this._state;
      this._state = 'UNLOCKED';
      
      console.log(`[EAL] unlock() | ${previousState} → UNLOCKED | executing queue: ${this._queue.length}`);

      // Executar fila acumulada (FIFO)
      if (this._queue.length > 0) {
        const queueSnapshot = [...this._queue]; // Copia para evitar mutação durante execução
        this._queue = []; // Limpar fila antes da execução
        
        for (const fn of queueSnapshot) {
          try {
            this._executionCount++;
            fn();
          } catch (error) {
            console.error('[EAL] Error executing queued function:', error);
            // Continuar executando as demais funções da fila
          }
        }
        
        console.log(`[EAL] Queue flushed | executed: ${queueSnapshot.length} | total: ${this._executionCount}`);
      }

      return this; // Chainable
    }

    /**
     * Verifica se execução está autorizada
     * @returns {boolean} true se UNLOCKED, false se LOCKED
     */
    canExecute() {
      return this._state === 'UNLOCKED';
    }

    /**
     * Portão de execução - comportamento condicional ao estado
     * Se UNLOCKED: executa imediatamente
     * Se LOCKED: adiciona na fila para execução futura
     * 
     * @param {Function} fn - Função a ser executada ou enfileirada
     * @returns {boolean} true se executou imediatamente, false se enfileirou
     */
    gate(fn) {
      if (typeof fn !== 'function') {
        console.error('[EAL] gate() requires a function, received:', typeof fn);
        return false;
      }

      if (this._state === 'UNLOCKED') {
        // Executar imediatamente
        try {
          this._executionCount++;
          fn();
          return true; // Executou imediatamente
        } catch (error) {
          console.error('[EAL] Error executing gated function:', error);
          return true; // Tentou executar, mas falhou
        }
      } else {
        // Enfileirar para execução futura
        this._queue.push(fn);
        this._queuedCount++;
        
        console.log(`[EAL] gate() | LOCKED → queued #${this._queuedCount} | queue: ${this._queue.length}`);
        return false; // Foi enfileirado
      }
    }

    // ================================
    // HARD INVARIANT - Execução protegida
    // ================================

    /**
     * HARD INVARIANT: Lança erro se execução não estiver autorizada
     * Use em pontos críticos: timers, listeners, reconciliation, heartbeat
     * @param {string} context - Identificador do ponto de execução
     * @throws {Error} Se state !== UNLOCKED
     */
    enforce(context = 'unknown') {
      if (this._state !== 'UNLOCKED') {
        throw new Error(`[EAL ENFORCE] Illegal execution outside EAL gate at: ${context}`);
      }
    }

    // ================================
    // API DE INTROSPEÇÃO (Não modifica estado)
    // ================================

    /**
     * Retorna estado atual
     * @returns {string} "LOCKED" | "UNLOCKED"
     */
    getState() {
      return this._state;
    }

    /**
     * Retorna tamanho da fila
     * @returns {number}
     */
    getQueueLength() {
      return this._queue.length;
    }

    /**
     * Retorna estatísticas de execução
     * @returns {Object}
     */
    getStats() {
      return {
        state: this._state,
        queueLength: this._queue.length,
        executionCount: this._executionCount,
        queuedCount: this._queuedCount,
        instanceId: this._instanceId
      };
    }

    /**
     * Limpa a fila sem executar (emergência/debug)
     * @returns {number} número de funções removidas
     */
    clearQueue() {
      const count = this._queue.length;
      this._queue = [];
      
      if (count > 0) {
        console.log(`[EAL] clearQueue() | removed: ${count}`);
      }
      
      return count;
    }

    // ================================
    // GARANTIA DE ISOLAMENTO
    // Não inicia timers, não escuta DOM, não usa BroadcastChannel,
    // não acessa SessionBus, não acessa AuthFSM
    // ================================
  }

  // ================================
  // REGISTRO GLOBAL
  // ================================
  
  // Singleton instance
  const ealInstance = new ExecutionAuthorityLayer();
  
  // Expor globalmente
  window.__EAL__ = ealInstance;

  // 🎯 HARD INVARIANT HELPER: Verificação global de execução autorizada
  // Use em qualquer ponto crítico: window.assertEAL('context')
  window.assertEAL = function(context = 'unknown') {
    if (!window.__EAL__) {
      throw new Error(`[EAL ASSERT] EAL not initialized - execution blocked at: ${context}`);
    }
    window.__EAL__.enforce(context);
  };

  console.log('[EAL] ★ ExecutionAuthorityLayer registered globally as window.__EAL__ ★');
  console.log('[EAL] Helper window.assertEAL() available for hard invariant checks');
  console.log('[EAL] Initial state: LOCKED (waiting for explicit unlock)');

})();
