// Página de Empresas
// DEPENDÊNCIAS: window.services, window.showAlert

console.log('[empresasPage.js] Loading...');

window.EmpresasPage = class EmpresasPage {
  constructor() {
    // ✅ FASE 3.5: STATELESS
    this.empresaEditando = null;
    this.saving = false;
  }

  // ================================
  // CACHE BOUNDARY CHECK (FASE 4.2)
  // ================================
  _beforeRenderAudit() {
    if (typeof window.assertNoEntityCacheLeak === 'function') {
      window.assertNoEntityCacheLeak(this, 'EmpresasPage');
    }
  }

  // ✅ FASE 3.5: Alias services para acesso ao DataCore
  get services() {
    return window.services;
  }

  // 🎯 MÉTODO OBRIGATÓRIO: Contrato de bootstrap FSM
  async initializePage() {
    // ⚠️ VALIDAÇÃO FRONTEND: Apenas admin pode acessar (secundária)
    // A validação REAL acontece no backend (Edge Function)
    if (!this._isAdmin()) {
      window.showAlert?.('Acesso negado. Apenas administradores podem acessar esta página.', 'error');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2000);
      return;
    }

    await this.initialize();
    await this.renderPage();
  }

  /**
   * ⚠️ VALIDAÇÃO FRONTEND (SECUNDÁRIA)
   * Verifica se usuário atual é admin
   * A validação REAL acontece no backend (Edge Function)
   */
  _isAdmin() {
    const authz = window.authAuthorization || (window.AuthAuthorization && window.createAuthAuthorization && window.createAuthAuthorization());
    if (authz) {
      return authz.isAdmin();
    }

    // Fallback: verificar role no user_metadata
    const state = window.authFSM?.getState?.();
    const role = state?.session?.user?.user_metadata?.role || state?.session?.user?.app_metadata?.role;
    return role === 'admin';
  }

  async initialize() {
    this.setupButtons();
  }

  // ✅ FASE 3.5: Entry point único - sempre fetch fresco do DataCore
  async renderPage() {
    this._beforeRenderAudit();

    const empresas = await this.services.empresas.list();
    this.renderTable(empresas);
    this.updateStats(empresas);
  }

  setupButtons() {
    // Botão nova empresa
    const btnNova = document.getElementById('btnNovaEmpresa');
    if (btnNova) {
      btnNova.addEventListener('click', () => this.openModal());
    } else {
      console.error('❌ Botão Nova Empresa não encontrado!');
    }

    // Botão atualizar
    const btnAtualizar = document.getElementById('btnAtualizar');
    if (btnAtualizar) {
      btnAtualizar.addEventListener('click', () => this.refreshEmpresas());
    } else {
      console.error('❌ Botão Atualizar não encontrado!');
    }

    // Botão fechar modal
    const btnFecharModal = document.getElementById('btnFecharModal');
    if (btnFecharModal) {
      btnFecharModal.addEventListener('click', () => this.closeModal());
    }

    // Botão cancelar
    const btnCancelar = document.getElementById('btnCancelar');
    if (btnCancelar) {
      btnCancelar.addEventListener('click', () => this.closeModal());
    }

    // Botão salvar
    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) {
      btnSalvar.addEventListener('click', () => this.saveEmpresa());
    }

    // Botão reset senha
    const btnResetSenha = document.getElementById('btnResetSenha');
    if (btnResetSenha) {
      btnResetSenha.addEventListener('click', () => this.abrirModalNovaSenha());
    }

    // Event listeners do modal de nova senha
    const btnFecharModalNovaSenha = document.getElementById('btnFecharModalNovaSenha');
    const btnCancelarNovaSenha = document.getElementById('btnCancelarNovaSenha');
    const btnConfirmarNovaSenha = document.getElementById('btnConfirmarNovaSenha');

    if (btnFecharModalNovaSenha) {
      btnFecharModalNovaSenha.addEventListener('click', () => this.fecharModalNovaSenha());
    }

    if (btnCancelarNovaSenha) {
      btnCancelarNovaSenha.addEventListener('click', () => this.fecharModalNovaSenha());
    }

    if (btnConfirmarNovaSenha) {
      btnConfirmarNovaSenha.addEventListener('click', () => this.confirmarNovaSenha());
    }

    // Busca
    const buscaInput = document.getElementById('buscaEmpresa');
    if (buscaInput) {
      buscaInput.addEventListener('input', (e) => this.handleBusca(e.target.value));
    }
  }

  renderTable(empresas) {
    const tbody = document.getElementById('tabelaEmpresas');
    if (!tbody) {
      console.error('❌ Tabela de empresas não encontrada');
      return;
    }

    tbody.innerHTML = '';

    if (!Array.isArray(empresas) || empresas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhuma empresa cadastrada</td></tr>';
      return;
    }

    empresas.forEach((empresa, index) => {
      const row = this.createEmpresaRow(empresa);
      tbody.appendChild(row);
    });
  }

  createEmpresaRow(empresa) {
    const row = document.createElement('tr');
    
    const nome = empresa.nome || 'Sem nome';
    const email = empresa.email || 'Sem email';
    const adminInfo = empresa.admin_nome ? ` (Admin: ${empresa.admin_nome})` : '';
    
    row.innerHTML = `
      <td>${nome}</td>
      <td>${email}${adminInfo}</td>
      <td><code>${empresa.id?.substring(0, 8) || '-'}...</code></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="window.empresasPage.editEmpresa('${empresa.id}')">
          Editar
        </button>
        <button class="btn btn-sm btn-danger" onclick="window.empresasPage.confirmarExclusao('${empresa.id}')">
          Excluir
        </button>
      </td>
    `;
    
    return row;
  }

  updateStats(empresas) {
    const totalEl = document.getElementById('totalEmpresas');
    const adminsEl = document.getElementById('totalAdmins');

    if (totalEl) {
      totalEl.textContent = Array.isArray(empresas) ? empresas.length : 0;
    }
    if (adminsEl) {
      adminsEl.textContent = Array.isArray(empresas)
        ? empresas.filter(e => e.admin_id).length
        : 0;
    }
  }

  handleBusca(termo) {
    const tbody = document.getElementById('tabelaEmpresas');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    const termoLower = termo.toLowerCase();

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(termoLower) ? '' : 'none';
    });
  }

  async refreshEmpresas() {
    console.log('[EmpresasPage] Refreshing...');
    const btn = document.getElementById('btnAtualizar');
    if (btn) btn.classList.add('loading');

    await this.renderPage();

    if (btn) btn.classList.remove('loading');
    window.showAlert?.('Lista atualizada!', 'success');
  }

  openModal() {
    // Se não for edição, mostrar campos de senha e definir título
    if (!this.empresaEditando) {
      this.resetModalToCreate();
    }
    // Se for edição, título e campos já foram definidos no editEmpresa
    
    // Usar showModal para abrir com display: flex
    this.showModal('modalEmpresa');
  }

  resetModalToCreate() {
    this.empresaEditando = null;
    
    // Definir título
    const titulo = document.getElementById('modalTitulo');
    if (titulo) {
      titulo.textContent = 'Nova Empresa';
    }

    // Limpar campos
    document.getElementById('nomeEmpresa').value = '';
    document.getElementById('emailAdmin').value = '';
    document.getElementById('senhaAdmin').value = '';
    
    // Mostrar campos de senha (só para criação)
    const senhaField = document.getElementById('senhaAdmin')?.parentElement;
    if (senhaField) {
      senhaField.style.display = 'block';
    }
    
    // Esconder botão reset senha (só para edição)
    const btnResetSenha = document.getElementById('btnResetSenha');
    if (btnResetSenha) {
      btnResetSenha.style.display = 'none';
    }
    
    // Resetar botão salvar
    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) {
      btnSalvar.innerHTML = '<span class="btn-icon">💾</span> Criar Empresa';
    }
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    } else {
      console.error(`Modal #${modalId} não encontrado`);
    }
  }

  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    } else {
      console.error(`Modal #${modalId} não encontrado`);
    }
  }

  closeModal() {
    this.hideModal('modalEmpresa');
    
    // Esconder botão reset senha ao fechar
    const btnResetSenha = document.getElementById('btnResetSenha');
    if (btnResetSenha) {
      btnResetSenha.style.display = 'none';
    }
    
    this.empresaEditando = null;
  }

  async saveEmpresa() {
    if (this.saving) {
      console.warn('[EmpresasPage] Save already in progress');
      return;
    }

    // Coletar dados do formulário
    const nome = document.getElementById('nomeEmpresa')?.value?.trim();
    const email = document.getElementById('emailAdmin')?.value?.trim();
    const password = document.getElementById('senhaAdmin')?.value;

    // Definir campos obrigatórios baseados no modo
    const isEditing = !!this.empresaEditando;
    const requiredFields = isEditing 
      ? ['nomeEmpresa'] 
      : ['nomeEmpresa', 'emailAdmin', 'senhaAdmin'];

    // Validar campos obrigatórios com mensagem padrão
    if (!window.validateFormFields({ requiredFields })) {
      return;
    }

    // Validar email se fornecido
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      window.showAlert?.('Email inválido', 'error');
      return;
    }

    this.saving = true;
    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) {
      btnSalvar.disabled = true;
      btnSalvar.innerHTML = '<span class="btn-icon">⏳</span> Salvando...';
    }

    try {
      if (this.empresaEditando) {
        // 🎯 MODO EDIÇÃO
        const dadosParaSalvar = {
          nome: nome,
          email: email || this.empresaEditando.email
          // Não atualiza senha aqui - teria que ser via reset separado
        };
        
        await this.services.empresas.update(this.empresaEditando.id, dadosParaSalvar);
        
        window.showAlert?.('Empresa atualizada com sucesso!', 'success');
        this.closeModal();
        await this.renderPage();
        
      } else {
        // 🎯 MODO CRIAÇÃO (Edge Function)
        // Validação de senha (mínimo 6 caracteres)
        if (password.length < 6) {
          window.showAlert?.('A senha deve ter pelo menos 6 caracteres', 'error');
          return;
        }

        // Obter token de acesso
        const state = window.authFSM?.getState?.();
        const accessToken = state?.session?.access_token;

        if (!accessToken) {
          throw new Error('Sessão não encontrada. Faça login novamente.');
        }

        console.log('[EmpresasPage] Criando empresa via Edge Function...');

        const result = await this.services.empresas.createWithAuth(
          { nome, email, password },
          accessToken
        );

        console.log('[EmpresasPage] Empresa criada:', result);

        this.closeModal();
        await this.renderPage();

        // Mostrar mensagem de sucesso com dados
        const mensagem = `Operação realizada com sucesso!\n\n` +
          `Empresa: "${nome}"\n` +
          `ID da Empresa: ${result.empresa_id}\n` +
          `ID do Admin: ${result.user_id}\n\n` +
          `O administrador pode fazer login com:\n` +
          `Email: ${email}\n` +
          `Senha: (a senha definida)`;

        this.showSuccessWithCopy(mensagem, result.empresa_id);
      }

    } catch (error) {
      console.error('[EmpresasPage] Erro ao salvar empresa:', error);
      window.showAlert?.(error.message || 'Erro ao salvar empresa', 'error');
    } finally {
      this.saving = false;
      if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = `<span class="btn-icon">💾</span> ${this.empresaEditando ? 'Salvar' : 'Criar Empresa'}`;
      }
    }
  }

  /**
   * Mostrar sucesso com opção de copiar para clipboard
   */
  showSuccessWithCopy(mensagem, copyText) {
    // Criar modal customizado
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal';
    modalDiv.style.display = 'flex';
    modalDiv.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>✅ Sucesso!</h3>
          <button type="button" class="btn-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <pre style="white-space: pre-wrap; background: #f3f4f6; padding: 16px; border-radius: 8px; font-size: 14px;">${mensagem}</pre>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
            Fechar
          </button>
          <button type="button" class="btn btn-primary" id="btnCopyId">
            📋 Copiar ID
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modalDiv);

    // Configurar botão de copiar
    const btnCopy = modalDiv.querySelector('#btnCopyId');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(copyText).then(() => {
          btnCopy.textContent = '✅ Copiado!';
          setTimeout(() => {
            btnCopy.textContent = '📋 Copiar ID';
          }, 2000);
        });
      });
    }

    // Fechar ao clicar fora
    modalDiv.addEventListener('click', (e) => {
      if (e.target === modalDiv) {
        modalDiv.remove();
      }
    });
  }

  /**
   * Editar empresa - similar ao padrão de Profissionais
   */
  async editEmpresa(id) {
    console.log('[EmpresasPage] editEmpresa() - id:', id);
    
    const empresas = await this.services.empresas.list();
    const empresa = empresas.find(e => String(e.id) === String(id));
    
    if (!empresa) {
      console.error('[EmpresasPage] editEmpresa() - Empresa não encontrada:', id);
      window.showAlert?.('Empresa não encontrada', 'error');
      return;
    }
    
    console.log('[EmpresasPage] editEmpresa() - Found:', empresa.nome);
    
    this.empresaEditando = empresa;
    this.populateModal(empresa);
    this.openModal();
    
    // Definir título como "Editar Empresa"
    const titulo = document.getElementById('modalTitulo');
    if (titulo) {
      titulo.textContent = 'Editar Empresa';
    }
  }

  populateModal(empresa) {
    document.getElementById('nomeEmpresa').value = empresa.nome || '';
    document.getElementById('emailAdmin').value = empresa.email || '';
    document.getElementById('senhaAdmin').value = '';
    
    // Em edição, esconder campo senha (não é permitido alterar diretamente)
    const senhaField = document.getElementById('senhaAdmin')?.parentElement;
    if (senhaField) {
      senhaField.style.display = 'none';
    }
    
    // Mostrar botão reset senha (apenas em edição)
    const btnResetSenha = document.getElementById('btnResetSenha');
    if (btnResetSenha) {
      btnResetSenha.style.display = 'inline-flex';
    }
    
    // Atualizar texto do botão salvar
    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) {
      btnSalvar.innerHTML = '<span class="btn-icon">💾</span> Salvar';
    }
  }

  /**
   * Abrir modal de nova senha
   */
  abrirModalNovaSenha() {
    // Fechar modal de edição
    const modalEdicao = document.getElementById('modalEmpresa');
    if (modalEdicao) {
      modalEdicao.style.display = 'none';
    }

    // Limpar campos
    document.getElementById('novaSenhaInput').value = '';
    document.getElementById('confirmarSenhaInput').value = '';

    // Abrir modal de nova senha
    this.showModal('modalNovaSenha');
  }

  /**
   * Fechar modal de nova senha
   */
  fecharModalNovaSenha() {
    this.hideModal('modalNovaSenha');
  }

  /**
   * Confirmar e executar reset de senha
   */
  async confirmarNovaSenha() {
    const novaSenha = document.getElementById('novaSenhaInput').value;
    const confirmarSenha = document.getElementById('confirmarSenhaInput').value;
    
    // Validar campos obrigatórios com mensagem padrão
    const requiredFields = ['novaSenhaInput', 'confirmarSenhaInput'];
    if (!window.validateFormFields({ requiredFields })) {
      return;
    }
    
    if (novaSenha.length < 8) {
      window.showAlert?.('A senha deve ter pelo menos 8 caracteres', 'error');
      return;
    }
    
    if (novaSenha !== confirmarSenha) {
      window.showAlert?.('As senhas não coincidem', 'error');
      return;
    }

    try {
      if (!this.empresaEditando?.admin_id) {
        throw new Error('Empresa não possui administrador associado');
      }

      console.log('[EmpresasPage] Reset de senha para admin:', this.empresaEditando.admin_id);

      await this.services.empresas.resetPassword(
        this.empresaEditando.admin_id,
        novaSenha
      );

      window.showAlert?.('Senha redefinida com sucesso!', 'success');
      this.fecharModalNovaSenha();
      
    } catch (error) {
      console.error('❌ Erro ao redefinir senha:', error);
      window.showAlert?.('Erro ao redefinir senha: ' + error.message, 'error');
    }
  }

  /**
   * Confirmar exclusão de empresa - similar ao padrão de Profissionais
   */
  async confirmarExclusao(empresaId) {
    const empresas = await this.services.empresas.list();
    const empresa = empresas.find(e => String(e.id) === String(empresaId));
    
    if (!empresa) {
      window.showAlert?.('Empresa não encontrada', 'error');
      return;
    }
    
    try {
      // Usar confirmDelete padrão do sistema
      const confirmed = await window.confirmDelete({
        title: 'Excluir Empresa',
        message: `Tem certeza que deseja excluir esta empresa?`,
        itemName: empresa.nome,
        confirmText: 'Excluir Empresa'
      });

      if (!confirmed) {
        return;
      }
      
      window.showAlert?.('Excluindo empresa...', 'info');
      
      // Excluir empresa
      await this.services.empresas.delete(empresa.id);
      
      window.showAlert?.('Empresa excluída com sucesso!', 'success');
      await this.renderPage();
      
    } catch (error) {
      console.error('❌ Erro ao excluir empresa:', error);
      window.showAlert?.('Erro ao excluir empresa: ' + error.message, 'error');
    }
  }
}

console.log('[empresasPage.js] Loaded - window.EmpresasPage:', typeof window.EmpresasPage);
