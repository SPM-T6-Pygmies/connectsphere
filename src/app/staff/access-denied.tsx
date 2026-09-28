import { ShieldAlertIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getSignedInStaffMember } from "@/composition/container";
import { pageAreaOwner, type StaffWorkspace } from "@/core/domain/staff-member";

/**
 * SPM-16: what a signed-in user sees for any page under /staff they may not
 * open -- another role's area, a record that is not theirs, or an ID that does
 * not exist. It takes the page area and nothing else, so it cannot differ
 * between those cases and never confirms that a record exists (#91).
 *
 * Rendered by each area's `forbidden.tsx`, outside `StaffShell`: the shell
 * would refuse this same user again.
 */
export async function AccessDenied({ area }: { area: StaffWorkspace }) {
  const member = await getSignedInStaffMember();
  const homeWorkspace = member?.homeWorkspace ?? null;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <ShieldAlertIcon className="text-muted-foreground size-10" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        You don&rsquo;t have access to this page.
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Please contact your respective {pageAreaOwner(area)}.
      </p>
      {homeWorkspace ? (
        <Button asChild className="mt-6 w-full sm:w-auto sm:self-start">
          <Link href={`/staff/${homeWorkspace}`}>Go back to your workspace</Link>
        </Button>
      ) : null}
    </main>
  );
}
