// Página de Clientes - Agenda Beauty
// VERSÃO: 2.0.0 - LIMPA E FUNCIONAL
console.log('👥 ClientesPage V2.0.0 carregado - Limpa e funcional');

class ClientesPage extends PageManager {
  constructor() {
    super();
    this.clientes = [];
    this.clienteEditando = null;
    this.clienteIdAnamnese = null;
    this.anamneseEditando = null;
    this.supabase = window.supabaseClient;
  }

  async initializeSpecificPage() {
    console.log('📋 Inicializando página de clientes...');
    await this.loadClientes();
    this.setupEventListeners();
    this.renderClientTable();
  }

  async loadClientes() {
    try {
      console.log('🔄 Carregando clientes...');
      this.clientes = await window.dataManager.getClientes();
      console.log('✅ Clientes carregados:', this.clientes);
    } catch (error) {
      console.error('❌ Erro ao carregar clientes:', error);
      UIUtils.showAlert('Erro ao carregar clientes', 'error');
    }
  }

  setupEventListeners() {
    // Event listeners para os formulários
    const formCliente = document.getElementById('formCliente');
    if (formCliente) {
      formCliente.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveCliente();
      });
    }
    
    // Configurar formatação automática de telefone
    this.setupPhoneFormatting();
    
    // Event listener para o checkbox de menor idade (apenas uma vez)
    const menorIdadeCheckbox = document.getElementById('anamneseMenorIdade');
    if (menorIdadeCheckbox) {
      menorIdadeCheckbox.addEventListener('change', () => {
        this.toggleResponsavelFields();
      });
      console.log('🔍 Listener do checkbox menor idade configurado');
    }

    // Event listener para o botão Novo Cliente
    const btnNovoCliente = document.getElementById('btnNovoCliente');
    if (btnNovoCliente) {
      btnNovoCliente.addEventListener('click', () => {
        this.openNewClientModal();
      });
    }

    // Event listeners para fechar modais
    this.setupModalListeners();
  }

  setupModalListeners() {
    // Fechar modal clicando fora
    const modalCliente = document.getElementById('modalCliente');
    if (modalCliente) {
      modalCliente.addEventListener('click', (e) => {
        if (e.target === modalCliente) {
          this.hideModal('modalCliente');
        }
      });
    }

    // Event listener para fechar modal de anamnese
    const btnFecharModalAnamnese = document.getElementById('btnFecharModalAnamnese');
    if (btnFecharModalAnamnese) {
      btnFecharModalAnamnese.addEventListener('click', () => {
        this.hideModal('modalAnamnese');
      });
    }

    // Fechar modal de anamnese clicando fora
    const modalAnamnese = document.getElementById('modalAnamnese');
    if (modalAnamnese) {
      modalAnamnese.addEventListener('click', (e) => {
        if (e.target === modalAnamnese) {
          this.hideModal('modalAnamnese');
        }
      });
    }

    // Event listener para o botão Salvar do modal de cliente
    const btnSalvar = document.getElementById('btnSalvar');
    if (btnSalvar) {
      btnSalvar.addEventListener('click', () => {
        this.saveCliente();
      });
    }

    // Event listener para o botão Salvar do modal de anamnese
    const btnSalvarAnamnese = document.getElementById('btnSalvarAnamnese');
    if (btnSalvarAnamnese) {
      btnSalvarAnamnese.addEventListener('click', () => {
        this.saveAnamnese();
      });
    }
  }

  openNewClientModal() {
    console.log('➕ Abrindo modal para novo cliente');
    
    // Limpar formulário
    this.clearForm('modalCliente');
    
    // Configurar modal
    document.getElementById('modalTitulo').textContent = 'Novo Cliente';
    document.getElementById('btnExcluir').style.display = 'none';
    
    // Reabilitar campo nome (caso tenha sido desabilitado na edição)
    document.getElementById('nomeCliente').disabled = false;
    
    // Abrir modal
    this.showModal('modalCliente');
  }

  async saveCliente() {
    try {
      console.log('💾 Salvando cliente...');
      
      // Coletar dados do formulário (apenas campos existentes na tabela)
      const clienteData = {
        nome: document.getElementById('nomeCliente').value,
        telefone: document.getElementById('telefoneCliente').value
      };

      // Validar campos obrigatórios
      if (!clienteData.nome.trim()) {
        UIUtils.showAlert('Nome do cliente é obrigatório', 'error');
        return;
      }

      if (!clienteData.telefone.trim()) {
        UIUtils.showAlert('WhatsApp do cliente é obrigatório', 'error');
        return;
      }

      // Salvar no DataManager
      if (this.clienteEditando) {
        // Atualizar cliente existente
        await window.dataManager.updateCliente(this.clienteEditando.id, clienteData);
        UIUtils.showAlert('Cliente atualizado com sucesso', 'success');
      } else {
        // Criar novo cliente
        const novoCliente = await window.dataManager.addCliente(clienteData);
        UIUtils.showAlert('Cliente criado com sucesso', 'success');
        
        // Simular clique no botão do link após criar novo cliente
        console.log('🔗 Simulando clique no botão do link para novo cliente:', novoCliente);
        
        // Corrigir: novoCliente pode vir como array, pegar o primeiro elemento
        const clienteCriado = Array.isArray(novoCliente) ? novoCliente[0] : novoCliente;
        
        if (clienteCriado && clienteCriado.ficha_token) {
          // Salvar referência ao this para usar no setTimeout
          const self = this;
          
          // Pequeno delay para o alerta ser mostrado primeiro
          setTimeout(() => {
            console.log('🔗 Timeout executado, preparando link...');
            const fichaLink = `${window.location.origin}/anamnese.html?token=${clienteCriado.ficha_token}`;
            console.log('🔗 Link gerado:', fichaLink);
            console.log('🔗 Chamando copyFichaLink para:', clienteCriado.nome);
            
            // Usar a referência salva em vez de this
            self.copyFichaLink(fichaLink, clienteCriado.nome);
          }, 1000); // 1 segundo de delay
        } else {
          console.log('🔗 Cliente ou token não encontrado:', clienteCriado);
          console.log('🔗 Tipo de novoCliente:', typeof novoCliente);
          console.log('🔗 É array?', Array.isArray(novoCliente));
        }
      }

      // Fechar modal e recarregar lista
      this.hideModal('modalCliente');
      await this.loadClientes();
      this.renderClientTable();

    } catch (error) {
      console.error('❌ Erro ao salvar cliente:', error);
      UIUtils.showAlert('Erro ao salvar cliente', 'error');
    }
  }

  clearForm(modalId) {
    const form = document.querySelector(`#${modalId} form`);
    if (form) {
      form.reset();
    }
    
    // Limpar também os inputs individualmente para garantir
    const inputs = document.querySelectorAll(`#${modalId} input, #${modalId} textarea`);
    inputs.forEach(input => {
      if (input.type === 'checkbox') {
        input.checked = false;
      } else {
        input.value = '';
      }
    });
    
    // Resetar variável de edição
    this.clienteEditando = null;
  }

  async renderClientTable() {
    const tbody = document.getElementById('tabelaClientes');
    tbody.innerHTML = '';

    if (this.clientes.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px;">
            <div style="color: #666;">
              <i class="fas fa-users" style="font-size: 48px; margin-bottom: 20px; display: block;"></i>
              <h4>Nenhum cliente cadastrado</h4>
              <p>Clique em "Novo Cliente" para começar</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    // Usar for...of em vez de forEach para esperar as promises assíncronas
    for (const cliente of this.clientes) {
      const tr = document.createElement('tr');
      
      // Gerar link da ficha de anamnese
      const fichaLink = cliente.ficha_token ? 
        `${window.location.origin}/anamnese.html?token=${cliente.ficha_token}` : null;
      
      // Obter dados de atendimentos
      const proximoAtendimento = await this.getProximoAtendimento(cliente.id);
      const ultimoAtendimento = await this.getUltimoAtendimento(cliente.id);
      
      tr.innerHTML = `
        <td>
          <div class="client-name">
            <strong>${cliente.nome}</strong>
          </div>
        </td>
        <td>${cliente.telefone ? this.formatPhone(cliente.telefone) : '-'}</td>
        <td>${proximoAtendimento}</td>
        <td>${ultimoAtendimento}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-sm btn-primary" onclick="window.clientesPage.openAnamnese(${cliente.id}, '${cliente.nome}')" title="Ficha de Anamnese">
              <span class="btn-icon">📋</span>
            </button>
            ${fichaLink ? `
              <button class="btn btn-sm btn-secondary" onclick="window.clientesPage.copyFichaLink('${fichaLink}', '${cliente.nome}')" title="Copiar link da ficha">
                <span class="btn-icon">📎</span>
              </button>
            ` : ''}
            <button class="btn btn-sm btn-info" onclick="window.clientesPage.showHistorico(${cliente.id}, '${cliente.nome}')" title="Histórico do Cliente">
              <span class="btn-icon">📅</span>
            </button>
            <button class="btn btn-sm btn-danger" onclick="window.clientesPage.confirmDelete('${cliente.nome}')" title="Excluir">
              <span class="btn-icon">🗑️</span>
            </button>
          </div>
        </td>
      `;
      
      // Adicionar event listener para clicar na linha e abrir ficha
      tr.addEventListener('click', (e) => {
        // Não abrir ficha se clicou em um botão
        if (e.target.closest('button')) {
          return;
        }
        console.log('👆 Clicou na linha do cliente:', cliente.nome);
        this.openAnamneseView(cliente.id, cliente.nome);
      });
      
      tbody.appendChild(tr);
    }
  }

  formatPhone(phone) {
    if (!phone) return '';
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  // Método para obter próximo atendimento
  async getProximoAtendimento(clienteId) {
    try {
      // ✅ CORRIGIDO: Formato de data compatível com Supabase
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      // Formatar data sem timezone para Supabase
      const dataFormatoSupabase = hoje.toISOString().split('T')[0];
      
      const { data, error } = await this.supabase
        .from('agendamentos')
        .select('data_inicio, servico_id, profissional_id, status')
        .eq('cliente_id', clienteId)
        .gte('data_inicio', dataFormatoSupabase)
        .order('data_inicio', { ascending: true })
        .limit(1)
        .single();
        
      if (error || !data) {
        return '<span class="text-muted">Sem agendamento</span>';
      }
      
      const dataAgendamento = new Date(data.data_inicio);
      const dataFormatada = dataAgendamento.toLocaleDateString('pt-BR');
      const horaFormatada = dataAgendamento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      return `<span class="badge badge-success">${dataFormatada} ${horaFormatada}</span>`;
    } catch (error) {
      console.error('Erro ao buscar próximo atendimento:', error);
      return '<span class="text-muted">-</span>';
    }
  }

  // Método para obter último atendimento
  async getUltimoAtendimento(clienteId) {
    try {
      // ✅ CORRIGIDO: Formato de data compatível com Supabase
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      // Formatar data sem timezone para Supabase
      const dataFormatoSupabase = hoje.toISOString().split('T')[0];
      
      const { data, error } = await this.supabase
        .from('agendamentos')
        .select('data_inicio, servico_id, profissional_id, status')
        .eq('cliente_id', clienteId)
        .lt('data_inicio', dataFormatoSupabase)
        .order('data_inicio', { ascending: false })
        .limit(1)
        .single();
        
      if (error || !data) {
        return '<span class="text-muted">Nenhum atendimento</span>';
      }
      
      const dataAgendamento = new Date(data.data_inicio);
      const dataFormatada = dataAgendamento.toLocaleDateString('pt-BR');
      const horaFormatada = dataAgendamento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      return `<span class="badge badge-primary">${dataFormatada} ${horaFormatada}</span>`;
    } catch (error) {
      console.error('Erro ao buscar último atendimento:', error);
      return '<span class="text-muted">-</span>';
    }
  }

  // Copiar link da ficha de anamnese
  copyFichaLink(link, clienteNome) {
    console.log('📎 copyFichaLink chamado!');
    console.log('📎 Link:', link);
    console.log('📎 Cliente:', clienteNome);
    console.log('📎 Iniciando criação do modal...');
    
    // Remover modal existente se houver
    const existingModal = document.getElementById('modalLinkFicha');
    if (existingModal) {
      console.log('📎 Removendo modal existente...');
      existingModal.remove();
    }
    
    // Criar modal profissional com link
    const modalHtml = `
      <div id="modalLinkFicha" class="modal" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; align-items: center; justify-content: center;">
        <div class="modal-content" style="position: relative; background: white; border-radius: 8px; max-width: 500px; width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
          <div class="modal-header" style="padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; color: #333;">Link da Ficha de Anamnese</h3>
            <button type="button" class="btn-close" onclick="window.clientesPage.fecharModalLink()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
          </div>
          <div class="modal-body" style="padding: 20px;">
            <p style="margin-bottom: 15px; color: #333;">Compartilhe este link com <strong>${clienteNome}</strong> para que ele possa preencher a ficha de anamnese:</p>
            <div class="form-group" style="margin-bottom: 15px;">
              <div class="input-group" style="display: flex; gap: 10px;">
                <input type="text" id="linkFichaInput" class="form-control" value="${link}" readonly style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 12px; background: #f8f9fa;">
                <button type="button" id="btnCopiarLink" class="btn btn-primary" onclick="window.clientesPage.copiarLinkManual()" style="padding: 10px 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;">
                  <span class="btn-icon">📋</span>
                  Copiar
                </button>
              </div>
            </div>
            <p class="text-muted" style="margin: 0; color: #666; font-size: 14px;">
              <small>O cliente pode acessar este link em qualquer dispositivo para preencher sua ficha de anamnese.</small>
            </p>
          </div>
          <div class="modal-footer" style="padding: 20px; border-top: 1px solid #eee; text-align: right;">
            <button type="button" class="btn btn-secondary" onclick="window.clientesPage.fecharModalLink()" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Fechar
            </button>
          </div>
        </div>
      </div>
    `;
    
    console.log('📎 Modal HTML criado, adicionando ao DOM...');
    
    // Adicionar modal ao corpo da página
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.body.style.overflow = 'hidden';
    
    console.log('📎 Modal adicionado ao DOM');
    
    // Selecionar automaticamente o texto do input
    setTimeout(() => {
      const linkInput = document.getElementById('linkFichaInput');
      if (linkInput) {
        linkInput.select();
        linkInput.focus();
        console.log('📎 Input selecionado e focado:', linkInput);
      } else {
        console.error('📎 Input não encontrado!');
      }
    }, 100);
    
    console.log('📎 copyFichaLink concluído com sucesso!');
  }

  fecharModalLink() {
    const modal = document.getElementById('modalLinkFicha');
    if (modal) {
      modal.remove();
      document.body.style.overflow = 'auto';
    }
  }

  async copiarLinkManual() {
    try {
      const input = document.getElementById('linkFichaInput');
      const button = document.getElementById('btnCopiarLink');
      
      if (input && button) {
        // Copiar para área de transferência
        await navigator.clipboard.writeText(input.value);
        
        // Mudar texto do botão temporariamente
        const textoOriginal = button.innerHTML;
        button.innerHTML = '<span class="btn-icon">✅</span> Copiado!';
        button.style.background = '#28a745';
        
        // Restaurar texto original após 2 segundos
        setTimeout(() => {
          button.innerHTML = textoOriginal;
          button.style.background = '#007bff';
        }, 2000);
        
        console.log('📎 Link copiado com sucesso');
      }
    } catch (error) {
      console.error('❌ Erro ao copiar link:', error);
      // Fallback: selecionar texto para cópia manual
      const input = document.getElementById('linkFichaInput');
      if (input) {
        input.select();
        alert('Selecione o texto e copie manualmente (Ctrl+C)');
      }
    }
  }

  async openAnamnese(clienteId, clienteNome) {
    try {
      console.log("🔍 Abrindo anamnese do cliente:", clienteId);
      
      // Limpar formulário
      this.clearForm('modalAnamnese');
      
      // Carregar dados do cliente e ficha existente
      await this.loadClienteForAnamnese(clienteId);
      
      // Configurar modal para edição
      await this.setupModalAnamnese(clienteId, clienteNome, false);
      
      // Abrir modal
      this.showModal('modalAnamnese');
      
    } catch (error) {
      console.error('❌ Erro ao abrir anamnese:', error);
      UIUtils.showAlert('Erro ao abrir ficha de anamnese', 'error');
    }
  }

  async openAnamneseView(clienteId, clienteNome) {
    try {
      console.log("👁️ Abrindo anamnese do cliente em modo visualização:", clienteId);
      
      // Limpar formulário
      this.clearForm('modalAnamnese');
      
      // Carregar dados do cliente e ficha existente
      await this.loadClienteForAnamnese(clienteId);
      
      // Configurar modal para visualização (readonly)
      await this.setupModalAnamnese(clienteId, clienteNome, true);
      
      // Abrir modal
      this.showModal('modalAnamnese');
      
    } catch (error) {
      console.error('❌ Erro ao abrir anamnese em visualização:', error);
      UIUtils.showAlert('Erro ao abrir ficha de anamnese', 'error');
    }
  }

  async loadClienteForAnamnese(clienteId) {
    try {
      console.log('🔍 Carregando dados para anamnese do cliente:', clienteId);
      
      // Primeiro, carregar serviços para garantir que o select esteja populado
      await this.loadServicos();
      
      // Encontrar cliente na lista local
      const cliente = this.clientes.find(c => c.id === clienteId);
      if (!cliente) {
        throw new Error('Cliente não encontrado');
      }
      
      // Carregar ficha de anamnese existente
      const { data: anamneseData, error: anamneseError } = await window.dataManager.supabase
        .from('anamnese_clientes')
        .select('*')
        .eq('cliente_id', clienteId)
        .maybeSingle();
      
      if (anamneseError && anamneseError.code !== 'PGRST116') {
        console.error('Erro ao carregar anamnese:', anamneseError);
        throw anamneseError;
      }
      
      // Se existe ficha, preencher formulário
      if (anamneseData) {
        console.log('📋 Ficha existente encontrada:', anamneseData);
        this.populateAnamneseForm(anamneseData);
        this.anamneseEditando = anamneseData;
        this.currentAnamneseId = anamneseData.id; // CORREÇÃO: Salvar ID da ficha
      } else {
        console.log('📝 Nenhuma ficha encontrada, formulário limpo');
        this.anamneseEditando = null;
        this.currentAnamneseId = null; // CORREÇÃO: Limpar ID
      }
      
      return { cliente, anamnese: anamneseData };
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados para anamnese:', error);
      throw error;
    }
  }

  async setupModalAnamnese(clienteId, clienteNome, isViewMode = false) {
    this.clienteIdAnamnese = clienteId;
    
    // Configurar título do modal
    if (isViewMode) {
      document.getElementById('modalAnamneseTitulo').textContent = `Ficha de Anamnese - ${clienteNome}`;
      document.getElementById('btnSalvarAnamnese').style.display = 'none';
    } else {
      document.getElementById('modalAnamneseTitulo').textContent = `Editar Ficha - ${clienteNome}`;
      document.getElementById('btnSalvarAnamnese').style.display = 'inline-block';
    }
    
    // Configurar campos como readonly se for modo de visualização
    const fields = [
      'anamneseNomeCompleto', 'anamneseIdade', 'anamneseOcupacao', 'anamneseIndicacao',
      'anamneseEndereco', 'anamneseCEP', 'anamneseCPF', 'anamneseContatoWhatsApp',
      'anamneseMenorIdade', 'anamneseResponsavel', 'anamneseContatoResponsavel',
      'anamneseGestacao', 'anamneseDiabetes', 'anamneseRoeUnhas', 'anamneseUnhaEncravada', 'anamneseAlergia',
      'anamneseCuticula', 'anamneseMicose', 'anamneseUsaMedicamento',
      'anamneseMedicamentos', 'anamneseAtividadeFisica', 'anamnesePiscinaPraia',
      'anamneseServico', 'anamneseAutorizacao'
    ];

    fields.forEach(fieldId => {
      const element = document.getElementById(fieldId);
      if (element) {
        if (isViewMode) {
          element.readOnly = true;
          element.disabled = element.type === 'checkbox';
          element.classList.add('readonly');
        } else {
          element.readOnly = false;
          element.disabled = false;
          element.classList.remove('readonly');
        }
      }
    });
    
    // Configurar visibilidade dos campos do responsável (apenas uma vez)
    this.toggleResponsavelFields();
  }

  // Controlar visibilidade dos campos do responsável
  toggleResponsavelFields() {
    const menorIdadeCheckbox = document.getElementById('anamneseMenorIdade');
    const responsavelRow = document.getElementById('rowResponsavel');
    
    if (menorIdadeCheckbox && responsavelRow) {
      if (menorIdadeCheckbox.checked) {
        responsavelRow.style.display = 'flex';
        console.log('🔍 Mostrando campos do responsável');
      } else {
        responsavelRow.style.display = 'none';
        console.log('🔍 Escondendo campos do responsável');
      }
    }
  }

  createNewAnamnese(clienteId, clienteNome) {
    this.clienteIdAnamnese = clienteId;
    this.anamneseEditando = null;
    
    // Limpar formulário
    this.clearAnamneseForm();
    
    // Configurar modal
    document.getElementById('modalAnamneseTitulo').textContent = `Nova Ficha - ${clienteNome}`;
    document.getElementById('btnSalvarAnamnese').innerHTML = '<span class="btn-icon"> </span> Criar Ficha';
    
    // Configurar permissões
    this.setupAnamnesePermissions();
    
    // Abrir modal
    this.showModal('modalAnamnese');
  }

  editAnamnese(anamnese, clienteNome) {
    this.clienteIdAnamnese = anamnese.cliente_id;
    this.anamneseEditando = anamnese;
    
    // Preencher formulário
    this.populateAnamneseForm(anamnese);
    
    // Configurar modal
    document.getElementById('modalAnamneseTitulo').textContent = `Editar Ficha - ${clienteNome}`;
    document.getElementById('btnSalvarAnamnese').innerHTML = '<span class="btn-icon"> </span> Atualizar Ficha';
    
    // Configurar permissões
    this.setupAnamnesePermissions();
    
    // Abrir modal
    this.showModal('modalAnamnese');
  }

  setupAnamnesePermissions() {
    const userProfile = window.authManager?.currentUserProfile;
    const isAdmin = userProfile?.role === 'admin';
    const restrictedFields = document.querySelectorAll('[data-restricted="true"]');
    
    restrictedFields.forEach(field => {
      if (isAdmin) {
        field.disabled = false;
      } else {
        field.disabled = true;
      }
    });
  }

  async loadServicos() {
    try {
      console.log('🔄 Carregando serviços para o formulário admin...');
      
      // ✅ CORRIGIDO: Usar campos específicos da nova estrutura
      const { data, error } = await window.dataManager.supabase
        .from('servicos')
        .select(`
          id, 
          nome, 
          categoria, 
          duracao_min, 
          descricao, 
          valor, 
          cor, 
          ativo, 
          created_at
        `)
        .eq('ativo', true)
        .order('nome');

      if (error) {
        console.error('Erro ao carregar serviços:', error);
        this.servicos = [];
        return;
      }

      // ✅ MAPEAR PARA COMPATIBILIDADE
      this.servicos = (data || []).map(servico => ({
        ...servico,
        duracao: servico.duracao_min,
        duracao_minutos: servico.duracao_min,
        preco: servico.valor
      }));

      console.log('✅ Serviços carregados:', this.servicos.length);
      
      // Adicionar serviços ao select do formulário de anamnese
      const selectServico = document.getElementById('anamneseServico');
      if (selectServico) {
        // Limpar opções existentes (exceto a primeira)
        selectServico.innerHTML = '<option value="">Selecione um serviço...</option>';
        
        data.forEach(servico => {
          const option = document.createElement('option');
          option.value = servico.nome;
          option.textContent = servico.nome;
          selectServico.appendChild(option);
        });
        
        console.log('✅ Serviços adicionados ao select anamneseServico:', data.length);
      } else {
        console.warn('❌ Select anamneseServico não encontrado!');
      }
      
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
      this.loadDefaultServicos();
    }
  }

  loadDefaultServicos() {
    console.log('🔄 Carregando serviços padrão...');
    
    const selectServico = document.getElementById('anamneseServico');
    if (selectServico) {
      selectServico.innerHTML = `
        <option value="">Selecione um serviço...</option>
      `;
      
      // Carregar serviços do DataManager
      if (window.dataManager && window.dataManager.servicos) {
        window.dataManager.servicos.forEach(servico => {
          const option = document.createElement('option');
          option.value = servico.nome;
          option.textContent = servico.nome;
          selectServico.appendChild(option);
        });
      }
    }
  }

  populateAnamneseForm(anamnese) {
    console.log('🔍 Preenchendo formulário com dados:', anamnese);
    
    // Mapeamento explícito para garantir que todos os campos sejam preenchidos
    const fieldMapping = {
      'anamneseNomeCompleto': 'nome_completo',
      'anamneseIdade': 'idade',
      'anamneseOcupacao': 'ocupacao',
      'anamneseIndicacao': 'indicacao',
      'anamneseEndereco': 'endereco',
      'anamneseCEP': 'cep',
      'anamneseCPF': 'cpf',
      'anamneseContatoWhatsApp': 'contato_whatsapp',
      'anamneseMenorIdade': 'menor_idade',
      'anamneseResponsavel': 'responsavel',
      'anamneseContatoResponsavel': 'contato_responsavel',
      'anamneseGestacao': 'gestante',
      'anamneseDiabetes': 'diabetes',
      'anamneseRoeUnhas': 'roe_unhas',
      'anamneseUnhaEncravada': 'unha_encravada',
      'anamneseAlergia': 'alergia_esmalte',
      'anamneseCuticula': 'retira_cuticula',
      'anamneseMicose': 'micose_fungo',
      'anamneseUsaMedicamento': 'usa_medicamento',
      'anamneseMedicamentos': 'medicamentos',
      'anamneseAtividadeFisica': 'atividade_fisica',
      'anamnesePiscinaPraia': 'piscina_praia',
      'anamneseServico': 'servico_escolhido',
      'anamneseAutorizacao': 'autorizacao_procedimento'
    };

    // Preencher cada campo usando o mapeamento explícito
    Object.entries(fieldMapping).forEach(([fieldId, dbField]) => {
      const element = document.getElementById(fieldId);
      if (element) {
        const value = anamnese[dbField];
        
        // Tratamento especial para o campo serviço (select)
        if (fieldId === 'anamneseServico' && element.tagName === 'SELECT') {
          if (value && value !== null && value !== undefined && value !== '') {
            // Esperar um pouco para garantir que as opções foram carregadas
            setTimeout(() => {
              let found = false;
              for (let i = 0; i < element.options.length; i++) {
                if (element.options[i].value === value || element.options[i].text === value) {
                  element.selectedIndex = i;
                  found = true;
                  break;
                }
              }
              
              if (!found) {
                console.warn('⚠️ Serviço não encontrado na lista, adicionando dinamicamente:', value);
                
                // CORREÇÃO: Adicionar opção dinamicamente se não existir
                const newOption = document.createElement('option');
                newOption.value = value;
                newOption.textContent = value;
                newOption.selected = true;
                element.appendChild(newOption);
              }
              
              // Forçar atualização visual do select
              element.dispatchEvent(new Event('change'));
            }, 200);
          }
        } else {
          // Preencher outros campos normalmente
          if (element.type === 'checkbox') {
            element.checked = value || false;
          } else {
            element.value = value || '';
          }
        }
      } else {
        console.warn(`⚠️ Elemento não encontrado: ${fieldId}`);
      }
    });
  }

  clearAnamneseForm() {
    const form = document.getElementById('formAnamnese');
    if (form) {
      form.reset();
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

  async confirmDelete(clienteNome) {
    console.log('🗑️ Confirmar exclusão:', clienteNome);
    
    // Encontrar cliente pelo nome
    const cliente = this.clientes.find(c => c.nome === clienteNome);
    if (!cliente) {
      UIUtils.showAlert('Cliente não encontrado', 'error');
      return;
    }
    
    const confirmed = await window.ConfirmDialog.confirmDelete({
      title: 'Excluir Cliente',
      message: 'Tem certeza que deseja excluir este cliente?',
      itemName: clienteNome,
      confirmText: 'Excluir Cliente'
    });

    if (confirmed) {
      await this.executarExclusao(cliente.id);
    }
  }

  fecharModalConfirmacao() {
    const modal = document.getElementById('modalConfirmarExclusao');
    if (modal) {
      modal.remove();
      document.body.style.overflow = 'auto';
    }
  }

  async executarExclusao(clienteId) {
    try {
      console.log('🗑️ Executando exclusão do cliente:', clienteId);
      
      // Excluir cliente no DataManager
      await window.dataManager.deleteCliente(clienteId);
      
      // Fechar modal
      this.fecharModalConfirmacao();
      
      // Recarregar lista
      await this.loadClientes();
      this.renderClientTable();
      
      UIUtils.showAlert('Cliente excluído com sucesso', 'success');
      
    } catch (error) {
      console.error('❌ Erro ao excluir cliente:', error);
      
      // Verificar se é erro de chave estrangeira (agendamentos associados)
      if (error.code === '23503' && error.message.includes('agendamentos')) {
        UIUtils.showAlert('Não é possível excluir este cliente pois existem agendamentos associados. Exclua primeiro os agendamentos deste cliente.', 'error');
      } else {
        UIUtils.showAlert('Erro ao excluir cliente', 'error');
      }
      
      // Fechar modal de qualquer forma
      this.fecharModalConfirmacao();
    }
  }

  // Mostrar histórico do cliente
  async showHistorico(clienteId, clienteNome) {
    try {
      // Verificar se elementos existem
      const historicoSection = document.getElementById('historicoSection');
      const listaSection = document.getElementById('listaSection');
      
      if (historicoSection && listaSection) {
        // Mostrar seção de histórico
        historicoSection.style.display = 'block';
        listaSection.style.display = 'none';
        
        // Atualizar informações do cliente
        const clienteInfo = document.getElementById('clienteInfo');
        if (clienteInfo) {
          clienteInfo.innerHTML = `
            <h3>${clienteNome}</h3>
            <p>Carregando histórico...</p>
          `;
        }
        
        // Carregar agendamentos do cliente
        await this.carregarHistoricoAgendamentos(clienteId);
        
        // Atualizar informações do cliente após carregar
        if (clienteInfo) {
          clienteInfo.innerHTML = `
            <h3>${clienteNome}</h3>
            <p>Histórico de agendamentos</p>
          `;
        }
        
        // Configurar botão fechar
        const btnFecharHistorico = document.getElementById('btnFecharHistorico');
        if (btnFecharHistorico) {
          btnFecharHistorico.onclick = () => {
            historicoSection.style.display = 'none';
            listaSection.style.display = 'block';
          };
        }
      }
    } catch (error) {
      console.error('Erro ao mostrar histórico:', error);
      UIUtils.showAlert('Erro ao carregar histórico: ' + error.message, 'error');
    }
  }

  // Carregar histórico de agendamentos
  async carregarHistoricoAgendamentos(clienteId) {
    try {
      const { data, error } = await this.supabase
        .from('agendamentos')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('data_inicio', { ascending: false });
        
      if (error) {
        throw error;
      }
      
      const tabelaHistorico = document.getElementById('tabelaHistorico');
      if (tabelaHistorico) {
        if (data && data.length > 0) {
          tabelaHistorico.innerHTML = `
            <table class="modern-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Serviço</th>
                  <th>Profissional</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${data.map(agendamento => {
                  const dataAgendamento = new Date(agendamento.data_inicio);
                  const dataFormatada = dataAgendamento.toLocaleDateString('pt-BR');
                  const horaFormatada = dataAgendamento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  
                  // Buscar nome do serviço
                  const servico = window.dataManager?.servicos?.find(s => s.id === agendamento.servico_id);
                  const servicoNome = servico ? servico.nome : 'Serviço não encontrado';
                  
                  // Buscar nome do profissional
                  const profissional = window.dataManager?.profissionais?.find(p => p.id === agendamento.profissional_id);
                  const profissionalNome = profissional ? profissional.nome : 'Profissional não encontrado';
                  
                  return `
                    <tr>
                      <td>${dataFormatada} ${horaFormatada}</td>
                      <td>${servicoNome}</td>
                      <td>${profissionalNome}</td>
                      <td><span class="badge badge-primary">${agendamento.status || 'Agendado'}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `;
        } else {
          tabelaHistorico.innerHTML = '<p>Nenhum agendamento encontrado.</p>';
        }
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      const tabelaHistorico = document.getElementById('tabelaHistorico');
      if (tabelaHistorico) {
        tabelaHistorico.innerHTML = '<p>Erro ao carregar histórico.</p>';
      }
    }
  }

  async saveAnamnese() {
    try {
      // Coletar dados do formulário
      const anamneseData = {
        nome_completo: document.getElementById('anamneseNomeCompleto')?.value || '',
        idade: document.getElementById('anamneseIdade')?.value || '',
        ocupacao: document.getElementById('anamneseOcupacao')?.value || '',
        indicacao: document.getElementById('anamneseIndicacao')?.value || '',
        endereco: document.getElementById('anamneseEndereco')?.value || '',
        cep: document.getElementById('anamneseCEP')?.value || '',
        cpf: document.getElementById('anamneseCPF')?.value || '',
        contato_whatsapp: document.getElementById('anamneseContatoWhatsApp')?.value || '',
        menor_idade: document.getElementById('anamneseMenorIdade')?.value || '',
        responsavel: document.getElementById('anamneseResponsavel')?.value || '',
        contato_responsavel: document.getElementById('anamneseContatoResponsavel')?.value || '',
        gestante: document.getElementById('anamneseGestacao')?.checked || false,
        diabetes: document.getElementById('anamneseDiabetes')?.checked || false,
        roe_unhas: document.getElementById('anamneseRoeUnhas')?.checked || false,
        unha_encravada: document.getElementById('anamneseUnhaEncravada')?.checked || false,
        alergia_esmalte: document.getElementById('anamneseAlergia')?.checked || false,
        retira_cuticula: document.getElementById('anamneseCuticula')?.checked || false,
        micose_fungo: document.getElementById('anamneseMicose')?.checked || false,
        usa_medicamento: document.getElementById('anamneseUsaMedicamento')?.checked || false,
        medicamentos: document.getElementById('anamneseMedicamentos')?.value || '',
        atividade_fisica: document.getElementById('anamneseAtividadeFisica')?.checked || false,
        piscina_praia: document.getElementById('anamnesePiscinaPraia')?.checked || false,
        servico_escolhido: document.getElementById('anamneseServico')?.value || '',
        autorizacao_procedimento: document.getElementById('anamneseAutorizacao')?.checked || false
      };

      // Validação do WhatsApp
      if (anamneseData.contato_whatsapp && !this.isValidPhone(anamneseData.contato_whatsapp)) {
        UIUtils.showAlert('WhatsApp inválido. Use o formato (DDD) 00000-0000', 'error');
        return;
      }

      // Obter ID do cliente atual
      const modalTitulo = document.getElementById('modalAnamneseTitulo')?.textContent || '';
      
      // CORREÇÃO: Aceitar ambos os formatos de título
      const clienteNome = modalTitulo.match(/(?:Ficha de Anamnese|Editar Ficha) - (.+)/)?.[1] || '';
      
      const cliente = this.clientes.find(c => c.nome === clienteNome);
      
      if (!cliente) {
        console.error('❌ Cliente não encontrado para nome:', clienteNome);
        UIUtils.showAlert('Cliente não encontrado', 'error');
        return;
      }

      // Salvar no Supabase - CORREÇÃO: Usar UPDATE para edição (ficha já existe)
      const { data, error } = await window.supabase
        .from('anamnese_clientes')
        .update({
          ...anamneseData,
          cliente_id: cliente.id
        })
        .eq('id', this.currentAnamneseId)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao salvar anamnese:', error);
        UIUtils.showAlert('Erro ao salvar ficha de anamnese', 'error');
        return;
      }

      console.log('✅ Anamnese salva com sucesso');
      UIUtils.showAlert('Ficha de anamnese salva com sucesso', 'success');
      
      // Fechar modal
      this.hideModal('modalAnamnese');
      
    } catch (error) {
      console.error('Erro ao salvar anamnese:', error);
      UIUtils.showAlert('Erro ao salvar ficha de anamnese', 'error');
    }
  }

  isValidPhone(phone) {
    // Aceita ambos os formatos: (DD) XXXX-XXXX (14 chars) ou (DDD) XXXXX-XXXX (15 chars)
    const phoneRegex = /^\(\d{2}\) \d{4,5}-\d{4}$/;
    const isValid = phoneRegex.test(phone);
    
    // Verificar se tem exatamente 14 ou 15 caracteres (incluindo espaço)
    const hasCorrectLength = phone.length === 14 || phone.length === 15;
    
    return isValid && hasCorrectLength;
  }

  // Obter classe do badge baseado no status
  getStatusBadgeClass(status) {
    switch (status) {
      case 'confirmado': return 'success';
      case 'concluido': return 'primary';
      case 'cancelado': return 'danger';
      case 'pendente': return 'warning';
      default: return 'secondary';
    }
  }

  setupPhoneFormatting() {
    // Configurar formatação para telefone do cliente
    const telefoneClienteInput = document.getElementById('telefoneCliente');
    if (telefoneClienteInput) {
      telefoneClienteInput.addEventListener('input', (e) => {
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
      console.log('✅ Formatação automática de telefone (cliente) configurada');
    }

    // Configurar formatação para WhatsApp da anamnese
    const whatsappAnamneseInput = document.getElementById('contatoWhatsApp');
    if (whatsappAnamneseInput) {
      whatsappAnamneseInput.addEventListener('input', (e) => {
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
      console.log('✅ Formatação automática de WhatsApp (anamnese) configurada');
    }
  }
}

// Exportar para uso global
window.ClientesPage = ClientesPage;
