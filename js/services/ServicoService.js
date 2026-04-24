(function() {
// 🔒 VALIDAÇÃO DE DEPENDÊNCIAS CRÍTICAS
if (!window.BaseService) {
  throw new Error('[BOOTSTRAP FATAL] ServicoService: window.BaseService missing. Ensure BaseService.js loads first.');
}

window.ServicoService = class ServicoService extends window.BaseService {
  constructor(core) {
    super(core, 'servicos');
  }
}
})();
