# Agenda Beauty - Sistema de Gestão para Salões de Beleza

O Agenda Beauty é uma aplicação web para gestão de salões de beleza, com recursos de agendamento, clientes, profissionais, serviços e empresas, integrada ao Supabase.

## Visão Geral

O Agenda Beauty oferece:
- **Agendamento** com calendário interativo
- **Gestão** de clientes, serviços e profissionais
- **Interface** responsiva
- **Autenticação** com controle de acesso
- **Dashboard** com visão geral do sistema

## Tecnologias Utilizadas

### **Frontend**
- **HTML5**
- **CSS3**
- **JavaScript ES6+**
- **FullCalendar** (carregado via CDN oficial: `https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js`)

### **Backend & API**
- **Node.js + Express.js**
- **Supabase** (Backend as a Service)
- **PostgreSQL**
- **Deno / Supabase Edge Functions**

### **Arquitetura JavaScript**
- **Finite State Machine (FSM)** (`js/fsm/`)
- **Composition Root** (`js/composition-root.js`)
- **Boot / Initialization Orchestration** (`js/core/`)
- **Effect / Execution infrastructure** (`js/core/`, `js/fsm/`)

### **Autenticação & Segurança**
- **Supabase Auth**
- **JWT / gerenciamento de sessão**
- **Controle de acesso baseado em papéis (roles)**
- **Fluxos de alteração e reset de senha**

### **Design & UX**
- **Interface responsiva**
- **Feedback visual**
- **Padrões de interação inspirados no Google Calendar**
- **Paleta de cores e tipografia personalizados** (`Poppins`, `Playfair Display`, e tons de dourado e marrom no tema geral)

---

## Estrutura Atual do Projeto

```text
agenda-beauty/
├── index.html                 # Dashboard principal
├── agenda.html                # Calendário de agendamentos
├── clientes.html              # Gestão de clientes
├── profissionais.html         # Gestão de profissionais
├── servicos.html              # Gestão de serviços
├── empresas.html              # Gestão de empresas / unidades
├── login.html                 # Tela de autenticação
├── change-password.html       # Tela de alteração de senha
├── css/
│   ├── style.css              # Estilos globais
│   ├── calendar-google-style.css # Tema visual estilo Google Calendar
│   └── fullcalendar.min.css   # Estilos do FullCalendar
├── js/
│   ├── composition-root.js    # Injeção e composição de dependências
│   ├── supabaseClient.js      # Inicialização do cliente Supabase
│   ├── pageManager.js         # Gerenciamento global de páginas
│   ├── menuManager.js         # Controle de menus e navegação
│   ├── sidebarManager.js      # Controle da barra lateral
│   ├── modalManager.js        # Controle de modais
│   ├── auth-authorization.js  # Controle de acesso e permissões
│   ├── auth-store.js          # Armazenamento de estado de autenticação
│   ├── bootstrap-auth.js      # Inicialização do módulo de auth
│   ├── logoutManager.js       # Gerenciamento de encerramento de sessão
│   ├── agendaPage.js          # Lógica da página de agenda
│   ├── clientesPage.js        # Lógica de clientes
│   ├── profissionaisPage.js   # Lógica de profissionais
│   ├── servicosPage.js        # Lógica de serviços
│   └── empresasPage.js        # Lógica de empresas
├── js/core/                   # Kernel, boot e orquestração de runtime
│   ├── boot-kernel.js
│   ├── BootSequencer.js
│   ├── boot-orchestrator.js
│   ├── execution-engine.js
│   └── runtime-health.js
├── js/fsm/                    # Máquinas de estado e efeitos de autenticação
│   ├── auth-fsm.js
│   ├── effect-runner.js
│   └── session-bus.js
├── js/services/               # Camada de serviços de negócio
│   ├── AgendamentoService.js
│   ├── ClienteService.js
│   ├── ProfissionalService.js
│   ├── ServicoService.js
│   ├── EmpresaService.js
│   └── BloqueioService.js
├── js/data/                   # Camada de dados e cache
│   └── core/
│       └── DataCore.js
├── backend/                   # Servidor Node.js Express auxiliar
│   └── server.js
├── supabase/
│   └── functions/             # Edge Functions em Deno / TypeScript
│       └── _shared/           # Código compartilhado (cors.ts)
├── docs/                      # Documentação histórica e checkpoints (v1.3, v1.4, v1.5)
├── deploy.sh / deploy.ps1     # Scripts de deploy automatizado
└── deno.json                  # Configuração Deno
```

---

## Funcionalidades Principais

### Agenda / Agendamentos
- **Calendário interativo** integrado via FullCalendar (CDN).
- **Operações de agendamento** (criação, edição e exclusão) via `AgendamentoService.js`.
- **Bloqueios de horário** (`BloqueioService.js`) integrados para gestão de folgas e indisponibilidades.
- **Filtros e visualização por profissional**, com suporte a cores personalizadas no calendário.

### Clientes
- **Cadastro e listagem** de clientes (`ClienteService.js`).
- **Consulta de histórico de agendamentos** vinculados ao cliente.

### Profissionais
- **Gestão de equipe e colaboradores** (`ProfissionalService.js`).
- **Configuração de horários de trabalho, especialidades e cores de calendário**.
- **Operações protegidas** de criação e remoção integradas com Edge Functions do Supabase.

### **Serviços**
- **Catálogo de serviços** (`ServicoService.js`) com definição de preços, durações e categorias.
- **Integração direta** com o módulo de agendamentos.

### Empresas (Multi-empresa)
- **Gestão de unidades e empresas** (`EmpresaService.js`).
- **Isolamento e associação de dados** por identificador de empresa (`empresa_id`).

### Autenticação & Segurança
- **Autenticação de usuários** via Supabase Auth.
- **Gerenciamento de sessões** com suporte a Finite State Machine (`auth-fsm.js`) e auto-healing de sessão.
- **Controle de acesso baseado em papéis** (`admin`, `adm_empresa`, `profissional`).
- **Fluxos oficiais de senha**: alteração de senha, primeiro acesso e reset via Edge Functions.

---

## Banco de Dados (Estrutura Real Supabase)

### **Tabelas Principais**

```sql
-- Empresas (Unidades)
CREATE TABLE empresas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Perfis de Usuário (Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  nome TEXT,
  role TEXT DEFAULT 'profissional', -- 'admin', 'adm_empresa', 'profissional'
  email TEXT,
  first_login_completed BOOLEAN DEFAULT false,
  telefone TEXT,
  empresa_id UUID REFERENCES empresas(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clientes
CREATE TABLE clientes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  observacoes TEXT,
  ficha_token TEXT UNIQUE,
  empresa_id UUID REFERENCES empresas(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Profissionais
CREATE TABLE profissionais (
  id SERIAL PRIMARY KEY,
  profile_id UUID UNIQUE REFERENCES profiles(id),
  empresa_id UUID REFERENCES empresas(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Serviços
CREATE TABLE servicos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  categoria TEXT,
  duracao_min INTEGER,
  ativo BOOLEAN DEFAULT true,
  descricao TEXT,
  valor NUMERIC,
  cor TEXT,
  empresa_id UUID REFERENCES empresas(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agendamentos
CREATE TABLE agendamentos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id),
  servico_id INTEGER REFERENCES servicos(id),
  profissional_id INTEGER REFERENCES profissionais(id),
  empresa_id UUID REFERENCES empresas(id),
  data_inicio TIMESTAMP WITHOUT TIME ZONE,
  data_fim TIMESTAMP WITHOUT TIME ZONE,
  status TEXT DEFAULT 'confirmado', -- 'agendado', 'confirmado', 'cancelado', 'concluido'
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bloqueios de Horário
CREATE TABLE bloqueios (
  id SERIAL PRIMARY KEY,
  profissional_id INTEGER REFERENCES profissionais(id),
  titulo TEXT NOT NULL,
  motivo TEXT,
  inicio TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  fim TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  tipo TEXT DEFAULT 'bloqueio', -- 'bloqueio', 'ferias', 'folga', 'pausa', 'manutencao'
  criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Anamnese de Clientes (Ficha externa por token)
CREATE TABLE anamnese_clientes (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER UNIQUE REFERENCES clientes(id),
  nome_completo TEXT NOT NULL,
  idade INTEGER,
  ocupacao TEXT,
  indicacao TEXT,
  endereco TEXT,
  cep TEXT,
  cpf TEXT,
  contato_whatsapp TEXT,
  menor_idade BOOLEAN DEFAULT false,
  responsavel TEXT,
  contato_responsavel TEXT,
  gestante BOOLEAN DEFAULT false,
  diabetes BOOLEAN DEFAULT false,
  roe_unhas BOOLEAN DEFAULT false,
  unha_encravada BOOLEAN DEFAULT false,
  alergia_esmalte BOOLEAN DEFAULT false,
  retira_cuticula BOOLEAN DEFAULT false,
  micose_fungo BOOLEAN DEFAULT false,
  usa_medicamento BOOLEAN DEFAULT false,
  medicamentos TEXT,
  atividade_fisica BOOLEAN DEFAULT false,
  piscina_praia BOOLEAN DEFAULT false,
  servico_escolhido TEXT,
  autorizacao_procedimento BOOLEAN DEFAULT false,
  criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
```

---

## Edge Functions (Supabase / Deno)

O repositório contém as seguintes funções serverless em `supabase/functions/`:
- `create-empresa` / `update-empresa` / `delete-empresa`: Gestão de unidades corporativas.
- `create-profissional` / `update-profissional` / `delete-profissional`: Gestão privilegiada de equipe.
- `reset-password` / `reset-password-empresa` / `reset-password-admin`: Fluxos de redefinição de senha.
- `first-login-change-password`: Controle de alteração de senha no primeiro acesso.

*Nota: O diretório `docs/` serve estritamente como registro histórico; o estado real do projeto é o refletido no código atual e documentado neste README.*
