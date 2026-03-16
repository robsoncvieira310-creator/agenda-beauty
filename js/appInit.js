// Inicialização centralizada da aplicação V1.3 - Com Autenticação
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
    
    // NOVA IMPLEMENTAÇÃO V1.3 - VERIFICAR AUTHMANAGER DISPONÍVEL
    console.log('🔐 APP_INIT: Verificando AuthManager...');
    
    // Aguardar AuthManager estar disponível
    if (!window.authManager) {
      console.error('❌ APP_INIT: AuthManager não encontrado');
      console.error('❌ APP_INIT: Scripts disponíveis:', Object.keys(window).filter(k => k.includes('Manager') || k.includes('auth')));
      throw new Error('❌ AuthManager não encontrado');
    }
    
    // Inicializar AuthManager e verificar sessão
    console.log('🔐 APP_INIT: Inicializando AuthManager...');
    const authResult = await window.authManager.initialize();
    console.log('🔐 APP_INIT: Resultado da autenticação:', authResult);
    
    if (!authResult.authenticated) {
      console.log('⚠️ APP_INIT: Usuário não autenticado, redirecionando para login...');
      console.log('🔐 APP_INIT: Verificando se já está na página de login...');
      if (window.location.pathname.includes('login.html') || window.location.href.includes('login.html')) {
        console.log('🔐 APP_INIT: Já está na página de login, não redirecionar');
      } else {
        window.location.href = 'login.html';
      }
      return;
    }
    
    console.log('✅ APP_INIT: Usuário autenticado, continuando inicialização...');
    console.log('👤 APP_INIT: Profile do usuário:', window.currentUserProfile);
    
    // Verificar se Supabase está disponível
    if (!window.supabaseClient) {
      throw new Error("❌ Supabase client não inicializado");
    }
    console.log('✅ Supabase client disponível');
    console.log('🔍 Verificando window.supabaseClient:', window.supabaseClient);

    // Criar DataManager com cliente Supabase
    window.dataManager = new DataManager(window.supabaseClient);
    console.log('✅ DataManager criado');

    // NOVA IMPLEMENTAÇÃO V1.2 - LIMPAR CACHE PARA FORÇAR CARREGAMENTO
    window.dataManager.cache = {
      clientes: null,
      profissionais: null,
      servicos: null,
      agendamentos: null,
      bloqueios: null
    };
    console.log('🗑️ Cache limpo para forçar carregamento inicial');

    // Carregar dados iniciais
    console.log('🔄 Carregando dados iniciais...');
    await Promise.all([
      window.dataManager.loadClientes(),
      window.dataManager.loadServicos(),
      window.dataManager.loadProfissionais(),
      window.dataManager.loadAgendamentos(),
      window.dataManager.loadBloqueios()
    ]);

    console.log("✅ Aplicação inicializada com sucesso");
    console.log(`📊 Clientes: ${window.dataManager.clientes.length}`);
    console.log(`💇 Serviços: ${window.dataManager.servicos.length}`);
    console.log(`👩 Profissionais: ${window.dataManager.profissionais.length}`);
    console.log(`📅 Agendamentos: ${window.dataManager.agendamentos.length}`);
    console.log(`🚫 Bloqueios: ${window.dataManager.bloqueios.length}`);

    // Disparar evento de aplicação pronta
    console.log("🚀 Disparando evento appReady...");
    window.dispatchEvent(new CustomEvent('appReady'));
    console.log("✅ Evento appReady disparado");
    
  } catch (error) {
    console.error('❌ Erro ao inicializar aplicação:', error);
    
    // Mostrar erro na tela
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #fee;
      color: #c00;
      padding: 20px;
      border-radius: 8px;
      border: 2px solid #c00;
      font-family: Arial, sans-serif;
      z-index: 9999;
      max-width: 400px;
      text-align: center;
    `;
    errorDiv.innerHTML = `
      <h3>❌ Erro de Inicialização</h3>
      <p>${error.message}</p>
      <button onclick="location.reload()" style="
        background: #c00;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 10px;
      ">Recarregar Página</button>
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
