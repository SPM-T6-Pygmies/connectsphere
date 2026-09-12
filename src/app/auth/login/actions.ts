"use server";

import { redirect } from "next/navigation";

import { buildLogin } from "@/composition/container";
import { InvalidCredentialsError } from "@/core/domain/errors";

export interface LoginState {
  status: "idle" | "error" | "success";
  message?: string;
}

/**
 * Maps staff role to their role-specific landing view path.
 */
function roleToLandingViewPath(role: string): string {
  const roleMap: Record<string, string> = {
    "Event Organiser": "organiser",
    "Event Coordinator": "coordinator",
    "Event Operations Manager": "ops",
    "Venue Staff": "venue",
    "Technical Support Staff": "technical",
  };
  return `/staff/${roleMap[role] || "organiser"}/landing-view`;
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

    const primaryRole = result.roles[0];
    const landingViewPath = roleToLandingViewPath(primaryRole);
    redirect(landingViewPath);
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
