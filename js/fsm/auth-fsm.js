// ================================
// AUTH FSM - Core State Machine
// ================================
// REGRAS CRÍTICAS:
// ✅ Estado único global
// ✅ Transições controladas
// ✅ Eventos vindos do session-bus
// ✅ Nenhuma ação direta fora da máquina

// Estados permitidos (CANONICAL)
window.AuthState = Object.freeze({
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  AUTHENTICATING: 'AUTHENTICATING',
  AUTHENTICATED: 'AUTHENTICATED',
  FIRST_LOGIN_REQUIRED: 'FIRST_LOGIN_REQUIRED',
  SESSION_RESTORING: 'SESSION_RESTORING',
  SESSION_REFRESHING: 'SESSION_REFRESHING',
  LOGOUT_PENDING: 'LOGOUT_PENDING',
  ERROR: 'ERROR'
});

// Eventos de entrada (UI / SYSTEM / SESSION-BUS)
window.AuthEvent = Object.freeze({
  LOGIN_REQUEST: 'LOGIN_REQUEST',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAIL: 'LOGIN_FAIL',
  SESSION_RESTORED: 'SESSION_RESTORED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  LOGOUT_REQUEST: 'LOGOUT_REQUEST',
  LOGOUT_SUCCESS: 'LOGOUT_SUCCESS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  // ✅ FASE 2: Eventos para fluxo de primeiro login
  FIRST_LOGIN_DETECTED: 'FIRST_LOGIN_DETECTED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  // ✅ CORREÇÃO DEFINITIVA: Evento de sincronização inicial obrigatória
  SESSION_BUS_INITIAL_SYNC: 'SESSION_BUS_INITIAL_SYNC'
});

// ================================
// IIFE - ISOLAMENTO DE ESCOPO
// ================================
(function() {

// ValidationResult tri-state para sessão (fora da classe)
const ValidationResult = Object.freeze({
  VALID: 'VALID',
  INVALID: 'INVALID',
  REFRESHED: 'REFRESHED'
});

// Lock key para refresh serializado entre abas
const REFRESH_LOCK_KEY = 'auth_refresh_lock';
const LOCK_TTL_MS = 3000; // 3 segundos

// ================================
// VALIDAÇÃO PURA DE SESSION PAYLOAD
// ================================
// VALIDAÇÃO ESTRUTURAL (PATCH 3)
// ================================
function isValidSession(session) {
  return !!(
    session &&
    typeof session.access_token === 'string' &&
    typeof session.refresh_token === 'string' &&
    session.user?.id &&
    typeof session.expires_at === 'number'
  );
}

// Extrai validações comuns para eliminar duplicação
// SEM side-effects - apenas retorna resultado da validação
// ================================
function validateSessionPayload(payload, currentSession) {
  // ✅ PATCH 3: Validação estrutural completa
  if (!isValidSession(payload)) {
    console.warn('[validateSessionPayload] Invalid session payload structure');
    return { valid: false, reason: 'invalid_payload' };
  }

  // Check expiração
  const now = Math.floor(Date.now() / 1000);
  const CLOCK_SKEW = 30;

  if (payload.expires_at <= now + CLOCK_SKEW) {
    return { valid: false, reason: 'expired' };
  }

  // ✅ CORREÇÃO: Permitir retry para eventos sem version durante reidratação
  // Apenas rejeitar terminalmente se NÃO estiver em fluxo de reidratação
  if (payload?.version == null) {
    const isRehydration = payload?.source?.includes('rehydration') || 
                          payload?.reason === 'divergence_detected';
    if (isRehydration) {
      console.warn('[validateSessionPayload] Version missing in rehydration - assigning fallback');
      // Atribuir version fallback para permitir processamento
      payload.version = Date.now();
    } else {
      console.error('[validateSessionPayload] REJECTED: Event without version');
      return { valid: false, reason: 'missing_version' };
    }
  }

  // ✅ I3: Usar apenas version do evento (não Date.now())
  return {
    valid: true,
    data: {
      incomingUserId: payload.user.id,
      currentUserId: currentSession?.user?.id,
      incomingVersion: payload.version,  // ✅ FIX FINAL: Sem fallback
      isSameSession: currentSession?.access_token === payload.access_token
    }
  };
}

// ================================
// VALIDAÇÃO SEGURA DE VERSION (PATCH FINAL)
// Retorna null em vez de throw - FSM nunca quebra
// ================================
function getValidVersion(payload, context) {
  const v = payload?.version;

  if (v == null) {
    console.error('[AuthFSM] Missing version', context, payload);
    return null;
  }

  const n = Number(v);

  if (!Number.isInteger(n)) {
    console.error('[AuthFSM] Invalid version (not integer)', context, v);
    return null;
  }

  return n;
}

// ✅ CICLO 3.2.4: Extrair eventId de forma padronizada
function getEventId(event) {
  // Prioridade: event.id > payload.eventId > payload.meta.eventId
  return event?.id || event?.payload?.eventId || event?.payload?.meta?.eventId || null;
}

// ================================
// NORMALIZAÇÃO OBRIGATÓRIA DE SESSÃO (CORREÇÃO PERSISTÊNCIA)
// Garante formato consistente antes de qualquer dispatch SESSION_RESTORED
// ================================
function normalizeSessionRestore(session, sessionBus, options = {}) {
  if (!session) return null;

  // Extrair user de vários formatos possíveis
  const user = session.user || (session.userId ? { id: session.userId } : null);
  if (!user?.id) {
    console.error('[normalizeSessionRestore] Invalid session: missing user.id');
    return null;
  }

  // Extrair tokens
  const access_token = session.access_token || session.accessToken;
  const refresh_token = session.refresh_token || session.refreshToken;
  const expires_at = session.expires_at || session.expiresAt;

  if (!access_token) {
    console.error('[normalizeSessionRestore] Invalid session: missing access_token');
    return null;
  }

  // 🔑 CRÍTICO: garantir consistência de versão
  // Prioridade: session.version > sessionBus.vectorClock > Date.now()
  const version = session.version ?? sessionBus?.checkpoint?.lastSeq ?? Date.now();

  const normalized = {
    type: 'SESSION_RESTORED',
    payload: {
      user: {
        id: user.id,
        email: user.email || session.email || null
      },
      access_token,
      refresh_token: refresh_token || '',
      expires_at: expires_at || null,
      expires_in: session.expires_in || null,
      token_type: session.token_type || 'bearer',

      // 🔑 CRÍTICO: version obrigatório para validação
      version,

      // Metadados de rastreamento
      source: options.source || 'rehydration',
      reason: options.reason || 'session_restore',
      authoritative: options.authoritative || false,
      normalizedAt: Date.now(),
      tabId: sessionBus?.tabId || null
    }
  };

  console.log('[normalizeSessionRestore] Session normalized:', {
    userId: user.id,
    hasAccessToken: !!access_token,
    version,
    source: normalized.payload.source
  });

  return normalized;
}

// ✅ SOURCE OF TRUTH: Autoridade absoluta de sessão (Supabase)
// Função pura - consulta backend diretamente, sem depender de estado FSM
async function getAuthoritativeSession(supabase) {
  // Default de retorno (garante nunca retornar undefined/null)
  const defaultResult = {
    hasSession: false,
    userId: null,
    accessToken: null,
    expiresAt: null,
    isValid: false,
    _meta: {
      source: 'fallback',
      hadError: false,
      expirySource: 'none'
    }
  };

  // Guard: supabase não disponível
  if (!supabase?.auth?.getSession) {
    return defaultResult;
  }

  try {
    const { data, error } = await supabase.auth.getSession();

    // Erro de API - retorna default (não quebra fluxo)
    if (error) {
      console.error('[AUTH SOURCE] Failed to fetch session', error);
      return { ...defaultResult, _meta: { ...defaultResult._meta, hadError: true } };
    }

      // Extrair session com segurança
    const session = data?.session;

    // Guard: sem session
    if (!session) {
      return { ...defaultResult, _meta: { ...defaultResult._meta, source: 'supabase' } };
    }

    // Extrair access_token (obrigatório para hasSession = true)
    const accessToken = session.access_token || null;

    // Guard: sem access_token = sem sessão válida
    if (!accessToken) {
      return { ...defaultResult, _meta: { ...defaultResult._meta, source: 'supabase' } };
    }

    // Extrair userId com segurança
    const userId = session.user?.id || null;

    // Extrair expiresAt (prioridade: session.expires_at > JWT exp)
    let expiresAt = null;
    let expirySource = 'none';

    if (session.expires_at && typeof session.expires_at === 'number') {
      // Usar expires_at da session (epoch seconds)
      expiresAt = session.expires_at;
      expirySource = 'session';
    } else if (accessToken && typeof accessToken === 'string') {
      // Fallback: extrair 'exp' do JWT (último recurso)
      // ✔️ VALIDAÇÃO ESTRUTURAL: JWT deve ter 3 partes separadas por '.'
      const jwtParts = accessToken.split('.');
      if (jwtParts.length === 3) {
        try {
          const base64Url = jwtParts[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const jwtPayload = JSON.parse(jsonPayload);
          if (jwtPayload.exp && typeof jwtPayload.exp === 'number') {
            expiresAt = jwtPayload.exp; // JWT exp é epoch seconds
            expirySource = 'jwt';
          }
        } catch (jwtError) {
          // Silencioso: falha no parsing do JWT não quebra fluxo
        }
      }
    }

    // ✔️ CORREÇÃO CRÍTICA: isValid evita falso negativo
    // Se não conseguimos provar que expirou, assumimos válido
    const now = Math.floor(Date.now() / 1000);
    const hasSession = true;
    const hasValidExpiry = typeof expiresAt === 'number';
    const isValid = hasSession && (!hasValidExpiry || expiresAt > now);

    return {
      hasSession,
      userId,
      accessToken,
      expiresAt,
      isValid,
      _meta: {
        source: 'supabase',
        hadError: false,
        expirySource
      }
    };

  } catch (unexpectedError) {
    // Captura qualquer erro inesperado - nunca quebra fluxo
    console.error('[AUTH SOURCE] Failed to fetch session', unexpectedError);
    return { ...defaultResult, _meta: { ...defaultResult._meta, hadError: true } };
  }
}

// ✅ DIVERGENCE DETECTOR: Detecção pura de inconsistência FSM vs Backend
// Função PURA - sem side effects, sem logs, sem alteração de estado
function detectAuthDivergence(fsmState, authoritativeSession) {
  // Normalizar entradas (defensivo)
  const safeFsm = {
    state: fsmState?.state || 'UNAUTHENTICATED',
    userId: fsmState?.userId || null,
    hasSession: Boolean(fsmState?.hasSession)
  };

  const safeBackend = {
    hasSession: Boolean(authoritativeSession?.hasSession),
    userId: authoritativeSession?.userId || null,
    isValid: Boolean(authoritativeSession?.isValid)
  };

  const meta = authoritativeSession?._meta || { source: 'unknown', hadError: false, expirySource: 'none' };

  // Resultado base (sem divergência)
  const noDivergence = {
    hasDivergence: false,
    type: null,
    severity: null,
    details: {
      fsmState: safeFsm,
      backendState: safeBackend,
      meta
    }
  };

  // Verificar consistência básica
  const fsmAuthenticated =
    safeFsm.state === 'AUTHENTICATED' ||
    safeFsm.state === 'FIRST_LOGIN_REQUIRED';
  const fsmHasUser = safeFsm.userId != null;
  const backendHasSession = safeBackend.hasSession;
  const backendValid = safeBackend.isValid;

  // === DETECÇÃO DE DIVERGÊNCIA ===

  // 1. FSM_AUTHENTICATED_BACKEND_NULL
  // FSM pensa que está autenticado, mas backend não tem sessão
  if (fsmAuthenticated && !backendHasSession) {
    return {
      hasDivergence: true,
      type: 'FSM_AUTHENTICATED_BACKEND_NULL',
      severity: 'high',
      details: {
        fsmState: safeFsm,
        backendState: safeBackend,
        meta
      }
    };
  }

  // 2. FSM_NULL_BACKEND_AUTHENTICATED
  // FSM pensa que não está autenticado, mas backend tem sessão válida
  if (!fsmAuthenticated && backendHasSession && backendValid) {
    return {
      hasDivergence: true,
      type: 'FSM_NULL_BACKEND_AUTHENTICATED',
      severity: 'high',
      details: {
        fsmState: safeFsm,
        backendState: safeBackend,
        meta
      }
    };
  }

  // 3. USER_MISMATCH
  // Ambos têm sessão, mas userIds diferentes
  if (fsmAuthenticated && backendHasSession && fsmHasUser) {
    if (safeFsm.userId !== safeBackend.userId) {
      return {
        hasDivergence: true,
        type: 'USER_MISMATCH',
        severity: 'high',
        details: {
          fsmState: safeFsm,
          backendState: safeBackend,
          meta
        }
      };
    }
  }

  // 4. SESSION_INVALID_BACKEND
  // FSM autenticado, backend tem sessão mas é inválida (expirada)
  if (fsmAuthenticated && backendHasSession && !backendValid) {
    return {
      hasDivergence: true,
      type: 'SESSION_INVALID_BACKEND',
      severity: 'medium',
      details: {
        fsmState: safeFsm,
        backendState: safeBackend,
        meta
      }
    };
  }

  // 5. UNKNOWN_INCONSISTENCY
  // Qualquer outro caso inesperado (edge cases)
  // Ex: FSM sem userId mas autenticado, ou backend tem sessão sem userId
  if (fsmAuthenticated && backendHasSession) {
    if (!fsmHasUser || !safeBackend.userId) {
      return {
        hasDivergence: true,
        type: 'UNKNOWN_INCONSISTENCY',
        severity: 'low',
        details: {
          fsmState: safeFsm,
          backendState: safeBackend,
          meta
        }
      };
    }
  }

  // Sem divergência detectada
  return noDivergence;
}

// ✅ AUTO-HEALING: Correção determinística de estado FSM alinhada ao backend
// Backend é a fonte de verdade absoluta - FSM é apenas projeção local
async function autoHealAuthState({
  fsm,
  supabase,
  getAuthoritativeSession,
  detectAuthDivergence,
  context = {}
}) {
  // ✅ DETERMINÍSTICO: Gate primário - FSM deve estar hydrated
  if (!fsm._hydrated) {
    console.log('[AUTO_HEAL] Deferred - FSM not hydrated (snapshot not applied)');
    return {
      healed: false,
      action: 'DEFERRED',
      divergenceType: null,
      severity: null,
      reason: 'boot_not_hydrated'
    };
  }

  // Proteção contra loop: throttle de 1 segundo
  const now = Date.now();
  if (fsm._lastHealTimestamp && (now - fsm._lastHealTimestamp < 1000)) {
    return {
      healed: false,
      action: 'THROTTLED',
      divergenceType: null,
      severity: null
    };
  }

  try {
    // 1. Obter estado atual da FSM
    const fsmState = {
      state: fsm.state,
      userId: fsm.session?.user?.id || null,
      hasSession: Boolean(fsm.session)
    };

    // 2. Obter sessão autoritativa do backend
    const authoritativeSession = await getAuthoritativeSession(supabase);

    // ✅ GATE DE HYDRATION LEGACY: manter para compatibilidade
    // Hydration = onAuthStateChange observado + SessionBus replay completo + sessão autoritativa resolvida
    if (!fsm._backendHydrated) {
      console.log('[AUTO_HEAL] Deferred - awaiting backend hydration (onAuthStateChange)');
      return {
        healed: false,
        action: 'DEFERRED',
        divergenceType: null,
        severity: null,
        reason: 'backend_not_hydrated'
      };
    }
    if (!fsm._sessionBusReady) {
      console.log('[AUTO_HEAL] Deferred - awaiting SessionBus replay');
      return {
        healed: false,
        action: 'DEFERRED',
        divergenceType: null,
        severity: null,
        reason: 'sessionbus_not_ready'
      };
    }
    // ✅ CORREÇÃO: Terceiro gate - sessão autoritativa deve estar resolvida
    // Durante postHydration, sempre executar mesmo sem flag (verificação já ocorreu)
    if (!fsm._authoritativeSessionResolved && !context?.postHydration) {
      console.log('[AUTO_HEAL] Deferred - awaiting authoritative session resolution');
      return {
        healed: false,
        action: 'DEFERRED',
        divergenceType: null,
        severity: null,
        reason: 'session_not_resolved'
      };
    }

    // ✅ CORREÇÃO DEFINITIVA: Quarto gate - sincronização inicial deve estar completa
    // Auto-heal NÃO pode corrigir ausência de sessão antes do sync inicial
    if (!fsm._initialSyncCompleted) {
      console.log('[AUTO_HEAL] Deferred - awaiting initial sync from SessionBus');
      return {
        healed: false,
        action: 'DEFERRED',
        divergenceType: null,
        severity: null,
        reason: 'initial_sync_not_completed'
      };
    }

    // 3. Detectar divergência
    let divergence = detectAuthDivergence(fsmState, authoritativeSession);

    // ✅ DOWNGRADE DE SEVERITY DURANTE BOOT
    // FSM_NULL_BACKEND_AUTHENTICATED durante boot pode ser timing, não erro crítico
    if (context?.trigger === 'boot' && divergence.type === 'FSM_NULL_BACKEND_AUTHENTICATED') {
      divergence = {
        ...divergence,
        severity: 'medium', // downgrade de high → medium
        _meta: { ...divergence._meta, severityDowngraded: true, reason: 'boot_timing' }
      };
    }

    // 4. Sem divergência → nada a fazer
    if (!divergence.hasDivergence) {
      return {
        healed: false,
        action: 'NO_ACTION',
        divergenceType: null,
        severity: null
      };
    }

    // Log de diagnóstico (antes de agir)
    console.warn('[AUTO_HEAL]', {
      divergenceType: divergence.type,
      severity: divergence.severity,
      fsmState,
      backendMeta: authoritativeSession._meta,
      context
    });

    // 5. Executar ação determinística baseada no tipo de divergência
    let action = null;

    switch (divergence.type) {
      // 🔴 HIGH SEVERITY: FSM autenticado, backend sem sessão
      // Backend é a verdade - FSM precisa alinhar via RESTORE (ou logout)
      case 'FSM_AUTHENTICATED_BACKEND_NULL':
        action = 'REQUIRES_RESTORE';  // ✅ Fallback necessário
        break;

      // 🔴 HIGH SEVERITY: FSM deslogado, backend com sessão válida
      // ✅ HEALED: Auto-heal pode corrigir diretamente via dispatch
      case 'FSM_NULL_BACKEND_AUTHENTICATED':
        action = 'HEALED';
        // ✅ CORREÇÃO CRÍTICA: Usar normalização obrigatória para garantir formato consistente
        const normalizedEvent = normalizeSessionRestore(
          {
            user: { id: authoritativeSession.userId },
            access_token: authoritativeSession.accessToken,
            refresh_token: authoritativeSession._meta?.refreshToken,
            expires_at: authoritativeSession.expiresAt
          },
          fsm.sessionBus,
          {
            source: 'auto_heal_rehydration',
            reason: 'divergence_detected',
            authoritative: true
          }
        );

        if (normalizedEvent) {
          fsm.dispatch(normalizedEvent);
        } else {
          console.error('[AUTO_HEAL] Failed to normalize session for restore');
          action = 'NO_ACTION';
        }
        break;

      // 🔴 HIGH SEVERITY: UserIds diferentes = risco de vazamento
      // ✅ HEALED: Auto-heal corrige via FORCE_LOGOUT
      case 'USER_MISMATCH':
        action = 'HEALED';
        fsm.dispatch({
          type: 'FORCE_LOGOUT',
          payload: {
            reason: 'user_mismatch',
            divergenceType: divergence.type,
            fsmUserId: fsmState.userId,
            backendUserId: authoritativeSession.userId,
            authoritative: true
          }
        });
        break;

      // 🟠 MEDIUM SEVERITY: Sessão expirada no backend
      // ✅ HEALED: Auto-heal corrige via FORCE_LOGOUT
      case 'SESSION_INVALID_BACKEND':
        action = 'HEALED';
        fsm.dispatch({
          type: 'FORCE_LOGOUT',
          payload: {
            reason: 'session_expired_backend',
            divergenceType: divergence.type,
            authoritative: true
          }
        });
        break;

      // 🟡 LOW SEVERITY: Inconsistência desconhecida
      case 'UNKNOWN_INCONSISTENCY':
        // NÃO corrigir automaticamente - apenas reportar
        action = 'NO_ACTION';
        console.warn('[AUTO_HEAL] Unknown inconsistency - manual intervention may be needed', {
          divergence,
          fsmState,
          authoritativeSession
        });
        break;

      default:
        action = 'NO_ACTION';
        console.warn('[AUTO_HEAL] Unhandled divergence type', divergence.type);
    }

    // Atualizar timestamp de último healing
    fsm._lastHealTimestamp = Date.now();

    // ✅ PADRONIZAÇÃO: healed = true apenas quando ação foi executada
    const wasHealed = action === 'HEALED';

    return {
      healed: wasHealed,
      action,
      divergenceType: divergence.type,
      severity: divergence.severity
    };

  } catch (error) {
    // Falha no healing não quebra o sistema
    console.error('[AUTO_HEAL] Healing failed', error);
    return {
      healed: false,
      action: 'ERROR',
      divergenceType: null,
      severity: null
    };
  }
}

window.AuthFSM = class AuthFSM {
  // 🎯 EXECUTION MODEL: AuthFSM é PASSIVO - não inicia efeitos colaterais
  // Todas as inicializações ativas devem ser feitas via BootOrchestrator + EAL
  constructor(sessionBus, supabase, bootId = null) {
    this.sessionBus = sessionBus;
    this.supabase = supabase;

    // ================================
    // 🎯 FASE 2.6.1: LIFECYCLE STATE ONLY (ZERO SIDE-EFFECTS)
    // ================================
    this.__lifecycle = {
      initialized: false,
      active: false,
      listenersBound: false,
      timersStarted: false,
      createdAt: Date.now(),
      bootId: bootId || this._generateBootId(),
      instanceId: this._generateInstanceId()
    };

    this.__bindings = {
      onVisibility: this._onVisibility.bind(this),
      onFocus: this._onFocus.bind(this),
      onLoad: this._onLoad.bind(this),
      onSupabaseAuthChange: this._onSupabaseAuthChange.bind(this)
    };

    this.__timers = {
      fallbackHydration: null
    };

    this.__subscriptions = {
      supabaseAuth: null
    };

    // ✅ FASE 1: EventLedger - Sistema central de registro
    // 🎯 FASE 3.0 INSTRUMENTAÇÃO: Detectar ledger ausente no constructor
    if (!window.__EVENT_LEDGER__) {
      console.warn('[INVARIANT][AuthFSM] EventLedger ausente no momento do constructor');
    }
    this._ledger = window.__EVENT_LEDGER__ || window.EventLedger?.getInstance();
    if (!this._ledger) {
      console.warn('[AuthFSM] ⚠️ EventLedger não disponível - eventos não serão registrados');
    } else {
      console.log('[AuthFSM] ✅ EventLedger conectado');
    }

    // ESTADO PURO - apenas representação, não orquestração
    this.state = AuthState.UNAUTHENTICATED;
    this.session = null;
    this.error = null;
    this.listeners = new Set();

    // ✅ I3: Versionamento via globalSeq (não Date.now())
    // Inicializa em 0, será atualizado pelo primeiro evento válido
    this.sessionVersion = 0;
    this.sessionSource = this.tabId;

    // ✅ I6: Deduplicação baseada em version (não TTL)
    // Apenas compara incoming.version <= current.version

    // 🎯 EAL GATE: Listeners e repair devem ser configurados via BootOrchestrator
    // NÃO chamar setupBusListener() ou setupRepairMechanism() aqui
    // ❌ REMOVIDO: Heartbeat agressivo (I8 - usa apenas repair coordenado)
    
    // ✅ FIX 4: Boot phase tracking para getStableState
    this.bootPhase = 'INIT';      // 'INIT' | 'RESTORING' | 'STABLE'
    this.bootPhaseVersion = 0;    // Version da fase
    this.stableStateLocked = false; // Estado estável já foi alcançado?
    
    // ✅ FIX 4: STATE MERGE DETERMINÍSTICO (CRDT-lite)
    this.mergeRules = {
      // Regra 1: logout > login sempre
      logoutDominates: true,
      // Regra 2: expired session > restored session
      expiredDominates: true,
      // Regra 3: maior auth entropy vence
      entropyScoring: true
    };
    
    // Histórico de estados para resolução de conflitos
    this.stateHistory = []; // Array de {state, timestamp, version, source}

    // ✅ CICLO 3: Deduplicação de repairSession
    this._repairRunning = false;

    // ✅ CICLO 3.2.1: Causalidade baseada em version (não timestamp)
    this._lastAuthEvent = {
      type: null,
      version: 0
    };

    // ✅ CICLO 3.2.4: Deduplicação por identidade de evento (HARDENED FINAL)
    // Buffer unificado: eventId → version (protege contra replay + version mismatch)
    this._processedEvents = new Map();      // key: eventId, value: version
    this._processedEventQueue = [];           // ordem para eviction FIFO
    this._processedVersions = new Set();      // tracking de versions (anti-colisão)
    this._maxProcessedEvents = 100;

    // ✅ AUTO-HEAL: Proteção contra loop de healing
    this._lastHealTimestamp = 0;
    this._autoHealPromise = null;  // ✅ Promise deduplication (join, not skip)

    // ✅ HYDRATION FLAGS: Só decidir após backend e SessionBus estarem prontos
    this._backendHydrated = false;  // onAuthStateChange observado
    this._sessionBusReady = false;   // SessionBus replay completo
    this._authoritativeSessionResolved = false; // getAuthoritativeSession completado
    this._pendingSessionBusTrigger = false; // SessionBus aguardando backend

    // ✅ DETERMINÍSTICO: Estado inicial via snapshot síncrono (não evento)
    this._hydrated = false; // Snapshot aplicado = decisão de estado final tomada
    this._initialSyncCompleted = false; // SESSION_BUS_INITIAL_SYNC processado (cross-tab)

    // 🎯 FASE 2.6.1: PASSIVE MODE - Nenhum listener ou timer ativo no constructor
    // _setupHydrationListener() será chamado via activateLifecycle()

    console.log('[AuthFSM] constructed (PASSIVE MODE):', {
      instanceId: this.__lifecycle.instanceId,
      bootId: this.__lifecycle.bootId,
      timestamp: this.__lifecycle.createdAt
    });
  }

  // ================================
  // 🎯 FASE 2.6.1: LIFECYCLE EXPLÍCITO
  // ================================
  activateLifecycle() {
    if (this.__lifecycle.active) {
      console.log('[AuthFSM] lifecycle already active');
      return;
    }

    console.log('[AuthFSM] activating lifecycle...');

    this._bindListeners();
    this._startTimers();

    this.__lifecycle.active = true;
    this.__lifecycle.initialized = true;

    console.log('[AuthFSM] lifecycle ACTIVE');
  }

  deactivateLifecycle() {
    console.log('[AuthFSM] deactivating lifecycle...');

    // Remove listeners
    if (this.__lifecycle.listenersBound) {
      document.removeEventListener('visibilitychange', this.__bindings.onVisibility);
      window.removeEventListener('focus', this.__bindings.onFocus);
      window.removeEventListener('load', this.__bindings.onLoad);
      
      // Unsubscribe Supabase auth
      this.__subscriptions.supabaseAuth?.unsubscribe?.();
      this.__subscriptions.supabaseAuth = null;
      
      this.__lifecycle.listenersBound = false;
    }

    // Stop timers
    if (this.__timers.fallbackHydration) {
      clearTimeout(this.__timers.fallbackHydration);
      this.__timers.fallbackHydration = null;
    }
    if (this.__timers.sessionExpiryCheck) {
      clearInterval(this.__timers.sessionExpiryCheck);
      this.__timers.sessionExpiryCheck = null;
    }
    this.__lifecycle.timersStarted = false;

    this.__lifecycle.active = false;

    console.log('[AuthFSM] lifecycle DEACTIVATED');
  }

  _bindListeners() {
    if (this.__lifecycle.listenersBound) return;

    // Setup hydration listener (Supabase auth)
    this._setupHydrationListener();

    // Repair mechanism listeners
    document.addEventListener('visibilitychange', this.__bindings.onVisibility);
    window.addEventListener('focus', this.__bindings.onFocus);
    window.addEventListener('load', this.__bindings.onLoad);

    this.__lifecycle.listenersBound = true;
    console.log('[AuthFSM] listeners bound');
  }

  _startTimers() {
    if (this.__lifecycle.timersStarted) return;

    // Fallback hydration timeout (30s)
    this.__timers.fallbackHydration = setTimeout(() => {
      if (!this._backendHydrated) {
        this._backendHydrated = true;
        console.log('[HYDRATION] Fallback - marking hydrated after timeout');
        this._triggerPostHydrationAutoHeal('timeout');
      }
      this.__subscriptions.supabaseAuth?.unsubscribe?.();
    }, 30000);

    // ✅ TIMER PERIÓDICO: Verificar expiração da sessão a cada 60s
    // Isso previne sessão expirada quando usuário está inativo
    this.__timers.sessionExpiryCheck = setInterval(() => {
      this._checkSessionExpiryPeriodic();
    }, 60000); // 60 segundos

    this.__lifecycle.timersStarted = true;
    console.log('[AuthFSM] timers started (incl. session expiry check)');
  }

  // ✅ MÉTODO PERIÓDICO: Verifica se sessão está perto de expirar e tenta refresh
  async _checkSessionExpiryPeriodic() {
    // Só verificar se estiver autenticado e ativo
    if (this.state !== AuthState.AUTHENTICATED || !this.session) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = this.session.expires_at;

    if (!expiresAt) {
      return; // Sessão sem expiração (não deveria acontecer)
    }

    const expiresIn = expiresAt - now;

    // Se faltam menos de 5 minutos, tentar refresh
    if (expiresIn < 300) {
      console.log('[AuthFSM] Periodic check: session near expiry, attempting refresh', {
        expiresIn,
        expiresAt,
        now
      });

      // Usar o mesmo mecanismo de refresh do TOKEN_EXPIRED
      // Mas só se não estiver já em processo de refresh
      if (this.state !== AuthState.SESSION_REFRESHING) {
        await this._handleTokenExpiredWithRefresh();
      }
    }
  }

  // 🎯 FASE 2.6.1: Handler methods (bound in constructor)
  _onVisibility() {
    if (!document.hidden) {
      this.runAutoHeal({ trigger: 'visibilitychange' });
    }
  }

  _onFocus() {
    this.runAutoHeal({ trigger: 'focus' });
  }

  _onLoad() {
    this.runAutoHeal({ trigger: 'load' });
  }

  _onSupabaseAuthChange(event, session) {
    // ✅ FASE 1: REGISTRAR EVENTO SUPABASE NO LEDGER
    let supabaseLedgerEntry = null;
    if (this._ledger) {
      supabaseLedgerEntry = this._ledger.append({
        eventType: `SUPABASE_${event}`,
        payload: {
          event,
          hasSession: !!session,
          userId: session?.user?.id,
          expiresAt: session?.expires_at
        },
        source: 'Supabase',
        metadata: {
          supabaseEvent: event,
          fsmInstanceId: this.__lifecycle?.instanceId,
          trigger: 'onAuthStateChange'
        }
      });
    }
    
    if (!this._backendHydrated) {
      this._backendHydrated = true;
      console.log('[HYDRATION] Backend hydrated via onAuthStateChange:', { event, hasSession: !!session });
      // ✅ RE-TRIGGER: Reavaliar auto-heal após hydration
      this._triggerPostHydrationAutoHeal('onAuthStateChange', { event, hasSession: !!session, ledgerEventId: supabaseLedgerEntry?.eventId });
    }
  }

  _generateBootId() {
    return `boot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateInstanceId() {
    return `fsm_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
  }

  // ✅ HYDRATION LISTENER: Observa primeiro onAuthStateChange do Supabase
  // Hydration só é verdadeira quando evento é observado, não quando getSession resolve
  // 🎯 FASE 2.6.1: Agora chamado via _bindListeners() em activateLifecycle()
  _setupHydrationListener() {
    if (!this.supabase?.auth?.onAuthStateChange) {
      console.warn('[HYDRATION] Supabase auth not available, marking as hydrated');
      this._backendHydrated = true;
      // Forçar reavaliação imediata
      this._triggerPostHydrationAutoHeal('no_supabase');
      return;
    }

    // Listener único para marcar hydration completa
    const { data: { subscription } } = this.supabase.auth.onAuthStateChange(this.__bindings.onSupabaseAuthChange);
    
    // Store subscription for cleanup
    this.__subscriptions.supabaseAuth = subscription;

    // 🎯 FASE 2.6.1: Timer movido para _startTimers()
    // Cleanup automático após 30s (fallback) agora gerenciado pelo lifecycle
  }

  // ✅ FORCE INITIAL CHECK: Garante que não perdemos evento que já ocorreu
  async _forceInitialSessionCheck() {
    try {
      const { data, error } = await this.supabase.auth.getSession();

      // ✅ CORREÇÃO: Marcar que sessão autoritativa foi verificada
      this._authoritativeSessionResolved = true;
      const hasSession = !!data?.session;

      if (!this._backendHydrated) {
        this._backendHydrated = true;
        console.log('[HYDRATION] Forced session check complete', {
          hasSession,
          error: !!error
        });
        // ✅ RE-TRIGGER: Reavaliar após verificação forçada
        this._triggerPostHydrationAutoHeal('forced_check', { hasSession });
      }

      // ✅ CORREÇÃO: Se SessionBus estava aguardando backend, executar agora
      if (this._pendingSessionBusTrigger && this._sessionBusReady) {
        console.log('[HYDRATION] Executing pending SessionBus trigger');
        this._pendingSessionBusTrigger = false;
        await this.runAutoHeal({
          trigger: 'hydration_sessionbus_pending',
          force: true,
          postHydration: true,
          hasSession
        });
      }
    } catch (e) {
      console.error('[HYDRATION] Force initial check failed:', e);
      this._authoritativeSessionResolved = true; // Marcar mesmo em erro
      if (!this._backendHydrated) {
        this._backendHydrated = true;
        this._triggerPostHydrationAutoHeal('forced_check_error');
      }
    }
  }

  // ✅ REATIVIDADE: Trigger de reavaliação após hydration
  async _triggerPostHydrationAutoHeal(source, meta = {}) {
    console.log('[HYDRATION] Triggering post-hydration auto-heal:', { source, ...meta });

    // ✅ CORREÇÃO: SEMPRE reavaliar após hydration completa
    // Garantir convergência determinística independente do estado atual
    await this.runAutoHeal({
      trigger: `hydration_${source}`,
      force: true,
      postHydration: true,
      hasSession: meta?.hasSession  // Passar info de sessão para contexto
    });
  }

  // ✅ MÉTODO PÚBLICO: SessionBus notifica quando replay está completo
  async markSessionBusReady() {
    if (this._sessionBusReady) return;
    this._sessionBusReady = true;
    console.log('[HYDRATION] SessionBus replay complete');

    // ✅ CORREÇÃO: Reavaliar auto-heal após SessionBus pronto
    // Sempre executar, mas com retry se backend ainda não hidratado
    if (this._backendHydrated) {
      await this.runAutoHeal({
        trigger: 'hydration_sessionbus',
        force: true,
        postHydration: true
      });
    } else {
      // Agendar retry quando backend hidratar
      console.log('[HYDRATION] SessionBus ready, awaiting backend hydration for auto-heal');
      this._pendingSessionBusTrigger = true;
    }
  }

  // ✅ PATCH 2: Gerar tabId único para tie-break
  get tabId() {
    if (!this._tabId) {
      this._tabId = `tab_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return this._tabId;
  }

  // Helper: verifica se sessão está expirada
  _isSessionExpired(session) {
    if (!session) return true;
    if (!session.expires_at) return false;
    return Math.floor(Date.now() / 1000) >= session.expires_at;
  }

  // =====================
  // REFRESH LOCK (single-tab coordination)
  // =====================
  async acquireRefreshLock() {
    const now = Date.now();

    try {
      const raw = localStorage.getItem(REFRESH_LOCK_KEY);
      const current = raw ? JSON.parse(raw) : null;

      // Lock expirado ou inexistente
      if (!current || now - current.ts > LOCK_TTL_MS) {
        const token = `${this.tabId}_${now}`;

        localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({
          token,
          ts: now
        }));

        // Verificação obrigatória (CAS pattern)
        const check = JSON.parse(localStorage.getItem(REFRESH_LOCK_KEY));
        return check?.token === token;
      }
    } catch (e) {
      console.warn('[AuthFSM] Lock acquisition error:', e);
    }

    return false;
  }

  releaseRefreshLock() {
    try {
      localStorage.removeItem(REFRESH_LOCK_KEY);
    } catch (e) {
      console.warn('[AuthFSM] Lock release error:', e);
    }
  }

  // =====================
  // SESSION VALIDATION (tri-state: VALID, INVALID, REFRESHED)
  // =====================
  async validateSession(session) {
    if (!session || !session.user) {
      return ValidationResult.INVALID;
    }

    // Verifica se token está expirado
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);

    if (expiresAt && now >= expiresAt) {
      console.log('[AuthFSM] Session expired');
      return ValidationResult.INVALID;
    }

    // Próximo da expiração: tenta refresh silencioso (com lock)
    const expiresIn = expiresAt ? expiresAt - now : 3600;
    
    // INSTRUMENTAÇÃO: Log de verificação de expiração
    console.log('[REFRESH CHECK]', {
      expiresIn,
      expiresAt,
      now,
      threshold: 300,
      willRefresh: expiresIn < 300,
      timestamp: Date.now()
    });
    
    if (expiresIn < 300) { // < 5 minutos
      console.log('[AuthFSM] Session near expiry, attempting refresh');

      // Tenta adquirir lock (apenas 1 aba faz refresh)
      const hasLock = await this.acquireRefreshLock();

      if (!hasLock) {
        // Outra aba vai fazer refresh → aguarda via SessionBus
        console.log('[AuthFSM] Refresh locked by another tab, waiting');
        // Retorna VALID para não bloquear boot - SessionBus vai sincronizar
        return ValidationResult.VALID;
      }

      try {
        // INSTRUMENTAÇÃO: Antes de chamar REFRESH_SESSION
        console.log('[REFRESH SESSION START]', {
          timestamp: Date.now(),
          currentState: this.state,
          bootState: this.bootState,
          hasExistingSession: !!this.session
        });

        // ✅ PATCH FINAL: Cancelamento forte com version
        const startState = this.state;
        const startVersion = this.sessionVersion;
        const abortController = new AbortController();
        this._currentAbortController = abortController;

        // EffectRunner é a ÚNICA camada que fala com Supabase
        const result = await this.effectRunner.run('REFRESH_SESSION', {}, { signal: abortController.signal });

        // ✅ PATCH FINAL: Validação TRIPLO pós-async (abort + state + version)
        if (abortController.signal.aborted || this.state !== startState || this.sessionVersion !== startVersion) {
          console.log('[AuthFSM] Refresh cancelled - abort signal or state changed');
          return ValidationResult.INVALID; // Operação cancelada
        }

        // INSTRUMENTAÇÃO: Após REFRESH_SESSION
        console.log('[REFRESH SESSION END]', {
          timestamp: Date.now(),
          ok: result?.ok
        });

        // ✅ FIX: SessionBus emitiu SESSION_RESTORED - FSM será notificada via subscribe()
        // Retornar REFRESHED imediatamente (session atualizada async via bus)
        if (result?.ok) {
          console.log('[AuthFSM] Session refresh emitted via SessionBus');
          return ValidationResult.REFRESHED;
        }

        console.warn('[AuthFSM] Refresh failed, session invalid');
        return ValidationResult.INVALID;
      } catch (e) {
        console.warn('[AuthFSM] Refresh error:', e);
        return ValidationResult.INVALID;
      } finally {
        // ✅ PATCH FINAL: Limpar abort controller e lock
        this._currentAbortController = null;
        this.releaseRefreshLock();
      }
    }

    return ValidationResult.VALID;
  }

  // =====================
  // TOKEN EXPIRED HANDLER com refresh automático
  // =====================
  async _handleTokenExpiredWithRefresh() {
    console.log('[AuthFSM] _handleTokenExpiredWithRefresh - starting refresh attempt');

    // Tenta adquirir lock (apenas 1 aba faz refresh)
    const hasLock = await this.acquireRefreshLock();

    if (!hasLock) {
      // Outra aba vai fazer refresh → aguarda via SessionBus
      console.log('[AuthFSM] Refresh locked by another tab, waiting for SESSION_RESTORED');
      // Fica em SESSION_REFRESHING aguardando evento de outra aba
      // Se não receber em tempo, o timeout abaixo vai deslogar
      this._tokenRefreshTimeout = setTimeout(() => {
        console.warn('[AuthFSM] Timeout waiting for cross-tab refresh, logging out');
        this.session = null;
        this.transitionTo(AuthState.UNAUTHENTICATED);
        this.emitStateChange();
      }, 10000); // 10s timeout
      return;
    }

    try {
      // INSTRUMENTAÇÃO: Antes de chamar REFRESH_SESSION
      console.log('[TOKEN EXPIRED REFRESH START]', {
        timestamp: Date.now(),
        currentState: this.state,
        hasExistingSession: !!this.session
      });

      // ✅ PATCH: Cancelamento forte com version
      const startState = this.state;
      const startVersion = this.sessionVersion;
      const abortController = new AbortController();
      this._currentAbortController = abortController;

      // EffectRunner é a ÚNICA camada que fala com Supabase
      const result = await this.effectRunner.run('REFRESH_SESSION', {}, { signal: abortController.signal });

      // ✅ PATCH: Validação TRIPLO pós-async (abort + state + version)
      if (abortController.signal.aborted || this.state !== startState || this.sessionVersion !== startVersion) {
        console.log('[AuthFSM] Token expired refresh cancelled - abort signal or state changed');
        return;
      }

      // INSTRUMENTAÇÃO: Após REFRESH_SESSION
      console.log('[TOKEN EXPIRED REFRESH END]', {
        timestamp: Date.now(),
        ok: result?.ok
      });

      // ✅ FIX: SessionBus emitiu SESSION_RESTORED - FSM será notificada via subscribe()
      // Não precisamos fazer nada aqui - o evento SESSION_RESTORED vai atualizar o estado
      if (result?.ok) {
        console.log('[AuthFSM] Token expired refresh successful - awaiting SESSION_RESTORED');
        // Limpar timeout se existir (de outra aba)
        if (this._tokenRefreshTimeout) {
          clearTimeout(this._tokenRefreshTimeout);
          this._tokenRefreshTimeout = null;
        }
        return;
      }

      // Refresh falhou - fazer logout
      console.warn('[AuthFSM] Token expired refresh failed, logging out');
      this.session = null;
      this.transitionTo(AuthState.UNAUTHENTICATED);
      this.emitStateChange();
    } catch (e) {
      console.warn('[AuthFSM] Token expired refresh error:', e);
      this.session = null;
      this.transitionTo(AuthState.UNAUTHENTICATED);
      this.emitStateChange();
    } finally {
      // ✅ PATCH: Limpar abort controller e lock
      this._currentAbortController = null;
      this.releaseRefreshLock();
      if (this._tokenRefreshTimeout) {
        clearTimeout(this._tokenRefreshTimeout);
        this._tokenRefreshTimeout = null;
      }
    }
  }

  // =====================
  // DEPENDENCY INJECTION (desacoplado)
  // =====================
  connectSessionBus(sessionBus) {
    // ✅ FIX IDEMPOTÊNCIA: Evitar múltiplas conexões
    if (this._sessionBusConnected) {
      console.log('[AuthFSM] SessionBus already connected, skipping');
      return;
    }
    
    this.sessionBus = sessionBus;
    this.setupBusListener();
    this._sessionBusConnected = true;
    
    console.log('[AuthFSM] SessionBus connected');
  }

  setEffectRunner(effectRunner) {
    this.effectRunner = effectRunner;
  }

  // =====================
  // EVENT ROUTER (entrada única) - FASE 1: EventLedger integrado
  // =====================
  async dispatch(event, payload, ledgerContext = {}) {
    // 🎯 FASE 3.0 INSTRUMENTAÇÃO: Detectar uso prematuro
    if (!this.__lifecycle?.active && !this._hydrated) {
      console.warn('[INVARIANT][AuthFSM] dispatch antes de estar pronto', {
        event,
        active: this.__lifecycle?.active,
        hydrated: this._hydrated
      });
    }
    
    // ✅ PATCH FINAL: Ignorar EFFECT_ERROR (HARD IGNORE)
    if (event === 'EFFECT_ERROR') {
      return; // HARD IGNORE
    }

    // ✅ FASE 1: REGISTRO OBRIGATÓRIO NO LEDGER
    let ledgerEntry = null;
    if (this._ledger) {
      ledgerEntry = this._ledger.append({
        eventType: event,
        payload: payload,
        source: ledgerContext.source || 'FSM',
        correlationId: ledgerContext.correlationId,
        parentEventId: ledgerContext.parentEventId,
        metadata: {
          fsmState: this.state,
          fsmBootState: this.bootState,
          fsmInstanceId: this.__lifecycle?.instanceId,
          fsmHydrated: this._hydrated,
          dispatchMethod: 'AuthFSM.dispatch'
        }
      });
    }

    // Atualiza timestamp de atividade de evento
    this._lastEventAt = Date.now();

    // INSTRUMENTAÇÃO: Log estruturado do dispatch
    console.log('[FSM DISPATCH]', {
      event,
      timestamp: Date.now(),
      currentState: this.state,
      bootState: this.bootState,
      hasSession: !!this.session,
      userId: this.session?.user?.id,
      fromStack: new Error().stack.split('\n')[2]?.trim(),
      // ✅ FASE 1: Ledger tracking
      ledgerEventId: ledgerEntry?.eventId,
      ledgerCorrelationId: ledgerEntry?.correlationId
    });

    // ✅ FASE 2: CONSTRUIR META COM LEDGER INFO PARA HANDLERS
    const meta = {
      eventId: ledgerEntry?.eventId,
      correlationId: ledgerEntry?.correlationId,
      parentEventId: ledgerEntry?.parentEventId,
      source: ledgerContext.source || 'FSM'
    };

    switch (this.state) {
      case AuthState.UNAUTHENTICATED:
        return this.handleUnauthenticated(event, payload, meta);

      case AuthState.AUTHENTICATING:
        return this.handleAuthenticating(event, payload, meta);

      case AuthState.AUTHENTICATED:
        return this.handleAuthenticated(event, payload, meta);

      case AuthState.FIRST_LOGIN_REQUIRED:
        return this.handleFirstLoginRequired(event, payload, meta);

      case AuthState.SESSION_RESTORING:
        return this.handleRestoring(event, payload, meta);

      case AuthState.SESSION_REFRESHING:
        return this.handleRefreshing(event, payload, meta);

      case AuthState.LOGOUT_PENDING:
        return this.handleLogout(event, payload, meta);

      case AuthState.ERROR:
        return this.handleError(event, payload, meta);

      default:
        console.warn(`[AuthFSM] Estado desconhecido: ${this.state}`);
    }
  }

  // =====================
  // STATE HANDLERS
  // =====================

  // UNAUTHENTICATED: estado inicial, aceita login ou restore
  async handleUnauthenticated(event, payload, meta) {
    // ✅ CORREÇÃO DEFINITIVA: Sincronização inicial obrigatória via SessionBus
    if (event === AuthEvent.SESSION_BUS_INITIAL_SYNC) {
      console.log('[FSM INITIAL_SYNC] Receiving initial sync from SessionBus:', {
        hasSession: !!payload?.session,
        userId: payload?.session?.user?.id,
        isAuthoritative: payload?.meta?.authoritative
      });

      // Marcar sync como completado
      this._initialSyncCompleted = true;

      // Se tem sessão válida, autenticar imediatamente
      if (payload?.session?.user?.id && payload?.session?.access_token) {
        console.log('[FSM INITIAL_SYNC] Session found - transitioning to AUTHENTICATED');

        this.session = {
          user: payload.session.user,
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token,
          expires_at: payload.session.expires_at,
          expires_in: payload.session.expires_in,
          token_type: payload.session.token_type || 'bearer'
        };
        this.state = AuthState.AUTHENTICATED;
        this._sessionVersion = payload.session.version || Date.now();
        this._backendHydrated = true;

        // Persistir no localStorage para consistência cross-tab
        localStorage.setItem('auth_session', JSON.stringify({
          user: payload.session.user,
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token,
          expires_at: payload.session.expires_at,
          expires_in: payload.session.expires_in,
          token_type: payload.session.token_type,
          version: this._sessionVersion,
          source: 'initial_sync'
        }));

        // Notificar listeners
        this._notifyListeners(AuthState.AUTHENTICATED, this.session);

        console.log('[FSM INITIAL_SYNC] Converged to AUTHENTICATED');
        return;
      }

      // Se não tem sessão, permanecer UNAUTHENTICATED (estado correto)
      console.log('[FSM INITIAL_SYNC] No session - staying UNAUTHENTICATED');
      this.state = AuthState.UNAUTHENTICATED;
      this.session = null;
      this._notifyListeners(AuthState.UNAUTHENTICATED, null);
      return;
    }

    if (event === AuthEvent.LOGIN_REQUEST) {
      // FASE 2: LOG DO FLUXO DE LOGIN - antes
      console.log('[LOGIN FLOW]', {
        before: this.getState(),
        event: 'LOGIN_REQUEST',
        payload: { email: payload?.email }
      });

      this.transitionTo(AuthState.AUTHENTICATING);

      // ✅ PATCH FINAL: Cancelamento forte com version
      const startState = this.state;
      const startVersion = this.sessionVersion;
      const abortController = new AbortController();
      this._currentAbortController = abortController;

      // EffectRunner é a ÚNICA camada que fala com Supabase
      const result = await this.effectRunner.run('LOGIN', payload, { signal: abortController.signal });

      // ✅ PATCH FINAL: Validação TRIPLO pós-async (abort + state + version)
      if (abortController.signal.aborted || this.state !== startState || this.sessionVersion !== startVersion) {
        console.log('[AuthFSM] Login cancelled - abort signal or state changed');
        this._currentAbortController = null;
        return; // Operação cancelada, não faz nada
      }

      // FASE 2: LOG DO RESULTADO DO LOGIN
      console.log('[LOGIN RESULT]', {
        event: result?.event,
        hasPayload: !!result?.payload,
        userId: result?.payload?.user?.id,
        hasAccessToken: !!result?.payload?.access_token,
        expiresAt: result?.payload?.expires_at
      });

      // Guard crítico: verifica se effect retornou sucesso
      if (!result || result.event !== 'LOGIN_OK') {
        return this.dispatch(AuthEvent.LOGIN_FAIL, {
          error: result?.payload?.error || 'Login falhou'
        }, { source: 'FSM', parentEventId: meta?.eventId });
      }

      // Segundo guard: valida sessão completa (user + access_token)
      const session = result.payload;
      if (!session?.user || !session?.access_token) {
        console.error('[AuthFSM] LOGIN_OK received but session invalid:', {
          hasUser: !!session?.user,
          hasToken: !!session?.access_token
        });
        return this.dispatch(AuthEvent.LOGIN_FAIL, {
          error: 'Sessão inválida (sem token de acesso)'
        }, { source: 'FSM', parentEventId: meta?.eventId });
      }

      // ✅ PATCH FINAL: Limpar abort controller após operação bem-sucedida
      this._currentAbortController = null;
      return this.dispatch(AuthEvent.LOGIN_SUCCESS, result.payload, { source: 'FSM', parentEventId: meta?.eventId });
    }

    if (event === AuthEvent.SESSION_RESTORED) {
      // FASE 3: LOG DA VALIDAÇÃO DA TRANSICAO
      console.log('[FSM SESSION_RESTORED] Payload recebido:', JSON.stringify({
        hasPayload: !!payload,
        hasUser: !!payload?.user,
        userId: payload?.user?.id,
        hasAccessToken: !!payload?.access_token,
        hasExpiresAt: !!payload?.expires_at,
        expiresAt: payload?.expires_at,
        currentState: this.state,
        bootState: this.bootState
      }, null, 2));

      // 🔒 VALIDAÇÃO (via função pura)
      const validation = validateSessionPayload(payload, this.session);

      if (!validation.valid) {
        if (validation.reason === 'expired') {
          console.warn('[AuthFSM] Ignoring SESSION_RESTORED - session expired');
          return this.dispatch(AuthEvent.SESSION_NOT_FOUND, { reason: 'session_expired' });
        }
        console.warn('[AuthFSM] Ignoring SESSION_RESTORED - invalid payload (missing user.id, access_token, or expires_at)');
        return;
      }

      // 🔒 IDEMPOTÊNCIA + VERSIONAMENTO MONOTÔNICO: evita stale session overwrite
      const {
        incomingUserId,
        currentUserId,
        incomingVersion,
        isSameSession
      } = validation.data;
      const currentVersion = this.sessionVersion;

      // 🔒 IDEMPOTÊNCIA: só aplica FORA do boot (evita duplicidade quando já está pronto)
      if (
        this.bootState === 'READY' &&
        isSameSession &&
        this.state === AuthState.AUTHENTICATED
      ) {
        console.log('[AuthFSM] Ignoring SESSION_RESTORED - already authenticated with same session');
        return;
      }

      // 🔒 Só bloqueia se fora do boot e já autenticado com mesmo usuário
      if (
        this.bootState === 'READY' &&
        this.state === AuthState.AUTHENTICATED &&
        currentUserId === incomingUserId
      ) {
        // Se versão atual é mais recente (monotonic version), ignora evento
        if (incomingVersion && currentVersion && incomingVersion <= currentVersion) {
          console.log('[AuthFSM] Ignoring SESSION_RESTORED - current version is newer or same');
          return;
        }
        console.log('[AuthFSM] Ignoring SESSION_RESTORED - already authenticated with same user');
        return;
      }

      // FASE 3: LOG DA TRANSICAO PARA AUTHENTICATED
      console.log('[FSM TRANSITION] >>> AUTHENTICATED <<<', JSON.stringify({
        reason: 'SESSION_RESTORED validado',
        userId: payload?.user?.id,
        expiresAt: payload?.expires_at,
        bootState: this.bootState,
        previousState: this.state
      }, null, 2));

      // ✅ PATCH FINAL: Validação segura - sem throw
      const newVersion = getValidVersion(payload, 'SESSION_RESTORED');
      if (newVersion == null) return;
      this.sessionVersion = newVersion;

      this.session = payload;
      this.transitionTo(AuthState.AUTHENTICATED);
      this.emitStateChange();
    }

    // ✅ INVARIANTE 3: LOGIN_OK de outra aba → tratar como SESSION_RESTORED
    if (event === 'LOGIN_OK') {
      console.log('[FSM LOGIN_OK] Cross-tab login received:', {
        userId: payload?.user?.id,
        hasAccessToken: !!payload?.access_token,
        version: payload?.version
      });

      // 🔒 VALIDAÇÃO (via função pura)
      const validation = validateSessionPayload(payload, this.session);

      if (!validation.valid) {
        console.warn('[AuthFSM] Ignoring LOGIN_OK - invalid payload');
        return;
      }

      const { incomingVersion, isSameSession } = validation.data;
      const currentVersion = this.sessionVersion;

      // 🔒 IDEMPOTÊNCIA: evita reprocessar mesmo login
      if (isSameSession && this.state === AuthState.AUTHENTICATED) {
        console.log('[AuthFSM] Ignoring LOGIN_OK - already authenticated with same session');
        return;
      }

      // 🔒 VERSIONAMENTO: só aplica se version é mais recente
      if (incomingVersion && currentVersion && incomingVersion <= currentVersion) {
        console.log('[AuthFSM] Ignoring LOGIN_OK - version stale');
        return;
      }

      // ✅ PATCH FINAL: Validação segura - sem throw
      const newVersion = getValidVersion(payload, 'LOGIN_OK');
      if (newVersion == null) return;
      this.sessionVersion = newVersion;

      this.session = payload;
      this.transitionTo(AuthState.AUTHENTICATED, 'LOGIN_OK');
      this.emitStateChange();
      return;
    }

    // ✅ I7: LOGOUT_OK - sempre vence quando version >= current
    if (event === 'LOGOUT_OK') {
      console.log('[FSM LOGOUT_OK] Cross-tab logout received');

      // ✅ PATCH FINAL: Cancelamento forte com version
      if (this._currentAbortController) {
        this._currentAbortController.abort();
        this._currentAbortController = null;
      }
      if (this.effectRunner) {
        this.effectRunner.cancel('REFRESH_SESSION');
      }

      // ✅ PATCH FINAL: Validação segura - LOGOUT também precisa de version
      const incomingVersion = getValidVersion(payload, 'LOGOUT_OK');
      if (incomingVersion == null) return;

      // ✅ I7: LOGOUT é exceção - sempre processa se version >= current
      // (inclusive igual - LOGOUT invalida sessão independentemente)
      if (incomingVersion < this.sessionVersion) {
        console.log('[AuthFSM] Ignoring LOGOUT_OK - version stale');
        return;
      }

      // 🔒 IDEMPOTÊNCIA: evita transição redundante
      if (this.state === AuthState.UNAUTHENTICATED && !this.session) {
        console.log('[AuthFSM] Ignoring LOGOUT_OK - already unauthenticated');
        return;
      }

      // ✅ PATCH FINAL: Validação segura - sem throw
      const newVersion = getValidVersion(payload, 'LOGOUT_OK');
      if (newVersion == null) return;
      this.sessionVersion = newVersion;

      this.session = null;
      this.error = null;
      // Permanece em UNAUTHENTICATED
      return;
    }

    // SESSION_NOT_FOUND: state snapshot, não requer version
    if (event === AuthEvent.SESSION_NOT_FOUND) {
      // Cancelamento de operações pendentes
      if (this._currentAbortController) {
        this._currentAbortController.abort();
        this._currentAbortController = null;
      }
      if (this.effectRunner) {
        this.effectRunner.cancel('REFRESH_SESSION');
      }

      // IDEMPOTÊNCIA: evita transição redundante se já está desautenticado
      if (this.state === AuthState.UNAUTHENTICATED && !this.session) {
        console.log('[AuthFSM] Ignoring SESSION_NOT_FOUND - already unauthenticated');
        return;
      }

      // State snapshot: não atualiza sessionVersion (não é GLOBAL_ORDERED)
      this.session = null;
    }
  }

  // AUTHENTICATING: durante execução de login
  async handleAuthenticating(event, payload, meta) {
    // DEBUG: Log de entrada no handler
    console.log('[AUTHENTICATING HANDLER]', {
      event,
      hasPayload: !!payload,
      payloadKeys: payload ? Object.keys(payload) : null,
      hasExpiresAt: !!payload?.expires_at,
      hasUser: !!payload?.user,
      hasAccessToken: !!payload?.access_token,
      currentState: this.state
    });

    if (event === AuthEvent.LOGIN_SUCCESS) {
      // Validação DEVE ocorrer ANTES da transição (mantém FSM determinística)

      // Validação 1: sessão deve ter expiração válida
      console.log('[AuthFSM] Validando expires_at:', payload?.expires_at);
      if (!payload?.expires_at) {
        console.error('[AuthFSM] LOGIN_SUCCESS but session has no expires_at');
        return this.dispatch(AuthEvent.LOGIN_FAIL, {
          error: 'Sessão sem expiração válida'
        }, { source: 'FSM', parentEventId: meta?.eventId });
      }

      // Validação 2: sessão não pode estar já expirada (com margem de segurança para clock drift)
      const CLOCK_SKEW = 30; // segundos de tolerância para diferença cliente/servidor
      const now = Math.floor(Date.now() / 1000);
      if (payload.expires_at <= now + CLOCK_SKEW) {
        console.error('[AuthFSM] LOGIN_SUCCESS but session already expired:', {
          expiresAt: payload.expires_at,
          now: now,
          skew: CLOCK_SKEW
        });
        return this.dispatch(AuthEvent.LOGIN_FAIL, {
          error: 'Sessão expirada imediatamente após login'
        }, { source: 'FSM', parentEventId: meta?.eventId });
      }

      // Só transiciona se todas as validações passarem
      const previousState = this.state;  // FASE 3: capturar estado anterior
      this.session = payload;
      this.error = null;

      // ✅ FIX 1: SessionBus é a ÚNICA fonte de version
      // FSM apenas CONSOME version que virá no payload do evento broadcast
      // NUNCA gera version localmente

      this.transitionTo(AuthState.AUTHENTICATED, 'LOGIN_SUCCESS');

      // FASE 3: LOG DE TRANSIÇÃO DE ESTADO
      console.log('[FSM TRANSITION]', {
        from: previousState,
        to: this.state,
        event: 'LOGIN_SUCCESS',
        valid: previousState === 'AUTHENTICATING' && this.state === 'AUTHENTICATED'
      });

      // FASE 2: LOG FSM APÓS LOGIN
      console.log('[FSM AFTER LOGIN]', {
        state: this.state,
        isAuthenticated: this.state === AuthState.AUTHENTICATED,
        userId: this.session?.user?.id,
        hasAccessToken: !!this.session?.access_token,
        expiresAt: this.session?.expires_at
      });

      // ✅ FIX P0: Não emitir diretamente — SessionBus propaga via LOGIN_OK
      // Outras abas recebem evento canônico com version automático
      this.emitStateChange();
    }

    if (event === AuthEvent.LOGIN_FAIL) {
      // ✅ PATCH FINAL: Cancelamento forte com version
      this._currentAbortController = null;
      this.error = payload.error;
      this.session = null;
      this.transitionTo(AuthState.ERROR);
      this.emitStateChange();
    }
  }

  // AUTHENTICATED: usuário logado, aceita logout ou refresh
  async handleAuthenticated(event, payload, meta) {
    if (event === AuthEvent.LOGOUT_REQUEST) {
      // FASE 4: LOG DO FLUXO DE LOGOUT - antes
      console.log('[LOGOUT TEST]', {
        before: this.getState(),
        userId: this.session?.user?.id
      });

      this.transitionTo(AuthState.LOGOUT_PENDING);

      // Guarda userId antes de limpar sessão (para validação em outras abas)
      const currentUserId = this.session?.user?.id;

      // EffectRunner é a ÚNICA camada que fala com Supabase
      const result = await this.effectRunner.run('LOGOUT');

      if (result?.event === 'LOGOUT_ERROR') {
        console.warn('[AuthFSM] Logout error:', result.payload?.error);
      }

      this.session = null;
      this.error = null;

      // ✅ FIX 1: SessionBus é a ÚNICA fonte de version
      // FSM NUNCA gera version localmente

      this.transitionTo(AuthState.UNAUTHENTICATED);

      // FASE 4: LOG APÓS LOGOUT
      console.log('[LOGOUT TEST]', {
        after: this.getState(),
        isUnauthenticated: this.state === AuthState.UNAUTHENTICATED,
        sessionCleared: !this.session
      });

      // ✅ FIX P0: Não emitir diretamente — SessionBus propaga via LOGOUT_OK
      // Outras abas recebem evento canônico com version automático
      this.emitStateChange();
    }

    if (event === AuthEvent.TOKEN_EXPIRED) {
      console.log('[AuthFSM] TOKEN_EXPIRED received - attempting session refresh');
      this.transitionTo(AuthState.SESSION_REFRESHING);

      // ✅ IMPLEMENTAÇÃO: Tentar refresh automático antes de deslogar
      this._handleTokenExpiredWithRefresh();
      // Não emitir state change aqui - será emitido após refresh async
    }

    // ✅ INVARIANTE 3: LOGOUT_OK de outra aba (logout cross-tab)
    if (event === 'LOGOUT_OK') {
      console.log('[FSM LOGOUT_OK] Cross-tab logout received in AUTHENTICATED state');

      const incomingVersion = payload?.version;
      const currentVersion = this.sessionVersion;

      // 🔒 VALIDAÇÃO: só processa logout se userId corresponder
      const currentUserId = this.session?.user?.id;
      const incomingUserId = payload?.user?.user?.id;
      if (incomingUserId && currentUserId && incomingUserId !== currentUserId) {
        console.log('[AuthFSM] Ignoring LOGOUT_OK - userId mismatch');
        return;
      }

      // 🔒 VERSIONAMENTO: verifica se version é mais recente
      if (incomingVersion && currentVersion && incomingVersion < currentVersion) {
        console.log('[AuthFSM] Ignoring LOGOUT_OK - version stale');
        return;
      }

      // ✅ PATCH FINAL: Validação segura - sem throw
      const newVersion = getValidVersion(payload, 'LOGOUT_OK');
      if (newVersion == null) return;
      this.sessionVersion = newVersion;

      this.session = null;
      this.error = null;
      this.transitionTo(AuthState.UNAUTHENTICATED, 'LOGOUT_OK');

      this.emitStateChange();
      return;
    }

    // Multi-tab sync: outra aba fez login (com validação + idempotência)
    if (event === AuthEvent.SESSION_RESTORED) {
      // 🔒 VALIDAÇÃO (via função pura)
      const validation = validateSessionPayload(payload, this.session);

      if (!validation.valid) {
        if (validation.reason === 'expired') {
          console.warn('[AuthFSM] Ignoring SESSION_RESTORED - session expired');
          return this.dispatch(AuthEvent.SESSION_NOT_FOUND, { reason: 'session_expired' });
        }
        console.warn('[AuthFSM] Ignoring SESSION_RESTORED - invalid payload (missing user.id, access_token, or expires_at)');
        return;
      }

      const {
        incomingUserId,
        currentUserId,
        incomingVersion,
        isSameSession
      } = validation.data;
      const currentVersion = this.sessionVersion;

      // 🔒 IDEMPOTÊNCIA: evita duplicidade quando já está autenticado
      if (
        isSameSession &&
        this.state === AuthState.AUTHENTICATED
      ) {
        console.log('[AuthFSM] Ignoring SESSION_RESTORED - already authenticated with same session');
        return;
      }

      // 🔒 VERSIONAMENTO: evita autenticação duplicada
      if (
        this.state === AuthState.AUTHENTICATED &&
        currentUserId === incomingUserId
      ) {
        if (incomingVersion && currentVersion && incomingVersion <= currentVersion) {
          console.log('[AuthFSM] Ignoring SESSION_RESTORED - version stale');
          return;
        }
      }

      // ✅ PATCH FINAL: Validação segura - sem throw
      const newVersion = getValidVersion(payload, 'SESSION_RESTORED');
      if (newVersion == null) return;
      this.sessionVersion = newVersion;

      // Só processa se está desautenticado ou usuário diferente
      if (this.state === AuthState.UNAUTHENTICATED || currentUserId !== incomingUserId) {
        this.session = payload;
        this.emitStateChange();
      }
    }
  }

  // FIRST_LOGIN_REQUIRED: usuário autenticado mas precisa trocar senha
  async handleFirstLoginRequired(event, payload, meta) {
    // 🎯 FASE 2: Handler completo para FIRST_LOGIN_REQUIRED

    if (event === AuthEvent.LOGOUT_REQUEST) {
      this.transitionTo(AuthState.LOGOUT_PENDING);
      return;
    }

    // 🎯 FASE 2: Transição para AUTHENTICATED após troca de senha
    if (event === AuthEvent.PASSWORD_CHANGED) {
      console.log('[AuthFSM] PASSWORD_CHANGED → transicionando para AUTHENTICATED');
      this.transitionTo(AuthState.AUTHENTICATED);
      return { status: 'transition', to: AuthState.AUTHENTICATED };
    }

    // Ignorar todos os outros eventos para manter estabilidade
    return { status: 'ignored', reason: 'FIRST_LOGIN_REQUIRED_restriction' };
  }

  // SESSION_RESTORING: durante boot, verifica sessão existente
  async handleRestoring(event, payload, meta) {
    if (event === AuthEvent.SESSION_RESTORED) {
      // 🔒 VALIDAÇÃO (via função pura)
      const validation = validateSessionPayload(payload, this.session);

      if (!validation.valid) {
        if (validation.reason === 'expired') {
          console.warn('[AuthFSM] Ignoring SESSION_RESTORED - session expired');
          return this.dispatch(AuthEvent.SESSION_NOT_FOUND, { reason: 'session_expired' });
        }
        console.warn('[AuthFSM] Ignoring SESSION_RESTORED - invalid payload (missing user.id, access_token, or expires_at)');
        return;
      }

      // 🔒 IDEMPOTÊNCIA + VERSIONAMENTO MONOTÔNICO: evita stale session overwrite
      const {
        incomingUserId,
        currentUserId,
        incomingVersion,
        isSameSession
      } = validation.data;
      const currentVersion = this.sessionVersion;

      // 🔒 IDEMPOTÊNCIA: evita duplicidade quando já está autenticado
      if (
        isSameSession &&
        this.state === AuthState.AUTHENTICATED
      ) {
        console.log('[AuthFSM] Ignoring SESSION_RESTORED - already authenticated with same session');
        return;
      }

      // 🔒 Evita autenticação duplicada com mesmo usuário
      if (
        this.state === AuthState.AUTHENTICATED &&
        currentUserId === incomingUserId
      ) {
        // Se versão atual é mais recente, ignora
        if (incomingVersion && currentVersion && incomingVersion <= currentVersion) {
          console.log('[AuthFSM] Ignoring SESSION_RESTORED - current version is newer or same');
          return;
        }
        console.log('[AuthFSM] Ignoring SESSION_RESTORED - already authenticated');
        return;
      }

      // ✅ PATCH FINAL: Validação segura - sem throw
      const newVersion = getValidVersion(payload, 'SESSION_RESTORED');
      if (newVersion == null) return;
      this.sessionVersion = newVersion;

      this.session = payload;
      this.transitionTo(AuthState.AUTHENTICATED);
      this.emitStateChange();
    }

    if (event === AuthEvent.SESSION_NOT_FOUND) {
      // IDEMPOTÊNCIA: evita transição redundante
      if (this.state === AuthState.UNAUTHENTICATED && !this.session) {
        console.log('[AuthFSM] Ignoring SESSION_NOT_FOUND - already unauthenticated');
        return;
      }

      // State snapshot: não atualiza sessionVersion
      this.session = null;
      this.transitionTo(AuthState.UNAUTHENTICATED);
      this.emitStateChange();
    }
  }

  // SESSION_REFRESHING: durante refresh de token
  async handleRefreshing(event, payload, meta) {
    // Placeholder para futura implementação
    console.log('[AuthFSM] Refreshing state - event:', event);
  }

  // LOGOUT_PENDING: durante execução de logout
  async handleLogout(event, payload, meta) {
    // Estado transitório - não aceita novos comandos
    console.log('[AuthFSM] Logout pending - ignoring event:', event);
  }

  // ERROR: estado de erro, pode retornar a UNAUTHENTICATED
  async handleError(event, payload, meta) {
    if (event === AuthEvent.LOGIN_REQUEST) {
      // Permite retry de login
      return this.handleUnauthenticated(event, payload, meta);
    }

    if (event === AuthEvent.SESSION_NOT_FOUND) {
      // IDEMPOTÊNCIA: evita transição redundante
      if (this.state === AuthState.UNAUTHENTICATED && !this.session) {
        this.error = null; // Limpa erro mesmo se já está desautenticado
        return;
      }

      // State snapshot: não atualiza sessionVersion
      this.error = null;
      this.session = null;
      this.transitionTo(AuthState.UNAUTHENTICATED);
      this.emitStateChange();
    }
  }

  // =====================
  // RESTORE_SESSION — MÉTODO PRIVADO (não usar diretamente)
  // =====================
  // ⚠️ RESTORE_SESSION só deve ser executado via:
  //   - runAutoHeal() (entrypoint global)
  //   - repairSession() (fallback)
  // ❌ PROIBIDO chamar diretamente no boot — usar bootAutoHeal()
  async _executeRestoreSession(context = {}) {
    // ✅ GUARD PREVENTIVO: não executar RESTORE se já autenticado
    if (this.state === AuthState.AUTHENTICATED && this.session?.access_token && !context.force) {
      console.log('[RESTORE_GUARD] Blocked: already authenticated');
      return { status: 'blocked', reason: 'already_authenticated' };
    }

    // ✅ PATCH FINAL: Cancelamento forte com version
    const startState = this.state;
    const startVersion = this.sessionVersion;
    const abortController = new AbortController();
    this._currentAbortController = abortController;

    // EffectRunner é a ÚNICA camada que fala com Supabase
    const result = await this.effectRunner.run('RESTORE_SESSION', {}, { signal: abortController.signal });

    // ✅ PATCH FINAL: Validação TRIPLO pós-async (abort + state + version)
    if (abortController.signal.aborted || this.state !== startState || this.sessionVersion !== startVersion) {
      console.log('[FSM RESTORE] Cancelled - abort signal or state/version changed');
      this._currentAbortController = null;
      return { status: 'cancelled' };
    }

    console.log('[FSM RESTORE] EffectRunner result:', JSON.stringify({
      ok: result?.ok
    }, null, 2));

    // ✅ FIX: SessionBus emitiu evento - FSM será notificada via subscribe()
    // NÃO fazer dispatch manual aqui
    if (!result?.ok) {
      // Apenas emitir SESSION_NOT_FOUND se effect falhou completamente
      // ✅ FASE 2: Usar último heal intent disponível ou null
      const healMeta = this._lastHealIntentEntry || {};
      await this.dispatch(AuthEvent.SESSION_NOT_FOUND, null, { 
        source: 'FSM', 
        parentEventId: healMeta?.eventId 
      });
    }
    // Se ok: SessionBus já emitiu SESSION_RESTORED, FSM vai receber via subscription

    // ✅ PATCH FINAL: Limpar abort controller após operação
    this._currentAbortController = null;
    console.log('[AuthFSM] Restore complete - state:', this.state);

    return { status: 'completed', event: result?.event };
  }

  // ✅ LEGACY: redirect para bootAutoHeal (não usar)
  async restoreSession() {
    console.warn('[RESTORE_GUARD] restoreSession() is deprecated — use bootAutoHeal()');
    return this.bootAutoHeal({ trigger: 'legacy_redirect' });
  }

  // =====================
  // ETAPA 2.7 + HARDENING: AUTO-HEAL COMO ENTRYPOINT GLOBAL
  // =====================

  // ✅ CONSTANTES DE HARDENING
  static HEAL_COOLDOWN = 1500; // ms - throttle entre execuções
  static STABLE_THRESHOLD = 5000; // ms - tempo mínimo para considerar estado estável

  // ✅ DETERMINÍSTICO: Aplicar snapshot síncrono no boot
  // FSM pura - decisões de negócio fora do FSM
  applySnapshot(session) {
    console.log('[FSM SNAPSHOT] Aplicando estado inicial:', {
      hasSession: !!session,
      userId: session?.user?.id,
      hasToken: !!session?.access_token
    });

    if (session?.access_token && session?.user?.id) {
      this.session = {
        user: session.user,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type || 'bearer'
      };
      this._sessionVersion = session.version || Date.now();
      this.state = AuthState.AUTHENTICATED;
      console.log('[FSM SNAPSHOT] → AUTHENTICATED');
    } else {
      this.state = AuthState.UNAUTHENTICATED;
      this.session = null;
      console.log('[FSM SNAPSHOT] → UNAUTHENTICATED');
    }

    this._hydrated = true;
    this._notifyListeners(this.state, this.session);

    console.log('[FSM SNAPSHOT] _hydrated = true');
    return { success: true, state: this.state };
  }

  // ✅ ENTRYPOINT GLOBAL: Único ponto de decisão determinístico
  // Usado por: triggers (focus, visibility), boot, e verificações manuais
  async runAutoHeal(context = {}) {
    // ✅ FASE 1: REGISTRAR INTENT DE AUTO-HEAL NO LEDGER
    let healIntentEntry = null;
    if (this._ledger) {
      healIntentEntry = this._ledger.append({
        eventType: 'AUTO_HEAL_INTENT',
        payload: {
          trigger: context.trigger,
          force: context.force,
          fsmState: this.state,
          hydrated: this._hydrated,
          backendHydrated: this._backendHydrated,
          sessionBusReady: this._sessionBusReady
        },
        source: 'AutoHeal',
        metadata: {
          autoHealContext: context,
          fsmInstanceId: this.__lifecycle?.instanceId
        }
      });
      // ✅ FASE 2: Armazenar para uso por métodos internos
      this._lastHealIntentEntry = healIntentEntry;
    }
    
    // ✅ DETERMINÍSTICO: Auto-heal NÃO pode atuar antes de hydration
    if (!this._hydrated) {
      console.log('[AUTO_HEAL] DEFERRED - FSM not hydrated yet');
      return { status: 'deferred', reason: 'boot_not_hydrated', ledgerEventId: healIntentEntry?.eventId };
    }

    // ✅ PROMISE DEDUPLICATION: join execução existente (não skip!)
    if (this._autoHealPromise) {
      console.log('[AUTO_HEAL] Joining existing execution');
      return this._autoHealPromise;
    }

    // ✅ THROTTLE TEMPORAL: evita bursts de chamadas
    const now = Date.now();
    const timeSinceLastHeal = now - this._lastHealTimestamp;
    if (timeSinceLastHeal < AuthFSM.HEAL_COOLDOWN && !context.force) {
      console.log('[AUTO_HEAL] Throttled:', { timeSinceLastHeal, cooldown: AuthFSM.HEAL_COOLDOWN });
      return { status: 'throttled_time', cooldownRemaining: AuthFSM.HEAL_COOLDOWN - timeSinceLastHeal, ledgerEventId: healIntentEntry?.eventId };
    }

    // ✅ SHORT-CIRCUIT PARA ESTADO ESTÁVEL
    // Se já está autenticado com sessão válida, assume consistência recente
    if (
      (this.state === AuthState.AUTHENTICATED || this.state === AuthState.FIRST_LOGIN_REQUIRED) &&
      this.session?.access_token &&
      timeSinceLastHeal < AuthFSM.STABLE_THRESHOLD &&
      !context.force &&
      context?.trigger !== 'boot'
    ) {
      console.log('[AUTO_HEAL] Stable skip - state consistent and recent');
      return { status: 'stable_skip', reason: 'authenticated_with_valid_session', ledgerEventId: healIntentEntry?.eventId };
    }

    console.log('[AUTO_HEAL] Entrypoint triggered:', context);

    // ✅ Criar promise compartilhada para deduplicação
    this._autoHealPromise = this._runAutoHealInternal(context, healIntentEntry);

    try {
      return await this._autoHealPromise;
    } finally {
      // Limpar promise APÓS conclusão
      this._autoHealPromise = null;
      // ✅ Atualizar timestamp APÓS execução (não antes)
      this._lastHealTimestamp = Date.now();
    }
  }

  // ✅ MÉTODO INTERNO: Execução real do auto-heal (extraído para promise deduplication)
  async _runAutoHealInternal(context = {}, healIntentEntry = null) {
    // ✅ FASE 1: Passar correlationId do intent para a execução
    const healContext = {
      ...context,
      _ledgerCorrelationId: healIntentEntry?.correlationId,
      _ledgerParentEventId: healIntentEntry?.eventId
    };
    
    const healResult = await autoHealAuthState({
      fsm: this,
      supabase: this.supabase,
      getAuthoritativeSession,
      detectAuthDivergence,
      context: healContext
    });

    // ✅ CASO 1: Sem divergência (estado consistente)
    if (healResult.action === 'NO_ACTION') {
      console.log('[AUTO_HEAL] No divergence detected - state is consistent');
      return { status: 'consistent' };
    }

    // ✅ CASO 2: Throttled (proteção de loop)
    if (healResult.action === 'THROTTLED') {
      return { status: 'throttled' };
    }

    // ✅ CASO 2.5: Deferred (backend não hidratado ainda)
    if (healResult.action === 'DEFERRED') {
      console.log('[AUTO_HEAL] Deferred - will retry when backend is ready');
      return { status: 'deferred', reason: healResult.reason };
    }

    // ✅ CASO 3: Já corrigido via dispatch (HEALED)
    if (healResult.healed || healResult.action === 'HEALED') {
      console.log('[AUTO_HEAL] Applied via dispatch:', {
        action: healResult.action,
        divergenceType: healResult.divergenceType
      });
      return { status: 'healed', ...healResult };
    }

    // ✅ CASO 4: REQUIRES_RESTORE (único caso que chama repairSession)
    // Fallback determinístico: apenas quando auto-heal explicitamente solicita
    if (healResult.action === 'REQUIRES_RESTORE') {
      console.log('[AUTO_HEAL] Requires restore:', healResult.divergenceType);
      return this.repairSession({
        reason: 'autoheal_requires_restore',
        divergenceType: healResult.divergenceType
      });
    }

    return { status: 'no_action' };
  }

  // ✅ MÉTODO DE BOOT CORRETO: Entrypoint único para inicialização
  // Substitui chamadas diretas de restoreSession() no boot
  async bootAutoHeal(context = {}) {
    console.log('[BOOT] Starting auto-heal based boot:', context);

    // ✅ PROMISE DEDUPLICATION: se já existe boot em andamento, join
    if (this._autoHealPromise && context?.trigger === 'boot') {
      console.log('[BOOT] Joining existing boot execution');
      return this._autoHealPromise;
    }

    // Durante boot, sempre executa (não aplica short-circuit)
    const result = await this.runAutoHeal({
      ...context,
      trigger: 'boot',
      force: true // Bypass short-circuit e throttle parcial
    });

    console.log('[BOOT] Auto-heal result:', result);

    // ✅ CASO DEFERRED: backend não hidratado ainda
    // Boot não pode tomar decisão - aguarda eventos (LOGIN_OK, SESSION_RESTORED)
    if (result.status === 'deferred') {
      console.log('[BOOT] Deferred - awaiting backend hydration via events');
      return {
        bootComplete: false,
        status: 'deferred',
        reason: result.reason,
        message: 'Awaiting backend hydration via SessionBus events'
      };
    }

    // Se não houve ação, o sistema está em estado inicial válido
    if (result.status === 'consistent' || result.status === 'stable_skip') {
      return { bootComplete: true, hadSession: false, action: 'no_session' };
    }

    // Se foi curado, retorna info da sessão restaurada
    if (result.status === 'healed') {
      return {
        bootComplete: true,
        hadSession: true,
        action: result.action,
        divergenceType: result.divergenceType
      };
    }

    return { bootComplete: true, status: result.status };
  }

  // =====================
  // REPAIR MECHANISM (INVARIANTE 5)
  // =====================
  // 🎯 FASE 2.6.1: setupRepairMechanism() foi integrado em _bindListeners()
  // Listeners agora registrados via activateLifecycle() para garantir determinismo
  setupRepairMechanism() {
    // ✅ DEPRECATED: Usar activateLifecycle() em vez deste método
    console.warn('[AuthFSM] setupRepairMechanism() is deprecated, use activateLifecycle()');
    // Forward para lifecycle se ainda não ativo
    if (!this.__lifecycle.active) {
      this.activateLifecycle();
    }
  }

  // ✅ ETAPA 2.7: REPAIR = executor puro (não decide, apenas executa)
  // Chamado apenas como fallback quando auto-heal não resolve
  async repairSession(context = {}) {
    // ✅ CICLO 3: Deduplicação
    if (this._repairRunning) {
      console.log('[GUARD] repairSession deduplicated');
      return { status: 'deduplicated' };
    }
    this._repairRunning = true;

    console.log('[REPAIR] Executing RESTORE_SESSION fallback:', context);

    try {
      // ✅ Não fazer repair durante operações críticas
      if (this.state === AuthState.AUTHENTICATING ||
          this.state === AuthState.SESSION_REFRESHING ||
          this.state === AuthState.LOGOUT_PENDING) {
        console.log('[REPAIR] Skipping - critical state:', this.state);
        return { status: 'skipped', reason: 'critical_state' };
      }

      // ✅ I8: Lock distribuído
      const hasLock = await this.acquireRepairLock();
      if (!hasLock) {
        console.log('[REPAIR] Lock held by another tab');
        return { status: 'skipped', reason: 'lock_held' };
      }

      // ✅ Executar RESTORE_SESSION via método privado (com guard preventivo)
      const result = await this._executeRestoreSession({ force: true });

      // ✅ Validação de resultado
      if (result.status === 'blocked') {
        console.log('[REPAIR] Blocked by guard - already authenticated');
        return { status: 'blocked', reason: 'already_authenticated' };
      }

      if (result.status === 'cancelled') {
        return { status: 'discarded', reason: 'state_changed' };
      }

      console.log('[REPAIR] RESTORE_SESSION complete:', result?.event);
      this.releaseRepairLock();

      return { status: 'executed', event: result?.event };

    } catch (e) {
      console.error('[REPAIR] Failed:', e);
      this.releaseRepairLock();
      return { status: 'error', error: e.message };
    } finally {
      this._currentAbortController = null;
      this._repairRunning = false;
    }
  }

  // =====================
  // CICLO 3.2: EVENT ADMISSION CONTROL (controle de admissão semântica)
  // =====================

  // ✅ CICLO 3.2.1: Atualizar tracking após aceitar evento
  _updateLastAuthEvent(eventType, payload) {
    const version = getValidVersion(payload, eventType);
    if (version != null) {
      this._lastAuthEvent = {
        type: eventType,
        version: version
      };
      console.log('[GUARD] Tracked auth event:', { type: eventType, version });
    }
  }

  shouldAcceptEvent(eventType, payload, currentState, eventId = null) {
    // ============================================================
    // CICLO 3.2.3 + 3.2.4: DOMINÂNCIA SEMÂNTICA + DETERMINISMO FORTE (HARDENED FINAL)
    // ORDEM DE VALIDAÇÃO (CRÍTICO - NÃO ALTERAR):
    // 1. version existe (hard fail)
    // 2. version válida (NaN check)
    // 3. eventId obrigatório (HARD REJECT se ausente)
    // 4. eventId duplicado (HARDENED 2.4.2)
    // 5. version duplicada (ETAPA 2.4.2 - anti-colisão)
    // 6. stale check (<= sessionVersion)
    // 7. logout absolute block (SESSION_RESTORED rejeitado após LOGOUT)
    // 8. user consistency
    // 9. regras específicas por evento (com reset no LOGIN_OK)
    // ============================================================

    // ========== 1. VERSION EXISTE (HARD REQUIREMENT - COM RETRY P/ REIDRATAÇÃO) ==========
    let rawVersion = getValidVersion(payload, eventType);

    // ✅ CORREÇÃO CRÍTICA: Permitir retry para eventos sem version durante reidratação
    if (rawVersion == null) {
      const isRehydration = payload?.source?.includes('rehydration') ||
                            payload?.reason === 'divergence_detected' ||
                            payload?.authoritative === true;

      if (isRehydration && eventType === 'SESSION_RESTORED') {
        console.warn('[GUARD] Version missing in rehydration - assigning fallback version');
        // Atribuir version fallback para permitir processamento
        rawVersion = Date.now();
        payload.version = rawVersion;
      } else {
        console.log('[GUARD] Event rejected: reason=missing_version_hard');
        return false;
      }
    }

    // ========== 2. VERSION VÁLIDA (DEFENSIVA) ==========
    const incomingVersion = Number(rawVersion);
    if (Number.isNaN(incomingVersion) || incomingVersion <= 0) {
      console.log('[GUARD] Event rejected: reason=invalid_version_format');
      return false;
    }

    // ========== 3. DEDUPLICAÇÃO POR EVENT ID (HARDENED FINAL - 2.4.2) ==========
    // HARD REJECT: eventos sem eventId são estruturalmente incorretos
    if (!eventId) {
      console.error('[GUARD] HARD REJECT: missing_event_id', { type: eventType });
      return false;
    }

    // Check duplicate eventId
    if (this._processedEvents.has(eventId)) {
      console.log('[GUARD] Event rejected: reason=duplicate_event_id', { eventId });
      return false;
    }

    // ========== 4. DUPLICATE VERSION CHECK (CRÍTICO - ETAPA 2.4.2) ==========
    // Mesma version com IDs diferentes = colisão semântica
    if (this._processedVersions.has(incomingVersion)) {
      console.log('[GUARD] Event rejected: reason=duplicate_version', {
        version: incomingVersion,
        eventId
      });
      return false;
    }

    // ========== 5. STALE CHECK (RIGOROSO) ==========
    if (incomingVersion <= this.sessionVersion) {
      console.log('[GUARD] Event rejected: reason=stale_version_strict');
      return false;
    }

    // ========== 7. LOGOUT ABSOLUTE BLOCK (DOMINÂNCIA SEMÂNTICA) ==========
    // Após LOGOUT, NENHUM SESSION_RESTORED é aceito — apenas LOGIN explícito
    if (this._lastAuthEvent.type === 'LOGOUT_OK') {
      // BLOQUEIO ABSOLUTO: SESSION_RESTORED sempre rejeitado após logout
      if (eventType === 'SESSION_RESTORED') {
        console.log('[GUARD] Event rejected: reason=logout_blocks_restore_absolute');
        return false;
      }

      // PERMITIDO: LOGIN_OK é a única forma de sair do estado pós-logout
      // ✅ FAST-PATH: aceita com validação mínima (version + payload básico)
      if (eventType === 'LOGIN_OK') {
        const v = getValidVersion(payload, eventType);
        if (v == null) {
          console.log('[GUARD] Event rejected: reason=missing_version_hard (fast-path)');
          return false;
        }
        if (!payload?.user?.id || !payload?.access_token) {
          console.log('[GUARD] Event rejected: reason=invalid_session_payload (fast-path)');
          return false;
        }
        console.log('[GUARD] Login accepted after logout (state reset)');
        return true; // ✅ EARLY RETURN (CRÍTICO)
      }
    }

    // ========== 5. CONSISTÊNCIA DE USUÁRIO (CRÍTICO) ==========
    // Evitar cross-user overwrite
    const currentUserId = this.session?.user?.id;
    const incomingUserId = payload?.user?.id || payload?.session?.user?.id;
    if (
      currentUserId &&
      incomingUserId &&
      currentUserId !== incomingUserId
    ) {
      console.log('[GUARD] Event rejected: reason=user_mismatch');
      return false;
    }

    // ========== 6. REGRAS ESPECÍFICAS POR EVENTO ==========
    switch (eventType) {
      case 'SESSION_RESTORED':
        // REJEITAR se: sessão inválida
        if (!payload?.user?.id || !payload?.access_token) {
          console.log('[GUARD] Event rejected: reason=invalid_session_payload');
          return false;
        }

        // ACEITAR
        return true;

      case 'LOGIN_OK':
        // REJEITAR se: sessão inválida
        if (!payload?.user?.id || !payload?.access_token) {
          console.log('[GUARD] Event rejected: reason=invalid_session_payload');
          return false;
        }

        // ACEITAR
        return true;

      case 'LOGOUT_OK':
        // REJEITAR se: FSM já está UNAUTHENTICATED sem sessão (idempotência)
        if (currentState === AuthState.UNAUTHENTICATED && !this.session) {
          console.log('[GUARD] Event rejected: reason=already_unauthenticated');
          return false;
        }

        // ACEITAR (LOGOUT tem prioridade)
        return true;

      default:
        // Eventos não listados: aceitar (mantém comportamento atual)
        return true;
    }
  }

  // =====================
  // I6: DEDUPLICATION BASEADA EM VERSION (NÃO TTL)
  // =====================
  shouldProcessByVersion(incomingVersion) {
    // ✅ I6: Rejeita se version <= current (inclusive igual)
    // Isto garante idempotência e ordering correto
    if (incomingVersion <= this.sessionVersion) {
      console.log('[DEDUP] Ignoring - version', incomingVersion, '<= current', this.sessionVersion);
      return false;
    }
    return true;
  }

  // =====================
  // FIX 4: REPAIR COM COORDENAÇÃO (LOCK DISTRIBUÍDO COM TTL)
  // =====================
  async acquireRepairLock() {
    const key = 'auth_repair_lock';
    const now = Date.now();
    const token = `${this.tabId}_${now}`;
    const LOCK_TTL_MS = 5000; // 5 segundos

    try {
      // ✅ FIX 4: Verificar se lock existe e está válido
      const existing = localStorage.getItem(key);
      if (existing) {
        const [_, timestamp] = existing.split('_');
        const lockAge = now - Number(timestamp);
        // Se lock é mais velho que TTL, considera órfão e pode ser recuperado
        if (lockAge < LOCK_TTL_MS) {
          console.log('[REPAIR LOCK] Lock held by another tab, age:', lockAge, 'ms');
          return false;
        }
        console.log('[REPAIR LOCK] Lock orphaned (age:', lockAge, 'ms), reclaiming');
      }

      // Tenta adquirir lock
      localStorage.setItem(key, token);
      // Yield para permitir que outras abas tentem (race condition window)
      await new Promise(r => setTimeout(r, 50));
      const current = localStorage.getItem(key);
      const acquired = current === token;
      if (acquired) {
        console.log('[REPAIR LOCK] Acquired by', this.tabId.slice(0, 8));
      }
      return acquired;
    } catch (e) {
      console.error('[REPAIR LOCK] Error:', e);
      return false;
    }
  }

  releaseRepairLock() {
    const key = 'auth_repair_lock';
    const current = localStorage.getItem(key);
    // Só remove se o lock é nosso
    if (current && current.startsWith(this.tabId)) {
      localStorage.removeItem(key);
      console.log('[REPAIR LOCK] Released by', this.tabId.slice(0, 8));
    }
  }

  // =====================
  // SESSION BUS INTEGRATION (I5: Transporte Puro)
  // =====================
  setupBusListener() {
    // Guard: sessionBus pode ser null inicialmente
    if (!this.sessionBus) {
      console.log('[AuthFSM] sessionBus not set yet, skipping bus listener setup');
      return;
    }

    // ✅ I5: Subscribe pattern (transporte puro)
    this.sessionBus.subscribe((event) => {
      // ✅ PATCH: Processar eventos locais e cross-tab (idempotência via version)
      // Removido check de tabId - o próprio tab deve processar seus eventos

      // ✅ PATCH FINAL: Gate único - rejeitar eventos inválidos
      if (!event || !event.payload) {
        console.error('[AuthFSM] Dropping invalid event', event);
        return;
      }

      // ✅ PATCH FINAL: Validação segura de version
      const v = getValidVersion(event.payload, event.type);
      if (v == null) return;

      if (v <= this.sessionVersion) return;

      // Extrair eventId para deduplicação
      const eventId = getEventId(event);

      // ✅ CICLO 3.2: EVENT ADMISSION CONTROL (controle de admissão semântica)
      if (!this.shouldAcceptEvent(event.type, event.payload, this.state, eventId)) {
        // Log já emitido dentro de shouldAcceptEvent
        return;
      }

      console.log('[GUARD] Event accepted:', { type: event.type, state: this.state, eventId });

      // ✅ CICLO 3.2.4: Atualizar tracking de deduplicação SOMENTE após aceitação (HARDENED FINAL)
      // Registra tanto eventId quanto version (consistência total)
      if (eventId) {
        const incomingVersion = getValidVersion(event.payload, event.type);

        this._processedEvents.set(eventId, incomingVersion);
        this._processedVersions.add(incomingVersion);
        this._processedEventQueue.push(eventId);

        // Evitar crescimento ilimitado - eviction sincronizado
        if (this._processedEventQueue.length > this._maxProcessedEvents) {
          const oldestId = this._processedEventQueue.shift();
          const oldVersion = this._processedEvents.get(oldestId);

          this._processedEvents.delete(oldestId);
          if (oldVersion != null) {
            this._processedVersions.delete(oldVersion);
          }
        }

        console.log('[GUARD] Event marked as processed:', {
          eventId,
          version: incomingVersion,
          bufferSize: this._processedEventQueue.length
        });
      }

      // ✅ CICLO 3.2.3: Reset de tracking se LOGIN_OK após LOGOUT
      // Faz isso FORA de shouldAcceptEvent (que deve ser pura)
      if (this._lastAuthEvent.type === 'LOGOUT_OK' && event.type === 'LOGIN_OK') {
        const incomingVersion = getValidVersion(event.payload, 'LOGIN_OK');
        if (incomingVersion != null) {
          this._lastAuthEvent = {
            type: 'LOGIN_OK',
            version: incomingVersion
          };
          console.log('[GUARD] Tracking reset after login post-logout');
        }
      }

      // ✅ CICLO 3.2.1: Tracking de evento aceito para causalidade
      if (['SESSION_RESTORED', 'LOGIN_OK', 'LOGOUT_OK'].includes(event.type)) {
        this._updateLastAuthEvent(event.type, event.payload);
      }

      // ✅ FASE 1: REGISTRAR EVENTO DO SESSION BUS NO LEDGER ANTES DE DISPATCH
      let sessionBusLedgerEntry = null;
      if (this._ledger) {
        sessionBusLedgerEntry = this._ledger.append({
          eventType: event.type,
          payload: event.payload,
          source: 'SessionBus',
          correlationId: event.payload?.correlationId,
          parentEventId: event.payload?.parentEventId,
          metadata: {
            fsmState: this.state,
            fsmInstanceId: this.__lifecycle?.instanceId,
            eventId: eventId,
            sessionVersion: this.sessionVersion,
            via: 'sessionBus.subscribe'
          }
        });
      }
      
      this.dispatch(event.type, event.payload, {
        source: 'SessionBus',
        parentEventId: sessionBusLedgerEntry?.eventId,
        correlationId: sessionBusLedgerEntry?.correlationId
      });
    });
  }

  // =====================
  // STATE MANAGEMENT
  // =====================
  transitionTo(newState, event = null) {
    const oldState = this.state;
    this.state = newState;
    console.log('[AuthFSM] Transition:', {
      from: oldState,
      to: newState,
      event: event || 'manual',
      hasSession: !!this.session,
      hasUser: !!this.session?.user
    });
  }

  getState() {
    // 🎯 FASE 9: Flags corretas do contrato
    const hasSession =
      this.state === AuthState.AUTHENTICATED ||
      this.state === AuthState.FIRST_LOGIN_REQUIRED;

    const state = {
      state: this.state,
      session: this.session,
      error: this.error,

      // Flags de contrato
      isAuthenticated: this.state === AuthState.AUTHENTICATED,
      requiresPasswordChange: this.state === AuthState.FIRST_LOGIN_REQUIRED,
      canAccessApp: this.state === AuthState.AUTHENTICATED,
      hasSession: hasSession
    };

    // FASE 2: LOG REAL DO ESTADO
    console.log('[FSM STATE]', JSON.stringify({
      state: state.state,
      isAuthenticated: state.isAuthenticated,
      canAccessApp: state.canAccessApp,
      hasSession: state.hasSession,
      userId: state.session?.user?.id,
      error: state.error?.message || null
    }, null, 2));

    return state;
  }

  // ✅ FIX 4: Receber atualização de fase do boot
  setBootPhase(phase, version) {
    this.bootPhase = phase;
    this.bootPhaseVersion = version;
    
    if (phase === 'STABLE') {
      this.stableStateLocked = true;
      console.log('[AuthFSM] STABLE state locked (v' + version + ')');
    }
  }
  
  // ✅ FIX 4: Obter estado SOMENTE se estável
  async getStableState(timeoutMs = 10000) {
    const transitionalStates = ['SESSION_RESTORING', 'SESSION_REFRESHING', 'AUTHENTICATING'];
    const startTime = Date.now();
    
    // Aguardar sair de estado transicional
    while (transitionalStates.includes(this.state)) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`[FSM STABLE TIMEOUT] Stuck in ${this.state}`);
      }
      await new Promise(r => setTimeout(r, 50));
    }
    
    // Retornar estado estável
    const state = this.getState();
    state._meta = {
      stable: true,
      bootPhase: this.bootPhase,
      bootPhaseVersion: this.bootPhaseVersion,
      lockedAt: Date.now()
    };
    
    return state;
  }

  subscribe(fn) {
    if (typeof fn !== 'function') {
      throw new Error('Subscriber deve ser uma função');
    }
    this.listeners.add(fn);
    fn(this.getState());
    return () => this.listeners.delete(fn);
  }

  // ✅ FIX 4: STATE MERGE DETERMINÍSTICO (CRDT-lite)
  // Resolve conflito entre dois estados usando regras determinísticas
  resolveStateMerge(stateA, stateB) {
    // 🎯 FASE 7: Cross-tab consistency - FIRST_LOGIN_REQUIRED tem prioridade
    if (
      stateA.state === AuthState.FIRST_LOGIN_REQUIRED ||
      stateB.state === AuthState.FIRST_LOGIN_REQUIRED
    ) {
      return {
        winner: { state: AuthState.FIRST_LOGIN_REQUIRED, session: stateA.session || stateB.session },
        reason: 'first_login_required_priority',
        rule: 0
      };
    }

    // Regra 1: logout > login sempre
    if (stateA.state === 'UNAUTHENTICATED' && stateB.state !== 'UNAUTHENTICATED') {
      return { winner: stateA, reason: 'logout_dominates', rule: 1 };
    }
    if (stateB.state === 'UNAUTHENTICATED' && stateA.state !== 'UNAUTHENTICATED') {
      return { winner: stateB, reason: 'logout_dominates', rule: 1 };
    }

    // Regra 2: expired session > restored session
    const aExpired = stateA.session && this._isSessionExpired(stateA.session);
    const bExpired = stateB.session && this._isSessionExpired(stateB.session);
    
    if (aExpired && !bExpired && stateB.state === 'AUTHENTICATED') {
      return { winner: stateB, reason: 'expired_vs_active', rule: 2 };
    }
    if (bExpired && !aExpired && stateA.state === 'AUTHENTICATED') {
      return { winner: stateA, reason: 'expired_vs_active', rule: 2 };
    }
    
    // Regra 3: maior auth entropy vence
    // Entropy = version + (session ? 1000 : 0) + (user ? 100 : 0)
    const entropyA = (stateA.sessionVersion || 0) + 
                     (stateA.session ? 1000 : 0) + 
                     (stateA.session?.user ? 100 : 0);
    const entropyB = (stateB.sessionVersion || 0) + 
                     (stateB.session ? 1000 : 0) + 
                     (stateB.session?.user ? 100 : 0);
    
    if (entropyA !== entropyB) {
      return entropyA > entropyB 
        ? { winner: stateA, reason: 'higher_entropy', rule: 3, entropyA, entropyB }
        : { winner: stateB, reason: 'higher_entropy', rule: 3, entropyA, entropyB };
    }
    
    // Tie-break: mais recente vence
    const timeA = stateA._meta?.lockedAt || 0;
    const timeB = stateB._meta?.lockedAt || 0;
    if (timeA !== timeB) {
      return timeA > timeB 
        ? { winner: stateA, reason: 'more_recent', rule: 4 }
        : { winner: stateB, reason: 'more_recent', rule: 4 };
    }
    
    // Último recurso: estado atual mantém
    return { winner: this.getState(), reason: 'current_state_wins', rule: 5 };
  }
  
  // ✅ FIX 4: Registrar estado no histórico para resolução de conflitos
  recordStateInHistory(source = 'local') {
    const state = this.getState();
    const entry = {
      state: state.state,
      timestamp: Date.now(),
      version: this.sessionVersion,
      source: source,
      sessionFingerprint: this.sessionBus?.causality?.sessionFingerprint
    };
    
    this.stateHistory.push(entry);
    
    // Limitar histórico (últimos 50 estados)
    if (this.stateHistory.length > 50) {
      this.stateHistory.shift();
    }
  }

  // ✅ Método interno para notificar (usado por applySnapshot e handlers)
  _notifyListeners(state = this.state, session = this.session) {
    const stateObj = {
      state,
      session,
      error: this.error,
      isAuthenticated: state === AuthState.AUTHENTICATED
    };
    for (const listener of this.listeners) {
      try {
        listener(stateObj);
      } catch (err) {
        console.error('[AuthFSM] Erro no listener:', err);
      }
    }
  }

  emitStateChange() {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[AuthFSM] Erro no listener:', err);
      }
    }
  }

  // 🎯 EXECUTION MODEL: AuthFSM é PASSIVO
  // Inicializações ativas (timers, listeners, repairs) devem ser feitas via BootOrchestrator
  // usando window.__EAL__.gate(() => { /* inicialização */ })
}

// Fechar IIFE
})();
