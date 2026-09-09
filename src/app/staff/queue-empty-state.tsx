import { InboxIcon, type LucideIcon } from "lucide-react";

/**
 * Blank main content for a queue index page, before anything is selected.
 *
 * Distinct from `EmptyState` in `field-list.tsx`: that one marks "zero items
 * exist" inside a list or form. This one marks "items exist in the list pane,
 * nothing is open yet" -- the Linear-style landing state for a queue.
 */
export function QueueEmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center">
      <Icon className="text-muted-foreground/40 size-10" />
      <p className="text-muted-foreground text-sm font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      ) : null}
    </div>
  );
}
