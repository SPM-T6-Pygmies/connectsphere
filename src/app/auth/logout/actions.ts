"use server";

import { redirect } from "next/navigation";

import { buildLogout } from "@/composition/container";
import { SupabaseAuthAdapter } from "@/adapters/outbound/supabase/supabase-auth-adapter";
import { SupabaseUserRepository } from "@/adapters/outbound/supabase/supabase-user-repository";

export async function logoutAction(): Promise<void> {
  const auth = new SupabaseAuthAdapter();
  const session = await auth.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const userRepo = new SupabaseUserRepository();
  const user = await userRepo.findByAuthUserId(session.userId);

  const logout = await buildLogout();
  await logout.execute({ userId: user?.userId ?? session.userId });
  redirect("/auth/login");
}
