// Página de Profissionais
class ProfissionaisPage extends PageManager {
  constructor() {
    super();
    this.profissionais = [];
    this.profissionalEditando = null;
    this.profissionaisPorId = {};
    this.coresProfissionais = {};
    this.saving = false;
  }

  async initializeSpecificPage() {
    console.log('Inicializando página de profissionais...');
    
    // Configurar botões
    this.setupProfessionalButtons();
    
    await this.initialize();
    this.renderProfessionalTable();
  }

  async initialize() {
    console.log('ProfissionaisPage iniciada');
    
    // Carregar profissionais
    await this.loadProfissionais();
    this.renderProfessionalTable();
  }

  setupProfessionalButtons() {
    // Botão novo profissional
    const btnNovo = document.getElementById('btnNovoProfissional');
    if (btnNovo) {
      btnNovo.addEventListener('click', () => this.openModal());
      console.log('✅ Botão Novo Profissional configurado');
    } else {
      console.error('❌ Botão Novo Profissional não encontrado!');
    }

    // Botão atualizar
    const btnAtualizar = document.getElementById('btnAtualizar');
    if (btnAtualizar) {
      btnAtualizar.addEventListener('click', () => this.refreshProfissionais());
      console.log('✅ Botão Atualizar configurado');
    } else {
      console.error('❌ Botão Atualizar não encontrado!');
    }

    // Botão excluir removido temporariamente
    console.log('✅ Botão Excluir removido para limpeza');

    // Botão fechar modal
    const btnFecharModal = document.getElementById('btnFecharModal');
    if (btnFecharModal) {
      btnFecharModal.addEventListener('click', () => this.closeModal());
      console.log('✅ Botão Fechar Modal configurado');
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
      btnResetSenha.addEventListener('click', () => this.handleResetSenhaDireto());
    }
    
    console.log('✅ Botões do modal configurados');
  }
  
  // MÉTODO DE RESET DE SENHA DIRETO - USANDO PADRÃO DO SISTEMA
  async handleResetSenhaDireto() {
    if (!this.profissionalEditando) {
      this.showError('Nenhum profissional selecionado para reset de senha');
      return;
    }
    
    const btnReset = document.getElementById('btnResetSenha');
    
    // PROTEÇÃO CONTRA MÚLTIPLOS CLIQUES
    if (btnReset.disabled) {
      console.log('⚠️ Reset de senha já em andamento...');
      return;
    }
    
    try {
      // CONFIRMAÇÃO COM CONFIRMDIALOG PADRÃO
      const confirmacao = await window.ConfirmDialog.confirmDelete({
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
      
      console.log('🔐 Iniciando reset de senha direto para:', this.profissionalEditando.email);
      
      const resultado = await window.dataManager.resetarSenhaDireto(
        this.profissionalEditando.email
      );
      
      console.log('✅ Reset de senha concluído:', resultado);
      
      // EXIBIR SENHA COM PADRÃO DO SISTEMA
      const mensagemCompleta = 
        `Senha redefinida com sucesso!\n\n` +
        `📧 Email: ${resultado.email}\n` +
        `🔑 Nova Senha: ${resultado.senhaTemporaria}\n\n` +
        `📋 Copie esta senha e envie ao profissional.\n` +
        `Ele deverá usá-la para fazer login e depois alterá-la.`;
      
      await this.showSuccessWithCopy(mensagemCompleta, resultado.senhaTemporaria);
      
      setTimeout(() => {
        this.closeModal();
      }, 3000);
      
    } catch (error) {
      console.error('❌ Erro ao resetar senha:', error);
      this.showError(`Erro ao resetar senha: ${error.message}`);
    } finally {
      btnReset.disabled = false;
      btnReset.innerHTML = '<span class="btn-icon">🔑</span> Resetar Senha';
    }
  }
  
  // MÉTODO AUXILIAR PARA EXIBIR SENHA COM PADRÃO DO SISTEMA
  async showSuccessWithCopy(mensagem, senhaParaCopiar) {
    try {
      console.log('🔐 Exibindo modal de sucesso com senha...');
      
      // Usar ConfirmDialog padrão do sistema
      const confirmed = await window.ConfirmDialog.confirmDelete({
        title: 'Senha Redefinida',
        message: mensagem,  // A mensagem já contém a senha
        itemName: '',  // Removido para não duplicar
        confirmText: '📋 Copiar Senha',
        cancelText: 'Fechar'
      });

      if (confirmed) {
        // Copiar senha para o clipboard
        await navigator.clipboard.writeText(senhaParaCopiar);
        console.log('✅ Senha copiada para o clipboard');
      }
      
    } catch (error) {
      console.error('❌ Erro ao exibir modal de sucesso:', error);
      this.showError('Erro ao processar senha: ' + error.message);
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

  async loadProfissionais() {
    try {
      console.log('Carregando profissionais...');
      this.profissionais = await window.dataManager.getProfissionais();
      
      // Criar mapa de profissionais por ID
      this.profissionaisPorId = {};
      this.profissionais.forEach(profissional => {
        this.profissionaisPorId[profissional.id] = profissional; // ✅ CORRIGIDO: nome correto da variável
      });
      
      console.log('Profissionais carregados:', this.profissionais.length);
      console.log('🔍 Dados dos profissionais para renderização:', this.profissionais);
    } catch (error) {
      console.error('Erro ao carregar profissionais:', error);
      this.showError('Erro ao carregar profissionais');
    }
  }

  async refreshProfissionais() {
    await this.loadProfissionais();
    this.renderProfessionalTable();
    this.showSuccess('Profissionais atualizados com sucesso');
  }

  renderProfessionalTable() {
    const tbody = document.getElementById('tabelaProfissionais');
    if (!tbody) {
      console.error('❌ Elemento tabelaProfissionais não encontrado');
      return;
    }

    console.log('🔍 Renderizando tabela com', this.profissionais.length, 'profissionais');
    tbody.innerHTML = '';

    this.profissionais.forEach(profissional => {
      const row = this.createProfessionalRow(profissional);
      tbody.appendChild(row);
    });
    
    console.log('✅ Tabela renderizada com sucesso');
  }

  createProfessionalRow(profissional) {
    const row = document.createElement('tr');
    
    // ✅ CORRIGIDO: Usar dados completos que o DataManager retorna
    const nome = profissional.nome || `Profissional ${profissional.id}`;
    const email = profissional.email || 'Email não informado';
    const telefone = profissional.telefone || 'Não informado';
    
    console.log('🔍 Renderizando profissional:', {
      id: profissional.id,
      nome: nome,
      email: email,
      telefone: telefone
    });
    
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

  editProfessional(id) {
    const profissional = this.profissionaisPorId[id];
    if (!profissional) {
      this.showError('Profissional não encontrado');
      return;
    }

    this.profissionalEditando = profissional;
    this.populateModal(profissional);
    this.openModal();
  }

  populateModal(profissional) {
    document.getElementById('nomeProfissional').value = profissional.nome || '';
    document.getElementById('emailProfissional').value = profissional.email || '';
    document.getElementById('telefoneProfissional').value = profissional.telefone || '';
    
    // Mostrar apenas botão de resetar senha
    document.getElementById('btnResetSenha').style.display = 'inline-block';
  }

  async confirmarExclusao(profissionalId) {
    console.log('🗑️ confirmarExclusao() chamado para ID:', profissionalId);
    
    // Buscar profissional
    const profissional = this.profissionaisPorId[profissionalId];
    if (!profissional) {
      this.showError('Profissional não encontrado');
      return;
    }
    
    console.log('📋 Profissional encontrado:', profissional);
    
    try {
      console.log('🔄 Abrindo modal de confirmação...');
      
      // Usar ConfirmDialog padrão do sistema (igual ao clientes)
      const confirmed = await window.ConfirmDialog.confirmDelete({
        title: 'Excluir Profissional',
        message: `Tem certeza que deseja excluir este profissional?`,
        itemName: profissional.nome,
        confirmText: 'Excluir Profissional'
      });

      console.log('📝 Resultado da confirmação:', confirmed);
      
      if (!confirmed) {
        console.log('❌ Usuário cancelou a exclusão');
        return;
      }
      
      console.log('🔄 Iniciando processo de exclusão...');
      this.showLoading('Excluindo profissional...');
      
      // Excluir em cascata: profissionais → profiles → auth.users
      const resultado = await window.dataManager.deleteProfissional(profissional.id);
      console.log('✅ Resultado da exclusão:', resultado);
      
      this.showSuccess(resultado.message || 'Profissional excluído com sucesso');
      await this.refreshProfissionais();
      
    } catch (error) {
      console.error('❌ Erro ao excluir profissional:', error);
      this.showError('Erro ao excluir profissional: ' + error.message);
    } finally {
      this.hideLoading();
    }
  }

  async saveProfessional() {
    if (this.saving) {
      console.log('⚠️ saveProfessional já está em execução, ignorando chamada duplicada');
      return;
    }
    
    this.saving = true;
    
    try {
      // Coletar dados do formulário
      const nome = document.getElementById('nomeProfissional').value.trim();
      const telefone = document.getElementById('telefoneProfissional').value.trim();
      const email = document.getElementById('emailProfissional').value.trim();
      
      // Validações
      if (!nome) {
        this.showError('Nome é obrigatório');
        return;
      }
      
      if (!email) {
        this.showError('Email é obrigatório');
        return;
      }
      
      if (!this.isValidEmail(email)) {
        this.showError('Email inválido');
        return;
      }
      
      const dadosParaSalvar = {
        nome: nome,
        telefone: telefone,
        email: email
      };

      if (this.profissionalEditando) {
        // Editar profissional existente
        await window.dataManager.updateProfissional(this.profissionalEditando.id, dadosParaSalvar);
        this.showSuccess('Profissional atualizado com sucesso');
      } else {
        // Criar novo profissional
        if (this.profissionais.some(p => p.nome === nome)) {
          this.showError('Já existe um profissional com este nome');
          return;
        }
        
        if (this.profissionais.some(p => p.email === email)) {
          this.showError('Este email já está cadastrado para outro profissional');
          return;
        }
        
        await window.dataManager.addProfissional(dadosParaSalvar);
        this.showSuccess('Profissional criado com sucesso');
      }
      
      await this.refreshProfissionais();
      this.closeModal();
      
    } catch (error) {
      console.error('Erro ao salvar profissional:', error);
      this.showError('Erro ao salvar profissional: ' + error.message);
    } finally {
      this.saving = false;
    }
  }

  openModal() {
    const modal = document.getElementById('modalProfissional');
    if (modal) {
      modal.style.display = 'block';
      console.log('✅ Modal aberto');
    } else {
      console.error('❌ Modal não encontrado');
    }
  }

  closeModal() {
    const modal = document.getElementById('modalProfissional');
    if (modal) {
      modal.style.display = 'none';
      console.log('✅ Modal fechado');
    }
    
    // Limpar formulário
    document.getElementById('nomeProfissional').value = '';
    document.getElementById('emailProfissional').value = '';
    document.getElementById('telefoneProfissional').value = '';
    
    // Esconder botão de resetar senha
    document.getElementById('btnResetSenha').style.display = 'none';
    
    // Limpar profissional editando
    this.profissionalEditando = null;
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  showError(message) {
    alert(message); // Substituir por seu sistema de alertas
  }

  showSuccess(message) {
    alert(message); // Substituir por seu sistema de alertas
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
