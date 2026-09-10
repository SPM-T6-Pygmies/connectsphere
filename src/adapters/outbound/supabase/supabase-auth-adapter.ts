import { createBrowserClient } from "@supabase/ssr";
import type { AuthPort, LoginResult } from "@/src/core/ports/outbound/auth-port";
import type { SessionData } from "@/src/core/ports/outbound/auth-port";

export class SupabaseAuthAdapter implements AuthPort {
  private client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  async login(email: string, password: string): Promise<LoginResult> {
    const { data, error } = await this.client.auth.signInWithPassword({
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

  async getSession(): Promise<SessionData | null> {
    const { data } = await this.client.auth.getSession();

    if (!data.session) {
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
