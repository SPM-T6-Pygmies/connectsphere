import {
  ArrowRightIcon,
  CalendarCheckIcon,
  ClipboardListIcon,
  InboxIcon,
  MapPinIcon,
  ProjectorIcon,
  UsersIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ACTING_AS, ROLE_LABELS, type StaffRole } from "@/lib/wireframe";

export const metadata = {
  title: "Event workflow wireframes | ConnectSphere",
  description:
    "Walk an event request from submission through planning to public registration.",
};

const ROLE_CARDS: ReadonlyArray<{
  role: StaffRole;
  step: string;
  icon: LucideIcon;
  does: string;
}> = [
  {
    role: "requester",
    step: "Steps 1-2",
    icon: ClipboardListIcon,
    does: "Drafts an event request and submits it. Sees only their own drafts and submissions.",
  },
  {
    role: "ops",
    step: "Step 3",
    icon: InboxIcon,
    does: "Sees every submitted request and assigns an Event Coordinator to each one.",
  },
  {
    role: "coordinator",
    step: "Steps 4-11",
    icon: CalendarCheckIcon,
    does: "Reviews and approves, raises the venue booking, records equipment, tracks readiness, confirms the event, then opens registration.",
  },
  {
    role: "venue",
    step: "Step 7",
    icon: MapPinIcon,
    does: "Approves or rejects booking requests, with enough event detail to decide.",
  },
  {
    role: "technical",
    step: "Step 8",
    icon: ProjectorIcon,
    does: "Reviews equipment lines and reserves what is available, line by line.",
  },
];

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <Badge variant="outline">Wireframes</Badge>
      <h1 className="font-heading mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        Event workflow, one desk at a time
      </h1>
      <p className="text-muted-foreground mt-2 max-w-2xl leading-relaxed">
        The path an event takes from a client&apos;s request to a published
        registration page, laid out as the screens each role actually works in.
        Layout and flow only &mdash; the data is seeded and the buttons
        don&apos;t write anything yet.
      </p>

      <p className="text-muted-foreground mt-6 rounded-lg border border-dashed px-4 py-3 text-sm">
        <span className="text-foreground font-medium">The gate to watch:</span>{" "}
        approval is not confirmation. Approving says the request holds enough
        information to plan against; confirming says the arrangements are
        actually in place. Registration only opens after confirmation.
      </p>

      <ol className="mt-10 space-y-3">
        {ROLE_CARDS.map(({ role, step, icon: Icon, does }, index) => (
          <li key={role}>
            <Link
              href={`/staff/${role}`}
              className="group hover:bg-muted/50 flex items-start gap-4 rounded-xl border p-4 transition-colors"
            >
              <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-muted-foreground font-mono text-xs">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="font-medium">{ROLE_LABELS[role]}</span>
                  <Badge variant="secondary">{step}</Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {does}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Acting as {ACTING_AS[role].name}
                </p>
              </div>
              <ArrowRightIcon className="text-muted-foreground mt-2 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-8 border-t pt-6">
        <Link
          href="/events"
          className="hover:bg-muted/50 flex items-start gap-4 rounded-xl border p-4 transition-colors"
        >
          <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <UsersIcon className="size-4" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium">Attendee</span>
              <Badge variant="secondary">Step 11</Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              The public registration pages, already built. Where a confirmed
              event with registration enabled ends up.
            </p>
          </div>
        </Link>
      </div>
    </main>
  );
}
