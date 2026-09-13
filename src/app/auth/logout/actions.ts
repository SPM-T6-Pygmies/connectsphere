"use server";

import { redirect } from "next/navigation";

import { buildLogout, getCurrentOrganiser } from "@/composition/container";
import { createClient } from "@/lib/supabase/server";

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/auth/login");
  }

  const organiser = await getCurrentOrganiser();
  const userId = organiser?.userAccountId ?? authData.user.id;

  const logout = await buildLogout();
  await logout.execute({ userId });
  redirect("/auth/login");
}
