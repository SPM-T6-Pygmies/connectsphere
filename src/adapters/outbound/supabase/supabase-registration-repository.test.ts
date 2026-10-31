import { describe, expect, it } from "vitest";

import { eventId } from "@/core/domain/event";

import type { SupabaseServerClient } from "./client";
import { SupabaseRegistrationRepository } from "./supabase-registration-repository";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

function fakeClient(answers: Record<string, RpcResult>) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return answers[name] ?? { data: null, error: { message: `unexpected call to ${name}` } };
    },
  } as unknown as SupabaseServerClient;
  return { client, calls };
}

describe("SupabaseRegistrationRepository registeredFor (SPM-69)", () => {
  it("AC1: lists the event's Registered attendees through coordinator_event_registrants", async () => {
    const { client, calls } = fakeClient({
      coordinator_event_registrants: {
        data: [
          {
            registration_reference: "3f0c2a6e-1d1b-4c7a-9b5e-8f2d7c4a1b90",
            event_id: 1,
            attendee_name: "Mei Lin",
            attendee_email: "mei@example.com",
            status: "Registered",
            registered_at: "2026-10-20T02:00:00Z",
          },
        ],
        error: null,
      },
    });

    const registrations = await new SupabaseRegistrationRepository(client).registeredFor(eventId("1"));

    expect(registrations).toMatchObject([
      {
        id: "3f0c2a6e-1d1b-4c7a-9b5e-8f2d7c4a1b90",
        eventId: "1",
        attendeeName: "Mei Lin",
        attendeeEmail: "mei@example.com",
        status: "registered",
      },
    ]);
    expect(calls).toEqual([{ name: "coordinator_event_registrants", args: { p_event_id: 1 } }]);
  });

  it("AC1: an event with no registrations lists nobody", async () => {
    const { client } = fakeClient({ coordinator_event_registrants: { data: [], error: null } });

    expect(await new SupabaseRegistrationRepository(client).registeredFor(eventId("1"))).toEqual([]);
  });
});
