import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EquipmentQueue } from "@/core/domain/equipment-review";
import type { EquipmentQueueEntry } from "@/core/use-cases/list-equipment-queue";

import { StatusBadge } from "../status-badge";
import { queueTeaser } from "./queue-teaser";

const COPY: Record<EquipmentQueue, { title: string; description: string; empty: string }> = {
  needsReview: {
    title: "Needs review",
    description:
      "Events with an equipment line that is new, was changed after you reserved it, or has its removal requested.",
    empty: "Nothing needs your attention.",
  },
  reviewed: {
    title: "Reviewed",
    description: "Events still running whose equipment lines are all reserved.",
    empty: "Nothing reviewed yet.",
  },
  archive: {
    title: "Archive",
    description: "Completed and cancelled events that had equipment.",
    empty: "Nothing archived.",
  },
};

/**
 * One of Technical Support's lists (SPM-273). Each event opens its equipment
 * page; acting on a line there is SPM-274 and SPM-108.
 */
export function EquipmentQueueCard({
  queue,
  events,
}: {
  queue: EquipmentQueue;
  events: readonly EquipmentQueueEntry[];
}) {
  const copy = COPY[queue];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">{copy.empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Equipment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.eventId}>
                  <TableCell className="font-medium">
                    <Link href={`/staff/technical/${event.eventId}`} className="underline-offset-4 hover:underline">
                      {event.eventName}
                    </Link>
                  </TableCell>
                  <TableCell>{event.preferredDate ?? "No date yet"}</TableCell>
                  <TableCell>
                    <StatusBadge status={event.status} />
                  </TableCell>
                  <TableCell>{queueTeaser(queue, event)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
