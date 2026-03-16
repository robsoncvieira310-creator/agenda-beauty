// Updated saveProfessional for new architecture
async saveProfessional() {
    try {
        const nome = document.getElementById('nome').value.trim();
        const email = document.getElementById('email').value.trim();
        const senha_temporaria = document.getElementById('senha_temporaria').value.trim();
        const telefone = document.getElementById('telefone').value.trim();
        
        if (!nome || !email || !senha_temporaria || !telefone) {
            this.showAlert('Preencha todos os campos', 'error');
            return;
        }
        
        // Call new Edge Function V2
        const response = await fetch(`${window.supabase.supabaseUrl}/functions/v1/create-professional-v2`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.supabase.supabaseKey}`,
                'apikey': window.supabase.supabaseKey
            },
            body: JSON.stringify({ nome, email, senha_temporaria, telefone })
        });
        
        if (!response.ok) {
            const error = await response.json();
            this.showAlert(error.error || 'Erro ao criar profissional', 'error');
            return;
        }
        
        const result = await response.json();
        this.showAlert(result.message, 'success');
        this.clearForm();
        await this.loadProfissionais();
        this.hideModal('modalProfissional');
        
    } catch (error) {
        console.error('Erro:', error);
        this.showAlert('Erro ao salvar profissional', 'error');
    }
}

// Check first login and redirect if needed
async checkFirstLogin() {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) return false;
    
    const { data: profile } = await window.supabase
        .from('profiles')
        .select('first_login_completed')
        .eq('id', session.user.id)
        .single();
    
    if (profile && !profile.first_login_completed) {
        window.location.href = 'change-password.html';
        return true;
    }
    return false;
}
