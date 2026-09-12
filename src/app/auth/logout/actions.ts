"use server";

import { redirect } from "next/navigation";

import { buildLogout } from "@/composition/container";

export async function logoutAction(): Promise<void> {
  const logout = await buildLogout();
  await logout.execute();
  redirect("/auth/login");
}
