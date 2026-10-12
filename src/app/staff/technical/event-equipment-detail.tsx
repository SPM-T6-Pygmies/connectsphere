import { forbidden, notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildViewEventEquipmentForTechnicalSupport, getCurrentTechnicalSupport } from "@/composition/container";
import type { AttentionReason, EquipmentQueue } from "@/core/domain/equipment-review";
import type { TechnicalSupportEquipmentLine } from "@/core/use-cases/view-event-equipment-for-technical-support";

import { detailCrumbs, type DetailOrigin } from "../detail-origin";
import { EquipmentLineDecision } from "./equipment-line-decision";
import { PageHeader, StaffShell } from "../staff-shell";
import { StatusBadge } from "../status-badge";

const QUEUES: Record<EquipmentQueue, { label: string; href: string }> = {
  needsReview: { label: "Needs review", href: "/staff/technical" },
  reviewed: { label: "Reviewed", href: "/staff/technical/reviewed" },
  archive: { label: "Archive", href: "/staff/technical/archive" },
};

const ATTENTION: Record<AttentionReason, { label: string; variant: "secondary" | "warning" | "destructive" }> = {
  new: { label: "New", variant: "secondary" },
  changed: { label: "Changed", variant: "warning" },
  removalRequested: { label: "Removal requested", variant: "destructive" },
};

function Was({ children }: { children: string }) {
  return <div className="text-muted-foreground text-xs">{children}</div>;
}

/** SPM-274: what was decided on a line nobody needs to act on now. */
function Decision({ line }: { line: TechnicalSupportEquipmentLine }) {
  const by = line.decision?.byName ? ` by ${line.decision.byName}` : "";
  if (line.state === "Unfulfilled") {
    return (
      <div className="max-w-64 space-y-1 whitespace-normal">
        <Badge variant="destructive">Unfulfilled</Badge>
        <div className="text-xs">{line.decision?.comment}</div>
        <div className="text-muted-foreground text-xs">{`Marked${by}`}</div>
      </div>
    );
  }
  if (line.state === "Reserved") {
    return <span className="text-muted-foreground text-xs">{`Reserved${by}`}</span>;
  }
  return null;
}

function EquipmentRow({ eventId, line }: { eventId: string; line: TechnicalSupportEquipmentLine }) {
  const was = line.reservedAs;
  const quantityChanged = was !== null && was.quantityRequested !== line.quantityRequested;
  const notesChanged = was !== null && was.technicalRequirements !== line.technicalRequirements;

  return (
    <TableRow>
      <TableCell className="font-medium">{line.equipmentType}</TableCell>
      <TableCell>
        {line.quantityRequested}
        {quantityChanged ? <Was>{`was ${was.quantityRequested}`}</Was> : null}
      </TableCell>
      <TableCell>{line.quantityReserved}</TableCell>
      <TableCell>
        {line.available === null ? (
          <span className="text-muted-foreground text-xs">Event has no date yet</span>
        ) : (
          line.available
        )}
      </TableCell>
      <TableCell className="max-w-64 whitespace-normal">
        {line.technicalRequirements ?? <span className="text-muted-foreground">None</span>}
        {notesChanged ? <Was>{`was: ${was.technicalRequirements ?? "none"}`}</Was> : null}
      </TableCell>
      <TableCell>
        {line.attention === null ? null : (
          <Badge variant={ATTENTION[line.attention].variant}>{ATTENTION[line.attention].label}</Badge>
        )}
      </TableCell>
      <TableCell className="w-72 max-w-72 align-top whitespace-normal">
        {line.canDecide ? <EquipmentLineDecision eventId={eventId} line={line} /> : <Decision line={line} />}
      </TableCell>
    </TableRow>
  );
}

/**
 * SPM-273 AC3-4: one event's equipment as Technical Support see it -- every
 * line, marked with why it needs attention, with what a changed line was when
 * it was reserved and how many units are free on the event's date. SPM-274:
 * a line awaiting a decision is reserved or marked unfulfilled in place, and
 * the others show what was decided. Releasing or replacing is SPM-108.
 */
export async function EventEquipmentDetail({ id, origin = "queue" }: { id: string; origin?: DetailOrigin }) {
  // Anyone who is not Technical Support Staff gets the shared access-denied screen (SPM-16).
  const technicalSupport = await getCurrentTechnicalSupport();
  if (technicalSupport === null) {
    forbidden();
  }

  const viewEventEquipment = await buildViewEventEquipmentForTechnicalSupport();
  const view = await viewEventEquipment.execute({ eventId: id, userAccountId: technicalSupport.userAccountId });
  if (view === null) {
    notFound();
  }

  const { event, lines } = view;
  const queue = view.queue ?? "needsReview";

  return (
    <StaffShell
      role="technical"
      crumbs={detailCrumbs("technical", origin, QUEUES[queue].label, event.name, QUEUES[queue].href)}
      activeSection={origin === "queue" ? queue : undefined}
      technicalQueue={queue}
    >
      <PageHeader
        title={event.name}
        description={event.preferredDate ?? "No date yet"}
        actions={<StatusBadge status={event.status} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Equipment lines</CardTitle>
          <CardDescription>
            Available counts the units owned, less those out of service, what other events hold from the day
            before to the day of their event, and what the line has already reserved, so it is how many more
            could be reserved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <p className="text-muted-foreground text-sm">No equipment lines.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Reserved</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Technical requirements</TableHead>
                  <TableHead>Needs attention</TableHead>
                  <TableHead>Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <EquipmentRow key={line.equipmentItemId} eventId={event.id} line={line} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </StaffShell>
  );
}
