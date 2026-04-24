// ================================
// DATA CORE - Infraestrutura de Dados Pura
// ================================
// Responsabilidade única: executar queries, gerenciar client Supabase
// ❌ PROIBIDO: auth rules, filtros de domínio, joins inteligentes, decisões de negócio

// ================================
// IIFE - ISOLAMENTO DE ESCOPO
// ================================
(function() {

// FASE 4: LOG DE CARREGAMENTO - detectar execução dupla
console.log('[LOAD] DataCore loading, existing?', !!window.DataCore, 'timestamp:', Date.now());

// 🔒 PROTEÇÃO CONTRA RELOAD DUPLICADO
if (window.DataCore) {
  console.warn('[LOAD] DataCore already loaded, skipping...');
  return;
}

// 🔒 VALIDAÇÃO DE DEPENDÊNCIAS CRÍTICAS
if (typeof window === 'undefined') {
  throw new Error('[BOOTSTRAP FATAL] DataCore: window not defined');
}

// 🔒 VALIDAÇÃO DO SUPABASE CLIENT (fonte única de verdade)
const supabaseClient = window.supabaseClient;
if (!supabaseClient || typeof supabaseClient.from !== 'function') {
  throw new Error('[BOOTSTRAP FATAL] DataCore: window.supabaseClient missing or invalid. Ensure supabaseClient.js loads first.');
}

// ================================
// CACHE BOUNDARY GUARD (FASE 4.2)
// ================================
// Proteção runtime contra violações de cache boundary

const PROHIBITED_CACHE_KEYS = [
  '_cache', '__cache', '__snapshot', '_snapshot',
  '__cycleCache', '_cycleCache', '_index', '__index',
  'cache', 'dataCache', 'entityCache', '_entityCache',
  '__entityCache', 'localCache', '_localCache',
  'profissionais', 'clientes', 'servicos', 'agendamentos'
];

window.assertNoEntityCacheLeak = function(obj, context) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (PROHIBITED_CACHE_KEYS.includes(key)) {
      throw new Error(
        `[CACHE BOUNDARY VIOLATION] ${context}: forbidden cache key detected -> ${key}`
      );
    }
  }
};

window.DataCore = class DataCore {
  constructor(injectedClient) {
    // 🔒 SINGLE SOURCE OF TRUTH: fonte única de verdade
    const client = injectedClient || window.supabaseClient;

    // 🎯 FASE 3.0 INSTRUMENTAÇÃO: Validar dependências críticas
    if (!client) {
      console.error('[INVARIANT][DataCore] supabaseClient não fornecido');
    }
    if (client && typeof client.from !== 'function') {
      console.error('[INVARIANT][DataCore] supabaseClient inválido (sem .from)');
    }

    // AÇÃO 5: LOG DE VALIDAÇÃO (TEMPORÁRIO)
    console.log('[DataCore] client validation', {
      hasClient: !!client,
      hasFrom: typeof client?.from === 'function'
    });

    // AÇÃO 2: VALIDAÇÃO ESTRUTURAL MÍNIMA SEGURA
    if (!client) {
      throw new Error('[BOOTSTRAP FATAL] DataCore: Missing supabase client');
    }

    if (typeof client.from !== 'function') {
      throw new Error('[BOOTSTRAP FATAL] DataCore: Invalid Supabase client instance');
    }

    this.client = client;
    this.cache = new Map();
    this.inFlight = new Map();
    this.requestVersion = new Map();

    console.log('[DataCore] Initialized with valid Supabase client');
  }

  async query(table, options = {}) {
    this._assertCanAccessApp?.(); // 🎯 FASE 4: Proteger query
    const key = this._buildCacheKey(table, options);
    console.log('[DataCore] QUERY:', { table, key, cacheSize: this.cache.size });

    if (this.cache.has(key)) {
      console.log('[DataCore] CACHE HIT:', { table, key });
      return this.cache.get(key);
    }

    if (this.inFlight.has(key)) {
      console.log('[DataCore] INFLIGHT HIT:', { table, key });
      return this.inFlight.get(key);
    }

    console.log('[DataCore] CACHE MISS - fetching from DB:', { table, key });

    const currentVersion = (this.requestVersion.get(key) || 0) + 1;
    this.requestVersion.set(key, currentVersion);

    const promise = this._executeQuery(table, options)
      .then((result) => {
        const latestVersion = this.requestVersion.get(key);

        if (currentVersion !== latestVersion) {
          console.log('[DataCore] QUERY RESULT (stale - discarded):', { table, currentVersion, latestVersion });
          this.inFlight.delete(key);
          return result;
        }

        console.log('[DataCore] QUERY RESULT:', { table, count: Array.isArray(result) ? result.length : 1 });
        this.cache.set(key, result);
        this.inFlight.delete(key);
        return result;
      })
      .catch((err) => {
        this.inFlight.delete(key);
        throw this._normalizeError(err);
      });

    this.inFlight.set(key, promise);

    return promise;
  }

  async insert(table, payload) {
    this._assertCanAccessApp?.(); // 🎯 FASE 4: Proteger insert
    console.log('[DataCore] INSERT:', { table, payload });

    // 🎯 API CUSTOMIZADA: Usar fetch manual
    const SUPABASE_URL = 'https://kckbcjjgbipcqzkynwpy.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtja2JjampnYmlwY3F6a3lud3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDIxMjgsImV4cCI6MjA4ODMxODEyOH0.h3Z8LkzH_PXxE-BBHPii3WUwfHQH5HESsvzHUHKY7ZE';
    const token = localStorage.getItem('supabase.auth.token');
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    console.log('[DataCore] INSERT response:', { 
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      data 
    });

    // Verificar se houve erro RLS
    if (!response.ok) {
      console.error('[DataCore] INSERT failed:', response.status, response.statusText);
      throw new Error(`INSERT failed: ${response.status} ${response.statusText}`);
    }

    return Array.isArray(data) ? data[0] : data;
  }

  async update(table, id, payload) {
    console.log('[DataCore] UPDATE:', { table, id, payload });

    // 🎯 NORMALIZAR ID: preservar UUIDs (string) ou converter números
    const normalizedId = (typeof id === 'string' && id.includes('-')) || isNaN(Number(id))
      ? id  // UUID ou string não-numérica
      : Number(id);  // Número
    console.log('[DataCore] UPDATE - normalized id:', normalizedId, typeof normalizedId);

    try {
      // 🎯 USAR FETCH MANUAL direto (mais confiável que API customizada)
      const SUPABASE_URL = 'https://kckbcjjgbipcqzkynwpy.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtja2JjampnYmlwY3F6a3lud3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDIxMjgsImV4cCI6MjA4ODMxODEyOH0.h3Z8LkzH_PXxE-BBHPii3WUwfHQH5HESsvzHUHKY7ZE';
      const token = localStorage.getItem('supabase.auth.token');
      
      const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${normalizedId}`;
      console.log('[DataCore] UPDATE URL:', url);
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });
      
      console.log('[DataCore] UPDATE HTTP status:', response.status, response.statusText, response.ok);
      
      // 🎯 VERIFICAR ERROS HTTP (403 RLS, 404 Not Found, etc)
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DataCore] UPDATE HTTP ERROR:', response.status, errorText);
        
        // Detectar RLS especificamente
        if (response.status === 403 || errorText.includes('permission')) {
          const rlsError = new Error(`RLS_BLOCKED: UPDATE em ${table} - permissão negada`);
          rlsError.code = 'RLS_BLOCKED';
          rlsError.operation = 'update';
          rlsError.table = table;
          rlsError.httpStatus = response.status;
          throw rlsError;
        }
        
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      
      const data = await response.json();
      console.log('[DataCore] UPDATE response:', { data, count: Array.isArray(data) ? data.length : 'N/A' });

      // 🎯 DETECÇÃO RLS: UPDATE bem-sucedido deve retornar dados
      if (Array.isArray(data) && data.length === 0) {
        console.error('[DataCore][RLS_DETECTED] UPDATE retornou array vazio - possível bloqueio RLS');
        const rlsError = new Error(`RLS_BLOCKED_OR_NOT_FOUND: UPDATE em ${table} retornou vazio`);
        rlsError.code = 'RLS_BLOCKED';
        rlsError.operation = 'update';
        rlsError.table = table;
        throw rlsError;
      }

      return Array.isArray(data) ? data[0] : data;
    } catch (err) {
      console.error('[DataCore] UPDATE ERROR:', err.message);
      console.error('[DataCore] UPDATE ERROR stack:', err.stack);
      throw err;
    }
  }

  async delete(table, id) {
    this._assertCanAccessApp?.(); // 🎯 FASE 4: Proteger delete
    console.log('[DataCore] DELETE:', { table, id });

    try {
      // 🎯 NORMALIZAR ID: preservar UUIDs (string) ou converter números
      const normalizedId = (typeof id === 'string' && id.includes('-')) || isNaN(Number(id))
        ? id  // UUID ou string não-numérica
        : Number(id);  // Número
      console.log('[DataCore] DELETE - normalized id:', normalizedId, typeof normalizedId);

      // 🎯 USAR FETCH MANUAL direto
      const SUPABASE_URL = 'https://kckbcjjgbipcqzkynwpy.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtja2JjampnYmlwY3F6a3lud3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDIxMjgsImV4cCI6MjA4ODMxODEyOH0.h3Z8LkzH_PXxE-BBHPii3WUwfHQH5HESsvzHUHKY7ZE';
      const token = localStorage.getItem('supabase.auth.token');
      
      const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${normalizedId}`;
      console.log('[DataCore] DELETE URL:', url);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      });
      
      console.log('[DataCore] DELETE response:', { 
        ok: response.ok, 
        status: response.status
      });

      // 🎯 VERIFICAR SE O REGISTRO FOI REALMENTE DELETADO
      // Fazer uma query para confirmar que o registro não existe mais
      const checkUrl = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${normalizedId}&select=id`;
      const checkResponse = await fetch(checkUrl, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      const checkData = await checkResponse.json();
      
      console.log('[DataCore] DELETE verification:', { 
        stillExists: Array.isArray(checkData) && checkData.length > 0,
        count: Array.isArray(checkData) ? checkData.length : 'N/A'
      });

      // Se o registro ainda existe, o DELETE foi bloqueado pela RLS
      if (Array.isArray(checkData) && checkData.length > 0) {
        console.warn('[DataCore][DELETE BLOCKED] Registro ainda existe após DELETE. Bloqueio RLS detectado.');
        throw new Error('Não foi possível excluir o registro. Verifique suas permissões de administrador.');
      }

      return { id, deleted: true };
    } catch (err) {
      console.error('[DataCore] DELETE ERROR:', err.message);
      throw err;
    }
  }

  invalidate(table) {
    console.log('[DataCore] INVALIDATE:', { table, cacheSizeBefore: this.cache.size });

    let deleted = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(table + ':')) {
        this.cache.delete(key);
        deleted++;
      }
    }

    for (const key of this.inFlight.keys()) {
      if (key.startsWith(table + ':')) {
        this.inFlight.delete(key);
        const current = this.requestVersion.get(key) || 0;
        this.requestVersion.set(key, current + 1);
      }
    }

    console.log('[DataCore] INVALIDATE complete:', { deleted, cacheSizeAfter: this.cache.size });
  }

  clearCache() {
    this.cache.clear();
  }

  // ================================
  // CACHE BOUNDARY PROTECTION (FASE 4.2)
  // ================================

  /**
   * 🔒 PROTEÇÃO: Bloqueia injeção de cache externo acidental
   * @throws Error sempre — método proibido
   */
  setExternalCache(key, value) {
    throw new Error(
      '[DATACORE BOUNDARY ERROR] External cache injection is forbidden. ' +
      'Use DataCore.query() for entity caching. Context: ' + key
    );
  }

  /**
   * 🔒 AUDIT: Verifica se objeto contém cache proibido (para uso em Pages)
   * @param {Object} obj — objeto a verificar
   * @param {string} context — contexto para mensagem de erro
   */
  auditForCacheViolation(obj, context) {
    window.assertNoEntityCacheLeak(obj, context);
  }

  /**
   * Execute arbitrary async operations (e.g., Edge Functions) with FSM control
   * @param {string} key - Unique identifier for this operation
   * @param {Function} fn - Async function to execute
   * @param {Object} options - Options including invalidate array for cache invalidation
   * @returns {Promise} - Result of the operation
   */
  async execute(key, fn, options = {}) {
    this._assertCanAccessApp?.(); // 🎯 FASE 4: Proteger execute
    const cacheKey = `exec:${key}:${JSON.stringify(options || {})}`;

    console.log('[DataCore] EXECUTE:', { key, cacheKey });

    if (this.inFlight.has(cacheKey)) {
      console.log('[DataCore] EXECUTE INFLIGHT HIT:', { key });
      return this.inFlight.get(cacheKey);
    }

    const currentVersion = (this.requestVersion.get(cacheKey) || 0) + 1;
    this.requestVersion.set(cacheKey, currentVersion);

    const promise = fn()
      .then((result) => {
        const latestVersion = this.requestVersion.get(cacheKey);

        if (currentVersion !== latestVersion) {
          console.log('[DataCore] EXECUTE RESULT (stale - discarded):', { key, currentVersion, latestVersion });
          this.inFlight.delete(cacheKey);
          return result;
        }

        // Invalidate cache for specified tables
        if (options.invalidate) {
          console.log('[DataCore] EXECUTE INVALIDATE:', { key, tables: options.invalidate });
          for (const table of options.invalidate) {
            this.invalidate(table);
          }
        }

        this.inFlight.delete(cacheKey);
        console.log('[DataCore] EXECUTE COMPLETE:', { key });
        return result;
      })
      .catch((err) => {
        this.inFlight.delete(cacheKey);
        console.error('[DataCore] EXECUTE ERROR:', { key, error: err.message });
        throw this._normalizeError(err);
      });

    this.inFlight.set(cacheKey, promise);

    return promise;
  }

  async _executeQuery(table, options) {
    // 🎯 SUPORTE A SELECT CUSTOMIZADO (para JOINs)
    const selectFields = options.select || '*';
    
    // 🎯 API CUSTOMIZADA: Construir query params manualmente
    const queryParams = new URLSearchParams();
    queryParams.append('select', selectFields);
    
    // Adicionar filtros eq como query params
    if (options.eq) {
      for (const [k, v] of Object.entries(options.eq)) {
        queryParams.append(`${k}`, `eq.${v}`);
      }
    }
    
    // Ordenação
    if (options.order) {
      const direction = options.order.asc === false ? 'desc' : 'asc';
      queryParams.append('order', `${options.order.column}.${direction}`);
    }
    
    // Limite
    if (options.limit) {
      queryParams.append('limit', options.limit.toString());
    }
    
    // 🎯 CHAMADA MANUAL via fetch (compatível com supabaseClient.js customizado)
    const SUPABASE_URL = 'https://kckbcjjgbipcqzkynwpy.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtja2JjampnYmlwY3F6a3lud3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDIxMjgsImV4cCI6MjA4ODMxODEyOH0.h3Z8LkzH_PXxE-BBHPii3WUwfHQH5HESsvzHUHKY7ZE';
    const token = localStorage.getItem('supabase.auth.token');
    
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const url = `${SUPABASE_URL}/rest/v1/${table}?${queryParams.toString()}`;
    console.log('[DataCore] _executeQuery URL:', url);
    
    let response = await fetch(url, { headers });
    let data = await response.json();
    
    console.log('[DataCore] _executeQuery response:', { count: Array.isArray(data) ? data.length : 1 });
    
    // 🎯 DETECTAR JWT EXPIRADO E TENTAR REFRESH AUTOMÁTICO
    if (data?.code === 'PGRST303' || data?.message?.includes('JWT expired')) {
      console.warn('[DataCore][JWT EXPIRED] Token expirado, tentando refresh...');
      
      try {
        // Tentar fazer refresh do token usando Supabase Auth
        const { data: refreshData, error: refreshError } = await window.supabaseClient.auth.refreshSession();
        
        if (refreshError || !refreshData?.session?.access_token) {
          console.error('[DataCore][REFRESH FAILED] Não foi possível renovar o token:', refreshError);
          // Se refresh falhar, redirecionar para login
          localStorage.removeItem('supabase.auth.token');
          localStorage.removeItem('supabase.auth.refreshToken');
          window.location.href = '/login.html?error=session_expired';
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        }
        
        // Refresh funcionou! Atualizar token e repetir a query
        const newToken = refreshData.session.access_token;
        console.log('[DataCore][REFRESH SUCCESS] Token renovado, repetindo query...');
        
        // Salvar novo token
        localStorage.setItem('supabase.auth.token', newToken);
        
        // Repetir a query com novo token
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(url, { headers });
        data = await response.json();
        
        console.log('[DataCore] _executeQuery (retry) response:', { count: Array.isArray(data) ? data.length : 1 });
        
        // Verificar se ainda deu erro (não deveria, mas por segurança)
        if (data?.code === 'PGRST303' || data?.message?.includes('JWT expired')) {
          throw new Error('Token renovado mas acesso ainda negado');
        }
        
      } catch (refreshErr) {
        console.error('[DataCore][REFRESH ERROR] Falha no refresh:', refreshErr);
        // Se qualquer erro no refresh, redirecionar para login
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('supabase.auth.refreshToken');
        window.location.href = '/login.html?error=session_expired';
        throw new Error('Sessão expirada. Por favor, faça login novamente.');
      }
    }
    
    return this._handleResponse({ data, error: null });
  }

  _handleResponse(res, context = {}) {
    const { operation = 'query', table = 'unknown' } = context;
    
    if (res.error) {
      // Detectar erro 403 (RLS) ou similar
      if (res.error.code === '403' || res.error.message?.includes('permission')) {
        console.error('[DataCore][RLS_ERROR]', { operation, table, error: res.error });
        const rlsError = new Error(`RLS_BLOCKED: ${operation} em ${table} - ${res.error.message}`);
        rlsError.code = 'RLS_BLOCKED';
        rlsError.operation = operation;
        rlsError.table = table;
        rlsError.originalError = res.error;
        throw rlsError;
      }
      throw res.error;
    }

    if (!Array.isArray(res.data)) {
      // Converter objeto único para array (incluindo erros da API - tratados no serviço)
      if (res.data && typeof res.data === 'object') {
        return [res.data];
      }
      return [];
    }

    // 🎯 DETECÇÃO DE RLS: Resposta vazia em operação de escrita pode indicar bloqueio
    if (res.data.length === 0 && ['insert', 'update', 'delete'].includes(operation)) {
      console.warn('[DataCore][RLS_DETECTED?]', {
        operation,
        table,
        hint: 'Resposta vazia pode indicar RLS bloqueando ou registro não encontrado'
      });
      
      // Não lançar erro aqui para não quebrar queries legítimas que retornam vazio
      // Mas logar para debugging
    }

    return res.data;
  }

  _normalizeError(err) {
    return {
      message: err.message || 'Unknown error',
      code: err.code || 'DATA_CORE_ERROR',
      raw: err
    };
  }

  _buildCacheKey(table, options) {
    return `${table}:${JSON.stringify(options || {})}`;
  }
}

// Fechar IIFE
})();
