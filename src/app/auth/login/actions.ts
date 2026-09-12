"use server";

import { redirect } from "next/navigation";

import { buildLogin } from "@/composition/container";
import { createClient } from "@/lib/supabase/server";
import { InvalidCredentialsError } from "@/core/domain/errors";

export interface LoginState {
  status: "idle" | "error" | "success";
  message?: string;
}

/**
 * Maps staff role to their role-specific page path.
 */
function roleToPagePath(role: string): string {
  const roleMap: Record<string, string> = {
    "Event Organiser": "requester",
    "Event Coordinator": "coordinator",
    "Event Operations Manager": "ops",
    "Venue Staff": "venue",
    "Technical Support Staff": "technical",
  };
  return `/staff/${roleMap[role]}`;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return {
      status: "error",
      message: "Invalid credentials",
    };
  }

  try {
    const login = await buildLogin();
    const result = await login.execute({ email, password });

    // Store roles in user metadata for reuse in getSession() (no DB query needed)
    const supabase = await createClient();
    await supabase.auth.updateUser({
      data: { roles: result.roles }
    });

    const primaryRole = result.roles[0];
    const pagePath = roleToPagePath(primaryRole);
    redirect(pagePath);
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
