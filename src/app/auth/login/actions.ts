"use server";

import { redirect } from "next/navigation";

import { loginSchema } from "@/adapters/inbound/login-schema";
import { buildLogin } from "@/composition/container";
import { createClient } from "@/lib/supabase/server";
import { InvalidCredentialsError } from "@/core/domain/errors";

export interface LoginState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Invalid credentials",
    };
  }

  try {
    const login = await buildLogin();
    const result = await login.execute(parsed.data);

    // Store roles in user metadata for reuse in getSession() (no DB query needed)
    const supabase = await createClient();
    await supabase.auth.updateUser({
      data: { roles: result.roles }
    });

    // With no staff role to land in there is no workspace page, so this ends
    // on a not-found, as it did before the landing moved into the domain.
    redirect(result.landingWorkspace === null ? "/staff" : `/staff/${result.landingWorkspace}`);
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return {
        status: "error",
        message: "Invalid credentials",
      };
    }

    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }

    console.error("Login error:", error);
    return {
      status: "error",
      message: "Invalid credentials",
    };
  }
}
