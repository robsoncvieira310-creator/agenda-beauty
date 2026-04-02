
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
- **JavaScript ES6+** - Lógica de negócio e interatividade
- **FullCalendar** - Calendário interativo e profissional

### **Backend & Database**
- **Supabase** - Backend como serviço (BaaS)
- **PostgreSQL** - Banco de dados relacional robusto
- **Autenticação JWT** - Segurança na gestão de sessões

### **Design & UX**
- **Design System** consistente e profissional
- **Interface responsiva** para todos os dispositivos
- **Feedback visual** com indicadores de carregamento
- **Acessibilidade** com navegação por teclado

## 📁 **Estrutura do Projeto**

```
agenda-beauty/
│
├── index.html              # Dashboard principal
├── agenda.html             # Calendário de agendamentos
├── clientes.html           # Gestão de clientes
├── profissionais.html      # Gestão de profissionais
├── servicos.html           # Gestão de serviços
├── login.html              # Autenticação
│
├── css/
│   └── style.css           # Estilos globais e componentes
│
├── js/
│   ├── supabaseClient.js   # Cliente Supabase
│   ├── authManager.js      # Gestão de autenticação
│   ├── dataManager.js      # Gestão de dados e cache
│   ├── calendarManager.js  # Gestão do calendário
│   ├── modalManager.js     # Gestão de modais
│   ├── pageManager.js      # Gestão de páginas base
│   ├── agendaPage.js       # Lógica da agenda
│   ├── clientesPage.js     # Lógica de clientes
│   ├── profissionaisPage.js # Lógica de profissionais
│   ├── servicosPage.js     # Lógica de serviços
│   ├── enhancements.js     # Melhorias e utilitários
│   ├── utils.js            # Funções utilitárias
│   └── appInit.js          # Inicialização da aplicação
│
├── libs/
│   └── fullcalendar.min.js # Biblioteca FullCalendar
│
├── assets/
│   ├── images/             # Imagens e ícones
│   └── icons/              # Ícones personalizados
│
├── docs/                   # Documentação do projeto
├── .gitignore              # Arquivos ignorados pelo Git
└── README.md               # Este arquivo
```

## 🎯 **Funcionalidades Principais**

### **📅 Agenda**
- **Calendário visual** com vista mensal, semanal e diária
- **Arrastar e soltar** para reagendar
- **Bloqueios de horário** para folgas e manutenção
- **Filtros dinâmicos** por profissional, serviço e cliente
- **Conflito detection** para evitar duplos agendamentos

### **👥 Clientes**
- **Cadastro completo** com informações detalhadas
- **Histórico de agendamentos** integrado
- **Busca inteligente** com filtros avançados
- **Importação/exportação** de dados

### **👩 Profissionais**
- **Gestão de equipe** com especializações
- **Disponibilidade** e horários de trabalho
- **Estatísticas individuais** de performance
- **Escalas e turnos** flexíveis

### **💇 Serviços**
- **Catálogo completo** com preços e durações
- **Categorias** e especializações
- **Promoções** e pacotes de serviços
- **Gestão de estoque** de produtos

### **🔐 Autenticação**
- **Login seguro** com validação
- **Papéis e permissões** (Admin, Profissional)
- **Sessões persistentes** com refresh automático
- **Recuperação de senha** (em implementação)

## 🛠️ **Instalação e Configuração**

### **Pré-requisitos**
- Node.js 16+ (opcional, para desenvolvimento)
- Conta Supabase (gratuita)
- Editor de código (VS Code recomendado)

### **Configuração do Supabase**
1. Crie um projeto em [supabase.com](https://supabase.com)
2. Copie as chaves de API
3. Configure as tabelas no SQL Editor
4. Ative a autenticação

### **Configuração Local**
1. Clone este repositório:
```bash
git clone https://github.com/seu-usuario/agenda-beauty.git
cd agenda-beauty
```

2. Configure as variáveis de ambiente:
```javascript
// Em js/supabaseClient.js
const SUPABASE_URL = 'sua-url-supabase';
const SUPABASE_ANON_KEY = 'sua-chave-anonima';
```

3. Sirva os arquivos estáticos:
```bash
# Usando Python
python -m http.server 8000

# Ou usando Node.js
npx serve .

# Ou usando Live Server no VS Code
```

4. Acesse `http://localhost:8000`

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
  status BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Serviços
CREATE TABLE servicos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  preco DECIMAL(10,2),
  duracao INTEGER, -- em minutos
  categoria VARCHAR(100),
  status BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agendamentos
CREATE TABLE agendamentos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id),
  servico_id INTEGER REFERENCES servicos(id),
  profissional_id INTEGER REFERENCES profissionais(id),
  data_inicio TIMESTAMP NOT NULL,
  data_fim TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'agendado',
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Perfis de Usuário (Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  nome VARCHAR(255),
  role VARCHAR(50) DEFAULT 'profissional',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
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

## 🔄 **Fluxo de Trabalho**

### **Fluxo de Agendamento**
1. **Login** do usuário
2. **Dashboard** com estatísticas
3. **Agenda** → Selecionar data/horário
4. **Modal** → Preencher dados
5. **Confirmação** → Salvar no banco
6. **Notificação** → Feedback ao usuário

### **Fluxo de Gestão**
1. **Navegação** pelo menu lateral
2. **Listagem** com busca e filtros
3. **CRUD** completo (Criar, Ler, Atualizar, Excluir)
4. **Validação** de dados
5. **Atualização** automática da interface

## 🚀 **Deploy**

### **Produção**
1. **GitHub Pages** (estático)
2. **Netlify** (estático com CI/CD)
3. **Vercel** (estático com serverless)
4. **Firebase Hosting** (estático)

### **Configuração de Deploy**
```bash
# Build para produção
npm run build

# Deploy para Netlify
netlify deploy --prod --dir=.

# Deploy para Vercel
vercel --prod
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
