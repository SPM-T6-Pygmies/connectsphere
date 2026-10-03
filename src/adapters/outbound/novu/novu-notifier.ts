import type { Novu } from "@novu/api";
import type { TriggerEventResponseDto } from "@novu/api/models/components";

import { LoggingNotifier } from "@/adapters/outbound/logging/logging-notifier";
import { COORDINATOR_ASSIGNED_WORKFLOW_ID } from "@/adapters/outbound/novu/workflows/coordinator-assigned";
import type { Connection } from "@/core/domain/connection";
import type {
  EventCoordinatorAssignedNotice,
  Notifier,
} from "@/core/ports/outbound/notifier";

/**
 * Why Novu did not take a trigger on, or `null` if it did.
 *
 * Novu answers some failures with a 201 rather than an error -- an inactive
 * workflow, a workflow with no active steps -- so a trigger that did not throw
 * has not necessarily been delivered.
 */
export function triggerFailure(
  result: Pick<TriggerEventResponseDto, "acknowledged" | "status" | "error">,
): string | null {
  if (result.acknowledged && result.status === "processed") return null;
  return [result.status, ...(result.error ?? [])].join(": ");
}

/**
 * Delivers notifications through Novu (SPM-173). The workflows themselves are
 * served from `/api/novu`; this only triggers them.
 *
 * Failures throw. Composition always wraps this in `SupabaseRecordingNotifier`,
 * which marks the row Failed and keeps a committed assignment from erroring.
 */
export class NovuNotifier implements Notifier {
  private readonly logging = new LoggingNotifier();

  constructor(
    private readonly novu: Novu,
    /** Local dev only: where `npx novu dev` tunnels the bridge. Cloud uses the synced URL. */
    private readonly bridgeUrl?: string,
  ) {}

  // No Novu workflow for connection requests yet.
  connectionRequested(connection: Connection): Promise<void> {
    return this.logging.connectionRequested(connection);
  }

  async eventCoordinatorAssigned(notice: EventCoordinatorAssignedNotice): Promise<void> {
    let result: TriggerEventResponseDto;
    try {
      ({ result } = await this.novu.trigger({
        workflowId: COORDINATOR_ASSIGNED_WORKFLOW_ID,
        to: notice.recipientUserAccountId,
        payload: { ...notice },
        bridgeUrl: this.bridgeUrl,
      }));
    } catch (error) {
      // The SDK cannot parse some of Novu's own error responses (a 422 for an
      // unknown workflow surfaces as "Response validation failed"), so carry
      // the raw body -- it is what says `workflow_not_found`.
      const body = error instanceof Error && "body" in error ? String(error.body) : null;
      throw new Error(
        `Novu rejected ${COORDINATOR_ASSIGNED_WORKFLOW_ID}${body === null ? "" : `: ${body}`}`,
        { cause: error },
      );
    }
    const failure = triggerFailure(result);
    if (failure !== null) {
      throw new Error(`Novu did not process ${COORDINATOR_ASSIGNED_WORKFLOW_ID}: ${failure}`);
    }
  }
}
