// MÉTODO ATUALIZADO PARA NOVA ARQUITETURA
async saveProfessional() {
    try {
        console.log('saveProfessional chamado');
        
        // Coletar dados do formulário
        const nome = document.getElementById('nome').value.trim();
        const email = document.getElementById('email').value.trim();
        const senha_temporaria = document.getElementById('senha_temporaria').value.trim();
        const telefone = document.getElementById('telefone').value.trim();
        
        // Validações
        if (!nome || !email || !senha_temporaria || !telefone) {
            this.showAlert('Preencha todos os campos obrigatórios', 'error');
            return;
        }
        
        // Validação de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showAlert('Email inválido', 'error');
            return;
        }
        
        // Validação de senha
        if (senha_temporaria.length < 6) {
            this.showAlert('A senha deve ter pelo menos 6 caracteres', 'error');
            return;
        }
        
        const dados = {
            nome,
            email,
            senha_temporaria,
            telefone
        };
        
        console.log('Salvando profissional:', dados);
        
        // Usar nova Edge Function V2
        const response = await fetch(`${window.supabase.supabaseUrl}/functions/v1/create-professional-v2`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.supabase.supabaseKey}`,
                'apikey': window.supabase.supabaseKey
            },
            body: JSON.stringify(dados)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Erro na Edge Function:', errorData);
            this.showAlert(errorData.error || 'Erro ao criar profissional', 'error');
            return;
        }
        
        const result = await response.json();
        console.log('Profissional criado:', result);
        
        this.showAlert(result.message || 'Profissional criado com sucesso!', 'success');
        
        // Limpar formulário
        this.clearForm();
        
        // Recarregar lista
        await this.loadProfissionais();
        
        // Fechar modal
        this.hideModal('modalProfissional');
        
    } catch (error) {
        console.error('Erro no saveProfessional():', error);
        this.showAlert('Erro ao salvar profissional', 'error');
    }
}

// MÉTODO PARA VERIFICAR PRIMEIRO LOGIN
async checkFirstLogin() {
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        
        if (!session) {
            return false;
        }
        
        // Verificar se precisa trocar senha
        const { data: profile } = await window.supabase
            .from('profiles')
            .select('first_login_completed')
            .eq('id', session.user.id)
            .single();
        
        return profile && !profile.first_login_completed;
        
    } catch (error) {
        console.error('Erro ao verificar primeiro login:', error);
        return false;
    }
}

// MÉTODO PARA REDIRECIONAR SE NECESSÁRIO
async redirectIfFirstLogin() {
    const needsPasswordChange = await this.checkFirstLogin();
    
    if (needsPasswordChange) {
        console.log('🔄 Redirecionando para troca de senha...');
        window.location.href = 'change-password.html';
        return true;
    }
    
    return false;
}
