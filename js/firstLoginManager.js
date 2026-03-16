// First Login Manager - Gerencia o primeiro acesso de profissionais
class FirstLoginManager {
    constructor() {
        this.supabase = window.supabase;
    }

    /**
     * Marca o primeiro login como completado
     * @returns {Promise<boolean>} - true se sucesso, false se erro
     */
    async markFirstLoginCompleted() {
        try {
            console.log('🔐 Marcando primeiro login como completado...');
            
            // Chamar função SQL para marcar primeiro login
            const { data, error } = await this.supabase
                .rpc('mark_first_login');

            if (error) {
                console.error('❌ Erro ao marcar primeiro login:', error);
                return false;
            }

            if (data) {
                console.log('✅ Primeiro login marcado com sucesso');
                return true;
            } else {
                console.warn('⚠️ Primeiro login não foi marcado');
                return false;
            }
        } catch (error) {
            console.error('❌ Erro no markFirstLoginCompleted:', error);
            return false;
        }
    }

    /**
     * Verifica se é o primeiro login do usuário
     * @returns {Promise<boolean>} - true se for primeiro login
     */
    async isFirstLogin() {
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            
            if (!user) {
                return false;
            }

            // Buscar profile do usuário
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('first_login_completed')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('❌ Erro ao verificar primeiro login:', error);
                return false;
            }

            return !profile.first_login_completed;
        } catch (error) {
            console.error('❌ Erro no isFirstLogin:', error);
            return false;
        }
    }

    /**
     * Processa o primeiro login após autenticação bem-sucedida
     * @returns {Promise<boolean>} - true se processado com sucesso
     */
    async processFirstLogin() {
        try {
            const isFirstLogin = await this.isFirstLogin();
            
            if (isFirstLogin) {
                console.log('🎉 Detectado primeiro acesso do profissional');
                
                // Marcar primeiro login como completado
                const marked = await this.markFirstLoginCompleted();
                
                if (marked) {
                    // Mostrar mensagem de boas-vindas
                    this.showWelcomeMessage();
                    return true;
                } else {
                    console.error('❌ Falha ao marcar primeiro login');
                    return false;
                }
            } else {
                console.log('👤 Usuário já realizou primeiro acesso anteriormente');
                return true;
            }
        } catch (error) {
            console.error('❌ Erro ao processar primeiro login:', error);
            return false;
        }
    }

    /**
     * Exibe mensagem de boas-vindas para primeiro acesso
     */
    showWelcomeMessage() {
        // Criar modal de boas-vindas
        const modalHtml = `
            <div id="welcomeModal" class="modal" style="display: block;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>🎉 Bem-vindo ao Agenda Beauty!</h2>
                    </div>
                    <div class="modal-body">
                        <p>Olá! Seja bem-vindo(a) ao sistema de agendamento.</p>
                        <p>Sua conta foi configurada com sucesso e você já pode começar a usar todas as funcionalidades.</p>
                        <ul>
                            <li>📅 Visualize e gerencie sua agenda</li>
                            <li>👥 Cadastre e atenda seus clientes</li>
                            <li>💅 Ofereça seus serviços com profissionalismo</li>
                        </ul>
                        <p>Estamos felizes em ter você conosco!</p>
                    </div>
                    <div class="modal-footer">
                        <button onclick="window.firstLoginManager.closeWelcomeModal()" class="btn btn-primary">
                            Começar a usar
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Adicionar modal ao body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    /**
     * Fecha o modal de boas-vindas
     */
    closeWelcomeModal() {
        const modal = document.getElementById('welcomeModal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Inicializa o gerenciador de primeiro login
     */
    async init() {
        // Verificar se usuário está logado
        const { data: { user } } = await this.supabase.auth.getUser();
        
        if (user) {
            // Processar primeiro login
            await this.processFirstLogin();
        }
    }
}

// Criar instância global
window.firstLoginManager = new FirstLoginManager();

// Auto-inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.firstLoginManager.init();
});
