// Lógica específica da página de clientes
class ClientesPage extends PageManager {
  constructor() {
    super();
    this.currentPage = 'clientes';
    this.clientes = [];
    this.clienteEditando = null;
    console.log('✅ ClientesPage iniciada');
    
    // VERSÃO ORIGINAL
    // Forçar inicialização específica após o DOM estar pronto
    // setTimeout(() => {
    //   this.initializeSpecificPage();
    // }, 100);
    
    // NOVA IMPLEMENTAÇÃO V1.2 - EVENTO appReady
    document.addEventListener('appReady', (event) => {
      console.log('🚀 appReady recebido em ClientesPage:', event);
      console.log('🔍 Verificando DataManager:', window.dataManager);
      console.log('🔍 Verificando clientes no DataManager:', window.dataManager?.clientes);
      this.initializeSpecificPage();
    });
  }

  needsAgendamentos() {
    return true; // Clientes precisa de agendamentos para histórico
  }

  async initializeSpecificPage() {
    console.log('📋 Inicializando página de clientes...');
    
    // Configurar botões específicos
    this.setupClientButtons();
    
    // Renderizar tabela inicial
    await this.renderPage();
    
    // Carregar estatísticas
    await this.updateStatistics();
  }

  setupClientButtons() {
    // Botão novo cliente
    const btnNovo = document.getElementById('btnNovoCliente');
    if (btnNovo) {
      btnNovo.addEventListener('click', () => this.openNewClientModal());
    }

    // Botão salvar cliente
    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) {
      btnSalvar.addEventListener('click', () => this.saveClient());
    }

    // Botão excluir cliente
    const btnExcluir = document.getElementById('btnExcluir');
    if (btnExcluir) {
      btnExcluir.addEventListener('click', () => this.deleteClient());
    }

    // Mudança de tipo de registro (se tiver)
    const tipoRegistro = document.getElementById('tipoRegistro');
    if (tipoRegistro) {
      tipoRegistro.addEventListener('change', (e) => this.toggleClientType(e.target.value));
    }
  }

  async renderPage() {
    console.log("🔄 Renderizando página de clientes...");
    
    // NOVA IMPLEMENTAÇÃO V1.2 - MOSTRAR LOADING
    this.showLoadingTable();
    
    // Carregar dados do DataManager (forçar carregamento do Supabase)
    try {
      console.log("🔍 Forçando carregamento direto do Supabase...");
      this.clientes = await window.dataManager.loadClientes();  // Força carregamento
      console.log("✅ Clientes obtidos do DataManager:", this.clientes);
      console.log("📊 Quantidade de clientes:", this.clientes.length);
    } catch (error) {
      console.error("❌ Erro ao carregar clientes:", error);
      this.clientes = [];
    }
    
    // Renderizar tabela
    this.renderClientTable();
  }

  renderClientTable() {
    console.log("🎨 Iniciando renderClientTable...");
    
    const tbody = document.getElementById('tabelaClientes');
    if (!tbody) {
      console.error('❌ Tabela de clientes não encontrada');
      return;
    }
    
    tbody.innerHTML = '';

    if (this.clientes.length === 0) {
      this.renderEmptyState(tbody, 'Nenhum cliente cadastrado', '👥', 'openNewClientModal()');
      return;
    }

    console.log(`📊 Renderizando ${this.clientes.length} clientes...`);
    this.clientes.forEach((cliente, index) => {
      const agendamentosCount = window.dataManager.agendamentos.filter(a => a.cliente === cliente.nome).length;
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="client-name">
            <strong>${cliente.nome}</strong>
            ${cliente.telefone ? `<br><small class="text-muted">${this.formatPhone(cliente.telefone)}</small>` : ''}
          </div>
        </td>
        <td>${cliente.email || '-'}</td>
        <td>${cliente.endereco || '-'}</td>
        <td>
          <span class="badge badge-primary">${agendamentosCount} agendamentos</span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn btn-sm btn-warning" onclick="pageManager.editClient('${cliente.nome}')" title="Editar">
              <span class="btn-icon">✏️</span>
            </button>
            <button class="btn btn-sm btn-info" onclick="pageManager.viewHistory('${cliente.nome}')" title="Ver Histórico">
              <span class="btn-icon">📅</span>
            </button>
            <button class="btn btn-sm btn-danger" onclick="pageManager.confirmDelete('${cliente.nome}')" title="Excluir">
              <span class="btn-icon">🗑️</span>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
    
    console.log("✅ Renderização concluída!");
  }

  // NOVA IMPLEMENTAÇÃO V1.2 - MÉTODOS DE LOADING
  showLoadingTable() {
    const tbody = document.getElementById("tabelaClientes");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px;">
            <div class="loading-table">
              <div class="loading-spinner"></div>
              <div class="loading-table-text">Carregando clientes...</div>
            </div>
          </td>
        </tr>
      `;
    }
  }

  showLoadingButton(button) {
    if (button) {
      button.classList.add('loading');
      button.disabled = true;
    }
  }

  hideLoadingButton(button, originalText) {
    if (button) {
      button.classList.remove('loading');
      button.disabled = false;
      if (originalText) {
        button.innerHTML = originalText;
      }
    }
  }

  showLoadingOverlay(message = 'Carregando...') {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-overlay-content">
        <div class="loading-spinner-large"></div>
        <div class="loading-overlay-text">${message}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  hideLoadingOverlay(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  async updateStatistics() {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);

      // Clientes ativos (com agendamentos nos últimos 30 dias)
      const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
      const clientesAtivos = new Set();
      
      window.dataManager.agendamentos.forEach(a => {
        const dataAg = new Date(a.inicio);
        if (dataAg >= trintaDiasAtras) {
          clientesAtivos.add(a.cliente);
        }
      });

      // Agendamentos este mês
      const agendamentosMes = window.dataManager.agendamentos.filter(a => {
        const dataAg = new Date(a.inicio);
        return dataAg.getMonth() === hoje.getMonth() && 
               dataAg.getFullYear() === hoje.getFullYear();
      });

      // Atualizar DOM
      const totalElement = document.getElementById('totalClientes');
      const ativosElement = document.getElementById('clientesAtivos');
      const mensaisElement = document.getElementById('agendamentosMes');

      if (totalElement) totalElement.textContent = this.clientes.length;
      if (ativosElement) ativosElement.textContent = clientesAtivos.size;
      if (mensaisElement) mensaisElement.textContent = agendamentosMes.length;
    } catch (error) {
      console.error('Erro ao atualizar estatísticas:', error);
    }
  }

  handleSearch(term) {
    const filtrados = this.clientes.filter(cliente => 
      cliente.nome.toLowerCase().includes(term.toLowerCase()) ||
      (cliente.email && cliente.email.toLowerCase().includes(term.toLowerCase())) ||
      (cliente.telefone && cliente.telefone.includes(term)) ||
      (cliente.endereco && cliente.endereco.toLowerCase().includes(term.toLowerCase()))
    );
    
    const tbody = document.getElementById('tabelaClientes');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (filtrados.length === 0) {
      this.renderEmptyState(tbody, `Nenhum cliente encontrado para "${term}"`, '🔍');
      return;
    }

    filtrados.forEach(cliente => {
      const agendamentosCount = window.dataManager.agendamentos.filter(a => a.cliente === cliente.nome).length;
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${cliente.nome}</strong></td>
        <td>${cliente.email || '-'}</td>
        <td>${cliente.endereco || '-'}</td>
        <td><span class="badge badge-primary">${agendamentosCount}</span></td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="pageManager.editClient('${cliente.nome}')">✏️</button>
          <button class="btn btn-sm btn-info" onclick="pageManager.viewHistory('${cliente.nome}')">📅</button>
          <button class="btn btn-sm btn-danger" onclick="pageManager.confirmDelete('${cliente.nome}')">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  openNewClientModal() {
    this.clienteEditando = null;
    document.getElementById('modalTitulo').textContent = 'Novo Cliente';
    document.getElementById('btnExcluir').style.display = 'none';
    this.clearForm('modalCliente');
    this.showModal('modalCliente');
  }

  editClient(nome) {
    const cliente = this.clientes.find(c => c.nome === nome);
    if (!cliente) return;

    this.clienteEditando = cliente;
    document.getElementById('modalTitulo').textContent = 'Editar Cliente';
    document.getElementById('btnExcluir').style.display = 'inline-block';
    
    // Preencher formulário
    document.getElementById('nomeCliente').value = cliente.nome || '';
    document.getElementById('telefoneCliente').value = cliente.telefone || '';
    document.getElementById('emailCliente').value = cliente.email || '';
    document.getElementById('enderecoCliente').value = cliente.endereco || '';
    document.getElementById('observacoesCliente').value = cliente.observacoes || '';
    
    // Desabilitar edição do nome
    document.getElementById('nomeCliente').disabled = true;
    
    this.showModal('modalCliente');
  }

  async saveClient() {
    const nome = document.getElementById('nomeCliente').value.trim();
    const telefone = document.getElementById('telefoneCliente').value.trim();
    const email = document.getElementById('emailCliente').value.trim();
    const endereco = document.getElementById('enderecoCliente').value.trim();
    const observacoes = document.getElementById('observacoesCliente').value.trim();

    // VERSÃO ORIGINAL
    // Validação
    // const errors = this.validateForm(['nomeCliente']);
    // if (errors.length > 0) {
    //   this.showError(errors[0]);
    //   return;
    // }

    // Validar email se fornecido
    // if (email && !this.isValidEmail(email)) {
    //   this.showError('Email inválido');
    //   return;
    // }
    
    // NOVA IMPLEMENTAÇÃO V1.2 - VALIDAÇÃO COMPLETA
    const errors = [];
    
    // Validação de nome obrigatório
    if (!nome) {
      errors.push('O nome do cliente é obrigatório');
    } else if (nome.length < 3) {
      errors.push('O nome deve ter pelo menos 3 caracteres');
    }
    
    // Validação de telefone (opcional mas se preenchido deve ser válido)
    if (telefone && !this.isValidPhone(telefone)) {
      errors.push('Telefone inválido. Use o formato (XX) XXXXX-XXXX');
    }
    
    // Validação de email (opcional mas se preenchido deve ser válido)
    if (email && !this.isValidEmail(email)) {
      errors.push('Email inválido');
    }
    
    // Se houver erros, mostrar primeiro erro
    if (errors.length > 0) {
      this.showToast(errors[0], 'error');
      return;
    }

    const btnSalvar = document.getElementById('btnSalvar');
    UIUtils.showLoading(btnSalvar);

    try {
      // NOVA IMPLEMENTAÇÃO V1.2 - MOSTRAR LOADING NO BOTÃO
      const btnSalvar = document.getElementById('btnSalvar');
      const originalText = btnSalvar.innerHTML;
      this.showLoadingButton(btnSalvar);

      if (this.clienteEditando) {
        // Atualizar cliente
        await window.dataManager.updateCliente(this.clienteEditando.id, {
          nome, telefone, email, endereco, observacoes
        });
        this.showToast('Cliente atualizado com sucesso', 'success');
      } else {
        // Verificar se já existe
        if (this.clientes.some(c => c.nome === nome)) {
          this.showToast('Já existe um cliente com este nome', 'error');
          this.hideLoadingButton(btnSalvar, originalText);
          return;
        }
        
        // Criar novo cliente
        await window.dataManager.addCliente({ 
          nome, 
          telefone, 
          email, 
          endereco, 
          observacoes 
        });
        this.showToast('Cliente criado com sucesso', 'success');
      }

      // NOVA IMPLEMENTAÇÃO V1.2 - MOSTRAR LOADING NA TABELA
      this.showLoadingTable();
      await this.renderPage();
      await this.updateStatistics();
      this.closeModal();
      
      this.hideLoadingButton(btnSalvar, originalText);
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      this.showError('Erro ao salvar cliente');
    } finally {
      UIUtils.hideLoading(btnSalvar);
    }
  }

  confirmDelete(nome) {
    if (confirm(`Tem certeza que deseja excluir o cliente "${nome}"? Esta ação não pode ser desfeita.`)) {
      this.deleteClientByName(nome);
    }
  }

  async deleteClientByName(nome) {
    const cliente = this.clientes.find(c => c.nome === nome);
    if (!cliente) return;

    try {
      await window.dataManager.deleteCliente(cliente.id);
      this.showSuccess('Cliente excluído com sucesso');
      await this.renderPage();
      await this.updateStatistics();
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      this.showError('Erro ao excluir cliente');
    }
  }

  async deleteClient() {
    if (!this.clienteEditando) return;
    this.deleteClientByName(this.clienteEditando.nome);
  }

  async viewHistory(nome) {
    try {
      const historico = await window.dataManager.getHistoricoCliente(nome);
      this.renderHistory(nome, historico);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      this.showError('Erro ao carregar histórico');
    }
  }

  renderHistory(nomeCliente, historico) {
    const historySection = document.getElementById('historySection');
    if (!historySection) return;

    historySection.style.display = 'block';
    historySection.innerHTML = `
      <div class="history-header">
        <h2>📅 Histórico de ${nomeCliente}</h2>
        <button class="btn btn-secondary" onclick="pageManager.closeHistory()">Fechar</button>
      </div>
      
      <div class="client-info">
        <div class="client-card">
          <h3>${nomeCliente}</h3>
          <p><strong>Total de agendamentos:</strong> ${historico.length}</p>
        </div>
      </div>

      <div class="history-table">
        <table class="modern-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Serviço</th>
              <th>Profissional</th>
              <th>Status</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            ${historico.length === 0 ? 
              '<tr><td colspan="5" class="text-center">Nenhum agendamento encontrado</td></tr>' :
              historico.map(a => `
                <tr>
                  <td>${this.formatDateTime(a.inicio)}</td>
                  <td>${a.servico}</td>
                  <td>${a.profissional}</td>
                  <td><span class="status-badge status-${a.status}">${a.status}</span></td>
                  <td>${a.observacoes || '-'}</td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    `;

    // Scroll para o histórico
    historySection.scrollIntoView({ behavior: 'smooth' });
  }

  closeHistory() {
    const historySection = document.getElementById('historySection');
    if (historySection) {
      historySection.style.display = 'none';
    }
  }

  toggleClientType(type) {
    // Se tiver diferentes tipos de registros (futuro)
    console.log('Tipo de cliente:', type);
  }

  // Métodos utilitários
  isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  // NOVA IMPLEMENTAÇÃO V1.2 - VALIDAÇÃO DE TELEFONE
  isValidPhone(phone) {
    const regex = /^\(\d{2}\)\s\d{5}-\d{4}$/;
    return regex.test(phone);
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
window.ClientesPage = ClientesPage;
