(function() {
// 🔒 VALIDAÇÃO DE DEPENDÊNCIAS CRÍTICAS
if (!window.BaseService) {
  throw new Error('[BOOTSTRAP FATAL] BloqueioService: window.BaseService missing. Ensure BaseService.js loads first.');
}

window.BloqueioService = class BloqueioService extends window.BaseService {
  constructor(core) {
    super(core, 'bloqueios');
  }
}
})();
