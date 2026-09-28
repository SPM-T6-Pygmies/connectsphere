import { ShieldAlertIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getSignedInStaffMember } from "@/composition/container";
import { hasNoStaffWorkspace, pageAreaOwner, type StaffWorkspace } from "@/core/domain/staff-member";

/**
 * SPM-16: what a signed-in user sees for any page under /staff they may not
 * open -- another role's area, a record that is not theirs, or an ID that does
 * not exist. It takes the page area and nothing else, so it cannot differ
 * between those cases and never confirms that a record exists (#91).
 *
 * Rendered by each area's `forbidden.tsx`, outside `StaffShell`: the shell
 * would refuse this same user again.
 *
 * SPM-192: login already refuses an account with no staff role at all, so
 * this only reaches that case if a session's roles changed after it signed
 * in. That's the `noStaffRole` branch below -- a fixed message and a way back
 * to the public site, since there is no page area or workspace to name.
 */
export async function AccessDenied({ area }: { area: StaffWorkspace }) {
  const member = await getSignedInStaffMember();
  const homeWorkspace = member?.homeWorkspace ?? null;
  const noStaffRole = hasNoStaffWorkspace(member?.workspaces ?? []);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <ShieldAlertIcon className="text-muted-foreground size-10" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        You don&rsquo;t have access to this page.
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Please contact your respective {noStaffRole ? "Event Organiser" : pageAreaOwner(area)}.
      </p>
      {noStaffRole ? (
        <Button asChild className="mt-6 w-full sm:w-auto sm:self-start">
          <Link href="/">Back to home</Link>
        </Button>
      ) : homeWorkspace ? (
        <Button asChild className="mt-6 w-full sm:w-auto sm:self-start">
          <Link href={`/staff/${homeWorkspace}`}>Go back to your workspace</Link>
        </Button>
      ) : null}
    </main>
  );
}
