"use server";

import { redirect } from "next/navigation";

import { buildLogin } from "@/composition/container";
import { InvalidCredentialsError } from "@/core/domain/errors";

export interface LoginState {
  status: "idle" | "error" | "success";
  message?: string;
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
    await login.execute({ email, password });

    redirect("/staff");
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
