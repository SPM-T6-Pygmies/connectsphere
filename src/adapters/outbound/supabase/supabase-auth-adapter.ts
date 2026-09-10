import { createSupabaseServerClient } from "@/adapters/outbound/supabase/client";

import type { AuthPort } from "@/core/ports/outbound/auth-port";

export class SupabaseAuthAdapter implements AuthPort {
  private getClient() {
    return createSupabaseServerClient();
  }

  async login(email: string, password: string) {
    const client = await this.getClient();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user?.id || !data.session?.expires_at) {
      throw new Error("Login failed: incomplete session data");
    }

    return {
      userId: data.user.id,
      expiresAt: new Date(data.session.expires_at * 1000),
    };
  }

  async getSession() {
    const client = await this.getClient();
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
    const client = await this.getClient();
    const { error } = await client.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }
}
