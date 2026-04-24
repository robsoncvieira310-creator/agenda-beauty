// ================================
// EFFECT RUNNER - Auth Effects
// ================================
// ✅ Effects retornam: { event: string, payload?: object } | null
// ❌ PROIBIDO: fsm.dispatch() dentro de effects
// ❌ PROIBIDO: side effects além de I/O de auth
// ❌ PROIBIDO: chamar FSM diretamente
// ❌ PROIBIDO: disparar dispatch direto
// ✅ APENAS: retornar { event, payload }
//
// ARCHITECTURAL RULE:
// Supabase = SOURCE OF TRUTH (única fonte confiável)
// localStorage = DERIVED CACHE (não confiável, apenas acelera boot)
// NUNCA confiar em localStorage sem validação do server

// ================================
// IIFE - ISOLAMENTO DE ESCOPO
// ================================
(function() {

// 🔒 VALIDAÇÃO: supabaseClient deve existir
if (!window.supabaseClient) {
  throw new Error('[BOOTSTRAP FATAL] EffectRunner: supabaseClient missing');
}

// ✅ fonte única
const client = window.supabaseClient;

// SESSION NORMALIZATION
// garante formato consistente independente da fonte
function normalizeSession(data) {
  if (!data) return null;

  // DEBUG: Log do que está sendo normalizado
  console.log('[normalizeSession] Input:', {
    hasData: !!data,
    dataSession: data.session,
    dataUser: data.user,
    dataAccessToken: data.access_token
  });

  // Handle both supabase format and normalized format
  // NOTA: Supabase v2 retorna dados DIRETAMENTE em data (data.session é null ou undefined)
  // Quando data.session é null, não queremos usar null, queremos usar data diretamente
  const session = (data.session && data.session.user) ? data.session : data;
  const user = session?.user ?? data?.user ?? null;

  console.log('[normalizeSession] Parsed:', {
    hasUser: !!user,
    hasAccessToken: !!(session?.access_token || data?.access_token)
  });

  if (!user) return null;

  // Extrair access_token para calcular expires_at do JWT se necessário
  const accessToken = session?.access_token || data?.access_token;

  // Extrair expires_at do token JWT se não estiver presente nos dados
  let expires_at = session?.expires_at || data?.expires_at || null;
  if (!expires_at && accessToken) {
    try {
      // JWT payload é a segunda parte (base64)
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      if (payload.exp) {
        expires_at = payload.exp;
        console.log('[normalizeSession] Extracted expires_at from JWT:', expires_at);
      }
    } catch (e) {
      // Ignorar erro de parsing JWT
    }
  }

  // Retorna formato plano compatível com FSM (user + access_token no mesmo nível)
  return {
    user,
    access_token: accessToken,
    refresh_token: session?.refresh_token || data?.refresh_token,
    expires_at,
    expires_in: session?.expires_in || data?.expires_in,
    token_type: session?.token_type || data?.token_type
  };
}

window.EffectRunner = class EffectRunner {
  constructor() {
    this.running = new Set();
    this.sessionBus = null;
    // INSTRUMENTAÇÃO: Contadores de execução
    this._executionLog = [];
    this._counters = {
      RESTORE_SESSION: 0,
      LOGIN: 0,
      LOGOUT: 0,
      REFRESH_SESSION: 0
    };
    // ✅ PATCH 1: AbortController para cancelamento real
    this._controllers = new Map();

    // ✅ CICLO 3: EFFECT LOCK REGISTRY (anti-concorrência)
    this.effectLocks = {
      RESTORE_SESSION: { running: false, controller: null, key: null, executionId: 0 },
      LOGIN: { running: false, executionId: 0 },
      LOGOUT: { running: false, executionId: 0 },
      REFRESH_SESSION: { running: false, executionId: 0 }  // Já tem lock externo, mas mantemos para consistência
    };
  }

  // INSTRUMENTAÇÃO: Obter estatísticas de execução
  getExecutionStats() {
    return {
      counters: { ...this._counters },
      log: [...this._executionLog],
      runningNow: Array.from(this.running)
    };
  }

  // INSTRUMENTAÇÃO: Registrar execução
  _recordExecution(effectName, state, bootState, session) {
    const entry = {
      effect: effectName,
      timestamp: Date.now(),
      state,
      bootState,
      hasSession: !!session,
      userId: session?.user?.id || null,
      stack: new Error().stack.split('\n').slice(2, 5).join(' | ')
    };
    this._executionLog.push(entry);
    this._counters[effectName] = (this._counters[effectName] || 0) + 1;
    
    console.log('[EFFECT EXEC]', entry);
    
    // Limitar log para evitar memory leak
    if (this._executionLog.length > 100) {
      this._executionLog.shift();
    }
  }

  // Conecta SessionBus para multi-tab sync
  setSessionBus(sessionBus) {
    this.sessionBus = sessionBus;
  }

  async run(type, payload = {}, options = {}) {
    const key = `${type}:${Date.now()}`;

    // Bloqueia reentrada
    if (this.running.has(key)) {
      console.warn('[EffectRunner] Reentrada bloqueada:', key);
      return { event: 'EFFECT_ERROR', payload: { reason: 'reentrada_bloqueada' } };
    }

    this.running.add(key);

    // ✅ CICLO 3: RUNTIME GUARDS (anti-concorrência)
    const lock = this.effectLocks[type];
    if (lock) {
      switch (type) {
        case 'RESTORE_SESSION':
          // Hard lock: cancela execução anterior e inicia nova
          if (lock.running && lock.controller) {
            console.log('[GUARD] RESTORE cancelled previous execution');
            lock.controller.abort();
            // Limpar estado anterior
            if (lock.key) {
              this.running.delete(lock.key);
              this._controllers.delete(lock.key);
            }
          }
          // Configurar nova execução
          lock.running = true;
          lock.key = key;
          // Criar controller interno para RESTORE (se não veio externo)
          if (!options.signal) {
            const restoreController = new AbortController();
            lock.controller = restoreController;
            this._controllers.set(key, restoreController);
          }
          break;

        case 'LOGIN':
          // Guard: bloqueia se já running
          if (lock.running) {
            console.log('[GUARD] LOGIN blocked (already running)');
            this.running.delete(key);
            return { event: 'EFFECT_BLOCKED', payload: { reason: 'login_already_running' } };
          }
          lock.running = true;
          break;

        case 'LOGOUT':
          // Guard: ignora se já running
          if (lock.running) {
            console.log('[GUARD] LOGOUT ignored duplicate');
            this.running.delete(key);
            return { event: 'EFFECT_IGNORED', payload: { reason: 'logout_already_running' } };
          }
          lock.running = true;
          break;

        case 'REFRESH_SESSION':
          // REFRESH já tem lock externo (acquireRefreshLock), apenas registrar
          lock.running = true;
          break;
      }

      // ✅ CICLO 3.1: EXECUTION TOKEN (anti-stale effect)
      lock.executionId = (lock.executionId || 0) + 1;
      console.log('[GUARD] Execution token assigned:', { effect: type, executionId: lock.executionId });
    }
    const currentExecution = lock ? lock.executionId : 0;

    // ✅ FIX 3: Usar signal externo se fornecido, ou criar AbortController interno
    const controller = options.signal ? { signal: options.signal, abort: () => {} } : new AbortController();
    if (!options.signal) {
      this._controllers.set(key, controller);
    }

    try {
      const fn = this.effects[type];
      if (!fn) {
        console.warn('[EffectRunner] Effect desconhecido:', type);
        return { event: 'EFFECT_ERROR', payload: { reason: 'effect_desconhecido' } };
      }

      // INSTRUMENTAÇÃO: Log antes da execução
      console.log('[EFFECT RUN START]', { effect: type, timestamp: Date.now(), key, hasExternalSignal: !!options.signal });

      // Executa effect com signal para cancelamento + execution token
      const result = await fn(payload, { signal: controller.signal, executionId: currentExecution, effectLocks: this.effectLocks });

      // INSTRUMENTAÇÃO: Log após execução
      console.log('[EFFECT RUN END]', {
        effect: type,
        timestamp: Date.now(),
        resultEvent: result?.event,
        hasPayload: !!result?.payload
      });

      // Validação semântica: aceita SIGNAL, EVENT ou RESULT
      const isSignal =
        result &&
        typeof result === 'object' &&
        result.event &&
        result.payload === undefined;

      const isEvent =
        result &&
        typeof result === 'object' &&
        result.event &&
        result.payload !== undefined;

      const isResult =
        result &&
        typeof result === 'object' &&
        result.ok === true;

      if (isSignal || isEvent || isResult) {
        return result;
      }

      console.error('[EffectRunner] Invalid effect result', result);

      return {
        event: 'EFFECT_ERROR',
        payload: { reason: 'invalid_effect_result' }
      };
    } catch (error) {
      // ✅ PATCH 1: Tratar abort como caso especial
      if (error.name === 'AbortError') {
        console.log('[EffectRunner] Effect cancelled:', type);
        return { event: 'CANCELLED', payload: { reason: 'aborted' } };
      }
      console.error('[EffectRunner] Erro em effect:', type, error);
      return { event: 'LOGOUT_ERROR', payload: { error: error.message } };
    } finally {
      this.running.delete(key);
      this._controllers.delete(key);

      // ✅ CICLO 3: Liberar lock do effect
      const effectLock = this.effectLocks[type];
      if (effectLock) {
        effectLock.running = false;
        if (type === 'RESTORE_SESSION') {
          effectLock.controller = null;
          effectLock.key = null;
        }
      }
    }
  }

  // ✅ PATCH 1: Cancelar effects em execução por tipo
  cancel(type) {
    let cancelled = 0;
    for (const [key, controller] of this._controllers.entries()) {
      if (key.startsWith(type)) {
        controller.abort();
        this._controllers.delete(key);
        cancelled++;
      }
    }
    if (cancelled > 0) {
      console.log('[EffectRunner] Cancelled', cancelled, type, 'effect(s)');
    }
    return cancelled;
  }

  // ================================
  // EFFECT HANDLERS
  // ================================
  // Todos retornam: { event: EffectEvent, payload?: object } | null

  effects = {
    // Restore session - Supabase primeiro (source of truth), cache apenas fallback temporário
    RESTORE_SESSION: async (payload, context = {}) => {
      // ✅ CICLO 3.1: EXECUTION TOKEN (anti-stale effect)
      const { executionId, effectLocks } = context;
      const currentExecution = executionId;

      try {
        // 1. SUPABASE PRIMEIRO - única fonte de verdade confiável
        const { data, error } = await client.auth.getSession();

        // ✅ CICLO 3.1: VALIDAÇÃO ANTES DE EMITIR
        const lock = effectLocks?.RESTORE_SESSION;
        if (lock && currentExecution !== undefined && lock.executionId !== currentExecution) {
          console.log('[GUARD] Ignoring stale execution result (RESTORE)');
          return { event: 'CANCELLED', payload: { reason: 'stale_execution' } };
        }

        // FASE 2: LOG COMPLETO DA SESSÃO RAW
        console.log('[SESSION RAW]', JSON.stringify({
          data,
          error,
          hasData: !!data,
          hasSession: !!data?.session,
          sessionKeys: data?.session ? Object.keys(data.session) : null,
          user: data?.session?.user,
          userId: data?.session?.user?.id,
          access_token: data?.session?.access_token,
          expires_at: data?.session?.expires_at
        }, null, 2));

        if (error) {
          console.error('[SESSION RAW] Supabase error:', error);
        }

        // DEBUG: Log completo do payload Supabase
        const session = data?.session;
        console.log('[EffectRunner RESTORE] Supabase raw:', {
          user: session?.user?.id,
          access_token: session?.access_token ? 'present' : 'missing',
          expires_at: session?.expires_at,
          expires_in: session?.expires_in,
          token_type: session?.token_type,
          fullKeys: session ? Object.keys(session) : null
        });

        const serverSession = normalizeSession(data?.session);

        if (serverSession?.user) {
          // ✅ CICLO 3.1: VALIDAÇÃO ANTES DE EMITIR
          if (lock && currentExecution !== undefined && lock.executionId !== currentExecution) {
            console.log('[GUARD] Ignoring stale execution result (RESTORE emit)');
            return { event: 'CANCELLED', payload: { reason: 'stale_execution' } };
          }

          // ✅ FIX: SessionBus é única fonte de version - emitir evento PRIMEIRO
          if (this.sessionBus) {
            await this.sessionBus.emit('SESSION_RESTORED', serverSession);
          }
          
          // ✅ FIX 3: Recuperar version atribuído pelo SessionBus
          // O evento foi processado e version foi atribuído - recuperar do Bus
          const lastEvent = this.sessionBus?.checkpoint?.lastSeq || 0;
          
          // ✅ INVARIANTE 1: Payload canônico completo COM version
          const canonicalPayload = {
            user: serverSession.user,
            access_token: serverSession.access_token,
            refresh_token: serverSession.refresh_token,
            expires_at: serverSession.expires_at,
            expires_in: serverSession.expires_in,
            token_type: serverSession.token_type,
            // ✅ FIX 3: Persistir version para reconcile seguro
            version: lastEvent,
            persistedAt: Date.now(),
            sourceTabId: this.sessionBus?.tabId
          };

          // ✅ CICLO 3.1: VALIDAÇÃO ANTES DE RETORNAR
          if (lock && currentExecution !== undefined && lock.executionId !== currentExecution) {
            console.log('[GUARD] Ignoring stale execution result (RESTORE return)');
            return { event: 'CANCELLED', payload: { reason: 'stale_execution' } };
          }

          // Sincroniza cache com servidor (AGORA com version)
          localStorage.setItem('auth_session', JSON.stringify(canonicalPayload));
          console.log('[EffectRunner] Session persisted with version:', lastEvent);

          return { ok: true };
        }

        // 🔴 FASE 1: SERVIDOR DIZ QUE NÃO HÁ SESSÃO - limpar cache stale!
        console.log('[SESSION RAW] Server returned no session - clearing stale cache');
        localStorage.removeItem('auth_session');

        // 🔴 CORREÇÃO CRÍTICA: NÃO usar cache quando servidor diz que não há sessão!
        // Cache é apenas fallback quando servidor está indisponível, não quando diz "não há sessão"
        console.log('[SESSION FALLBACK] IGNORADO - servidor confirmou ausência de sessão');

        // ESTADO FINAL SEGURO - sem sessão válida
        return { event: 'SESSION_NOT_FOUND' };

      } catch (error) {
        console.error('[EffectRunner] Session restore failed:', error);
        return { event: 'SESSION_NOT_FOUND' };
      }
    },

    // Login - autenticação + write-through síncrono
    LOGIN: async (payload, context = {}) => {
      // ✅ CICLO 3.1: EXECUTION TOKEN (anti-stale effect)
      const { executionId, effectLocks } = context;
      const currentExecution = executionId;
      const lock = effectLocks?.LOGIN;

      try {
        const { email, password } = payload;
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password
        });

        // ✅ CICLO 3.1: VALIDAÇÃO APÓS API CALL
        if (lock && currentExecution !== undefined && lock.executionId !== currentExecution) {
          console.log('[GUARD] Ignoring stale execution result (LOGIN)');
          return { event: 'CANCELLED', payload: { reason: 'stale_execution' } };
        }

        // DEBUG: Log completo do payload Supabase
        // NOTA: Supabase v2 retorna dados DIRETAMENTE em data (data.session é null)
        console.log('[EffectRunner LOGIN] Supabase raw:', {
          hasData: !!data,
          dataKeys: data ? Object.keys(data) : null,
          user: data?.user?.id,
          access_token: data?.access_token ? 'present' : 'missing',
          expires_at: data?.expires_at,
          expires_in: data?.expires_in,
          token_type: data?.token_type
        });

        if (error) throw error;

        // Normaliza e valida
        // NOTA: Passar data diretamente, não data.session (que é null no Supabase v2)
        const session = normalizeSession(data);

        // FASE 4: LOG OBRIGATÓRIO DE SUCESSO
        console.log('[LOGIN SUCCESS]', {
          hasSession: !!session,
          userId: session?.user?.id,
          hasAccessToken: !!session?.access_token,
          expiresAt: session?.expires_at
        });

        if (!session?.user) {
          return {
            event: 'LOGIN_ERROR',
            payload: { error: 'Sessão inválida do servidor' }
          };
        }

        // ✅ INVARIANTE 1: Payload canônico completo
        // ✅ FIX FINAL: SessionBus adiciona version - NÃO gerar localmente
        const canonicalPayload = {
          user: session.user,
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          expires_in: session.expires_in,
          token_type: session.token_type
          // version será adicionado pelo SessionBus
        };

        // WRITE-THROUGH ÚNICO: cache sempre derivado do server
        localStorage.setItem('auth_session', JSON.stringify(canonicalPayload));

        // ✅ CICLO 3.1: VALIDAÇÃO ANTES DE EMITIR
        if (lock && currentExecution !== undefined && lock.executionId !== currentExecution) {
          console.log('[GUARD] Ignoring stale execution result (LOGIN emit)');
          return { event: 'CANCELLED', payload: { reason: 'stale_execution' } };
        }

        // MULTI-TAB SYNC: propaga para outras abas (após commit local)
        // ✅ INVARIANTE 1: Emitir payload COMPLETO, não parcial
        if (this.sessionBus) {
          queueMicrotask(async () => {
            // ✅ CICLO 3.1: VALIDAÇÃO DENTRO DO MICROTASK
            if (lock && currentExecution !== undefined && lock.executionId !== currentExecution) {
              console.log('[GUARD] Ignoring stale execution result (LOGIN microtask)');
              return;
            }
            await this.sessionBus.emit('LOGIN_OK', canonicalPayload);
          });
        }

        // ✅ CICLO 3.1: VALIDAÇÃO ANTES DE RETORNAR
        if (lock && currentExecution !== undefined && lock.executionId !== currentExecution) {
          console.log('[GUARD] Ignoring stale execution result (LOGIN return)');
          return { event: 'CANCELLED', payload: { reason: 'stale_execution' } };
        }

        return {
          event: 'LOGIN_OK',
          payload: canonicalPayload
        };
      } catch (error) {
        return {
          event: 'LOGIN_ERROR',
          payload: { error: error.message }
        };
      }
    },

    // Logout - atômico global (server first, cache garantido)
    LOGOUT: async (payload, context = {}) => {
      // ✅ CICLO 3.1: EXECUTION TOKEN (anti-stale effect)
      const { executionId, effectLocks } = context;
      const currentExecution = executionId;
      const lock = effectLocks?.LOGOUT;

      try {
        // 1. Sempre tenta server primeiro (pode falhar silenciosamente)
        try {
          await client.auth.signOut();
        } catch (serverErr) {
          console.warn('[EffectRunner] Server logout failed:', serverErr);
          // Continua para limpeza local mesmo se server falhar
        }

        // ✅ CICLO 3.1: VALIDAÇÃO APÓS API CALL
        if (lock && currentExecution !== undefined && lock.executionId !== currentExecution) {
          console.log('[GUARD] Ignoring stale execution result (LOGOUT)');
          return { event: 'CANCELLED', payload: { reason: 'stale_execution' } };
        }

        // 2. GARANTE limpeza local (hard guarantee)
        localStorage.removeItem('auth_session');

        // 2b. LIMPA flag de redirect (permite redirecionar após novo login)
        sessionStorage.removeItem('auth_redirect_done');

        // ✅ CICLO 3.1: VALIDAÇÃO ANTES DE EMITIR
        if (lock && currentExecution !== undefined && lock.executionId !== currentExecution) {
          console.log('[GUARD] Ignoring stale execution result (LOGOUT emit)');
          return { event: 'CANCELLED', payload: { reason: 'stale_execution' } };
        }

        // 3. MULTI-TAB SYNC: propaga logout para outras abas (após commit local)
        // ✅ FIX FINAL: Payload necessário para SessionBus adicionar version
        const logoutPayload = { reason: 'user_logout' };
        if (this.sessionBus) {
          queueMicrotask(async () => {
            // ✅ CICLO 3.1: VALIDAÇÃO DENTRO DO MICROTASK
            if (lock && currentExecution !== undefined && lock.executionId !== currentExecution) {
              console.log('[GUARD] Ignoring stale execution result (LOGOUT microtask)');
              return;
            }
            await this.sessionBus.emit('LOGOUT_OK', logoutPayload);
          });
        }

        // ✅ CICLO 3.1: VALIDAÇÃO ANTES DE RETORNAR
        if (lock && currentExecution !== undefined && lock.executionId !== currentExecution) {
          console.log('[GUARD] Ignoring stale execution result (LOGOUT return)');
          return { event: 'CANCELLED', payload: { reason: 'stale_execution' } };
        }

        // 4. State reset garantido
        return { event: 'LOGOUT_OK', payload: logoutPayload };

      } catch (error) {
        // Fallback final: garante que cache seja removido mesmo em erro total
        localStorage.removeItem('auth_session');

        return {
          event: 'LOGOUT_ERROR',
          payload: { error: error.message }
        };
      }
    },

    // Refresh session - server-side token refresh
    REFRESH_SESSION: async (payload, context = {}) => {
      // ✅ CICLO 3.1: EXECUTION TOKEN (anti-stale effect)
      const { executionId, effectLocks } = context;
      const currentExecution = executionId;
      const lock = effectLocks?.REFRESH_SESSION;

      try {
        const { data, error } = await client.auth.refreshSession();

        // ✅ CICLO 3.1: VALIDAÇÃO ANTES DE PROCESSAR RESULTADO
        if (lock && currentExecution !== undefined && lock.executionId !== currentExecution) {
          console.log('[GUARD] Ignoring stale execution result (REFRESH)');
          return { event: 'CANCELLED', payload: { reason: 'stale_execution' } };
        }

        if (error) {
          return {
            event: 'SESSION_NOT_FOUND',
            payload: { error: error.message }
          };
        }

        const session = normalizeSession(data?.session);

        if (!session?.user) {
          return { event: 'SESSION_NOT_FOUND' };
        }

        // ✅ CICLO 3.1: VALIDAÇÃO ANTES DE EMITIR
        if (lock && currentExecution !== undefined && lock.executionId !== currentExecution) {
          console.log('[GUARD] Ignoring stale execution result (REFRESH emit)');
          return { event: 'CANCELLED', payload: { reason: 'stale_execution' } };
        }

        // ✅ FIX: SessionBus é única fonte de version - emitir evento PRIMEIRO
        if (this.sessionBus) {
          await this.sessionBus.emit('SESSION_RESTORED', session);
        }
        
        // ✅ FIX 3: Recuperar version atribuído pelo SessionBus
        const lastEvent = this.sessionBus?.checkpoint?.lastSeq || 0;

        // ✅ INVARIANTE 1: Payload canônico completo COM version
        const canonicalPayload = {
          user: session.user,
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          expires_in: session.expires_in,
          token_type: session.token_type,
          // ✅ FIX 3: Persistir version para reconcile seguro
          version: lastEvent,
          persistedAt: Date.now(),
          sourceTabId: this.sessionBus?.tabId
        };

        // ✅ CICLO 3.1: VALIDAÇÃO ANTES DE RETORNAR
        if (lock && currentExecution !== undefined && lock.executionId !== currentExecution) {
          console.log('[GUARD] Ignoring stale execution result (REFRESH return)');
          return { event: 'CANCELLED', payload: { reason: 'stale_execution' } };
        }

        // Atualiza cache com nova sessão (AGORA com version)
        localStorage.setItem('auth_session', JSON.stringify(canonicalPayload));
        console.log('[EffectRunner] Refreshed session persisted with version:', lastEvent);

        return { ok: true };
      } catch (error) {
        console.error('[EffectRunner] Session refresh failed:', error);
        return { event: 'SESSION_NOT_FOUND' };
      }
    }
  };
}

// Fechar IIFE
})();
