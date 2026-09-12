import type { Metadata } from "next";

import { LoginForm } from "./form";

export const metadata: Metadata = {
  title: "Login | ConnectSphere",
  description: "Sign in to your ConnectSphere staff account",
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Sign in with your staff credentials to continue
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
