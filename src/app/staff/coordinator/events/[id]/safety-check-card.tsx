import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EventSafetyChecksView } from "@/core/use-cases/view-event-safety-checks";

import { ResubmitForm } from "./resubmit-form";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * SPM-261: what the Safety Officer said about this event, newest first (AC2),
 * and -- after a rejection -- the way to send it back for another check once
 * it has been reworked (AC3).
 */
export function SafetyCheckCard({ eventId, view }: { eventId: string; view: EventSafetyChecksView }) {
  const latest = view.checks[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Safety check</CardTitle>
        {latest?.outcome === "Rejected" && latest.resubmittedAt === null ? (
          <CardDescription>
            The Safety Officer rejected this event. Make the changes they asked for, then resubmit it.
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {view.checks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No safety check yet</p>
        ) : (
          <ol className="space-y-4">
            {view.checks.map((check, index) => (
              <li key={index} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={check.outcome === "Approved" ? "success" : "destructive"}>{check.outcome}</Badge>
                  <span className="text-muted-foreground text-xs">
                    {check.checkedByName} · {when(check.checkedAt)}
                  </span>
                </div>
                {check.comments === null ? null : <p className="text-sm whitespace-pre-wrap">{check.comments}</p>}
                {check.resubmittedAt === null ? null : (
                  <p className="text-muted-foreground text-xs">
                    Resubmitted for a safety check · {when(check.resubmittedAt)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}

        {view.canResubmit ? <ResubmitForm eventId={eventId} /> : null}
      </CardContent>
    </Card>
  );
}
