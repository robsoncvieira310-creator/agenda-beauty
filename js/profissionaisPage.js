// Lógica específica da página de profissionais
class ProfissionaisPage extends PageManager {
  constructor() {
    super();
    this.currentPage = 'profissionais';
    this.profissionais = [];
    this.profissionalEditando = null;
    this.coresDisponiveis = [
      "#3b82f6", "#10b981", "#f97316", "#ec4899", "#8b5cf6", 
      "#f59e0b", "#ef4444", "#06b6d4", "#84cc16", "#a855f7"
    ];
    console.log('✅ ProfissionaisPage iniciada');
    
    // VERSÃO ORIGINAL
    // Forçar inicialização específica após o DOM estar pronto
    // setTimeout(() => {
    //   this.initializeSpecificPage();
    // }, 100);
    
    // NOVA IMPLEMENTAÇÃO V1.2 - EVENTO appReady
    document.addEventListener('appReady', () => {
      console.log('🚀 appReady recebido em ProfissionaisPage');
      this.initializeSpecificPage();
    });
  }

  needsAgendamentos() {
    return true; // Profissionais precisa de agendamentos para estatísticas
  }

  async initializeSpecificPage() {
    console.log('👩 Inicializando página de profissionais...');
    
    // Configurar botões específicos
    this.setupProfessionalButtons();
    
    // Configurar color picker
    this.setupColorPicker();
    
    // Renderizar tabela inicial
    await this.renderPage();
    
    // Carregar estatísticas
    await this.updateStatistics();
  }

  setupProfessionalButtons() {
    // Botão novo profissional
    const btnNovo = document.getElementById('btnNovoProfissional');
    if (btnNovo) {
      btnNovo.addEventListener('click', () => this.openNewProfessionalModal());
    }

    // Botão salvar profissional
    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) {
      btnSalvar.addEventListener('click', () => this.saveProfessional());
    }

    // Botão excluir profissional
    const btnExcluir = document.getElementById('btnExcluir');
    if (btnExcluir) {
      btnExcluir.addEventListener('click', () => this.deleteProfessional());
    }
  }

  setupColorPicker() {
    // Sincronizar color picker com campo hex
    const colorPicker = document.getElementById('corCalendario');
    const colorHex = document.getElementById('corHex');
    const btnCorAleatoria = document.getElementById('btnCorAleatoria');

    if (colorPicker && colorHex) {
      colorPicker.addEventListener('input', (e) => {
        colorHex.value = e.target.value;
      });

      colorHex.addEventListener('input', (e) => {
        if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
          colorPicker.value = e.target.value;
        }
      });
    }

    if (btnCorAleatoria) {
      btnCorAleatoria.addEventListener('click', () => {
        const cor = this.generateRandomColor();
        if (colorPicker) colorPicker.value = cor;
        if (colorHex) colorHex.value = cor;
      });
    }
  }

  async renderPage() {
    console.log("🔄 Renderizando página de profissionais...");
    
    // NOVA IMPLEMENTAÇÃO V1.2 - FORÇAR CARREGAMENTO DIRETO
    try {
      console.log("🔍 Forçando carregamento direto do Supabase...");
      this.profissionais = await window.dataManager.loadProfissionais();  // Força carregamento
      console.log("✅ Profissionais obtidos do DataManager:", this.profissionais);
      console.log("📊 Quantidade de profissionais:", this.profissionais.length);
    } catch (error) {
      console.error("❌ Erro ao carregar profissionais:", error);
      this.profissionais = [];
    }
    
    // Renderizar tabela
    this.renderProfessionalTable();
  }

  renderProfessionalTable() {
    console.log("🎨 Iniciando renderProfessionalTable...");
    
    const tbody = document.getElementById('tabelaProfissionais');
    if (!tbody) {
      console.error('❌ Tabela de profissionais não encontrada');
      return;
    }
    
    tbody.innerHTML = '';

    if (this.profissionais.length === 0) {
      this.renderEmptyState(tbody, 'Nenhum profissional cadastrado', '👩', 'openNewProfessionalModal()');
      return;
    }

    console.log(`📊 Renderizando ${this.profissionais.length} profissionais...`);
    this.profissionais.forEach((profissional, index) => {
      const agendamentosCount = window.dataManager.agendamentos.filter(a => a.profissional === profissional.nome).length;
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="professional-name">
            <strong>${profissional.nome}</strong>
            ${profissional.telefone ? `<br><small class="text-muted">${this.formatPhone(profissional.telefone)}</small>` : ''}
          </div>
        </td>
        <td>${profissional.email || '-'}</td>
        <td>${profissional.especialidade || '-'}</td>
        <td>
          <div class="color-sample" style="background-color: ${profissional.cor_calendario || '#3b82f6'}; width: 20px; height: 20px; border-radius: 4px; border: 1px solid #ddd;"></div>
        </td>
        <td>
          <span class="badge badge-primary">${agendamentosCount} agendamentos</span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn btn-sm btn-warning" onclick="pageManager.editProfessional('${profissional.nome}')" title="Editar">
              <span class="btn-icon">✏️</span>
            </button>
            <button class="btn btn-sm btn-danger" onclick="pageManager.confirmDelete('${profissional.nome}')" title="Excluir">
              <span class="btn-icon">🗑️</span>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    console.log("✅ Renderização concluída!");
  }

  async updateStatistics() {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      // Agendamentos hoje
      const agendamentosHoje = dataManager.agendamentos.filter(a => {
        const dataAg = new Date(a.inicio);
        return dataAg >= hoje && dataAg < amanha;
      });

      // Profissional mais ativo (com mais agendamentos)
      const contagemPorProfissional = {};
      dataManager.agendamentos.forEach(a => {
        contagemPorProfissional[a.profissional] = (contagemPorProfissional[a.profissional] || 0) + 1;
      });

      const profissionalMaisAtivo = Object.entries(contagemPorProfissional)
        .sort(([,a], [,b]) => b - a)[0];

      this.updateStatisticsDOM(
        this.profissionais.length, 
        agendamentosHoje.length, 
        profissionalMaisAtivo ? profissionalMaisAtivo[0] : '-'
      );
    } catch (error) {
      console.error('Erro ao atualizar estatísticas:', error);
    }
  }

  updateStatisticsDOM(total, agendamentosHoje, maisAtivo) {
    const totalElement = document.getElementById('totalProfissionais');
    const agendamentosElement = document.getElementById('agendamentosHoje');
    const ativoElement = document.getElementById('profissionalAtivo');

    if (totalElement) totalElement.textContent = total;
    if (agendamentosElement) agendamentosElement.textContent = agendamentosHoje;
    if (ativoElement) ativoElement.textContent = maisAtivo;
  }

  handleSearch(term) {
    const filtrados = this.profissionais.filter(profissional => 
      profissional.nome.toLowerCase().includes(term.toLowerCase()) ||
      (profissional.especialidade && profissional.especialidade.toLowerCase().includes(term.toLowerCase())) ||
      (profissional.telefone && profissional.telefone.includes(term))
    );
    
    const tbody = document.getElementById('tabelaProfissionais');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (filtrados.length === 0) {
      this.renderEmptyState(tbody, `Nenhum profissional encontrado para "${term}"`, '🔍');
      return;
    }

    filtrados.forEach(profissional => {
      const agendamentosCount = dataManager.agendamentos.filter(a => a.profissional === profissional.nome).length;
      const cor = profissional.cor_calendario || '#3b82f6';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${profissional.nome}</strong></td>
        <td>${this.formatPhone(profissional.telefone)}</td>
        <td>${profissional.especialidade || '-'}</td>
        <td>
          <div class="color-display">
            <span class="color-badge" style="background-color: ${cor}"></span>
            <code class="color-code">${cor}</code>
          </div>
        </td>
        <td><span class="badge badge-primary">${agendamentosCount}</span></td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="pageManager.editProfessional('${profissional.nome}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="pageManager.confirmDelete('${profissional.nome}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  openNewProfessionalModal() {
    this.profissionalEditando = null;
    document.getElementById('modalTitulo').textContent = 'Novo Profissional';
    document.getElementById('btnExcluir').style.display = 'none';
    this.clearForm('modalProfissional');
    
    // Gerar cor aleatória para novo profissional
    const cor = this.generateRandomColor();
    const colorPicker = document.getElementById('corCalendario');
    const colorHex = document.getElementById('corHex');
    
    if (colorPicker) colorPicker.value = cor;
    if (colorHex) colorHex.value = cor;
    
    this.showModal('modalProfissional');
  }

  editProfessional(nome) {
    const profissional = this.profissionais.find(p => p.nome === nome);
    if (!profissional) return;

    this.profissionalEditando = profissional;
    document.getElementById('modalTitulo').textContent = 'Editar Profissional';
    document.getElementById('btnExcluir').style.display = 'inline-block';
    
    // Preencher formulário
    document.getElementById('nomeProfissional').value = profissional.nome || '';
    document.getElementById('telefoneProfissional').value = profissional.telefone || '';
    document.getElementById('especialidadeProfissional').value = profissional.especialidade || '';
    
    const cor = profissional.cor_calendario || '#3b82f6';
    const colorPicker = document.getElementById('corCalendario');
    const colorHex = document.getElementById('corHex');
    
    if (colorPicker) colorPicker.value = cor;
    if (colorHex) colorHex.value = cor;
    
    // Desabilitar edição do nome
    document.getElementById('nomeProfissional').disabled = true;
    
    this.showModal('modalProfissional');
  }

  async saveProfessional() {
    const nome = document.getElementById('nomeProfissional').value.trim();
    const telefone = document.getElementById('telefoneProfissional').value.trim();
    const especialidade = document.getElementById('especialidadeProfissional').value.trim();
    const corCalendario = document.getElementById('corCalendario').value;

    // VERSÃO ORIGINAL
    // Validação
    // const errors = this.validateForm(['nomeProfissional']);
    // if (errors.length > 0) {
    //   this.showError(errors[0]);
    //   return;
    // }

    // Validar formato da cor
    // if (!/^#[0-9A-F]{6}$/i.test(corCalendario)) {
    //   this.showError('Cor inválida');
    //   return;
    // }

    // Validar telefone se fornecido
    // if (telefone && !this.isValidPhone(telefone)) {
    //   this.showError('Telefone inválido');
    //   return;
    // }
    
    // NOVA IMPLEMENTAÇÃO V1.2 - VALIDAÇÃO COMPLETA
    const errors = [];
    
    // Validação de nome obrigatório
    if (!nome) {
      errors.push('O nome do profissional é obrigatório');
    } else if (nome.length < 3) {
      errors.push('O nome deve ter pelo menos 3 caracteres');
    }
    
    // Validação de telefone (opcional mas se preenchido deve ser válido)
    if (telefone && !this.isValidPhone(telefone)) {
      errors.push('Telefone inválido. Use o formato (XX) XXXXX-XXXX');
    }
    
    // Validação de especialidade (opcional mas se preenchida deve ter mínimo)
    if (especialidade && especialidade.length < 3) {
      errors.push('A especialidade deve ter pelo menos 3 caracteres');
    }
    
    // Validação de formato da cor
    if (!/^#[0-9A-F]{6}$/i.test(corCalendario)) {
      errors.push('Cor inválida. Use o formato #RRGGBB (ex: #FF0000)');
    }
    
    // Se houver erros, mostrar primeiro erro
    if (errors.length > 0) {
      this.showToast(errors[0], 'error');
      return;
    }

    const btnSalvar = document.getElementById('btnSalvar');
    UIUtils.showLoading(btnSalvar);

    try {
      if (this.profissionalEditando) {
        // Atualizar profissional
        await dataManager.updateProfissional(this.profissionalEditando.id, {
          nome, telefone, especialidade, cor_calendario: corCalendario
        });
        this.showSuccess('Profissional atualizado com sucesso');
      } else {
        // Verificar se já existe
        if (this.profissionais.some(p => p.nome === nome)) {
          this.showError('Já existe um profissional com este nome');
          return;
        }
        
        // Criar novo profissional
        await dataManager.addProfissional({ 
          nome, 
          telefone, 
          especialidade, 
          cor_calendario: corCalendario 
        });
        this.showSuccess('Profissional criado com sucesso');
      }

      await this.renderPage();
      await this.updateStatistics();
      this.closeModal();
    } catch (error) {
      console.error('Erro ao salvar profissional:', error);
      this.showError('Erro ao salvar profissional');
    } finally {
      UIUtils.hideLoading(btnSalvar);
    }
  }

  confirmDelete(nome) {
    if (confirm(`Tem certeza que deseja excluir o profissional "${nome}"? Esta ação não pode ser desfeita.`)) {
      this.deleteProfessionalByName(nome);
    }
  }

  async deleteProfessionalByName(nome) {
    const profissional = this.profissionais.find(p => p.nome === nome);
    if (!profissional) return;

    try {
      await dataManager.deleteProfissional(profissional.id);
      this.showSuccess('Profissional excluído com sucesso');
      await this.renderPage();
      await this.updateStatistics();
    } catch (error) {
      console.error('Erro ao excluir profissional:', error);
      this.showError('Erro ao excluir profissional');
    }
  }

  async deleteProfessional() {
    if (!this.profissionalEditando) return;
    this.deleteProfessionalByName(this.profissionalEditando.nome);
  }

  // Métodos utilitários
  generateRandomColor() {
    return this.coresDisponiveis[Math.floor(Math.random() * this.coresDisponiveis.length)];
  }

  isValidPhone(phone) {
    // Aceita formatos: (00) 00000-0000, 00000000000, 0000-0000
    const regex = /^(\(\d{2}\)\s?)?\d{4,5}-?\d{4}$/;
    return regex.test(phone.replace(/\s/g, ''));
  }

  // NOVA IMPLEMENTAÇÃO V1.2 - TOAST NOTIFICATIONS
  showToast(message, type = 'success') {
    // Criar elemento toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Adicionar estilos inline
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
      max-width: 300px;
      word-wrap: break-word;
    `;
    
    // Estilo por tipo
    switch(type) {
      case 'success':
        toast.style.backgroundColor = '#10b981';
        break;
      case 'error':
        toast.style.backgroundColor = '#ef4444';
        break;
      case 'warning':
        toast.style.backgroundColor = '#f59e0b';
        break;
      default:
        toast.style.backgroundColor = '#6b7280';
    }
    
    // Adicionar ao DOM
    document.body.appendChild(toast);
    
    // Animar entrada
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Remover após 3 segundos
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
}

// Exportar para uso global
window.ProfissionaisPage = ProfissionaisPage;
