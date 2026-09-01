import { LoggingNotifier } from "@/adapters/outbound/logging/logging-notifier";
import { createSupabaseServerClient } from "@/adapters/outbound/supabase/client";
import { SupabaseConnectionRepository } from "@/adapters/outbound/supabase/supabase-connection-repository";
import { SupabaseMemberDirectory } from "@/adapters/outbound/supabase/supabase-member-directory";
import { systemClock } from "@/adapters/outbound/system/system-clock";
import type { SendConnectionRequest } from "@/core/ports/inbound/send-connection-request";
import { SendConnectionRequestUseCase } from "@/core/use-cases/send-connection-request";

/**
 * The composition root: the one module allowed to know both sides.
 *
 * Every other file imports either the core or an adapter, never both. Because
 * all the wiring is here, "what is this application actually made of?" has a
 * single, readable answer -- and swapping Supabase for something else is a
 * change to this file plus one new adapter directory.
 *
 * Server-only. The ESLint boundaries stop `src/app` and `src/components` from
 * importing adapters directly so they have to come through here.
 */
export async function buildSendConnectionRequest(): Promise<SendConnectionRequest> {
  const client = await createSupabaseServerClient();

  return new SendConnectionRequestUseCase({
    connections: new SupabaseConnectionRepository(client),
    members: new SupabaseMemberDirectory(client),
    notifier: new LoggingNotifier(),
    clock: systemClock,
  });
}
