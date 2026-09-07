import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        We couldn&rsquo;t find that registration
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Check the link you were given &mdash; it needs to be complete to work.
      </p>
      <Button asChild className="mt-6">
        <Link href="/events">Browse events</Link>
      </Button>
    </main>
  );
}
