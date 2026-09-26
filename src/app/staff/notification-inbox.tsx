import type { StaffRole } from "@/lib/wireframe";

import { NotificationPlaceholder } from "./notification-placeholder";
import { StaffShell } from "./staff-shell";

/**
 * The inbox, shared by all five roles.
 *
 * A notification points at a record rather than restating it, so every row
 * links to the screen that owns what changed. The rows live in the list pane,
 * fed from Novu through `StaffShell` (SPM-174); until one is opened the page
 * itself only counts what is unread.
 */
export function NotificationInbox({ role }: { role: StaffRole }) {
  return (
    <StaffShell role={role} crumbs={[{ label: "Notifications" }]}>
      <NotificationPlaceholder />
    </StaffShell>
  );
}
