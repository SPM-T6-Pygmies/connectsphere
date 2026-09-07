import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">This event isn&rsquo;t open</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        It may not exist, or registration for it has not opened or has already closed.
      </p>
      <Button asChild className="mt-6">
        <Link href="/events">Browse events</Link>
      </Button>
    </main>
  );
}
