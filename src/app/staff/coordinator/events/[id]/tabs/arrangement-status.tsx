import { Badge } from "@/components/ui/badge";
import type { ArrangementType, EventReadiness } from "@/core/domain/event-readiness";

/** One arrangement's readiness, as the Venue and Registration tabs show it. */
export function ArrangementStatus({
  readiness,
  type,
}: {
  readiness: EventReadiness;
  type: ArrangementType;
}) {
  const arrangement = readiness.essentialArrangements.find((candidate) => candidate.type === type);
  if (arrangement === undefined) {
    return <p className="text-muted-foreground text-sm">Not marked essential for this event.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {arrangement.complete ? (
        <Badge variant="success">Done</Badge>
      ) : (
        <span className="text-muted-foreground text-xs">Outstanding</span>
      )}
      <span className="text-muted-foreground text-xs">{arrangement.detail}</span>
    </div>
  );
}
