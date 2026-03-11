# 🚀 Guia de Deploy - Agenda Beauty

## 📋 **Visão Geral**

Este guia cobre o processo completo de deploy do Agenda Beauty em diferentes plataformas, desde configuração inicial até monitoramento em produção.

## 🎯 **Plataformas Suportadas**

### **1. Netlify (Recomendado)**
- ✅ Deploy automático com Git
- ✅ HTTPS gratuito
- ✅ CDN global
- ✅ Functions serverless
- ✅ Preview deployments

### **2. Vercel**
- ✅ Integração com GitHub
- ✅ Edge functions
- ✅ Analytics integrado
- ✅ Deploy automático

### **3. GitHub Pages**
- ✅ Gratuito
- ✅ Integração nativa
- ✅ Jekyll support
- ❌ Sem serverless

### **4. Firebase Hosting**
- ✅ CDN global
- ✅ Configuração avançada
- ✅ Functions support
- ✅ A/B testing

## 🔧 **Pré-requisitos**

### **1. Configuração do Supabase**
```bash
# 1. Crie projeto no Supabase
# 2. Configure as tabelas
# 3. Ative Auth
# 4. Copie as credenciais
```

### **2. Variáveis de Ambiente**
```javascript
// js/supabaseClient.js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### **3. Build Optimization**
```bash
# Minificar CSS/JS
# Otimizar imagens
# Configurar cache headers
```

## 🌐 **Deploy no Netlify**

### **1. Preparação**
```bash
# 1. Fork do repositório
git clone https://github.com/your-username/agenda-beauty.git
cd agenda-beauty

# 2. Configurar remote
git remote add origin https://github.com/your-username/agenda-beauty.git
git push -u origin main
```

### **2. Configuração Netlify**
1. Acesse [netlify.com](https://netlify.com)
2. **"New site from Git"**
3. Conecte seu repositório GitHub
4. Configure as build settings:

```yaml
# netlify.toml
[build]
  publish = "."
  command = ""

[build.environment]
  NODE_VERSION = "16"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[headers]]
  for = "*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "*.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"

[[redirects]]
  from = "/admin"
  to = "/index.html"
  status = 302

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 404
```

### **3. Deploy Automático**
```bash
# Push para deploy automático
git add .
git commit -m "Deploy: Production ready"
git push origin main
```

## 🚀 **Deploy no Vercel**

### **1. Configuração**
1. Acesse [vercel.com](https://vercel.com)
2. **"New Project"**
3. Importe do GitHub
4. Configure as variáveis de ambiente:

```bash
# Environment Variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### **2. vercel.json**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "**/*",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/$1",
      "headers": {
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    }
  ]
}
```

## 📄 **Deploy no GitHub Pages**

### **1. Configuração do Repository**
```bash
# 1. Crie repository
# 2. Configure GitHub Pages
# Settings > Pages > Source: Deploy from branch
```

### **2. GitHub Actions**
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '16'
        
    - name: Build
      run: |
        npm install
        npm run build
        
    - name: Deploy
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: .
```

### **3. Configuração Base URL**
```html
<!-- index.html -->
<base href="/agenda-beauty/">
```

## 🔥 **Deploy no Firebase Hosting**

### **1. Instalação Firebase CLI**
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
```

### **2. firebase.json**
```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000"
          }
        ]
      }
    ]
  }
}
```

### **3. Deploy**
```bash
firebase deploy --only hosting
```

## 🔧 **Configuração de Domínio**

### **1. Configuração DNS**
```bash
# Netlify
# DNS > Custom domains > agenda-beauty.com

# Vercel
# Settings > Domains > agenda-beauty.com

# GitHub Pages
# Settings > Pages > Custom domain
```

### **2. SSL Certificate**
```bash
# Automático na maioria das plataformas
# Netlify/Vercel: SSL automático
# GitHub Pages: SSL automático
# Firebase: SSL automático
```

## 📊 **Monitoramento**

### **1. Google Analytics**
```html
<!-- index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### **2. Sentry (Error Tracking)**
```html
<script src="https://browser.sentry-cdn.com/6.19.7/bundle.min.js"></script>
<script>
  Sentry.init({
    dsn: 'YOUR_SENTRY_DSN',
    environment: 'production'
  });
</script>
```

### **3. Performance Monitoring**
```html
<!-- Core Web Vitals -->
<script>
  // Measure performance
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log(entry.name, entry.startTime, entry.duration);
    }
  });
  observer.observe({entryTypes: ['navigation', 'resource', 'paint']});
</script>
```

## 🔒 **Segurança em Produção**

### **1. HTTPS**
```bash
# Automático em todas as plataformas
# Forçar HTTP -> HTTPS
```

### **2. Content Security Policy**
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.supabase.co; 
               style-src 'self' 'unsafe-inline'; 
               connect-src 'self' https://*.supabase.co; 
               img-src 'self' data:;">
```

### **3. Rate Limiting**
```bash
# Configurar no Supabase Dashboard
# Settings > API > Rate limiting
```

## 🚀 **CI/CD Pipeline**

### **GitHub Actions Completo**
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '16'
    - name: Install dependencies
      run: npm install
    - name: Run tests
      run: npm test
      
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Build
      run: |
        npm install
        npm run build
        
  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Deploy to Staging
      run: |
        # Deploy para Vercel preview
        vercel --token ${{ secrets.VERCEL_TOKEN }}
        
  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Deploy to Production
      run: |
        # Deploy para Netlify
        netlify deploy --prod --dir=. --auth ${{ secrets.NETLIFY_AUTH_TOKEN }}
```

## 📈 **Performance Optimization**

### **1. Minificação**
```bash
# CSS
npx clean-css-cli -o style.min.css style.css

# JavaScript
npx terser app.js -o app.min.js

# HTML
npx html-minifier --collapse-whitespace --remove-comments --minify-css --minify-js index.html -o index.min.html
```

### **2. Image Optimization**
```bash
# Compress images
npx imagemin images/* --out-dir=images/optimized

# WebP conversion
npx imagemin images/* --out-dir=images/webp --plugin=webp
```

### **3. Bundle Analysis**
```bash
# Analyze bundle size
npx webpack-bundle-analyzer dist/main.js
```

## 🔧 **Troubleshooting**

### **Problemas Comuns**

#### **1. CORS Issues**
```javascript
// Supabase Dashboard
// Settings > API > CORS
// Adicionar seu domínio
```

#### **2. Cache Issues**
```bash
# Limpar cache
curl -X PURGE "https://your-site.com/*"

# Bypass cache
?version=20231201
```

#### **3. Build Failures**
```bash
# Verificar dependências
npm audit fix

# Limpar node_modules
rm -rf node_modules package-lock.json
npm install
```

### **Debug em Produção**
```javascript
// Adicionar logging
console.log('Debug info:', {
  url: window.location.href,
  userAgent: navigator.userAgent,
  timestamp: new Date().toISOString()
});

// Error boundaries
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
});
```

## 📋 **Checklist de Deploy**

### **Pré-Deploy**
- [ ] Testes passando
- [ ] Variáveis de ambiente configuradas
- [ ] Assets otimizados
- [ ] Cache headers configurados
- [ ] HTTPS configurado
- [ ] Backup dos dados

### **Pós-Deploy**
- [ ] Funcionalidades testadas
- [ ] Performance verificada
- [ ] Monitoramento configurado
- [ ] Logs verificados
- [ ] Backup automatizado
- [ ] Documentação atualizada

---

**🚀 Agora seu Agenda Beauty está pronto para produção!**

*Para suporte adicional, consulte a documentação completa ou abra um issue no GitHub.*
