// Página de Profissionais
class ProfissionaisPage {
  constructor() {
    this.profissionais = [];
    this.profissionalEditando = null;
    this.profissionaisPorId = {};
    this.coresProfissionais = {};
  }

  async initializeSpecificPage() {
    console.log('Inicializando página de profissionais...');
    await this.initialize();
    this.renderProfessionalTable();
  }

  async initialize() {
    console.log('ProfissionaisPage iniciada');
    
    // Configurar botões
    this.setupProfessionalButtons();
    
    // Carregar profissionais
    await this.loadProfissionais();
    this.renderProfessionalTable();
  }

  setupProfessionalButtons() {
    // Botão novo profissional
    const btnNovo = document.getElementById('btnNovoProfissional');
    if (btnNovo) {
      btnNovo.addEventListener('click', () => this.openNewProfessionalModal());
      console.log('✅ Botão Novo Profissional configurado');
    } else {
      console.error('❌ Botão Novo Profissional não encontrado!');
    }

    // Botão salvar profissional
    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) {
      btnSalvar.addEventListener('click', () => this.saveProfessional());
      console.log('✅ Botão Salvar configurado');
    } else {
      console.error('❌ Botão Salvar não encontrado!');
    }

    // Botão excluir profissional
    const btnExcluir = document.getElementById('btnExcluir');
    if (btnExcluir) {
      btnExcluir.addEventListener('click', () => this.confirmDelete());
      console.log('✅ Botão Excluir configurado');
    } else {
      console.error('❌ Botão Excluir não encontrado!');
    }

    // Botão fechar modal
    const btnFecharModal = document.getElementById('btnFecharModal');
    if (btnFecharModal) {
      btnFecharModal.addEventListener('click', () => this.closeModal());
      console.log('✅ Botão Fechar Modal configurado');
    } else {
      console.error('❌ Botão Fechar Modal não encontrado!');
    }

    // Configurar formatação automática do telefone
    this.setupPhoneFormatting();
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
        } else if (digits.length === 7) {
          // Início do hífen no formato fixo
          e.target.value = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        } else if (digits.length <= 10) {
          // Formato fixo: (DD) XXXX-XXXX
          e.target.value = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
        } else if (digits.length === 11) {
          // Formato celular: (DD) XXXXX-XXXX
          e.target.value = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
        } else {
          // Limitar a 11 dígitos
          e.target.value = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
        }
      });
      console.log('✅ Formatação automática de telefone configurada');
    }
  }

  async renderPage() {
    console.log('Renderizando página de profissionais...');
    await this.loadProfissionais();
    this.renderProfessionalTable();
  }

  async updateStatistics() {
    console.log('Atualizando estatísticas de profissionais...');
    // Implementar se necessário
  }

  async loadProfissionais() {
    try {
      console.log('Carregando profissionais...');
      this.profissionais = await window.dataManager.getProfissionais();
      
      // Criar mapa de profissionais por ID
      this.profissionaisPorId = {};
      this.profissionais.forEach(p => {
        this.profissionaisPorId[p.id] = p;
      });
      
      // Gerar cores para profissionais
      this.coresProfissionais = this.gerarCoresProfissionais(this.profissionais);
      
      console.log('Profissionais carregados:', this.profissionais.length);
    } catch (error) {
      console.error('Erro ao carregar profissionais:', error);
      UIUtils.showAlert('Erro ao carregar profissionais', 'error');
    }
  }

  gerarCoresProfissionais(profissionais) {
    const cores = {};
    profissionais.forEach(profissional => {
      cores[profissional.id] = profissional.cor_calendario || '#8b5cf6';
    });
    return cores;
  }

  renderProfessionalTable() {
    console.log('🎨 Iniciando renderProfessionalTable...');
    console.log('📊 Profissionais disponíveis:', this.profissionais);
    
    const tbody = document.getElementById('tabelaProfissionais');
    if (!tbody) {
      console.error('❌ Elemento tabelaProfissionais não encontrado!');
      return;
    }

    console.log('✅ Elemento tbody encontrado:', tbody);
    tbody.innerHTML = '';

    if (this.profissionais.length === 0) {
      console.log('⚠️ Nenhum profissional encontrado');
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="text-center">Nenhum profissional encontrado</td>
        </tr>
      `;
      return;
    }

    console.log(`📊 Renderizando ${this.profissionais.length} profissionais...`);
    this.profissionais.forEach((profissional, index) => {
      console.log(`👤 Renderizando profissional ${index + 1}:`, profissional);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${profissional.nome}</td>
        <td>${profissional.telefone || '-'}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="window.profissionaisPage.editProfessional(${profissional.id})">
            <i class="fas fa-edit"></i> Editar
          </button>
          <button class="btn btn-sm btn-danger" onclick="window.profissionaisPage.deleteProfessional(${profissional.id})">
            <i class="fas fa-trash"></i> Excluir
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    console.log('✅ Renderização concluída!');
  }

  openNewProfessionalModal() {
    this.profissionalEditando = null;
    this.clearForm();
    document.getElementById('modalTitulo').textContent = 'Novo Profissional';
    document.getElementById('btnExcluir').style.display = 'none';
    this.showModal('modalProfissional');
  }

  editProfessional(id) {
    const profissional = this.profissionaisPorId[id];
    if (!profissional) return;

    this.profissionalEditando = profissional;
    this.fillForm(profissional);
    document.getElementById('modalTitulo').textContent = 'Editar Profissional';
    document.getElementById('btnExcluir').style.display = 'inline-block';
    this.showModal('modalProfissional');
  }

  fillForm(profissional) {
    document.getElementById('nomeProfissional').value = profissional.nome || '';
    document.getElementById('telefoneProfissional').value = profissional.telefone || '';
    document.getElementById('emailProfissional').value = profissional.email || '';
    
    // Verificar se usuário é admin para permitir edição do nome
    const userProfile = window.authManager?.currentUserProfile;
    const isAdmin = userProfile?.role === 'admin';
    
    if (!isAdmin) {
      // Desabilitar edição do nome apenas para não-admins
      document.getElementById('nomeProfissional').disabled = true;
    } else {
      // Permitir edição do nome para admin
      document.getElementById('nomeProfissional').disabled = false;
      console.log('👑 Admin detectado - edição de nome permitida');
    }
  }

  clearForm() {
    // Limpar campos individualmente
    document.getElementById('nomeProfissional').value = '';
    document.getElementById('telefoneProfissional').value = '';
    document.getElementById('emailProfissional').value = '';
    document.getElementById('nomeProfissional').disabled = false;
    console.log('✅ Formulário limpo');
  }

  async saveProfessional() {
    console.log('saveProfessional chamado');
    
    try {
        // Coletar dados
        const nome = document.getElementById('nomeProfissional').value.trim();
        const telefone = document.getElementById('telefoneProfissional').value.trim();
        const email = document.getElementById('emailProfissional').value.trim();

        console.log('Dados coletados:', { nome, telefone, email });

        // Validacao
        const errors = [];
        
        if (!nome) {
            errors.push('O nome do profissional e obrigatorio');
        } else if (nome.length < 3) {
            errors.push('O nome deve ter pelo menos 3 caracteres');
        }
        
        if (!telefone) {
            errors.push('WhatsApp do profissional e obrigatorio');
        }
        
        if (telefone && !this.isValidPhone(telefone)) {
            errors.push('WhatsApp invalido. Use o formato (DDD) 00000-0000');
        }
        
        if (!email) {
            errors.push('Email do profissional e obrigatorio');
        } else if (!this.isValidEmail(email)) {
            errors.push('Email invalido');
        }
        
        if (errors.length > 0) {
            this.showError(errors[0]);
            return;
        }

        const btnSalvar = document.getElementById('btnSalvar');
        UIUtils.showLoading(btnSalvar);

        // DADOS APENAS CAMPOS EXISTENTES NO BANCO
        const dadosParaSalvar = {
            nome: nome,
            telefone: telefone,
            email: email
        };

        console.log('Salvando profissional:', dadosParaSalvar);

        if (this.profissionalEditando) {
            await window.dataManager.updateProfissional(this.profissionalEditando.id, dadosParaSalvar);
            this.showSuccess('Profissional atualizado com sucesso');
        } else {
            if (this.profissionais.some(p => p.nome === nome)) {
                this.showError('Ja existe um profissional com este nome');
                return;
            }
            
            if (this.profissionais.some(p => p.email === email)) {
                this.showError('Este email já está cadastrado para outro profissional');
                return;
            }
            
            await window.dataManager.addProfissional(dadosParaSalvar);
            this.showSuccess('Profissional criado com sucesso');
        }
        
        await this.renderPage();
        this.closeModal();
        console.log('saveProfessional concluido com sucesso');
        
    } catch (error) {
        console.error('Erro no saveProfessional():', error);
        this.showError('Erro ao salvar profissional: ' + error.message);
    } finally {
        const btnSalvar = document.getElementById('btnSalvar');
        UIUtils.hideLoading(btnSalvar);
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone) {
    // Aceita ambos os formatos: (DD) XXXX-XXXX (14 chars) ou (DDD) XXXXX-XXXX (15 chars)
    const phoneRegex = /^\(\d{2}\) \d{4,5}-\d{4}$/;
    const isValid = phoneRegex.test(phone);
    
    // Verificar se tem exatamente 14 ou 15 caracteres (incluindo espaço)
    const hasCorrectLength = phone.length === 14 || phone.length === 15;
    
    return isValid && hasCorrectLength;
  }

  showError(message) {
    UIUtils.showAlert(message, 'error');
  }

  showSuccess(message) {
    UIUtils.showAlert(message, 'success');
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  closeModal() {
    const modal = document.getElementById('modalProfissional');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  }

  async deleteProfessional(id) {
    const profissional = this.profissionaisPorId[id];
    if (!profissional) return;

    const confirmed = await window.ConfirmDialog.confirmDelete({
      title: 'Excluir Profissional',
      message: 'Tem certeza que deseja excluir este profissional?',
      itemName: profissional.nome,
      confirmText: 'Excluir Profissional'
    });

    if (!confirmed) {
      return;
    }

    try {
      await window.dataManager.deleteProfissional(id);
      this.showSuccess('Profissional excluído com sucesso');
      
      // Forçar recarregamento dos dados do banco e renderizar novamente
      await this.loadProfissionais();
      await this.renderProfessionalTable();
    } catch (error) {
      console.error('Erro ao excluir profissional:', error);
      this.showError('Erro ao excluir profissional');
    }
  }

  async loadProfissionais() {
    try {
      console.log('Carregando profissionais...');
      // Forçar recarregamento para obter dados atualizados
      this.profissionais = await window.dataManager.getProfissionais(true);
      
      // Criar mapa de profissionais por ID
      this.profissionaisPorId = {};
      this.profissionais.forEach(p => {
        this.profissionaisPorId[p.id] = p;
      });
      
      // Gerar cores para profissionais
      this.coresProfissionais = this.gerarCoresProfissionais(this.profissionais);
      
      console.log('Profissionais carregados:', this.profissionais.length);
    } catch (error) {
      console.error('Erro ao carregar profissionais:', error);
      UIUtils.showAlert('Erro ao carregar profissionais', 'error');
    }
  }
}

// Exportar para uso global
window.ProfissionaisPage = ProfissionaisPage;
