import type { SupabaseServerClient } from "@/adapters/outbound/supabase/client";
import type { AuthPort } from "@/core/ports/outbound/auth-port";

export class SupabaseAuthAdapter implements AuthPort {
  constructor(private readonly client: SupabaseServerClient) {}

  async login(email: string, password: string) {
    console.log("[SupabaseAuthAdapter] Attempting login for:", email);

    const { client } = this;
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    console.log("[SupabaseAuthAdapter] Auth response:", {
      hasUser: !!data.user,
      hasSession: !!data.session,
      errorMessage: error?.message
    });

    if (error) {
      console.error("[SupabaseAuthAdapter] Auth error:", error);
      throw new Error(error.message);
    }

    if (!data.user?.id || !data.session?.expires_at) {
      console.error("[SupabaseAuthAdapter] Missing user or session data");
      throw new Error("Login failed: incomplete session data");
    }

    console.log("[SupabaseAuthAdapter] Login successful, userId:", data.user.id);
    return {
      userId: data.user.id,
      expiresAt: new Date(data.session.expires_at * 1000),
    };
  }

  async getSession() {
    const { client } = this;
    const { data } = await client.auth.getSession();

    if (!data.session || !data.session.expires_at) {
      return null;
    }

    return {
      userId: data.session.user.id,
      expiresAt: new Date(data.session.expires_at * 1000),
    };
  }

  async logout(): Promise<void> {
    const { client } = this;
    const { error } = await client.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }
}
