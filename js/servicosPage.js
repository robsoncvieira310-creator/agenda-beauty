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
    this.setupColorPicker();
    this.setupServiceButtons();
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
    
    // Botão X do header para fechar modal
    const btnFecharModal = document.getElementById('btnFecharModal');
    if (btnFecharModal) {
      btnFecharModal.addEventListener('click', () => this.closeModal());
    }
    
    console.log('✅ Botões de serviços configurados');
  }

  async renderPage() {
    console.log("📋 renderPage() - Carregando serviços...");
    try {
      // NOVA IMPLEMENTAÇÃO V1.2 - FORÇAR CARREGAMENTO DIRETO
      console.log("🔍 Forçando carregamento direto do Supabase...");
      
      try {
        this.servicos = await window.dataManager.loadServicos();  // Força carregamento
        console.log("✅ Serviços carregados:", this.servicos);
        console.log("📊 Quantidade de serviços:", this.servicos.length);
      } catch (loadError) {
        console.error("❌ Erro específico no loadServicos():", loadError);
        throw loadError;
      }
      
      // NOVA IMPLEMENTAÇÃO V1.2 - VERIFICAR ESTRUTURA DOS DADOS
      if (this.servicos.length > 0) {
        console.log("🔍 Estrutura do primeiro serviço:", this.servicos[0]);
        console.log("🔍 Campos disponíveis:", Object.keys(this.servicos[0]));
      }
      
      // Configurar botões (importante!)
      console.log("🔧 Configurando botões de serviços...");
      this.setupServiceButtons();
      console.log("✅ setupServiceButtons() chamado");
      
      // Configurar seletor de cores
      console.log("🎨 Configurando seletor de cores...");
      this.setupColorPicker();
      console.log("✅ setupColorPicker() chamado");
      
      console.log("🎨 Iniciando renderização da tabela...");
      this.renderServiceTable();
      console.log("✅ renderServiceTable() concluído");
    } catch (error) {
      console.error("❌ Erro ao carregar serviços em renderPage():", error);
      console.error("❌ Stack trace:", error.stack);
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
      const corServico = servico.cor || '#78909c';
      tr.innerHTML = `
        <td>
          <div class="service-name">
            <strong>${servico.nome}</strong>
            ${servico.descricao ? `<br><small class="text-muted">${servico.descricao.substring(0, 50)}...</small>` : ''}
          </div>
        </td>
        // Usar campos com compatibilidade para nova estrutura
        <td>
          <span class="badge badge-primary">${servico.duracao_min || servico.duracao_minutos || servico.duracao || 0} min</span>
        </td>
        <td>
          <span class="badge badge-success">${this.formatCurrency(servico.valor || servico.preco || 0)}</span>
        </td>
        <td>
          <div class="color-display">
            <div class="color-badge" style="background-color: ${corServico}; border-color: ${this.getDarkerColor(corServico)};"></div>
            <span class="color-code">${corServico.toUpperCase()}</span>
          </div>
        </td>
        <td>
          <span class="badge badge-info">${agendamentosCount} agendamentos</span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn btn-sm btn-warning" onclick="pageManager.editService('${servico.nome}')" title="Editar">
              <span class="btn-icon">✏️</span>
            </button>
            <button class="btn btn-sm btn-danger" onclick="confirmDelete('${servico.nome}')" title="Excluir">
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

      // Usar campos com compatibilidade para nova estrutura
      const duracoes = this.servicos.map(s => s.duracao_min || s.duracao_minutos || s.duracao || 0);
      const valores = this.servicos.map(s => s.valor || s.preco || 0);
      
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
        // Usar campos com compatibilidade para nova estrutura
        <td><span class="badge badge-primary">${servico.duracao_min || servico.duracao_minutos || servico.duracao || 0} min</span></td>
        <td><span class="badge badge-success">${this.formatCurrency(servico.valor || servico.preco || 0)}</span></td>
        <td><span class="badge badge-info">${agendamentosCount}</span></td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="pageManager.editService('${servico.nome}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDelete('${servico.nome}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  openNewServiceModal() {
    this.servicoEditando = null;
    document.getElementById('modalTitulo').textContent = 'Novo Serviço';
    document.getElementById('btnExcluir').style.display = 'none';
    
    // Reabilitar campo nome (caso tenha sido desabilitado na edição)
    document.getElementById('nomeServico').disabled = false;
    
    this.clearForm('modalServico');
    
    // Resetar cor para padrão
    const corPadrao = '#78909c';
    document.getElementById('corServico').value = corPadrao;
    
    // Atualizar pré-visualização da cor
    const colorPreview = document.getElementById('colorPreview');
    if (colorPreview) {
      colorPreview.style.backgroundColor = corPadrao;
      colorPreview.style.color = this.getContrastColor(corPadrao);
      colorPreview.querySelector('.preview-text').textContent = corPadrao.toUpperCase();
    }
    
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
    // Usar campos com compatibilidade para nova estrutura
    document.getElementById('duracaoServico').value = servico.duracao_min || servico.duracao_minutos || servico.duracao || '';
    document.getElementById('valorServico').value = servico.valor || servico.preco || '';
    document.getElementById('descricaoServico').value = servico.descricao || '';
    
    // Preencher cor (usar cor padrão se não existir)
    const corServico = servico.cor || '#78909c';
    document.getElementById('corServico').value = corServico;
    
    // Atualizar pré-visualização da cor
    const colorPreview = document.getElementById('colorPreview');
    if (colorPreview) {
      colorPreview.style.backgroundColor = corServico;
      colorPreview.style.color = this.getContrastColor(corServico);
      colorPreview.querySelector('.preview-text').textContent = corServico.toUpperCase();
    }
    
    // Desabilitar edição do nome
    document.getElementById('nomeServico').disabled = true;
    
    this.showModal('modalServico');
  }

  async saveService() {
    console.log('🔘 Botão salvar clicado - Iniciando saveService()');
    
    const nome = document.getElementById('nomeServico').value.trim();
    const duracao = parseInt(document.getElementById('duracaoServico').value) || 0;
    const valor = parseFloat(document.getElementById('valorServico').value) || 0;
    const descricao = document.getElementById('descricaoServico').value.trim();
    
    console.log('📋 Dados do formulário:', { nome, duracao, valor, descricao });
    
    // Validação de nome obrigatório
    if (!nome) {
      console.log('❌ Validação: nome vazio');
      UIUtils.showAlert('Nome do serviço é obrigatório', 'error');
      return;
    }
    
    // Validação de duração obrigatória e positiva
    if (!duracao || duracao <= 0) {
      console.log('❌ Validação: duração inválida', duracao);
      UIUtils.showAlert('Duração deve ser maior que 0', 'error');
      return;
    }
    
    console.log('✅ Validações básicas passadas');
    
    // Validação de valor obrigatório e positivo
    const errors = [];
    console.log('💰 Valor informado:', valor, 'Tipo:', typeof valor);
    
    // Se for edição e valor for 0, verificar se o campo foi preenchido
    if (this.servicoEditando && valor === 0) {
      const valorInput = document.getElementById('valorServico').value;
      console.log('💰 Valor do input:', valorInput);
      if (valorInput === '' || valorInput === '0') {
        errors.push('O valor deve ser maior que 0');
      }
    } else if (!this.servicoEditando && (valor === null || valor === undefined || valor <= 0)) {
      errors.push('O valor deve ser maior que 0');
    } else if (valor > 10000) { // máximo R$ 10.000
      errors.push('O valor não pode exceder R$ 10.000,00');
    }
    
    // Se houver erros, mostrar primeiro erro
    if (errors.length > 0) {
      console.log('❌ Validação: erro de valor', errors[0]);
      UIUtils.showAlert(errors[0], 'error');
      return;
    }
    
    console.log('✅ Todas as validações passaram');

    const btnSalvar = document.getElementById('btnSalvar');
    console.log('🔘 Botão salvar encontrado:', !!btnSalvar);
    UIUtils.showLoading(btnSalvar);
    console.log('✅ Loading mostrado no botão');

    try {
      // Obter cor selecionada
      const corServico = document.getElementById('corServico').value;
      console.log('🎨 Cor selecionada:', corServico, '(agora será salva no banco!)');
      
      if (this.servicoEditando) {
        console.log('📝 Modo edição - serviço:', this.servicoEditando);
        // Atualizar serviço (com cor agora)
        await window.dataManager.updateServico(this.servicoEditando.id, {
          nome, 
          duracao_min: duracao, // Novo campo
          valor, // Novo campo
          descricao,
          cor: corServico
        });
        console.log('✅ Serviço atualizado com sucesso');
        UIUtils.showAlert('Serviço atualizado com sucesso', 'success');
      } else {
        console.log('🆕 Modo criação - novo serviço');
        // Verificar se já existe
        if (this.servicos.some(s => s.nome === nome)) {
          console.log('❌ Serviço já existe:', nome);
          UIUtils.showAlert('Já existe um serviço com este nome', 'error');
          return;
        }
        
        // Criar novo serviço (com cor agora)
        console.log('💾 Criando novo serviço...');
        await window.dataManager.addServico({ 
          nome, 
          duracao_min: duracao, // Novo campo
          valor, // Novo campo
          descricao,
          cor: corServico
        });
        console.log('✅ Serviço criado com sucesso');
        UIUtils.showAlert('Serviço criado com sucesso', 'success');
      }

      console.log('🔄 Atualizando página...');
      await this.renderPage();
      await this.updateStatistics();
      console.log('✅ Página atualizada');
      this.closeModal();
      console.log('✅ Modal fechado');
    } catch (error) {
      console.error('❌ Erro ao salvar serviço:', error);
      UIUtils.showAlert('Erro ao salvar serviço', 'error');
    } finally {
      console.log('🔄 Escondendo loading...');
      UIUtils.hideLoading(btnSalvar);
      console.log('✅ Loading escondido');
    }
  }

  async deleteServiceByName(nome) {
    const servico = this.servicos.find(s => s.nome === nome);
    if (!servico) return;

    try {
      await window.dataManager.deleteServico(servico.id);
      UIUtils.showAlert('Serviço excluído com sucesso!', 'success');
      await this.renderPage();
      await this.updateStatistics();
    } catch (error) {
      console.error('Erro ao excluir serviço:', error);
      UIUtils.showAlert('Erro ao excluir serviço', 'error');
    }
  }

  async deleteService() {
    if (!this.servicoEditando) return;
    this.deleteServiceByName(this.servicoEditando.nome);
  }

  async confirmDelete(nome) {
    const confirmed = await window.ConfirmDialog.confirmDelete({
      title: 'Excluir Serviço',
      message: 'Tem certeza que deseja excluir este serviço?',
      itemName: nome,
      confirmText: 'Excluir Serviço'
    });

    if (confirmed) {
      await this.deleteServiceByName(nome);
    }
  }

  // Método para configurar o seletor de cores
  setupColorPicker() {
    console.log('🎨 Configurando seletor de cores...');
    
    const colorInput = document.getElementById('corServico');
    const colorPreview = document.getElementById('colorPreview');
    
    console.log('🔍 Elementos encontrados:');
    console.log('  - colorInput:', !!colorInput);
    console.log('  - colorPreview:', !!colorPreview);
    
    if (!colorInput || !colorPreview) {
      console.log('⚠️ Campos de cor não encontrados');
      return;
    }
    
    // Verificar se o preview tem o elemento de texto
    const previewText = colorPreview.querySelector('.preview-text');
    console.log('  - previewText:', !!previewText);
    
    // Função para atualizar pré-visualização
    const updatePreview = (color) => {
      console.log('🎨 Atualizando preview para cor:', color);
      colorPreview.style.backgroundColor = color;
      colorPreview.style.color = this.getContrastColor(color);
      if (previewText) {
        previewText.textContent = color.toUpperCase();
      }
    };
    
    // Event listener para input de cor
    colorInput.addEventListener('input', (e) => {
      const color = e.target.value;
      console.log('🎨 Cor alterada pelo usuário:', color);
      updatePreview(color);
    });
    
    // Inicializar com a cor atual
    console.log('🎨 Inicializando com cor:', colorInput.value);
    updatePreview(colorInput.value);
    
    console.log('✅ Seletor de cores configurado');
  }
  
  // Método para calcular cor de contraste
  getContrastColor(hexColor) {
    // Converter hex para RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Calcular luminosidade
    const luminosity = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Retornar branco ou preto dependendo da luminosidade
    return luminosity > 0.5 ? '#000000' : '#ffffff';
  }
  
  // Método para obter cor mais escura para bordas
  getDarkerColor(hexColor) {
    // Converter hex para RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Escurecer 20%
    const darkerR = Math.floor(r * 0.8);
    const darkerG = Math.floor(g * 0.8);
    const darkerB = Math.floor(b * 0.8);
    
    // Converter para hex
    return '#' + [darkerR, darkerG, darkerB].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
}

// Exportar para uso global
window.ServicosPage = ServicosPage;

// Função global para o botão excluir
window.confirmDelete = function(nome) {
  if (window.pageManager && window.pageManager.confirmDelete) {
    window.pageManager.confirmDelete(nome);
  } else if (window.servicosPage && window.servicosPage.confirmDelete) {
    window.servicosPage.confirmDelete(nome);
  } else {
    console.error('❌ Instância de ServicosPage não encontrada');
  }
};
