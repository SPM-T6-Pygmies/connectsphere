import { createSupabaseAdminClient } from "@/adapters/outbound/supabase/client";

import type { AuthPort } from "@/core/ports/outbound/auth-port";

export class SupabaseAuthAdapter implements AuthPort {
  private client = createSupabaseAdminClient();

  async login(email: string, password: string) {
    console.log("[SupabaseAuthAdapter] Attempting login for:", email);

    const { data, error } = await this.client.auth.signInWithPassword({
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
    const { data } = await this.client.auth.getSession();

    if (!data.session || !data.session.expires_at) {
      return null;
    }

    return {
      userId: data.session.user.id,
      expiresAt: new Date(data.session.expires_at * 1000),
    };
  }

  async logout(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }
}
