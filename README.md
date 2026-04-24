
https://robsoncvieira310-creator.github.io/agenda-beauty/profissionais.html

# 🌟 Agenda Beauty - Sistema de Gestão para Salões de Beleza

Um sistema completo e moderno de gestão para salões de beleza, desenvolvido com tecnologias web modernas e integrado com Supabase.

## 📋 **Visão Geral**

O Agenda Beauty é uma solução profissional que oferece:
- **Agendamento inteligente** com calendário interativo
- **Gestão completa** de clientes, serviços e profissionais
- **Interface moderna** e responsiva
- **Autenticação segura** com controle de acesso
- **Dashboard analítico** com estatísticas em tempo real

## 🚀 **Tecnologias Utilizadas**

### **Frontend**
- **HTML5** - Estrutura semântica e moderna
- **CSS3** - Design responsivo com animações suaves
- **JavaScript ES6+** - Lógica de negócio e interatividade avançada
- **FullCalendar** - Calendário interativo e profissional
- **Google Calendar Design System** - Interface inspirada no Google Calendar

### **Backend & API**
- **Node.js + Express.js** - Servidor backend robusto
- **Supabase** - Backend como serviço (BaaS) e banco de dados
- **PostgreSQL** - Banco de dados relacional robusto
- **Deno Edge Functions** - Funções serverless para operações críticas
- **CORS** - Compartilhamento de recursos entre origens
- **dotenv** - Gestão de variáveis de ambiente

### **Arquitetura Avançada**
- **Finite State Machine (FSM)** - Gestão de estados complexos
- **Composition Root Pattern** - Injeção de dependências controlada
- **Boot Sequence Orchestrator** - Inicialização determinística
- **Effect System** - Gestão de efeitos colaterais
- **Runtime Health Monitoring** - Monitoramento em tempo real
- **Execution Engine** - Motor de execução de comandos

### **Autenticação & Segurança**
- **Supabase Auth** - Sistema de autenticação completo
- **JWT Tokens** - Segurança na gestão de sessões
- **Role-Based Access Control** - Controle de acesso por papéis
- **Password Reset Flow** - Fluxo de recuperação de senha

### **Design & UX**
- **Design System** consistente e profissional
- **Interface responsiva** para todos os dispositivos
- **Feedback visual** com indicadores de carregamento
- **Acessibilidade** com navegação por teclado
- **Google Calendar UX Patterns** - Comportamento familiar aos usuários

## 📁 **Estrutura do Projeto**

```
agenda-beauty/
│
├── 📄 PÁGINAS PRINCIPAIS
├── index.html              # Dashboard principal
├── agenda.html             # Calendário de agendamentos
├── clientes.html           # Gestão de clientes
├── profissionais.html      # Gestão de profissionais
├── servicos.html           # Gestão de serviços
├── empresas.html           # Gestão de empresas/multi-salão
├── anamnese.html           # Formulários de anamnese
├── login.html              # Autenticação
├── change-password.html    # Alteração de senha
│
├── 🎨 ESTILOS E COMPONENTES
├── css/
│   ├── style.css           # Estilos globais e componentes
│   ├── calendar-google-style.css # Estilo Google Calendar
│   └── fullcalendar.min.css # Estilos FullCalendar
│
├── 🧠 LÓGICA DA APLICAÇÃO
├── js/
│   ├── composition-root.js    # Orquestrador principal do sistema
│   ├── supabaseClient.js      # Cliente Supabase
│   ├── auth-authorization.js  # Sistema de autorização
│   ├── auth-store.js          # Store de autenticação
│   ├── bootstrap-auth.js      # Bootstrap do auth
│   ├── logoutManager.js       # Gestão de logout
│   │
│   ├── 📁 core/                # Arquitetura core do sistema
│   │   ├── BootSequencer.js   # Sequenciador de boot
│   │   ├── execution-engine.js # Motor de execução
│   │   ├── lifecycle-contract.js # Contratos de lifecycle
│   │   ├── runtime-health.js  # Monitoramento de runtime
│   │   └── [20+ arquivos]     # Sistema de boot avançado
│   │
│   ├── 📁 fsm/                 # Finite State Machine
│   │   ├── auth-fsm.js        # Máquina de estados de autenticação
│   │   ├── effect-analyzer.js # Analisador de efeitos
│   │   └── effect-runner.js   # Executor de efeitos
│   │
│   ├── 📁 services/            # Serviços de negócio
│   │   ├── AgendaService.js   # Serviço de agendamentos
│   │   ├── ClienteService.js  # Serviço de clientes
│   │   └── [outros serviços]
│   │
│   ├── 📁 auth/                # Módulos de autenticação
│   └── 📁 ui/                  # Componentes UI
│
├── 🔧 BACKEND
├── backend/
│   ├── server.js            # Servidor Express.js
│   ├── package.json         # Dependências Node.js
│   └── package-lock.json    # Lock de dependências
│
├── ☁️ EDGE FUNCTIONS (Deno)
├── edge-functions/
│   └── reset-password.ts    # Reset de senha
│
├── 🗄️ SUPABASE
├── supabase/
│   ├── functions/           # Funções serverless
│   ├── migrations/          # Migrações de banco
│   └── _shared/            # Code compartilhado
│
├── 📚 BIBLIOTECAS
├── libs/
│   └── fullcalendar.min.js  # Biblioteca FullCalendar
│
├── 📖 DOCUMENTAÇÃO
├── docs/
│   ├── README.md            # Documentação principal
│   ├── checkpoint-v1.3.md   # Checkpoint v1.3
│   ├── checkpoint-v1.4.md   # Checkpoint v1.4
│   └── checkpoint-v1-5.md   # Checkpoint v1.5
│
├── 🚀 DEPLOY
├── deploy.ps1               # Script deploy PowerShell
├── deploy.sh                # Script deploy Bash
├── deno.json               # Configuração Deno
│
├── 📋 CONFIGURAÇÃO
├── package.json            # Dependências do projeto
├── package-lock.json       # Lock de dependências
├── .gitignore              # Arquivos ignorados pelo Git
├── .gitattributes          # Atributos Git
└── README.md               # Este arquivo
```

## 🎯 **Funcionalidades Principais**

### **📅 Agenda Avançada**
- **Calendário visual** com vista mensal, semanal e diária
- **Arrastar e soltar** para reagendar com validação de conflitos
- **Bloqueios de horário** para folgas e manutenção
- **Filtros dinâmicos** por profissional, serviço e cliente
- **Detecção automática de conflitos** para evitar duplos agendamentos
- **Sidebar Google Calendar style** com comportamento familiar
- **Visualização por profissional** com cores personalizadas

### **👥 Clientes**
- **Cadastro completo** com informações detalhadas
- **Histórico de agendamentos** integrado e navegável
- **Busca inteligente** com filtros avançados
- **Anamnese completa** com formulários personalizados
- **Gestão de documentos** e histórico de tratamentos
- **Importação/exportação** de dados

### **👩 Profissionais**
- **Gestão de equipe** com especializações
- **Disponibilidade** e horários de trabalho
- **Estatísticas individuais** de performance
- **Escalas e turnos** flexíveis
- **Cores personalizadas** no calendário
- **Gestão de bloqueios** individuais e gerais

### **💇 Serviços**
- **Catálogo completo** com preços e durações
- **Categorias** e especializações
- **Promoções** e pacotes de serviços
- **Gestão de estoque** de produtos
- **Duração flexível** com múltiplos formatos
- **Integração** com agendamentos

### **🏢 Empresas (Multi-salão)**
- **Gestão multi-salão** com controle centralizado
- **Configurações** por empresa
- **Relatórios consolidados** e individuais
- **Transferência** de dados entre salões

### **📋 Anamnese**
- **Formulários personalizados** por tipo de tratamento
- **Histórico completo** do cliente
- **Templates** reutilizáveis
- **Integração** com agendamentos
- **Exportação** de dados clínicos

### **🔐 Autenticação Avançada**
- **Login seguro** com validação em múltiplos níveis
- **Sistema de papéis e permissões** (Admin, Profissional, Cliente)
- **Sessões persistentes** com refresh automático
- **Recuperação de senha** com fluxo completo via email
- **Autorização granular** por funcionalidade
- **Finite State Machine** para gestão de estados de auth
- **Auto-healing** de sessões expiradas

## 🛠️ **Instalação e Configuração**

### **Pré-requisitos**
- **Node.js 18+** (obrigatório para o backend)
- **Deno** (opcional, para edge functions)
- Conta Supabase (gratuita)
- Editor de código (VS Code recomendado)
- Git

### **Configuração do Supabase**
1. Crie um projeto em [supabase.com](https://supabase.com)
2. Copie as chaves de API (URL e ANON KEY)
3. Configure as tabelas usando o SQL Editor
4. Ative a autenticação com providers desejados
5. Configure as Edge Functions se necessário

### **Configuração Local**
1. Clone este repositório:
```bash
git clone https://github.com/robsoncvieira310-creator/agenda-beauty.git
cd agenda-beauty
```

2. Instale as dependências do backend:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
# Crie um arquivo .env na raiz do projeto
cp .env.example .env
# Edite o arquivo .env com suas credenciais
```

```env
# .env
SUPABASE_URL=seu-url-supabase
SUPABASE_ANON_KEY=sua-chave-anonima
PORT=3000
NODE_ENV=development
```

4. Configure as credenciais no frontend:
```javascript
// Em js/supabaseClient.js (already configured with defaults)
const supabaseUrl = process.env.SUPABASE_URL || 'https://kckbcjjgbipcqzkynwpy.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

5. Inicie o servidor backend:
```bash
# Modo desenvolvimento
npm start

# Ou diretamente com Node.js
node backend/server.js
```

6. Acesse a aplicação:
```
Frontend: http://localhost:3000
API Backend: http://localhost:3000/api
```

### **Configuração das Edge Functions (Opcional)**
```bash
# Instale o Deno
curl -fsSL https://deno.land/install.sh | sh

# Teste localmente
deno run --allow-net edge-functions/reset-password.ts
```

### **Configuração do Banco de Dados**
Execute os scripts de migração em `supabase/migrations/`:
```sql
-- Execute no SQL Editor do Supabase
-- 20240320_delete_profissional_cascade.sql
-- 20260321030430_fix_duplicate_migration.sql
```

## 📊 **Banco de Dados**

### **Tabelas Principais**
```sql
-- Clientes
CREATE TABLE clientes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(255),
  endereco TEXT,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Profissionais
CREATE TABLE profissionais (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  especialidade VARCHAR(255),
  telefone VARCHAR(20),
  email VARCHAR(255),
  cor_calendario VARCHAR(7), -- #HEX color para calendário
  status BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Serviços
CREATE TABLE servicos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  valor DECIMAL(10,2), -- campo 'valor' em vez de 'preco'
  duracao INTEGER, -- em minutos
  duracao_minutos INTEGER, -- campo alternativo para compatibilidade
  categoria VARCHAR(100),
  status BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agendamentos (estrutura atualizada)
CREATE TABLE agendamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente VARCHAR(255) NOT NULL, -- campo de texto em vez de FK
  servico VARCHAR(255) NOT NULL, -- campo de texto em vez de FK
  profissional VARCHAR(255) NOT NULL, -- campo de texto em vez de FK
  inicio TIMESTAMP NOT NULL, -- campo 'inicio' em vez de 'data_inicio'
  fim TIMESTAMP NOT NULL, -- campo 'fim' em vez de 'data_fim'
  status VARCHAR(50) DEFAULT 'agendado',
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Empresas (Multi-salão)
CREATE TABLE empresas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(20),
  endereco TEXT,
  telefone VARCHAR(20),
  email VARCHAR(255),
  config_json JSONB, -- configurações específicas da empresa
  status BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Anamnese
CREATE TABLE anamnese (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id),
  profissional_id INTEGER REFERENCES profissionais(id),
  data_avaliacao DATE NOT NULL,
  formulario_json JSONB NOT NULL, -- estrutura dinâmica do formulário
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bloqueios de Horário
CREATE TABLE bloqueios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID REFERENCES empresas(id),
  profissional_id INTEGER REFERENCES profissionais(id), -- null para bloqueio geral
  titulo VARCHAR(255) NOT NULL,
  motivo TEXT,
  inicio TIMESTAMP NOT NULL,
  fim TIMESTAMP NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- 'folga', 'manutencao', 'evento', etc.
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Perfis de Usuário (Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  nome VARCHAR(255),
  role VARCHAR(50) DEFAULT 'profissional', -- 'admin', 'profissional', 'cliente'
  empresa_id UUID REFERENCES empresas(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **Relacionamentos e Índices**
```sql
-- Índices para performance
CREATE INDEX idx_agendamentos_inicio ON agendamentos(inicio);
CREATE INDEX idx_agendamentos_profissional ON agendamentos(profissional);
CREATE INDEX idx_agendamentos_cliente ON agendamentos(cliente);
CREATE INDEX idx_bloqueios_profissional ON bloqueios(profissional_id);
CREATE INDEX idx_bloqueios_periodo ON bloqueios(inicio, fim);
CREATE INDEX idx_anamnese_cliente ON anamnese(cliente_id);

-- Views úteis
CREATE VIEW agendamentos_detalhados AS
SELECT 
  a.*,
  c.nome as cliente_nome,
  c.telefone as cliente_telefone,
  p.nome as profissional_nome,
  p.cor_calendario,
  s.nome as servico_nome,
  s.valor as servico_valor,
  s.duracao as servico_duracao
FROM agendamentos a
LEFT JOIN clientes c ON a.cliente = c.nome
LEFT JOIN profissionais p ON a.profissional = p.nome
LEFT JOIN servicos s ON a.servico = s.nome;
```

## 🎨 **Design System**

### **Cores Principais**
- **Primária**: Dourado (#D4AF37)
- **Secundária**: Azul escuro (#1F2937)
- **Sucesso**: Verde (#10B981)
- **Alerta**: Laranja (#F59E0B)
- **Erro**: Vermelho (#EF4444)
- **Neutras**: Cinza claro (#F3F4F6)

### **Tipografia**
- **Títulos**: Inter, bold
- **Corpo**: Inter, regular
- **Código**: JetBrains Mono

### **Componentes**
- **Botões**: 3 variações (primary, secondary, danger)
- **Cards**: Sombras suaves e bordas arredondadas
- **Modais**: Overlay com backdrop blur
- **Tabelas**: Design moderno com hover states
- **Forms**: Validação em tempo real

## 🏗️ **Arquitetura Avançada**

### **Finite State Machine (FSM)**
O sistema utiliza uma máquina de estados para gerenciar o ciclo de vida da autenticação:
- **Estados**: `unauthenticated`, `authenticating`, `authenticated`, `error`, `refreshing`
- **Transições**: Login, logout, refresh, erro, recuperação
- **Efeitos**: Redirecionamentos, atualizações de UI, persistência de sessão
- **Auto-healing**: Recuperação automática de sessões expiradas

### **Composition Root Pattern**
Arquitetura de injeção de dependências centralizada:
- **Orquestrador Principal**: `composition-root.js`
- **Boot Sequencer**: Inicialização determinística de módulos
- **Execution Engine**: Motor de execução de comandos e efeitos
- **Lifecycle Contracts**: Contratos de ciclo de vida para componentes

### **Boot Sequence Orchestrator**
Sistema de inicialização robusto e resiliente:
- **Boot Kernel**: Núcleo do sistema de boot
- **Trace Context**: Rastreamento completo do processo de inicialização
- **Anomaly Detection**: Detecção de anomalias durante o boot
- **Recovery Manager**: Recuperação automática de falhas
- **Health Monitoring**: Monitoramento contínuo da saúde do sistema

### **Effect System**
Gestão declarativa de efeitos colaterais:
- **Effect Runner**: Executor de efeitos centralizado
- **Effect Analyzer**: Análise de dependências e conflitos
- **Execution Authority**: Controle de permissões de execução
- **Execution Firewall**: Proteção contra efeitos não autorizados

## 🔄 **Fluxo de Trabalho**

### **Fluxo de Agendamento**
1. **Boot Sequence** → Inicialização do sistema
2. **Auth FSM** → Verificação de autenticação
3. **Dashboard** → Estatísticas em tempo real
4. **Agenda** → Selecionar data/horário
5. **Modal** → Preencher dados
6. **Conflito Detection** → Validação automática
7. **Confirmação** → Salvar no banco
8. **Notificação** → Feedback ao usuário

### **Fluxo de Gestão**
1. **Navigation Effects** → Navegação controlada
2. **Data Services** → Camada de serviços centralizada
3. **State Management** → Gestão de estado reativa
4. **CRUD Operations** → Operações com validação
5. **UI Updates** → Atualização automática da interface
6. **Error Handling** → Tratamento robusto de erros

## 🚀 **Deploy**

### **Produção**
1. **Backend Node.js** - Servidor dedicado ou VPS
2. **Frontend** - GitHub Pages, Netlify, Vercel
3. **Supabase** - Banco de dados e Edge Functions
4. **Deno Deploy** - Edge Functions serverless

### **Scripts de Deploy Automatizados**
O projeto inclui scripts prontos para deploy:

#### **PowerShell (Windows)**
```bash
# Execute o script de deploy
.\deploy.ps1
```

#### **Bash (Linux/Mac)**
```bash
# Dê permissão de execução
chmod +x deploy.sh

# Execute o script
./deploy.sh
```

### **Configuração de Deploy**
```bash
# Deploy do Backend (Node.js)
npm start --production

# Deploy do Frontend (estático)
npm run build:frontend

# Deploy para Netlify
netlify deploy --prod --dir=.

# Deploy para Vercel
vercel --prod

# Deploy Edge Functions (Deno)
deno deploy --prod edge-functions/reset-password.ts
```

### **Variáveis de Ambiente de Produção**
```env
# Produção
NODE_ENV=production
PORT=3000
SUPABASE_URL=seu-url-supabase-producao
SUPABASE_ANON_KEY=sua-chave-anonima-producao
SUPABASE_SERVICE_ROLE_KEY=sua-chave-servico
```

### **CI/CD Pipeline**
```yaml
# .github/workflows/deploy.yml (exemplo)
name: Deploy Agenda Beauty
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Deploy to production
        run: ./deploy.sh
```

## 🧪 **Testes**

### **Testes Manuais**
- **Fluxo completo** de agendamento
- **Validação** de formulários
- **Responsividade** em dispositivos
- **Performance** de carregamento

### **Testes Automáticos** (planejado)
- **Unit tests** com Jest
- **E2E tests** com Cypress
- **Visual tests** com Percy

## 📈 **Melhorias Futuras**

### **Short Term**
- [ ] **Notificações** por email/SMS
- [ ] **Pagamentos** integrados
- [ ] **Relatórios** avançados
- [ ] **Mobile app** nativo

### **Long Term**
- [ ] **AI/ML** para otimização de agenda
- [ ] **Multi-salão** suporte
- [ ] **API REST** completa
- [ ] **Microserviços** architecture

## 🤝 **Contribuição**

### **Como Contribuir**
1. **Fork** este repositório
2. **Crie** uma branch (`git checkout -b feature/nova-funcionalidade`)
3. **Commit** suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. **Push** para a branch (`git push origin feature/nova-funcionalidade`)
5. **Abra** um Pull Request

### **Guidelines**
- **Código limpo** e bem documentado
- **Testes** para novas funcionalidades
- **Commits** semânticos
- **Respeito** ao design system

## 📝 **Licença**

Este projeto está licenciado sob a **MIT License**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 **Suporte**

- **Issues**: [GitHub Issues](https://github.com/seu-usuario/agenda-beauty/issues)
- **Email**: contato@agendabeauty.com
- **Discord**: [Servidor Discord](https://discord.gg/agendabeauty)

## 🙏 **Agradecimentos**

- **Supabase** - Backend e database
- **FullCalendar** - Componente de calendário
- **Comunidade** - Feedback e sugestões

---

**🌟 Agenda Beauty - Transformando a gestão de salões de beleza**

*Desenvolvido com ❤️ para profissionais da beleza*
