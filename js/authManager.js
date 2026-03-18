class AuthManager {
    constructor(supabase) {
        this.supabase = supabase;
    }

    async getSession() {
        return await this.supabase.auth.getSession();
    }

    async getUser() {
        const { data: { user } } = await this.supabase.auth.getUser();
        return user;
    }

    async getProfile() {
        const { data: { user } } = await this.supabase.auth.getUser();

        if (!user) return null;

        const { data, error } = await this.supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error("Erro ao buscar profile:", error);
            return null;
        }

        return data;
    }
}

// instância global
window.authManager = new AuthManager(window.supabaseClient);
