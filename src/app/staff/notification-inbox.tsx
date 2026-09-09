import { InfoIcon } from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { notificationsFor, unreadCount, type StaffRole } from "@/lib/wireframe";

import { EmptyState } from "./field-list";
import { PageHeader, StaffShell } from "./staff-shell";

/**
 * The inbox, shared by all five roles.
 *
 * A notification points at a record rather than restating it, so every row
 * links to the screen that owns what changed. Which triggers reach which role
 * comes from the recipient matrix, not from the brief -- section 6 names
 * fourteen triggers and never says who receives them -- so the card covering
 * each row is shown rather than the matrix being passed off as settled.
 */
export function NotificationInbox({ role }: { role: StaffRole }) {
  const notifications = notificationsFor(role);
  const unread = unreadCount(role);

  return (
    <StaffShell role={role} crumbs={[{ label: "Notifications" }]}>
      <PageHeader
        title="Notifications"
        description="What changed on the events you are responsible for. Each one links to the record it concerns."
        actions={
          <>
            {unread > 0 ? (
              <Badge variant="warning">{unread} unread</Badge>
            ) : null}
            <Button variant="outline" disabled={unread === 0}>
              Mark all read
            </Button>
          </>
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          description="Notifications about your events will arrive here."
        />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Notification</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Card</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((notification) => (
                <TableRow key={notification.id}>
                  <TableCell>
                    {notification.unread ? (
                      <span
                        className="bg-primary block size-1.5 rounded-full"
                        aria-label="Unread"
                      />
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/staff/${role}/notifications/${notification.id}`}
                      className={
                        notification.unread
                          ? "font-medium hover:underline"
                          : "hover:underline"
                      }
                    >
                      {notification.subject}
                    </Link>
                    <div className="text-muted-foreground max-w-md text-xs">
                      {notification.body}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{notification.trigger}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {notification.eventName}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {notification.receivedAt}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right font-mono text-xs">
                    {notification.card}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>In-app is half of it</AlertTitle>
        <AlertDescription>
          <p>
            Notifications go out in-app and by email, configured per
            notification type. Whether they are delivered as they happen or
            batched at an interval is the team&apos;s to choose — the customer
            set no delivery-time requirement either way. Reminders for events
            with incomplete arrangements are backlog, not Release 1.
          </p>
        </AlertDescription>
      </Alert>
    </StaffShell>
  );
}
