// First Login Manager - Sistema de troca de senha obrigatória
// VERSÃO: 1.0.0
console.log('🔐 FirstLoginManager V1.0.0 carregado');

class FirstLoginManager {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.modal = null;
    this.form = null;
    this.isProcessing = false;
    
    this.init();
  }
  
  init() {
    // Criar modal de primeiro login
    this.createModal();
    
    // Verificar se usuário precisa fazer primeiro login
    this.checkFirstLogin();
  }
  
  createModal() {
    // Criar HTML do modal
    const modalHTML = `
      <div id="firstLoginModal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>🔐 Bem-vindo ao Agenda Beauty</h3>
            <p>Por segurança, você precisa alterar sua senha temporária no primeiro acesso.</p>
          </div>
          
          <div class="modal-body">
            <form id="firstLoginForm">
              <div class="form-group">
                <label for="senhaAtual">Senha Temporária</label>
                <input type="password" id="senhaAtual" class="form-control" required placeholder="Digite a senha temporária">
              </div>
              
              <div class="form-group">
                <label for="novaSenha">Nova Senha</label>
                <input type="password" id="novaSenha" class="form-control" required placeholder="Mínimo 6 caracteres" minlength="6">
              </div>
              
              <div class="form-group">
                <label for="confirmarSenha">Confirmar Nova Senha</label>
                <input type="password" id="confirmarSenha" class="form-control" required placeholder="Confirme a nova senha">
              </div>
              
              <div class="form-group">
                <div class="password-requirements">
                  <p><strong>Requisitos da senha:</strong></p>
                  <ul>
                    <li id="req-length">✅ Mínimo 6 caracteres</li>
                    <li id="req-match">✅ Senhas coincidem</li>
                  </ul>
                </div>
              </div>
            </form>
          </div>
          
          <div class="modal-footer">
            <button type="button" id="btnTrocarSenha" class="btn btn-primary">
              <span class="btn-icon">🔐</span>
              Alterar Senha
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Adicionar ao body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Referenciar elementos
    this.modal = document.getElementById('firstLoginModal');
    this.form = document.getElementById('firstLoginForm');
    
    // Configurar eventos
    this.setupEvents();
  }
  
  setupEvents() {
    const btnTrocarSenha = document.getElementById('btnTrocarSenha');
    const novaSenha = document.getElementById('novaSenha');
    const confirmarSenha = document.getElementById('confirmarSenha');
    
    // Evento do botão
    btnTrocarSenha.addEventListener('click', () => this.handlePasswordChange());
    
    // Validação em tempo real
    novaSenha.addEventListener('input', () => this.validatePasswords());
    confirmarSenha.addEventListener('input', () => this.validatePasswords());
    
    // Submit do formulário
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlePasswordChange();
    });
    
    // Fechar modal ao clicar fora
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hideModal();
      }
    });
  }
  
  validatePasswords() {
    const novaSenha = document.getElementById('novaSenha').value;
    const confirmarSenha = document.getElementById('confirmarSenha').value;
    
    // Validar comprimento
    const reqLength = document.getElementById('req-length');
    if (novaSenha.length >= 6) {
      reqLength.innerHTML = '✅ Mínimo 6 caracteres';
      reqLength.style.color = '#28a745';
    } else {
      reqLength.innerHTML = '❌ Mínimo 6 caracteres';
      reqLength.style.color = '#dc3545';
    }
    
    // Validar coincidência
    const reqMatch = document.getElementById('req-match');
    if (novaSenha === confirmarSenha && novaSenha.length > 0) {
      reqMatch.innerHTML = '✅ Senhas coincidem';
      reqMatch.style.color = '#28a745';
    } else {
      reqMatch.innerHTML = '❌ Senhas coincidem';
      reqMatch.style.color = '#dc3545';
    }
  }
  
  async checkFirstLogin() {
    try {
      // Obter usuário atual
      const { data: { user }, error } = await this.supabase.auth.getUser();
      
      if (error || !user) {
        console.log('🔐 Usuário não logado, ignorando verificação de primeiro login');
        return;
      }
      
      // Buscar profile para verificar first_login_completed
      const { data: profile, error: profileError } = await this.supabase
        .from('profiles')
        .select('first_login_completed, nome')
        .eq('id', user.id)
        .single();
      
      if (profileError || !profile) {
        console.log('🔐 Profile não encontrado, ignorando primeiro login');
        return;
      }
      
      console.log('🔐 Estado do primeiro login:', { first_login_completed: profile.first_login_completed });
      
      // Se primeiro login não foi completado, mostrar modal
      if (!profile.first_login_completed) {
        console.log('🔐 Primeiro login pendente, mostrando modal');
        this.showModal();
      } else {
        console.log('👤 Usuário já realizou primeiro acesso anteriormente');
      }
      
    } catch (error) {
      console.error('❌ Erro ao verificar primeiro login:', error);
    }
  }
  
  showModal() {
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Focar no primeiro campo
    setTimeout(() => {
      document.getElementById('senhaAtual').focus();
    }, 100);
  }
  
  hideModal() {
    this.modal.style.display = 'none';
    document.body.style.overflow = '';
  }
  
  async handlePasswordChange() {
    if (this.isProcessing) {
      console.log('🔄 Processamento já em andamento, aguardando...');
      return;
    }
    
    this.isProcessing = true;
    const btnTrocarSenha = document.getElementById('btnTrocarSenha');
    
    try {
      // Obter valores
      const senhaAtual = document.getElementById('senhaAtual').value;
      const novaSenha = document.getElementById('novaSenha').value;
      const confirmarSenha = document.getElementById('confirmarSenha').value;
      
      // Validações
      if (!senhaAtual || !novaSenha || !confirmarSenha) {
        throw new Error('Preencha todos os campos');
      }
      
      if (novaSenha.length < 6) {
        throw new Error('A nova senha deve ter pelo menos 6 caracteres');
      }
      
      if (novaSenha !== confirmarSenha) {
        throw new Error('A nova senha e a confirmação não coincidem');
      }
      
      // Desabilitar botão e mostrar loading
      btnTrocarSenha.disabled = true;
      btnTrocarSenha.innerHTML = '<span class="btn-icon">⏳</span> Processando...';
      
      console.log('🔐 Iniciando troca de senha...');
      
      // 1. Verificar senha atual
      const { error: signInError } = await this.supabase.auth.signInWithPassword({
        email: (await this.supabase.auth.getUser()).data.user.email,
        password: senhaAtual
      });
      
      if (signInError) {
        throw new Error('Senha temporária incorreta');
      }
      
      // 2. Atualizar senha
      const { error: updateError } = await this.supabase.auth.updateUser({
        password: novaSenha
      });
      
      if (updateError) {
        throw new Error('Erro ao atualizar senha: ' + updateError.message);
      }
      
      // 3. Marcar primeiro login como completado
      const { error: profileError } = await this.supabase
        .from('profiles')
        .update({ first_login_completed: true })
        .eq('id', (await this.supabase.auth.getUser()).data.user.id);
      
      if (profileError) {
        console.warn('⚠️ Erro ao atualizar profile:', profileError);
      }
      
      console.log('✅ Senha alterada com sucesso!');
      
      // 4. Mostrar sucesso
      this.showSuccess();
      
      // 5. Recarregar página após 2 segundos
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('❌ Erro na troca de senha:', error);
      this.showError(error.message);
    } finally {
      // Reabilitar botão
      btnTrocarSenha.disabled = false;
      btnTrocarSenha.innerHTML = '<span class="btn-icon">🔐</span> Alterar Senha';
      this.isProcessing = false;
    }
  }
  
  showSuccess() {
    const alertHTML = `
      <div class="alert alert-success" style="position: fixed; top: 20px; right: 20px; z-index: 10000; min-width: 300px;">
        <strong>✅ Sucesso!</strong> Senha alterada com sucesso. Recarregando...
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', alertHTML);
    
    // Remover após 3 segundos
    setTimeout(() => {
      const alert = document.querySelector('.alert-success');
      if (alert) alert.remove();
    }, 3000);
  }
  
  showError(message) {
    const alertHTML = `
      <div class="alert alert-danger" style="position: fixed; top: 20px; right: 20px; z-index: 10000; min-width: 300px;">
        <strong>❌ Erro!</strong> ${message}
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', alertHTML);
    
    // Remover após 5 segundos
    setTimeout(() => {
      const alert = document.querySelector('.alert-danger');
      if (alert) alert.remove();
    }, 5000);
  }
}

// Exportar para uso global
window.FirstLoginManager = FirstLoginManager;
