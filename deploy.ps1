# Deploy Script - Edge Function create-profissional
# Para Windows PowerShell

Write-Host "🚀 DEPLOY EDGE FUNCTION - AGENDA BEAUTY" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

# Cores
$ErrorActionPreference = "Stop"

function Write-ColorOutput($Message, $Color) {
    Write-Host $Message -ForegroundColor $Color
}

# Verificar se npm está instalado
Write-ColorOutput "📦 Verificando npm..." "Blue"
try {
    $npmVersion = npm --version
    Write-ColorOutput "✅ npm encontrado: $npmVersion" "Green"
} catch {
    Write-ColorOutput "❌ npm não encontrado! Instale Node.js primeiro." "Red"
    Write-ColorOutput "📦 Baixe em: https://nodejs.org/" "Yellow"
    exit 1
}

# Verificar se Supabase CLI está instalado
Write-ColorOutput "🔍 Verificando Supabase CLI..." "Blue"
try {
    $supabaseVersion = supabase --version
    Write-ColorOutput "✅ Supabase CLI encontrado: $supabaseVersion" "Green"
} catch {
    Write-ColorOutput "❌ Supabase CLI não encontrado!" "Red"
    Write-ColorOutput "📦 Instalando Supabase CLI..." "Yellow"
    
    try {
        npm install -g supabase
        Write-ColorOutput "✅ Supabase CLI instalado com sucesso!" "Green"
    } catch {
        Write-ColorOutput "❌ Erro ao instalar Supabase CLI!" "Red"
        Write-ColorOutput "🔧 Tente manualmente: npm install -g supabase" "Yellow"
        exit 1
    }
}

# Verificar login
Write-ColorOutput "🔐 Verificando login no Supabase..." "Blue"
try {
    $loginStatus = supabase status 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Login verificado" "Green"
    } else {
        Write-ColorOutput "❌ Não está logado!" "Red"
        Write-ColorOutput "🔐 Fazendo login..." "Yellow"
        supabase login
        Write-ColorOutput "✅ Login concluído" "Green"
    }
} catch {
    Write-ColorOutput "❌ Erro ao verificar login!" "Red"
    Write-ColorOutput "🔐 Faça login manualmente: supabase login" "Yellow"
    exit 1
}

# Verificar link do projeto
Write-ColorOutput "🔗 Verificando link do projeto..." "Blue"
try {
    $projectStatus = supabase status 2>$null | Select-String "Project URL"
    if ($projectStatus -match "kckbcjjgbipcqzkynwpy") {
        Write-ColorOutput "✅ Projeto já está linkado" "Green"
    } else {
        Write-ColorOutput "❌ Projeto não está linkado!" "Red"
        Write-ColorOutput "🔗 Linkando ao projeto..." "Yellow"
        supabase link --project-ref kckbcjjgbipcqzkynwpy
        Write-ColorOutput "✅ Projeto linkado com sucesso" "Green"
    }
} catch {
    Write-ColorOutput "❌ Erro ao verificar link do projeto!" "Red"
    Write-ColorOutput "🔗 Link manualmente: supabase link --project-ref kckbcjjgbipcqzkynwpy" "Yellow"
    exit 1
}

# Deploy da Edge Function
Write-ColorOutput "📦 Fazendo deploy da Edge Function..." "Blue"
try {
    supabase functions deploy create-profissional
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✅ Edge Function deployada com sucesso!" "Green"
    } else {
        Write-ColorOutput "❌ Erro no deploy!" "Red"
        exit 1
    }
} catch {
    Write-ColorOutput "❌ Erro no deploy da Edge Function!" "Red"
    exit 1
}

# Perguntar sobre secrets
Write-ColorOutput "`n🔑 Deseja configurar as secrets? (S/N)" "Yellow"
$resposta = Read-Host

if ($resposta -match "^[Ss]$") {
    Write-ColorOutput "🔑 Configurando secrets..." "Blue"
    
    # Configurar SUPABASE_URL
    Write-ColorOutput "🌐 Configurando SUPABASE_URL..." "Blue"
    try {
        supabase secrets set SUPABASE_URL=https://kckbcjjgbipcqzkynwpy.supabase.co
        Write-ColorOutput "✅ SUPABASE_URL configurada" "Green"
    } catch {
        Write-ColorOutput "❌ Erro ao configurar SUPABASE_URL" "Red"
    }
    
    # Configurar SUPABASE_SERVICE_ROLE_KEY
    Write-ColorOutput "🔑 Digite sua SUPABASE_SERVICE_ROLE_KEY:" "Yellow"
    $serviceRoleKey = Read-Host -AsSecureString
    $serviceRoleKeyPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($serviceRoleKey))
    
    try {
        supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$serviceRoleKeyPlain"
        Write-ColorOutput "✅ SUPABASE_SERVICE_ROLE_KEY configurada" "Green"
    } catch {
        Write-ColorOutput "❌ Erro ao configurar SUPABASE_SERVICE_ROLE_KEY" "Red"
    }
}

# Testar a função
Write-ColorOutput "`n🧪 Testando a Edge Function..." "Blue"
try {
    $response = Invoke-WebRequest -Uri "https://kckbcjjgbipcqzkynwpy.supabase.co/functions/v1/create-profissional" -UseBasicParsing
    if ($response.StatusCode -eq 405) {
        Write-ColorOutput "✅ Edge Function está ativa! (HTTP 405 - Method not allowed é esperado)" "Green"
    } else {
        Write-ColorOutput "⚠️  Resposta inesperada: HTTP $($response.StatusCode)" "Yellow"
    }
} catch {
    Write-ColorOutput "⚠️  Não foi possível testar a função diretamente" "Yellow"
}

# Instructions finais
Write-ColorOutput "`n🎯 PRÓXIMOS PASSOS:" "Blue"
Write-ColorOutput "1. Abra: http://localhost:8000/profissionais.html" "White"
Write-ColorOutput "2. Faça login como admin" "White"
Write-ColorOutput "3. Tente criar um profissional com EMAIL NOVO" "White"
Write-ColorOutput "4. Ex: profissional1@teste.com" "White"

Write-ColorOutput "`n📊 Para ver logs: supabase functions logs create-profissional --follow" "Blue"

Write-ColorOutput "`n🎉 DEPLOY CONCLUÍDO!" "Green"
