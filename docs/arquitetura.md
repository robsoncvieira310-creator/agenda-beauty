# 📋 Documentação de Arquitetura - Agenda Beauty

## 🏗️ **Visão Geral da Arquitetura**

O Agenda Beauty segue uma arquitetura **client-side** com **backend como serviço** (BaaS) utilizando Supabase. A aplicação é estruturada em camadas bem definidas para facilitar manutenção e escalabilidade.

## 📁 **Estrutura de Camadas**

### **1. Camada de Apresentação (Presentation Layer)**
```
├── index.html              # Dashboard principal
├── agenda.html             # Calendário e agendamentos
├── clientes.html           # Gestão de clientes
├── profissionais.html      # Gestão de profissionais
├── servicos.html           # Gestão de serviços
└── login.html              # Autenticação
```

**Responsabilidades:**
- Interface com o usuário
- Renderização de componentes
- Captura de eventos
- Validação de formulários

### **2. Camada de Lógica de Negócio (Business Logic Layer)**
```
├── js/
│   ├── calendarManager.js  # Lógica do calendário
│   ├── modalManager.js     # Gestão de modais
│   ├── agendaPage.js       # Lógica da agenda
│   ├── clientesPage.js     # Lógica de clientes
│   ├── profissionaisPage.js # Lógica de profissionais
│   └── servicosPage.js     # Lógica de serviços
```

**Responsabilidades:**
- Regras de negócio
- Validações complexas
- Orquestração de fluxos
- Gestão de estado da UI

### **3. Camada de Dados (Data Layer)**
```
├── js/
│   ├── dataManager.js      # Gestão de dados e cache
│   ├── supabaseClient.js   # Cliente do Supabase
│   └── authManager.js      # Gestão de autenticação
```

**Responsabilidades:**
- Comunicação com o backend
- Cache de dados
- Sincronização
- Tratamento de erros

### **4. Camada de Infraestrutura (Infrastructure Layer)**
```
├── js/
│   ├── pageManager.js      # Gestão de páginas base
│   ├── menuManager.js      # Navegação
│   ├── appInit.js          # Inicialização
│   └── utils.js            # Utilitários
```

**Responsabilidades:**
- Inicialização da aplicação
- Navegação e roteamento
- Utilitários compartilhados
- Configuração global

## 🔄 **Fluxo de Dados**

### **Fluxo de Leitura (Read)**
```
UI Event → PageManager → DataManager → Supabase → Cache → UI Update
```

1. **UI Event**: Usuário interage com a interface
2. **PageManager**: Orquestra a requisição
3. **DataManager**: Verifica cache primeiro
4. **Supabase**: Busca dados se cache vazio
5. **Cache**: Armazena resposta
6. **UI Update**: Atualiza interface

### **Fluxo de Escrita (Write)**
```
UI Event → Validation → DataManager → Supabase → Cache Invalidation → UI Refresh
```

1. **UI Event**: Usuário submete formulário
2. **Validation**: Validação local e regras de negócio
3. **DataManager**: Envia para Supabase
4. **Supabase**: Persiste dados
5. **Cache Invalidation**: Limpa cache relevante
6. **UI Refresh**: Atualiza interface

## 🗄️ **Modelo de Dados**

### **Entidades Principais**

#### **Cliente**
```javascript
{
  id: number,
  nome: string,
  telefone: string,
  email: string,
  endereco: string,
  observacoes: string,
  created_at: string,
  updated_at: string
}
```

#### **Profissional**
```javascript
{
  id: number,
  nome: string,
  especialidade: string,
  telefone: string,
  email: string,
  status: boolean,
  created_at: string,
  updated_at: string
}
```

#### **Serviço**
```javascript
{
  id: number,
  nome: string,
  descricao: string,
  preco: number,
  duracao: number, // minutos
  categoria: string,
  status: boolean,
  created_at: string,
  updated_at: string
}
```

#### **Agendamento**
```javascript
{
  id: number,
  cliente_id: number,
  servico_id: number,
  profissional_id: number,
  data_inicio: string,
  data_fim: string,
  status: 'agendado' | 'confirmado' | 'em_andamento' | 'concluido' | 'cancelado' | 'nao_compareceu',
  observacoes: string,
  created_at: string,
  updated_at: string
}
```

## 🎯 **Padrões de Projeto**

### **1. Singleton Pattern**
- **DataManager**: Instância única para gestão de cache
- **AuthManager**: Instância única para autenticação
- **ModalManager**: Instância única para gestão de modais

### **2. Observer Pattern**
- **Eventos Customizados**: Comunicação entre componentes
- **appReady Event**: Notificação de inicialização completa
- **modalAgendamentoSalvo Event**: Notificação de salvamento

### **3. Factory Pattern**
- **PageManager**: Criação de páginas específicas
- **ModalManager**: Criação de modais dinâmicos

### **4. Repository Pattern**
- **DataManager**: Abstração do acesso a dados
- **Cache Layer**: Abstração do cache de dados

## 🔧 **Componentes Principais**

### **CalendarManager**
```javascript
class CalendarManager {
  // Inicialização do FullCalendar
  initializeCalendar()
  
  // Gestão de eventos
  handleEventClick(info)
  handleEventDrop(info)
  handleEventResize(info)
  
  // Renderização
  processarEventos(agendamentos)
  refreshEvents()
}
```

### **DataManager**
```javascript
class DataManager {
  // Cache
  cache: {
    clientes: Cliente[],
    profissionais: Profissional[],
    servicos: Servico[],
    agendamentos: Agendamento[]
  }
  
  // CRUD Operations
  async loadClientes()
  async addCliente(cliente)
  async updateCliente(id, cliente)
  async deleteCliente(id)
}
```

### **ModalManager**
```javascript
class ModalManager {
  // Gestão de modais
  abrirModalAgendamento(data)
  fecharModal()
  
  // Validação e salvamento
  async salvarAgendamento()
  async salvarBloqueio()
  
  // UI State
  preencherFormulario(data)
  limparFormulario()
}
```

## 🔄 **Ciclo de Vida da Aplicação**

### **1. Inicialização**
```javascript
// 1. Carregamento dos scripts
// 2. Criação dos managers
// 3. Configuração do Supabase
// 4. Disparo do evento appReady
// 5. Inicialização das páginas
```

### **2. Carregamento de Dados**
```javascript
// 1. Verificação de autenticação
// 2. Carregamento do cache
// 3. Busca de dados do Supabase
// 4. Armazenamento no cache
// 5. Renderização da UI
```

### **3. Interação do Usuário**
```javascript
// 1. Captura de eventos
// 2. Validação local
// 3. Envio para DataManager
// 4. Processamento no backend
// 5. Atualização do cache e UI
```

## 🛡️ **Segurança**

### **Autenticação**
- **JWT Tokens**: Sessões seguras
- **Role-based Access**: Controle por papéis
- **Session Management**: Refresh automático

### **Validação**
- **Client-side**: Validação instantânea
- **Server-side**: Validação no Supabase
- **Input Sanitization**: Limpeza de dados

### **CORS**
- **Origin Whitelist**: Domínios permitidos
- **Method Restrictions**: Métodos HTTP permitidos

## 📊 **Performance**

### **Cache Strategy**
- **Memory Cache**: Dados em memória
- **Cache Invalidation**: Limpeza inteligente
- **Lazy Loading**: Carregamento sob demanda

### **Optimizations**
- **Event Delegation**: Redução de listeners
- **Debouncing**: Limitação de chamadas
- **Virtual Scrolling**: Para grandes listas

## 🔧 **Configuração**

### **Ambiente de Desenvolvimento**
```javascript
// Supabase Configuration
const SUPABASE_URL = 'http://localhost:8000';
const SUPABASE_ANON_KEY = 'dev-key';
```

### **Ambiente de Produção**
```javascript
// Supabase Configuration
const SUPABASE_URL = 'https://project.supabase.co';
const SUPABASE_ANON_KEY = 'prod-key';
```

## 🚀 **Deploy**

### **Static Hosting**
- **GitHub Pages**: Para documentação
- **Netlify**: Para aplicação principal
- **Vercel**: Para ambiente de staging

### **CDN Configuration**
- **Asset Optimization**: Minificação de CSS/JS
- **Cache Headers**: Cache de longo prazo
- **Compression**: Gzip/Brotli

## 🧪 **Testes**

### **Tipos de Testes**
- **Unit Tests**: Testes de unidade
- **Integration Tests**: Testes de integração
- **E2E Tests**: Testes ponta a ponta
- **Visual Tests**: Testes visuais

### **Ferramentas**
- **Jest**: Para unit tests
- **Cypress**: Para E2E tests
- **Percy**: Para visual tests

## 📈 **Monitoramento**

### **Métricas**
- **Performance**: Tempo de carregamento
- **Errors**: Taxa de erros
- **Usage**: Estatísticas de uso

### **Ferramentas**
- **Google Analytics**: Análise de uso
- **Sentry**: Monitoramento de erros
- **Lighthouse**: Performance

---

**📋 Esta documentação está em constante evolução. Contribuições são bem-vindas!**
