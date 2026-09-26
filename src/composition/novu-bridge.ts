import { serve } from "@novu/framework/next";

import { coordinatorAssigned } from "@/adapters/outbound/novu/workflows/coordinator-assigned";

/**
 * The Novu bridge: Novu Cloud calls back here to discover and run our code-first
 * workflows. Wired in composition because `src/app` may not import outbound
 * adapters; `src/app/api/novu/route.ts` only re-exports these handlers.
 *
 * `serve` reads `NOVU_SECRET_KEY` itself and rejects unsigned calls outside
 * development.
 */
export const { GET, POST, OPTIONS } = serve({ workflows: [coordinatorAssigned] });
