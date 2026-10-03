"use server";

import { redirect } from "next/navigation";

import { loginSchema } from "@/adapters/inbound/login-schema";
import { buildLogin } from "@/composition/container";
import { createClient } from "@/lib/supabase/server";
import { InvalidCredentialsError, NoStaffRoleError } from "@/core/domain/errors";

export interface LoginState {
  status: "idle" | "error" | "success";
  message?: string;
  /** Set for a NoStaffRoleError, so the form can point an Attendee at /events. */
  showEventsLink?: boolean;
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

    redirect(`/staff/${result.landingWorkspace}`);
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return {
        status: "error",
        message: "Invalid credentials",
      };
    }

    if (error instanceof NoStaffRoleError) {
      return {
        status: "error",
        message: "Authorised users only.",
        showEventsLink: true,
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
