// Página de Profissionais
// DEPENDÊNCIAS: window.services, window.showAlert

window.ProfissionaisPage = class ProfissionaisPage {
  constructor() {
    // ✅ FASE 3.5: STATELESS - Nenhum array persistente de entidade
    this.profissionalEditando = null;   // estado de UI (modal)
    this.coresProfissionais = {};       // estado de UI (cores)
    this.saving = false;                // estado de UI (loading)
    // REMOVIDO: profissionais[], __cycleCache, _profissionaisIndex
  }

  // ================================
  // CACHE BOUNDARY CHECK (FASE 4.2)
  // ================================
  _beforeRenderAudit() {
    // 🔒 ENFORCEMENT REAL: Falha explicitamente se cache proibido detectado
    if (typeof window.assertNoEntityCacheLeak === 'function') {
      window.assertNoEntityCacheLeak(this, 'ProfissionaisPage');
    }
  }

  // ✅ FASE 3.5: Alias services para acesso ao DataCore
  get services() {
    return window.services;
  }

  // 🎯 MÉTODO OBRIGATÓRIO: Contrato de bootstrap FSM
  async initializePage() {
    // ⚠️ VALIDAÇÃO FRONTEND: Apenas admin ou adm_empresa pode acessar (secundária)
    // A validação REAL acontece no backend (Edge Function)
    if (!this._canAccessProfissionaisPage()) {
      window.showAlert?.('Acesso negado. Apenas administradores podem acessar esta página.', 'error');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2000);
      return;
    }

    // 🔒 FASE 3.5: Entry point único - sempre fetch fresco do DataCore
    await this.initialize();
    await this.renderPage();
  }

  // 🎯 MÉTODO LEGADO: Mantido para compatibilidade
  async initializeSpecificPage() {
    console.warn('[ProfissionaisPage] initializeSpecificPage() is deprecated - use initializePage()');
    await this.initializePage();
  }

  async initialize() {
    // Configurar botões
    this.setupProfessionalButtons();
  }

  // ✅ FASE 3.5: Entry point único - sempre fetch fresco do DataCore
  async renderPage() {
    // 🔒 CACHE BOUNDARY ENFORCEMENT
    this._beforeRenderAudit();

    const profissionais = await this.services.profissionais.list();
    this.renderProfessionalTable(profissionais);
    await this.updateEstatisticas();
  }

  setupProfessionalButtons() {
    // Botão novo profissional - com controle de permissão
    const btnNovo = document.getElementById('btnNovoProfissional');
    if (btnNovo) {
      // Verificar permissão antes de configurar o botão
      if (!this._canCreateProfissionais()) {
        btnNovo.style.display = 'none';
        console.log('[ProfissionaisPage] Botão Novo Profissional oculto - usuário sem permissão');
      } else {
        btnNovo.addEventListener('click', () => this.openModal());
        console.log('[ProfissionaisPage] Botão Novo Profissional habilitado - usuário com permissão');
      }
    } else {
      console.error('❌ Botão Novo Profissional não encontrado!');
    }

    // Botão atualizar
    const btnAtualizar = document.getElementById('btnAtualizar');
    if (btnAtualizar) {
      btnAtualizar.addEventListener('click', () => this.refreshProfissionais());
    } else {
      console.error('❌ Botão Atualizar não encontrado!');
    }

    // Botão excluir removido temporariamente

    // Event listener para o campo de busca
    const buscaProfissional = document.getElementById('buscaProfissional');
    if (buscaProfissional) {
      buscaProfissional.addEventListener('input', (e) => {
        const termo = e.target.value;

        if (!termo.trim()) {
          this.renderPage();
          return;
        }

        this.filtrarProfissionais(termo);
      });
    }

    // Botão fechar modal
    const btnFecharModal = document.getElementById('btnFecharModal');
    if (btnFecharModal) {
      btnFecharModal.addEventListener('click', () => this.closeModal());
    } else {
      console.error('❌ Botão Fechar Modal não encontrado!');
    }

    // CONFIGURAÇÃO DOS BOTÕES DO MODAL
    this.setupModalButtons();
    
    // Configurar formatação automática do telefone
    this.setupPhoneFormatting();
  }

  setupModalButtons() {
    const btnSalvar = document.getElementById('btnSalvar');
    const btnFechar = document.getElementById('btnFecharModal');
    const btnResetSenha = document.getElementById('btnResetSenha');
    
    if (btnSalvar) {
      btnSalvar.addEventListener('click', () => this.saveProfessional());
    }
    
    // ✅ btnExcluir já configurado em setupProfessionalButtons()
    
    if (btnFechar) {
      btnFechar.addEventListener('click', () => this.closeModal());
    }
    
    if (btnResetSenha) {
      btnResetSenha.addEventListener('click', () => this.abrirModalNovaSenha());
    }

    // Event listeners do modal de nova senha
    const btnFecharModalNovaSenha = document.getElementById('btnFecharModalNovaSenha');
    const btnCancelarNovaSenha = document.getElementById('btnCancelarNovaSenha');

    if (btnFecharModalNovaSenha) {
      btnFecharModalNovaSenha.addEventListener('click', () => this.fecharModalNovaSenha());
    }

    if (btnCancelarNovaSenha) {
      btnCancelarNovaSenha.addEventListener('click', () => this.fecharModalNovaSenha());
    }
  }

  // Fechar modal de nova senha
  fecharModalNovaSenha() {
    this.hideModal('modalNovaSenha');
  }

  // Abrir modal de nova senha (UI apenas)
  abrirModalNovaSenha() {
    // FECHAR modal de edição (IMPORTANTE)
    const modalEdicao = document.getElementById('modalProfissional');
    if (modalEdicao) {
      modalEdicao.style.display = 'none';
    }

    // ABRIR modal de nova senha
    const modal = document.getElementById('modalNovaSenha');
    if (modal) {
      this.showModal('modalNovaSenha');
      
      // Configurar botão DENTRO do modal (IMPORTANTE)
      const btnConfirmarNovaSenha = document.getElementById('btnConfirmarNovaSenha');
      
      if (btnConfirmarNovaSenha) {
        btnConfirmarNovaSenha.onclick = () => {
          this.validarNovaSenha();
        };
      }
    } else {
      console.error('❌ Modal de nova senha não encontrado');
    }
  }

  // Validar nova senha (método placeholder)
  async validarNovaSenha() {
    const novaSenha = document.getElementById('novaSenhaInput').value;
    const confirmarSenha = document.getElementById('confirmarSenhaInput').value;
    
    // Validar campos obrigatórios com mensagem padrão
    const requiredFields = ['novaSenhaInput', 'confirmarSenhaInput'];
    if (!window.validateFormFields({ requiredFields })) {
      return;
    }
    
    if (novaSenha.length < 6) {
      showAlert('A senha deve ter pelo menos 6 caracteres', 'error');
      return;
    }
    
    if (novaSenha !== confirmarSenha) {
      showAlert('As senhas não coincidem', 'error');
      return;
    }

    try {
      // Obter sessão atual (padrão DataManager)
      const { data: { session }, error: sessionError } = await window.supabaseClient.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Sessão não encontrada');
      }

      // Usar profile_id (UUID) ao invés de id (número)
      const profileId = this.profissionalEditando.profile_id;

      const result = await this.services.profissionais.resetPassword(
        profileId,
        novaSenha,
        session.user.id,
        session.access_token
      );

            
      this.showSuccess('Senha redefinida com sucesso!');
      this.fecharModalNovaSenha();
      
    } catch (error) {
      console.error('❌ Erro ao redefinir senha:', error);
      showAlert('Erro ao redefinir senha: ' + error.message, 'error');
    }
  }

  // MÉTODO DE RESET DE SENHA DIRETO - USANDO PADRÃO DO SISTEMA
  async handleResetSenhaDireto() {
    if (!this.profissionalEditando) {
      showAlert('Nenhum profissional selecionado para reset de senha', 'error');
      return;
    }
    
    const btnReset = document.getElementById('btnResetSenha');
    
    // PROTEÇÃO CONTRA MÚLTIPLOS CLIQUES
    if (btnReset.disabled) {
      return;
    }
    
    try {
      // CONFIRMAÇÃO COM CONFIRMDIALOG PADRÃO
      const confirmacao = await window.confirmDelete({
        title: 'Redefinir Senha',
        message: `Deseja redefinir a senha do profissional "${this.profissionalEditando.nome}"?`,
        itemName: this.profissionalEditando.email,
        confirmText: 'Redefinir Senha'
      });
      
      if (!confirmacao) {
        return;
      }
      
      // PROTEGER BOTÃO
      btnReset.disabled = true;
      btnReset.innerHTML = '<span class="btn-icon">⏳</span> Gerando senha...';
      
      // TODO: Implementar reset de senha via Supabase Auth ou Edge Function
      const resultado = { senha_temporaria: 'temp123456' }; // Placeholder
      
      // EXIBIR SENHA COM PADRÃO DO SISTEMA
      const mensagemCompleta = 
        `Senha temporária gerada com sucesso!\n\n` +
        `Email: ${this.profissionalEditando.email}\n` +
        `Senha: ${resultado.senha_temporaria}\n\n` +
        `Copie esta senha e forneça ao profissional.\n` +
        `Ele precisará fazer login e alterá-la no primeiro acesso.\n\n` +
        `Deseja copiar a senha para a área de transferência?`;
      
      this.showSuccessWithCopy(mensagemCompleta, resultado.senha_temporaria);
      
      setTimeout(() => {
        this.closeModal();
      }, 3000);
      
    } catch (error) {
      console.error('❌ Erro ao resetar senha:', error);
      showAlert('Erro ao resetar senha: ' + error.message, 'error');
    } finally {
      btnReset.disabled = false;
      btnReset.innerHTML = '<span class="btn-icon">🔑</span> Resetar Senha';
    }
  }
  
  // MÉTODO AUXILIAR PARA EXIBIR SENHA COM PADRÃO DO SISTEMA
  async showSuccessWithCopy(mensagem, senhaParaCopiar) {
    try {
      // Usar confirmDelete padrão do sistema
      const confirmed = await window.confirmDelete({
        title: 'Senha Gerada com Sucesso',
        message: mensagem,
        confirmText: 'Copiar Senha',
        cancelText: 'Fechar'
      });

      if (confirmed) {
        // Copiar senha para o clipboard
        await navigator.clipboard.writeText(senhaParaCopiar);
      }
      
    } catch (error) {
      console.error('❌ Erro ao exibir modal de sucesso:', error);
      showAlert('Erro ao processar senha: ' + error.message, 'error');
    }
  }

  setupPhoneFormatting() {
    const telefoneInput = document.getElementById('telefoneProfissional');
    if (telefoneInput) {
      telefoneInput.addEventListener('input', (e) => {
        // Remover todos os caracteres não numéricos
        let digits = e.target.value.replace(/\D/g, '');
        
        // Formatar para celular (11 dígitos): (DDD) XXXXX-XXXX
        // Formatar para fixo (10 dígitos): (DD) XXXX-XXXX
        if (digits.length === 0) {
          e.target.value = '';
        } else if (digits.length <= 2) {
          e.target.value = `(${digits}`;
        } else if (digits.length <= 6) {
          e.target.value = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        } else if (digits.length <= 10) {
          e.target.value = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        } else {
          e.target.value = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
        }
      });
    }
  }

  // ✅ REMOVIDO: loadProfissionais() que armazenava em this.profissionais
  // Usar renderPage() ou fetch direto quando necessário

  async refreshProfissionais() {
    await this.renderPage();
    this.showSuccess('Profissionais atualizados com sucesso');
  }

  renderProfessionalTable(profissionais) {
    if (!profissionais) {
      return;
    }
    
    // 🎯 GARANTIR QUE É ARRAY
    const profissionaisArray = Array.isArray(profissionais) ? profissionais : 
                               (profissionais.data || profissionais.profissionais || []);
    
    const tbody = document.getElementById('tabelaProfissionais');
    if (!tbody) {
      console.error('[ProfissionaisPage] tabelaProfissionais element NOT FOUND!');
      return;
    }

    tbody.innerHTML = '';

    // ✅ FASE 3.5: Render direto do parâmetro (não usa this.profissionais)
    profissionaisArray.forEach((profissional, index) => {
      const row = this.createProfessionalRow(profissional);
      tbody.appendChild(row);
    });
  }

  async filtrarProfissionais(termo) {
    // ✅ STATELESS: Fetch direto do DataCore, depois filtra
    const profissionais = await window.services.profissionais.list();
    const termoLower = termo.toLowerCase().trim();
    const termoTelefone = termo.replace(/\D/g, '');

    const profissionaisFiltrados = profissionais.filter(profissional => {
      const nome = (profissional.nome || '').toLowerCase().trim();
      const telefone = (profissional.telefone || '').replace(/\D/g, '');
      const email = (profissional.email || '').toLowerCase().trim();

      const nomeMatch = nome.includes(termoLower);
      const telefoneMatch = termoTelefone
        ? telefone.includes(termoTelefone)
        : false;
      const emailMatch = email.includes(termoLower);

      return nomeMatch || telefoneMatch || emailMatch;
    });

    await this.renderProfessionalTable(profissionaisFiltrados);
  }

  async updateEstatisticas() {
    try {
            
      // 1. Atualizar total de profissionais
      const profissionais = await window.services.profissionais.list();
      const totalProfissionaisElement = document.getElementById('totalProfissionais');
      if (totalProfissionaisElement) {
        totalProfissionaisElement.textContent = profissionais.length;
      }
      
      // 2. Atualizar agendamentos de hoje (todos os profissionais)
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0); // Início do dia
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1); // Início do dia seguinte
      
      const agendamentos = await window.services.agendamentos.list();
      
      // Filtrar agendamentos de hoje
      const agendamentosHoje = agendamentos.filter(agendamento => {
        const dataAgendamento = new Date(agendamento.data_inicio || agendamento.inicio);
        return dataAgendamento >= hoje && dataAgendamento < amanha;
      });
      
      const agendamentosHojeElement = document.getElementById('agendamentosHoje');
      if (agendamentosHojeElement) {
        agendamentosHojeElement.textContent = agendamentosHoje.length;
      }
      
            
    } catch (error) {
      console.error('[ProfissionaisPage] Erro ao atualizar estatísticas:', error);
    }
  }

  createProfessionalRow(profissional) {
    const row = document.createElement('tr');
    
    // ✅ CORRIGIDO: Usar dados completos que o DataManager retorna
    const nome = profissional.nome || 'Sem nome';
    const email = profissional.email || 'Sem email';
    const telefone = profissional.telefone || 'Sem telefone';
    
    row.innerHTML = `
      <td>${nome}</td>
      <td>${email}</td>
      <td>${telefone}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="window.profissionaisPage.editProfessional('${profissional.id}')">
          Editar
        </button>
        <button class="btn btn-sm btn-danger" onclick="window.profissionaisPage.confirmarExclusao('${profissional.id}')">
          Excluir
        </button>
      </td>
    `;
    
    return row;
  }

  async editProfessional(id) {
    // ✅ FASE 3.5: Fetch direto do DataCore
    const profissionais = await this.services.profissionais.list();
    
    // 🎯 NORMALIZAR ID para comparação (string vs number)
    const normalizedId = String(id);
    const profissional = profissionais.find(p => String(p.id) === normalizedId);
    
    if (!profissional) {
      showAlert('Profissional não encontrado', 'error');
      return;
    }

    this.profissionalEditando = profissional;
    this.populateModal(profissional);
    this.openModal();

    // Definir título como "Editar Profissional"
    const titulo = document.getElementById('modalTitulo');
    if (titulo) {
      titulo.textContent = 'Editar Profissional';
    }
  }

  populateModal(profissional) {
    document.getElementById('nomeProfissional').value = profissional.nome || '';
    document.getElementById('emailProfissional').value = profissional.email || '';
    document.getElementById('telefoneProfissional').value = profissional.telefone || '';
    
    // Em edição, esconder campo senha (não é permitido alterar)
    const senhaField = document.getElementById('senhaProfissional').parentElement;
    if (senhaField) {
      senhaField.style.display = 'none';
    }
    
    // Mostrar apenas botão de resetar senha
    const btnResetSenha = document.getElementById('btnResetSenha');
    if (btnResetSenha) {
      btnResetSenha.style.display = 'inline-block';
      
      btnResetSenha.onclick = () => {
        this.abrirModalNovaSenha();
      };
    }
  }

  async confirmarExclusao(profissionalId) {
    // ✅ FASE 3.5: Fetch direto do DataCore
    const profissionais = await this.services.profissionais.list();
    
    // 🎯 NORMALIZAR ID para comparação (string vs number)
    const normalizedId = String(profissionalId);
    const profissional = profissionais.find(p => String(p.id) === normalizedId);
    
    if (!profissional) {
      showAlert('Profissional não encontrado', 'error');
      return;
    }
    
    try {
      
      // Usar confirmDelete padrão do sistema (igual ao clientes)
      const confirmed = await window.confirmDelete({
        title: 'Excluir Profissional',
        message: `Tem certeza que deseja excluir este profissional?`,
        itemName: profissional.nome,
        confirmText: 'Excluir Profissional'
      });

      if (!confirmed) {
        return;
      }
      
      this.showLoading('Excluindo profissional...');
      
      // Excluir em cascata: profissionais → profiles → auth.users
      const resultado = await this.services.profissionais.delete(profissional.id);
      
      this.showSuccess(resultado.message || 'Profissional excluído com sucesso');
      await this.refreshProfissionais();
      await this.updateEstatisticas();
      
    } catch (error) {
      console.error('❌ Erro ao excluir profissional:', error);
      showAlert('Erro ao excluir profissional: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  async saveProfessional() {
    if (this.saving) {
      return;
    }
    
    this.saving = true;
    
    try {
      // Coletar dados do formulário
      const nome = document.getElementById('nomeProfissional').value.trim();
      const telefone = document.getElementById('telefoneProfissional').value.trim();
      const email = document.getElementById('emailProfissional').value.trim();
      const senha = document.getElementById('senhaProfissional').value;
      
      // 🎯 FSM STATE-DRIVEN: Validação de campos obrigatórios baseada no estado
      const isNovoProfissional = !this.profissionalEditando;
      const requiredFields = isNovoProfissional 
        ? ['nomeProfissional', 'emailProfissional', 'senhaProfissional']
        : ['nomeProfissional', 'emailProfissional'];

      // Validar campos obrigatórios com mensagem padrão
      if (!window.validateFormFields({ requiredFields })) {
        this.saving = false;
        return;
      }
      
      // Validar email
      if (!this.isValidEmail(email)) {
        showAlert('Email inválido', 'error');
        this.saving = false;
        return;
      }
      
      // Validar tamanho da senha apenas se foi fornecida
      if (senha && senha.length < 6) {
        showAlert('Senha deve ter pelo menos 6 caracteres', 'error');
        this.saving = false;
        return;
      }
      
      // 🎯 FSM: Dados condicionais baseados no estado
      const dadosParaSalvar = {
        nome: nome,
        telefone: telefone,
        email: email,
        ...(senha ? { password: senha } : {})  // Só envia senha se preenchida
      };

      if (this.profissionalEditando) {
        await this.services.profissionais.update(this.profissionalEditando.id, dadosParaSalvar);
        this.showSuccess('Profissional atualizado com sucesso');
      } else {
        // Criar novo profissional
        // ✅ FASE 3.5: Fetch direto do DataCore para validação
        const profissionais = await this.services.profissionais.list();
        if (profissionais.some(p => p.nome === nome)) {
          showAlert('Já existe um profissional com este nome', 'error');
          return;
        }
        
        if (profissionais.some(p => p.email === email)) {
          showAlert('Este email já está cadastrado para outro profissional', 'error');
          return;
        }
        
        try {
          await this.services.profissionais.create(dadosParaSalvar);
          this.showSuccess('Operação realizada com sucesso');
        } catch (error) {
          console.error('❌ Erro ao criar profissional:', error.message);
          
          // Tratar erros específicos da Edge Function
          if (error.message.includes('Email já está registrado')) {
            showAlert('Email já está registrado. Use um email diferente.', 'error');
            return;
          }
          
          if (error.message.includes('Limite de criação excedido')) {
            showAlert('Limite de criação excedido. Tente novamente em alguns minutos.', 'error');
            return;
          }
          
          // Erro genérico
          showAlert('Erro ao salvar profissional: ' + error.message, 'error');
          return;
        }
      }
      
      await this.refreshProfissionais();
      await this.updateEstatisticas();
      this.closeModal();
      
    } catch (error) {
      console.error('❌ Erro ao salvar profissional:', error);
      showAlert('Erro ao salvar profissional: ' + error.message, 'error');
    } finally {
      this.saving = false;
    }
  }

  openModal() {
    // Se não for edição, mostrar campo senha e definir título como "Novo Profissional"
    if (!this.profissionalEditando) {
      const senhaField = document.getElementById('senhaProfissional').parentElement;
      if (senhaField) {
        senhaField.style.display = 'block';
      }
      
      // Definir título como "Novo Profissional"
      const titulo = document.getElementById('modalTitulo');
      if (titulo) {
        titulo.textContent = 'Novo Profissional';
      }
    }
    
    // Se for edição, esconder campo senha (já feito no populateModal)
    // e título já foi definido no editProfessional()
    
    // Usar showModal para abrir com display: flex
    this.showModal('modalProfissional');
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
    this.hideModal('modalProfissional');
    
    // Limpar formulário
    document.getElementById('nomeProfissional').value = '';
    document.getElementById('emailProfissional').value = '';
    document.getElementById('telefoneProfissional').value = '';
    document.getElementById('senhaProfissional').value = '';
    
    // Mostrar campo senha novamente (para próxima criação)
    const senhaField = document.getElementById('senhaProfissional').parentElement;
    if (senhaField) {
      senhaField.style.display = 'block';
    }
    
    // Esconder botão de resetar senha
    document.getElementById('btnResetSenha').style.display = 'none';
    
    // Limpar profissional editando
    this.profissionalEditando = null;
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * ⚠️ VALIDAÇÃO FRONTEND (SECUNDÁRIA)
   * Verifica se usuário atual pode acessar página profissionais
   * Permite admin e adm_empresa, bloqueia profissional
   * A validação REAL acontece no backend (Edge Function)
   */
  _canAccessProfissionaisPage() {
    const authz = window.authAuthorization || (window.AuthAuthorization && window.createAuthAuthorization && window.createAuthAuthorization());
    if (authz) {
      const role = this._getUserRole();
      return role === 'admin' || role === 'adm_empresa';
    }

    // Fallback: verificar role no user_metadata
    const state = window.authFSM?.getState?.();
    const role = state?.session?.user?.user_metadata?.role || state?.session?.user?.app_metadata?.role;
    return role === 'admin' || role === 'adm_empresa';
  }

  /**
   * ⚠️ VALIDAÇÃO FRONTEND (SECUNDÁRIA)
   * Verifica se usuário atual pode criar profissionais
   * Permite admin e adm_empresa, bloqueia profissional
   */
  _canCreateProfissionais() {
    return this._canAccessProfissionaisPage();
  }

  /**
   * 🔍 Obter role do usuário atual
   */
  _getUserRole() {
    try {
      const state = window.authFSM?.getState?.();
      const user = state?.session?.user;
      
      if (!user) {
        console.warn('[ProfissionaisPage] _getUserRole: No user found');
        return null;
      }

      // Prioridade: app_metadata (JWT) > user_metadata (legado)
      const role = user.app_metadata?.role || user.user_metadata?.role;
      console.log('[ProfissionaisPage] _getUserRole:', { userId: user.id, role });
      return role;
    } catch (e) {
      console.error('[ProfissionaisPage] _getUserRole error:', e);
      return null;
    }
  }

  
  showSuccess(message) {
    console.log('✅ SUCCESS:', message);
    showAlert(message, 'success');
  }

  showWarning(message) {
    console.log('⚠️ WARNING:', message);
    showAlert(message, 'warning');
  }

  showLoading(message = 'Carregando...') {
    // Criar ou mostrar loading overlay
    let loading = document.getElementById('loadingOverlay');
    if (!loading) {
      loading = document.createElement('div');
      loading.id = 'loadingOverlay';
      loading.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
        font-size: 18px;
      `;
      loading.innerHTML = `<div>${message}</div>`;
      document.body.appendChild(loading);
    } else {
      loading.querySelector('div').textContent = message;
      loading.style.display = 'flex';
    }
  }

  hideLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
      loading.style.display = 'none';
    }
  }
}

// Exportar para uso global
window.ProfissionaisPage = ProfissionaisPage;
