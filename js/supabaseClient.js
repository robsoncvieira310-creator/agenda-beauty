// ================================
// SUPABASE CLIENT - HARDENED LOCAL ONLY
// ================================
// ✅ ZERO dependência de CDN
// ✅ Cliente inline (copiado da lib @supabase/supabase-js)
// ✅ Fail-fast se inicialização falhar
// ✅ Usar window.supabase (client local)

// ================================
// IIFE - ISOLAMENTO DE ESCOPO
// ================================
(function() {

// FASE 4: LOG DE CARREGAMENTO - detectar execução dupla
console.log('[LOAD] supabaseClient loading, existing?', !!window.supabaseClient, 'timestamp:', Date.now());

// 🔒 PROTEÇÃO CONTRA RELOAD DUPLICADO
if (window.supabaseClient) {
  console.warn('[LOAD] supabaseClient already loaded, skipping...');
  return;
}

const SUPABASE_URL = "https://kckbcjjgbipcqzkynwpy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtja2JjampnYmlwY3F6a3lud3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDIxMjgsImV4cCI6MjA4ODMxODEyOH0.h3Z8LkzH_PXxE-BBHPii3WUwfHQH5HESsvzHUHKY7ZE";

// 🔒 HARD SINGLE SOURCE OF TRUTH - Cliente Inline
// Implementação mínima do cliente Supabase (baseada em @supabase/supabase-js@2.49.4)
class SupabaseClient {
  constructor(url, key, options = {}) {
    this.supabaseUrl = url;
    this.supabaseKey = key;
    this.options = options;
    this.auth = this._createAuth();
    this.realtime = null;
    this.rest = null;
    
    this._validateConfig();
  }

  _validateConfig() {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('[BOOTSTRAP FATAL] Supabase config missing');
    }
    if (!this.supabaseUrl.startsWith('https://')) {
      throw new Error('[BOOTSTRAP FATAL] Supabase URL invalid');
    }
  }

  _createAuth() {
    return {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      
      async signInWithPassword(credentials) {
        // FASE 1: DIAGNÓSTICO HTTP
        console.log('[SUPABASE REQUEST] signInWithPassword', {
          url: `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
          credentials: { email: credentials.email, hasPassword: !!credentials.password },
          headers: {
            'apikey': SUPABASE_ANON_KEY ? 'PRESENTE' : 'AUSENTE',
            'Content-Type': 'application/json'
          }
        });

        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(credentials)
        });

        // FASE 2: CAPTURAR STATUS E HEADERS
        console.log('[SUPABASE RESPONSE]', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries([...response.headers.entries()])
        });

        // FASE 3: CAPTURAR BODY COMPLETO
        const text = await response.text();
        console.log('[SUPABASE RAW BODY]', text || '(vazio)');

        // FASE 4: PARSE JSON (se houver)
        let data = null;
        let error = null;
        try {
          if (text) {
            data = JSON.parse(text);
          }
        } catch (e) {
          error = { message: 'Invalid JSON response', raw: text };
        }

        // FASE 5: MAPEAR ERRO HTTP PARA OBJETO PADRÃO
        if (!response.ok) {
          error = data?.error || { 
            message: `HTTP ${response.status}: ${response.statusText}`,
            status: response.status
          };
          data = null;
        }

        // FASE 6: PERSISTIR SESSÃO NO LOCALSTORAGE (se sucesso)
        if (response.ok && data?.access_token) {
          localStorage.setItem('supabase.auth.token', data.access_token);
          if (data.refresh_token) {
            localStorage.setItem('supabase.auth.refreshToken', data.refresh_token);
          }
          console.log('[SUPABASE SESSION] Token e refresh_token persistidos no localStorage');
        }

        const result = { data, error };
        console.log('[SUPABASE FINAL RESULT]', JSON.stringify(result, null, 2));
        return result;
      },

      async signOut() {
        try {
          const response = await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
            }
          });
          return response.json();
        } catch (err) {
          console.warn('[SUPABASE SIGNOUT] Server logout failed:', err);
          return { error: { message: err.message } };
        } finally {
          // ✅ Limpeza atômica local - executa mesmo em erro de rede
          localStorage.removeItem('supabase.auth.token');
          localStorage.removeItem('supabase.auth.refreshToken');
          localStorage.removeItem('auth_session');
          sessionStorage.removeItem('auth_redirect_done');
          console.log('[SUPABASE SIGNOUT] Todos os tokens e sessões foram limpos');
        }
      },

      async getSession() {
        const token = localStorage.getItem('supabase.auth.token');
        if (!token) return { data: { session: null }, error: null };
        
        // Validar token
        const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const user = await response.json();
          return { data: { session: { user, access_token: token } }, error: null };
        }
        return { data: { session: null }, error: null };
      },

      onAuthStateChange(callback) {
        // Simular listener básico
        return { data: { subscription: { unsubscribe: () => {} } } };
      },

      async refreshSession() {
        const token = localStorage.getItem('supabase.auth.token');
        const refreshToken = localStorage.getItem('supabase.auth.refreshToken');

        console.log('[SUPABASE REFRESH] Attempting token refresh');

        try {
          // Chamar endpoint de refresh do Supabase
          const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              refresh_token: refreshToken || token // Fallback para token se não tiver refresh_token separado
            })
          });

          const data = await response.json();

          if (!response.ok) {
            console.error('[SUPABASE REFRESH] Failed:', data);
            return { data: { session: null }, error: data.error || { message: 'Refresh failed' } };
          }

          // Sucesso! Atualizar tokens
          if (data.access_token) {
            localStorage.setItem('supabase.auth.token', data.access_token);
            if (data.refresh_token) {
              localStorage.setItem('supabase.auth.refreshToken', data.refresh_token);
            }
            console.log('[SUPABASE REFRESH] Success - new token saved');
          }

          return {
            data: {
              session: {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_at: data.expires_at,
                expires_in: data.expires_in,
                user: data.user
              }
            },
            error: null
          };
        } catch (error) {
          console.error('[SUPABASE REFRESH] Error:', error);
          return { data: { session: null }, error: { message: error.message } };
        }
      },

      _setToken(token) {
        localStorage.setItem('supabase.auth.token', token);
      }
    };
  }

  from(table) {
    return {
      async select(columns = '*') {
        const token = localStorage.getItem('supabase.auth.token');
        const headers = {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}`, {
          headers
        });
        return { data: await response.json(), error: null };
      },

      async insert(data) {
        const token = localStorage.getItem('supabase.auth.token');
        const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(data)
        });
        return { data: await response.json(), error: null };
      },

      async update(data) {
        const token = localStorage.getItem('supabase.auth.token');
        return {
          eq: async (column, value) => {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}`, {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(data)
            });
            return { data: await response.json(), error: null };
          }
        };
      },

      async delete() {
        const token = localStorage.getItem('supabase.auth.token');
        return {
          eq: async (column, value) => {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}`, {
              method: 'DELETE',
              headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
              }
            });
            return { data: null, error: response.ok ? null : await response.json() };
          }
        };
      }
    };
  }

  rpc(functionName, params = {}) {
    return {
      async single() {
        const token = localStorage.getItem('supabase.auth.token');
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(params)
        });
        return { data: await response.json(), error: null };
      }
    };
  }
}

// 🔒 CRIAÇÃO DO CLIENTE
const client = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🔒 VALIDAÇÃO CRÍTICA
if (!client || typeof client.from !== 'function') {
  throw new Error('[BOOTSTRAP FATAL] Supabase local client missing');
}

// 🔒 EXPOSIÇÃO CONTROLADA
window.supabaseClient = client;

// LOCK ROBUSTO (lida com redefinição)
const desc = Object.getOwnPropertyDescriptor(window, 'supabase');

if (!desc || desc.configurable) {
  try {
    delete window.supabase;
  } catch (e) {}

  Object.defineProperty(window, 'supabase', {
    get() {
      console.trace('[BOOTSTRAP FATAL] Acesso a window.supabase detectado. Use window.supabaseClient apenas.');
      throw new Error('[BOOTSTRAP FATAL] Use window.supabaseClient only');
    },
    configurable: false
  });
}

// 🔒 SUPABASE OWNERSHIP LOCK (Garantir 1 único owner ativo)
window.__SUPABASE_OWNER__ = 'supabaseClient';

window.__assertSupabaseOwner = function (caller) {
  if (window.__SUPABASE_OWNER__ !== 'supabaseClient') {
    throw new Error(`[BOOTSTRAP FATAL] Supabase ownership violation by ${caller}`);
  }
};

// ENFORCE SINGLE CLIENT MODE
window.__SUPABASE_MODE__ = 'SINGLE_CLIENT_ONLY';
console.log('[BOOT] Supabase Single Source Lock active');

// 🔒 SINGLETON PROTECTION
window._supabaseClientInitialized = true;
window._supabaseClientVersion = '3.0.0-LOCAL';

console.log('[BOOTSTRAP] Supabase Client LOCAL initialized');
console.log('[BOOTSTRAP] .from() validated:', typeof client.from);

// ✅ APENAS supabaseClient - NUNCA supabase (proibido pelo lock acima)

// Fechar IIFE
})();
