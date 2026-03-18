// Configuração e criação do cliente Supabase
const SUPABASE_URL = "https://kckbcjjgbipcqzkynwpy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtja2JjampnYmlwY3F6a3lud3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDIxMjgsImV4cCI6MjA4ODMxODEyOH0.h3Z8LkzH_PXxE-BBHPii3WUwfHQH5HESsvzHUHKY7ZE";

// Criar cliente Supabase com configurações de sessão CORRETAS
const client = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,      // ✅ Manter sessão no localStorage
      autoRefreshToken: true,   // ✅ Auto refresh do token
      detectSessionInUrl: true,  // ✅ Detectar sessão na URL
      flowType: 'pkce',        // ✅ Fluxo PKCE mais seguro
      debug: false              // ✅ Desativar debug em produção
    }
  }
);

// Disponibilizar globalmente
window.supabase = client;
window.supabaseClient = client; // Manter compatibilidade

console.log("✅ Supabase inicializado com configurações de sessão corretas");
