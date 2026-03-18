// Inicialização centralizada da aplicação V1.3 - Com Autenticação Corrigida
let appInitialized = false; // Flag para evitar inicialização duplicada

async function initApp() {
  // PROTEÇÃO CONTRA INICIALIZAÇÃO DUPLICADA
  if (appInitialized) {
    console.log('⚠️ APP já foi inicializado, ignorando chamada duplicada');
    return;
  }
  
  appInitialized = true;
  
  try {
    console.log('🔄 Iniciando aplicação...');
    
    // NOVA IMPLEMENTAÇÃO V1.3 - DIAGNÓSTICO COMPLETO
    console.log('🔍 APP_INIT: DIAGNÓSTICO - Scripts carregados:');
    console.log('  - window.supabase:', !!window.supabase);
    console.log('  - window.supabaseClient:', !!window.supabaseClient);
    console.log('  - window.authManager:', !!window.authManager);
    console.log('  - window.dataManager:', !!window.dataManager);
    console.log('  - window.menuManager:', !!window.menuManager);
    
    // ✅ VERIFICAÇÃO CRÍTICA: Supabase disponível
    if (!window.supabaseClient) {
      throw new Error("❌ Supabase client não inicializado");
    }
    console.log('✅ APP_INIT: Supabase client disponível');
    
    // ✅ VERIFICAÇÃO CRÍTICA: AuthManager disponível
    if (!window.authManager) {
      console.error('❌ APP_INIT: AuthManager não encontrado');
      throw new Error('❌ AuthManager não encontrado');
    }
    console.log('✅ APP_INIT: AuthManager disponível');
    
    // ✅ VERIFICAÇÃO CRÍTICA: Aguardar sessão ser estabelecida
    console.log('🔐 APP_INIT: Verificando sessão antes de carregar dados...');
    const authResult = await window.authManager.initialize();
    
    if (!authResult.authenticated) {
      console.log('⚠️ APP_INIT: Usuário não autenticado, redirecionando para login...');
      if (window.location.pathname.includes('login.html') || window.location.href.includes('login.html')) {
        console.log('🔐 APP_INIT: Já está na página de login, não redirecionar');
      } else {
        window.location.href = 'login.html';
      }
      return;
    }
    
    console.log('✅ APP_INIT: Usuário autenticado, continuando inicialização...');
    console.log('👤 APP_INIT: Profile do usuário:', authResult.profile);
    
    // ✅ VERIFICAÇÃO CRÍTICA: Sessão está ativa
    const currentSession = await window.authManager.getCurrentSession();
    if (!currentSession) {
      console.error('❌ APP_INIT: Sessão não está ativa, abortando carregamento de dados');
      throw new Error('Sessão não está ativa');
    }
    
    console.log('✅ APP_INIT: Sessão ativa verificada:', currentSession.user.id);

    // Criar DataManager com cliente Supabase
    window.dataManager = new DataManager(window.supabaseClient);
    console.log('✅ APP_INIT: DataManager criado');

    // NOVA IMPLEMENTAÇÃO V1.2 - LIMPAR CACHE PARA FORÇAR CARREGAMENTO
    window.dataManager.cache = {
      clientes: null,
      profissionais: null,
      servicos: null,
      agendamentos: null,
      bloqueios: null
    };
    console.log('🗑️ APP_INIT: Cache limpo para forçar carregamento inicial');

    // ✅ CARREGAR DADOS APÓS VERIFICAR SESSÃO
    console.log('🔄 APP_INIT: Carregando dados iniciais (com sessão verificada)...');
    
    try {
      await Promise.all([
        window.dataManager.loadClientes(),
        window.dataManager.loadServicos(),
        window.dataManager.loadProfissionais(),
        window.dataManager.loadAgendamentos(),
        window.dataManager.loadBloqueios()
      ]);
      
      console.log("✅ APP_INIT: Aplicação inicializada com sucesso");
      console.log(`📊 Clientes: ${window.dataManager.clientes.length}`);
      console.log(`💇 Serviços: ${window.dataManager.servicos.length}`);
      console.log(`👩 Profissionais: ${window.dataManager.profissionais.length}`);
      console.log(`📅 Agendamentos: ${window.dataManager.agendamentos.length}`);
      console.log(`🚫 Bloqueios: ${window.dataManager.bloqueios.length}`);

      // Disparar evento de aplicação pronta
      console.log("🚀 APP_INIT: Disparando evento appReady...");
      window.dispatchEvent(new CustomEvent('appReady'));
      console.log("✅ APP_INIT: Evento appReady disparado");
      
    } catch (dataError) {
      console.error('❌ APP_INIT: Erro ao carregar dados:', dataError);
      
      // Verificar se é erro de RLS (auth.uid() = null)
      if (dataError.message && dataError.message.includes('null value')) {
        console.error('❌ APP_INIT: ERRO DE RLS DETECTADO - auth.uid() chegou como null');
        console.error('❌ APP_INIT: Isso indica que a sessão não está sendo aplicada às queries');
        throw new Error('Erro de RLS: Sessão não está sendo aplicada. Verifique configuração do cliente Supabase.');
      }
      
      throw dataError;
    }
    
  } catch (error) {
    console.error('❌ APP_INIT: Erro ao inicializar aplicação:', error);
    
    // Mostrar erro na tela
    const errorDiv = document.createElement('div');
    errorDiv.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center;">
        <div style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; text-align: center;">
          <h3 style="color: #dc3545; margin-bottom: 20px;">❌ Erro na Inicialização</h3>
          <p style="margin-bottom: 20px;">${error.message}</p>
          <button onclick="window.location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Recarregar Página
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(errorDiv);
  }
}

// Expor função global para compatibilidade
window.initDataManager = initApp;

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  // NOVA IMPLEMENTAÇÃO V1.3 - VERIFICAR CLASSES EXISTENTES
  console.log('🔍 APP_INIT: Verificando classes existentes antes de declarar...');
  console.log('  - DataManager existe:', typeof DataManager !== 'undefined');
  console.log('  - PageManager existe:', typeof PageManager !== 'undefined');
  console.log('  - MenuManager existe:', typeof MenuManager !== 'undefined');
  console.log('  - ProfissionaisPage existe:', typeof ProfissionaisPage !== 'undefined');
  
  // NOVA IMPLEMENTAÇÃO V1.3 - AGUARDAR CARREGAMENTO DOS SCRIPTS
  setTimeout(() => {
    console.log('🔄 APP_INIT: Iniciando após delay para carregamento de scripts...');
    initApp();
  }, 200);
});
