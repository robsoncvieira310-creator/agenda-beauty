// ================================
// CORE CONTEXT - Application Context
// ================================
// Factory para criar instâncias isoladas de FSM
// Zero estado global - sempre criar via função

import fsmModule from './core-auth-fsm.js';

// ================================
// CONTEXT FACTORY
// ================================

export function createContext() {
  return {
    fsm: fsmModule
  };
}

// ================================
// DEFAULT EXPORT
// ================================

export default {
  createContext
};
