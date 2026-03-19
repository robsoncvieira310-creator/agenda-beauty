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

    async login(email, password) {
        try {
            const result = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            
            return {
                success: !result.error,
                data: result.data,
                error: result.error
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async logout() {
        try {
            const { error } = await this.supabase.auth.signOut();
            
            return {
                success: !error,
                error: error
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
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

window.authManager = new AuthManager(window.supabaseClient);
