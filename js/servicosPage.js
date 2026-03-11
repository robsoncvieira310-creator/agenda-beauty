// Lógica específica da página de serviços
class ServicosPage extends PageManager {
  constructor() {
    super();
    console.log("🚀 ServicosPage iniciada");
    this.currentPage = 'servicos';
    this.servicos = [];
    this.servicoEditando = null;
    
    // VERSÃO ORIGINAL
    // this.init();
    
    // NOVA IMPLEMENTAÇÃO V1.2 - EVENTO appReady
    document.addEventListener('appReady', () => {
      console.log('🚀 appReady recebido em ServicosPage');
      this.init();
    });
  }

  async init() {
    console.log("🔄 Inicializando página de serviços");
    await this.loadServicos();
  }

  // NOVA IMPLEMENTAÇÃO V1.2 - MÉTODO initializeSpecificPage() PARA COMPATIBILIDADE
  async initializeSpecificPage() {
    console.log("📋 Inicializando página de serviços (V1.2)");
    
    // Configurar botões específicos
    this.setupServiceButtons();
    
    // Renderizar tabela inicial
    await this.renderPage();
    
    // Carregar estatísticas
    await this.updateStatistics();
  }

  async loadServicos() {
    console.log("🔍 Carregando serviços do Supabase...");
    try {
      this.servicos = await window.dataManager.loadServicos();
      console.log("✅ Serviços encontrados:", this.servicos);
      this.renderServiceTable();
      await this.updateStatistics();
    } catch (error) {
      console.error("❌ Erro ao carregar serviços:", error);
      this.servicos = [];
      this.renderServiceTable();
    }
  }

  needsAgendamentos() {
    return true; // Serviços precisa de agendamentos para estatísticas
  }

  setupServiceButtons() {
    // Botão novo serviço
    const btnNovo = document.getElementById('btnNovoServico');
    if (btnNovo) {
      btnNovo.addEventListener('click', () => this.openNewServiceModal());
    }

    // Botão salvar serviço
    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) {
      btnSalvar.addEventListener('click', () => this.saveService());
    }

    // Botão excluir serviço
    const btnExcluir = document.getElementById('btnExcluir');
    if (btnExcluir) {
      btnExcluir.addEventListener('click', () => this.deleteService());
    }
  }

  async renderPage() {
    console.log("📋 renderPage() - Carregando serviços...");
    try {
      // NOVA IMPLEMENTAÇÃO V1.2 - FORÇAR CARREGAMENTO DIRETO
      console.log("🔍 Forçando carregamento direto do Supabase...");
      this.servicos = await window.dataManager.loadServicos();  // Força carregamento
      console.log("✅ Serviços carregados:", this.servicos);
      console.log("📊 Quantidade de serviços:", this.servicos.length);
      
      // NOVA IMPLEMENTAÇÃO V1.2 - VERIFICAR ESTRUTURA DOS DADOS
      if (this.servicos.length > 0) {
        console.log("🔍 Estrutura do primeiro serviço:", this.servicos[0]);
        console.log("🔍 Campos disponíveis:", Object.keys(this.servicos[0]));
      }
      
      this.renderServiceTable();
    } catch (error) {
      console.error("❌ Erro ao carregar serviços em renderPage():", error);
      this.servicos = [];
      this.renderServiceTable();
    }
  }

  renderServiceTable() {
    console.log("🎨 renderServiceTable() - Renderizando tabela...");
    console.log("📋 Serviços disponíveis para renderizar:", this.servicos);
    
    const tbody = document.getElementById('tabelaServicos');
    if (!tbody) {
      console.error('❌ Tabela de serviços não encontrada');
      return;
    }

    console.log("� tbody encontrado, limpando conteúdo...");
    tbody.innerHTML = '';

    if (this.servicos.length === 0) {
      console.log("⚠️ Nenhum serviço encontrado - mostrando estado vazio");
      this.renderEmptyState(tbody, 'Nenhum serviço cadastrado', '💇', 'openNewServiceModal()');
      return;
    }

    console.log(`✅ Renderizando ${this.servicos.length} serviços...`);
    this.servicos.forEach((servico, index) => {
      console.log(`🔍 Processando serviço ${index + 1}:`, servico);
      
      const agendamentosCount = window.dataManager.agendamentos.filter(a => a.servico === servico.nome).length;
      console.log(`🔍 Agendamentos encontrados para ${servico.nome}: ${agendamentosCount}`);
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="service-name">
            <strong>${servico.nome}</strong>
            ${servico.descricao ? `<br><small class="text-muted">${servico.descricao.substring(0, 50)}...</small>` : ''}
          </div>
        </td>
        <td>
          <span class="badge badge-primary">${servico.duracao_minutos || servico.duracao || 0} min</span>
        </td>
        <td>
          <span class="badge badge-success">${this.formatCurrency(servico.valor || servico.preco || 0)}</span>
        </td>
        <td>
          <span class="badge badge-info">${agendamentosCount} agendamentos</span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn btn-sm btn-warning" onclick="pageManager.editService('${servico.nome}')" title="Editar">
              <span class="btn-icon">✏️</span>
            </button>
            <button class="btn btn-sm btn-danger" onclick="pageManager.confirmDelete('${servico.nome}')" title="Excluir">
              <span class="btn-icon">🗑️</span>
            </button>
          </div>
        </td>
      `;
      
      console.log(`🔍 Adicionando linha ${index + 1} ao tbody...`);
      tbody.appendChild(tr);
    });
    
    console.log("✅ Tabela renderizada com sucesso");
    console.log(`🔍 tbody agora tem ${tbody.children.length} filhos`);
  }

  async updateStatistics() {
    try {
      if (this.servicos.length === 0) {
        this.updateStatisticsDOM(0, 0, 0);
        return;
      }

      const duracoes = this.servicos.map(s => s.duracao_minutos || s.duracao || 0);
      const valores = this.servicos.map(s => s.valor || 0);
      
      const duracaoMedia = duracoes.reduce((a, b) => a + b, 0) / duracoes.length;
      const valorMedio = valores.reduce((a, b) => a + b, 0) / valores.length;

      this.updateStatisticsDOM(this.servicos.length, Math.round(duracaoMedia), valorMedio);
    } catch (error) {
      console.error('Erro ao atualizar estatísticas:', error);
    }
  }

  updateStatisticsDOM(total, duracaoMedia, valorMedio) {
    const totalElement = document.getElementById('totalServicos');
    const duracaoElement = document.getElementById('duracaoMedia');
    const valorElement = document.getElementById('valorMedio');

    if (totalElement) totalElement.textContent = total;
    if (duracaoElement) duracaoElement.textContent = duracaoMedia;
    if (valorElement) valorElement.textContent = this.formatCurrency(valorMedio);
  }

  handleSearch(term) {
    const filtrados = this.servicos.filter(servico => 
      servico.nome.toLowerCase().includes(term.toLowerCase()) ||
      (servico.descricao && servico.descricao.toLowerCase().includes(term.toLowerCase()))
    );
    
    const tbody = document.getElementById('tabelaServicos');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (filtrados.length === 0) {
      this.renderEmptyState(tbody, `Nenhum serviço encontrado para "${term}"`, '🔍');
      return;
    }

    filtrados.forEach(servico => {
      const agendamentosCount = window.dataManager.agendamentos.filter(a => a.servico === servico.nome).length;
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${servico.nome}</strong></td>
        <td><span class="badge badge-primary">${servico.duracao_minutos || servico.duracao || 0} min</span></td>
        <td><span class="badge badge-success">${this.formatCurrency(servico.valor || 0)}</span></td>
        <td><span class="badge badge-info">${agendamentosCount}</span></td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="pageManager.editService('${servico.nome}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="pageManager.confirmDelete('${servico.nome}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  openNewServiceModal() {
    this.servicoEditando = null;
    document.getElementById('modalTitulo').textContent = 'Novo Serviço';
    document.getElementById('btnExcluir').style.display = 'none';
    this.clearForm('modalServico');
    this.showModal('modalServico');
  }

  editService(nome) {
    const servico = this.servicos.find(s => s.nome === nome);
    if (!servico) return;

    this.servicoEditando = servico;
    document.getElementById('modalTitulo').textContent = 'Editar Serviço';
    document.getElementById('btnExcluir').style.display = 'inline-block';
    
    // Preencher formulário
    document.getElementById('nomeServico').value = servico.nome || '';
    document.getElementById('duracaoServico').value = servico.duracao_minutos || servico.duracao || '';
    document.getElementById('valorServico').value = servico.valor || '';
    document.getElementById('descricaoServico').value = servico.descricao || '';
    
    // Desabilitar edição do nome
    document.getElementById('nomeServico').disabled = true;
    
    this.showModal('modalServico');
  }

  async saveService() {
    const nome = document.getElementById('nomeServico').value.trim();
    const duracao = parseInt(document.getElementById('duracaoServico').value) || 0;
    const valor = parseFloat(document.getElementById('valorServico').value) || 0;
    const descricao = document.getElementById('descricaoServico').value.trim();

    // VERSÃO ORIGINAL
    // Validação
    // const errors = this.validateForm(['nomeServico', 'duracaoServico']);
    // if (errors.length > 0) {
    //   this.showError(errors[0]);
    //   return;
    // }

    // if (duracao <= 0) {
    //   this.showError('Duração deve ser maior que 0');
    //   return;
    // }

    // if (valor < 0) {
    //   this.showError('Valor não pode ser negativo');
    //   return;
    // }
    
    // NOVA IMPLEMENTAÇÃO V1.2 - VALIDAÇÃO COMPLETA
    const errors = [];
    
    // Validação de nome obrigatório
    if (!nome) {
      errors.push('O nome do serviço é obrigatório');
    } else if (nome.length < 3) {
      errors.push('O nome deve ter pelo menos 3 caracteres');
    }
    
    // Validação de duração obrigatória e positiva
    if (!duracao || duracao <= 0) {
      errors.push('A duração deve ser maior que 0 minutos');
    } else if (duracao > 480) { // máximo 8 horas
      errors.push('A duração não pode exceder 8 horas (480 minutos)');
    }
    
    // Validação de valor obrigatório e positivo
    if (valor === null || valor === undefined || valor <= 0) {
      errors.push('O valor deve ser maior que 0');
    } else if (valor > 10000) { // máximo R$ 10.000
      errors.push('O valor não pode exceder R$ 10.000,00');
    }
    
    // Se houver erros, mostrar primeiro erro
    if (errors.length > 0) {
      this.showToast(errors[0], 'error');
      return;
    }

    const btnSalvar = document.getElementById('btnSalvar');
    UIUtils.showLoading(btnSalvar);

    try {
      if (this.servicoEditando) {
        // Atualizar serviço
        await window.dataManager.updateServico(this.servicoEditando.id, {
          nome, duracao, duracao_minutos: duracao, valor, descricao
        });
        this.showSuccess('Serviço atualizado com sucesso');
      } else {
        // Verificar se já existe
        if (this.servicos.some(s => s.nome === nome)) {
          this.showError('Já existe um serviço com este nome');
          return;
        }
        
        // Criar novo serviço
        await window.dataManager.addServico({ 
          nome, 
          duracao, 
          duracao_minutos: duracao, 
          valor, 
          descricao 
        });
        this.showSuccess('Serviço criado com sucesso');
      }

      await this.renderPage();
      await this.updateStatistics();
      this.closeModal();
    } catch (error) {
      console.error('Erro ao salvar serviço:', error);
      this.showError('Erro ao salvar serviço');
    } finally {
      UIUtils.hideLoading(btnSalvar);
    }
  }

  confirmDelete(nome) {
    if (confirm(`Tem certeza que deseja excluir o serviço "${nome}"? Esta ação não pode ser desfeita.`)) {
      this.deleteServiceByName(nome);
    }
  }

  async deleteServiceByName(nome) {
    const servico = this.servicos.find(s => s.nome === nome);
    if (!servico) return;

    try {
      await window.dataManager.deleteServico(servico.id);
      this.showToast('Serviço excluído com sucesso!', 'success');
      await this.renderPage();
      await this.updateStatistics();
    } catch (error) {
      console.error('Erro ao excluir serviço:', error);
      this.showToast('Erro ao excluir serviço', 'error');
    }
  }

  async deleteService() {
    if (!this.servicoEditando) return;
    this.deleteServiceByName(this.servicoEditando.nome);
  }
}

// Exportar para uso global
window.ServicosPage = ServicosPage;
