import { serve } from "@novu/framework/next";

import { clarificationRequested } from "@/adapters/outbound/novu/workflows/clarification-requested";
import { coordinatorAssigned } from "@/adapters/outbound/novu/workflows/coordinator-assigned";
import { eventRequestDecided } from "@/adapters/outbound/novu/workflows/event-request-decided";
import { organiserCoordinatorAssigned } from "@/adapters/outbound/novu/workflows/organiser-coordinator-assigned";
import { safetyCheckReady } from "@/adapters/outbound/novu/workflows/safety-check-ready";

/**
 * The Novu bridge: Novu Cloud calls back here to discover and run our code-first
 * workflows. Wired in composition because `src/app` may not import outbound
 * adapters; `src/app/api/novu/route.ts` only re-exports these handlers.
 *
 * `serve` reads `NOVU_SECRET_KEY` itself and rejects unsigned calls outside
 * development. It is built on the first request, not at import: in production
 * mode it throws without a key, and `next build` imports every route -- so a
 * build without Novu (CI) would fail.
 */
type Bridge = ReturnType<typeof serve>;

let bridge: Bridge | undefined;

function handlers(): Bridge {
  bridge ??= serve({
    workflows: [
      coordinatorAssigned,
      organiserCoordinatorAssigned,
      clarificationRequested,
      eventRequestDecided,
      safetyCheckReady,
    ],
  });
  return bridge;
}

export const GET: Bridge["GET"] = (...args) => handlers().GET(...args);
export const POST: Bridge["POST"] = (...args) => handlers().POST(...args);
export const OPTIONS: Bridge["OPTIONS"] = (...args) => handlers().OPTIONS(...args);
