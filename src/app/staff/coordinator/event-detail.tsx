import { LockIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  blockingArrangements,
  eventById,
  registrationUnlocked,
} from "@/lib/wireframe";

import { detailCrumbs, type DetailOrigin } from "../detail-origin";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";
import {
  OverviewTab,
  ReadinessTab,
  RegistrationTab,
  TechnicalTab,
  VenueTab,
} from "./[id]/tabs";

const TABS = ["overview", "venue", "technical", "readiness", "registration"];

export function EventDetail({
  id,
  tab,
  origin = "queue",
}: {
  id: string;
  tab?: string | string[];
  origin?: DetailOrigin;
}) {
  const event = eventById(id);

  if (!event) {
    notFound();
  }

  // The open tab lives in the URL so a coordinator can send a colleague
  // straight to the readiness or venue view, the same reason the acting role
  // is a path segment rather than client state.
  const activeTab =
    typeof tab === "string" && TABS.includes(tab) ? tab : "overview";

  const blocking = blockingArrangements(event);
  const unlocked = registrationUnlocked(event);

  return (
    <StaffShell
      role="coordinator"
      crumbs={detailCrumbs("coordinator", origin, "My events", event.name)}
    >
      <PageHeader
        title={event.name}
        description={`${event.request.clientOrganisation} · ${event.request.requestedBy.name} · ${event.request.preferredDate ?? "no date set"}`}
        actions={
          <>
            <StatusBadge status={event.request.status} />
            <StatusBadge status={event.status} />
          </>
        }
      />

      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="venue">Venue</TabsTrigger>
          <TabsTrigger value="technical">Technical</TabsTrigger>
          <TabsTrigger value="readiness">
            Readiness{blocking.length > 0 ? ` (${blocking.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="registration" className="gap-1.5">
            {unlocked ? null : <LockIcon className="size-3" />}
            Registration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab event={event} />
        </TabsContent>
        <TabsContent value="venue">
          <VenueTab event={event} />
        </TabsContent>
        <TabsContent value="technical">
          <TechnicalTab event={event} />
        </TabsContent>
        <TabsContent value="readiness">
          <ReadinessTab event={event} />
        </TabsContent>
        <TabsContent value="registration">
          <RegistrationTab event={event} />
        </TabsContent>
      </Tabs>
    </StaffShell>
  );
}
