// Lógica específica da página de serviços
// DEPENDÊNCIAS: window.services, window.PageManager, window.showAlert, window.showLoading, window.hideLoading, window.confirmDelete

window.ServicosPage = class ServicosPage extends window.PageManager {
  constructor() {
    super();
    this.currentPage = 'servicos';

    // ✅ FASE 3.5: PURE DATACORE READ MODEL - NENHUM cache local
    this.servicoEditando = null;  // único estado persistente (UI modal)
    // REMOVIDO: __snapshot, getServicosSnapshot, invalidateSnapshot

    // ✅ FASE 2: Proteção contra multi-entry mantida
    this.__initialized = false;
    this.__initializing = false;
  }

  // ================================
  // CACHE BOUNDARY CHECK (FASE 4.2)
  // ================================
  _beforeRenderAudit() {
    // 🔒 ENFORCEMENT REAL: Falha explicitamente se cache proibido detectado
    if (typeof window.assertNoEntityCacheLeak === 'function') {
      window.assertNoEntityCacheLeak(this, 'ServicosPage');
    }
  }

  // ✅ FASE 3.5: NENHUM método de cache - fetch direto do DataCore sempre

  // ✅ FASE 2: Único ponto de inicialização via bootstrap
  async initializeSpecificPage() {
    // ✅ FASE 2: Proteção contra execução duplicada
    if (this.__initialized) {
      return;
    }
    if (this.__initializing) {
      while (this.__initializing) {
        await new Promise(r => setTimeout(r, 50));
      }
      return;
    }

    this.__initializing = true;

    try {
      // ✅ FASE 2: Configurar UI primeiro (independente de dados)
      this.setupServiceButtons();
      this.setupColorPicker();

      // ✅ FASE 2: Único fetch via DataCore authority
      await this.renderPage();

      // 🔒 CACHE BOUNDARY ENFORCEMENT (post-render verification)
      this._beforeRenderAudit();

      // ✅ FASE 2: Só marcar como inicializado após sucesso COMPLETO
      this.__initialized = true;
      
    } catch (error) {
      console.error('❌ Erro na inicialização, realizando rollback:', error);
      this.__initialized = false;
      throw error;

    } finally {
      this.__initializing = false;
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
  }

  async renderPage() {
    // 🔒 CACHE BOUNDARY ENFORCEMENT
    this._beforeRenderAudit();

    try {
      // ✅ FASE 3.5: FETCH DIRETO - nenhum cache intermediário
      const servicos = await window.services.servicos.list();

      this.renderServiceTable(servicos);
      this.updateStatistics(servicos);

    } catch (error) {
      console.error("❌ Erro ao carregar serviços em renderPage():", error);
      this.renderServiceTable([]);
      this.updateStatistics([]);
    }
  }

  renderServiceTable(servicos = []) {
        
    const tbody = document.getElementById('tabelaServicos');
    if (!tbody) {
      console.error('❌ Tabela de serviços não encontrada');
      return;
    }

    tbody.innerHTML = '';

    if (servicos.length === 0) {
      this.renderEmptyState(tbody, 'Nenhum serviço cadastrado', '💇', 'openNewServiceModal()');
      return;
    }

    servicos.forEach((servico, index) => {
      
      // TODO: Carregar agendamentos via service para contar
      const agendamentosCount = 0;
      const tr = document.createElement('tr');
      const corServico = servico.cor || '#78909c';
      tr.innerHTML = `
        <td>
          <div class="service-name">
            <strong>${servico.nome}</strong>
            ${servico.descricao ? `<br><small class="text-muted">${servico.descricao.substring(0, 50)}...</small>` : ''}
          </div>
        </td>
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
            <button class="btn btn-sm btn-warning" onclick="pageManager.handleEditClick('${servico.nome}')" title="Editar">
              <span class="btn-icon">✏️</span>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteService('${servico.nome}')" title="Excluir">
              <span class="btn-icon">🗑️</span>
            </button>
          </div>
        </td>
      `;
      
      tbody.appendChild(tr);
    });
  }

  updateStatistics(servicos) {
    // ✅ FASE 3.2: Pure function - recebe snapshot como parâmetro
    try {
      if (!servicos || servicos.length === 0) {
        this.updateStatisticsDOM(0, 0, 0);
        return;
      }

      const duracoes = servicos.map(s => s.duracao_min || s.duracao_minutos || s.duracao || 0);
      const valores = servicos.map(s => s.valor || s.preco || 0);
      
      const duracaoMedia = duracoes.reduce((a, b) => a + b, 0) / duracoes.length;
      const valorMedio = valores.reduce((a, b) => a + b, 0) / valores.length;

      this.updateStatisticsDOM(servicos.length, Math.round(duracaoMedia), valorMedio);
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

  // ✅ FASE 3.3: Pure function - recebe snapshot e term explicitamente
  handleSearch(servicos, term) {
    if (!servicos) {
      console.error('[FASE 3.3] handleSearch requires servicos parameter');
      return;
    }
    
    const filtrados = servicos.filter(servico => 
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
      // TODO: Carregar agendamentos via service para contar
      const agendamentosCount = 0;
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${servico.nome}</strong></td>
        <td><span class="badge badge-primary">${servico.duracao_min || servico.duracao_minutos || servico.duracao || 0} min</span></td>
        <td><span class="badge badge-success">${this.formatCurrency(servico.valor || servico.preco || 0)}</span></td>
        <td><span class="badge badge-info">${agendamentosCount}</span></td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="pageManager.handleEditClick('${servico.nome}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDelete('${servico.nome}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
  }

  // ✅ FASE 3.3: Handler para clique de edição - inicia ciclo e chama método puro
  async handleEditClick(nome) {
    // ✅ FASE 3.5: Fetch direto do DataCore
    const servicos = await window.services.servicos.list();
    this.editService(nome, servicos);
    // Modal permanece aberto
  }

  // ✅ FASE 3.5: Handler para busca - compatibilidade com PageManager
  async handleSearch(term) {
    if (!term.trim()) {
      await this.renderPage();
      return;
    }
    // ✅ FASE 3.5: FETCH DIRETO - nenhum cache
    const servicos = await window.services.servicos.list();
    this.handleSearchPure(servicos, term);
  }

  // ✅ FASE 3.3: Método puro de busca (nome mudado para evitar conflito)
  handleSearchPure(servicos, term) {
    if (!servicos) {
      console.error('[FASE 3.3] handleSearchPure requires servicos parameter');
      return;
    }
    
    const filtrados = servicos.filter(servico => 
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
      // TODO: Carregar agendamentos via service para contar
      const agendamentosCount = 0;
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${servico.nome}</strong></td>
        <td><span class="badge badge-primary">${servico.duracao_min || servico.duracao_minutos || servico.duracao || 0} min</span></td>
        <td><span class="badge badge-success">${this.formatCurrency(servico.valor || servico.preco || 0)}</span></td>
        <td><span class="badge badge-info">${agendamentosCount}</span></td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="pageManager.handleEditClick('${servico.nome}')">✏️</button>
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

  editService(nome, servicos) {
    // ✅ FASE 3.3: Pure function - SÓ recebe snapshot via parâmetro
    if (!servicos) {
      console.error('[FASE 3.3] editService requires servicos parameter');
      return;
    }
    const servico = servicos.find(s => s.nome === nome);
    if (!servico) return;

    this.servicoEditando = servico;
    document.getElementById('modalTitulo').textContent = 'Editar Serviço';
    document.getElementById('btnExcluir').style.display = 'inline-block';
    
    // Preencher formulário
    document.getElementById('nomeServico').value = servico.nome || '';
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
    
    // Manter nome habilitado para edição
    // document.getElementById('nomeServico').disabled = true;
    
    this.showModal('modalServico');
  }

  async saveService() {
    // PREVENIR DUPLO CLIQUE
    const saveButton = document.getElementById('btnSalvar');
    if (saveButton && saveButton.disabled) {
      return;
    }
    
    const nome = document.getElementById('nomeServico').value.trim();
    const duracao = parseInt(document.getElementById('duracaoServico').value) || 0;
    const valor = parseFloat(document.getElementById('valorServico').value) || 0;
    const descricao = document.getElementById('descricaoServico').value.trim();
    
        
    // Validar campos obrigatórios básicos com mensagem padrão
    const requiredFields = ['nomeServico', 'duracaoServico', 'valorServico'];
    if (!window.validateFormFields({ requiredFields })) {
      return;
    }
    
    // Validações específicas (mantidas para melhor UX)
    if (duracao <= 0) {
      showAlert('Duração deve ser maior que 0', 'error');
      return;
    }
    
    // Validação de valor positivo
    if (valor <= 0) {
      showAlert('O valor deve ser maior que 0', 'error');
      return;
    }
    
    // Validação de valor máximo
    if (valor > 10000) { // máximo R$ 10.000
      showAlert('O valor não pode exceder R$ 10.000,00', 'error');
      return;
    }

    const btnSalvar = document.getElementById('btnSalvar');
    showLoading(btnSalvar);

    try {
      // Obter cor selecionada
      const corServico = document.getElementById('corServico').value;
      
      if (this.servicoEditando) {
        // Atualizar serviço (com cor agora)
        await window.services.servicos.update(this.servicoEditando.id, {
          nome, 
          duracao_min: duracao, // Novo campo
          valor, // Novo campo
          descricao,
          cor: corServico
        });
        showAlert('Serviço atualizado com sucesso', 'success');
      } else {
        // ✅ FASE 3.5: FETCH DIRETO para validação - sempre dados frescos
        const servicos = await window.services.servicos.list();
        if (servicos.some(s => s.nome === nome)) {
          showAlert('Já existe um serviço com este nome', 'error');
          return;
        }
        
        // Criar novo serviço (com cor agora)
        await window.services.servicos.create({ 
          nome, 
          duracao_min: duracao, // Novo campo
          valor, // Novo campo
          descricao,
          cor: corServico
        });
        showAlert('Serviço criado com sucesso', 'success');
      }

      // ✅ FASE 3.5: Re-render simples - DataCore garante consistência
      await this.renderPage();
      this.closeModal();
    } catch (error) {
      console.error('❌ Erro ao salvar serviço:', error);
      showAlert('Erro ao salvar serviço', 'error');
    } finally {
      hideLoading(btnSalvar);
    }
  }

  async deleteServiceByName(nome) {
    // ✅ FASE 3.5: FETCH DIRETO para buscar ID
    const servicos = await window.services.servicos.list();
    const servico = servicos.find(s => s.nome === nome);
    if (!servico) return;

    try {
      await window.services.servicos.delete(servico.id);
      showAlert('Serviço excluído com sucesso!', 'success');

      // ✅ FASE 3.5: Re-render simples - DataCore garante consistência
      await this.renderPage();
    } catch (error) {
      console.error('Erro ao excluir serviço:', error);
      showAlert('Erro ao excluir serviço', 'error');
    }
  }

  async deleteService() {
    if (!this.servicoEditando) return;
    this.deleteServiceByName(this.servicoEditando.nome);
  }

  async confirmDelete(nome) {
    const confirmed = await window.confirmDelete({
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
    
    if (!colorInput || !colorPreview) {
      return;
    }
    
    // Verificar se o preview tem o elemento de texto
    const previewText = colorPreview.querySelector('.preview-text');
    
    // Função para atualizar pré-visualização
    const updatePreview = (color) => {
      colorPreview.style.backgroundColor = color;
      colorPreview.style.color = this.getContrastColor(color);
      if (previewText) {
        previewText.textContent = color.toUpperCase();
      }
    };
    
    // Event listener para input de cor
    colorInput.addEventListener('input', (e) => {
      const color = e.target.value;
      updatePreview(color);
    });
    
    // Inicializar com a cor atual
    updatePreview(colorInput.value);
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
window.deleteService = function(nome) {
  if (window.pageManager && window.pageManager.confirmDelete) {
    window.pageManager.confirmDelete(nome);
  } else if (window.servicosPage && window.servicosPage.confirmDelete) {
    window.servicosPage.confirmDelete(nome);
  } else {
    console.error('❌ Instância de ServicosPage não encontrada');
  }
};
