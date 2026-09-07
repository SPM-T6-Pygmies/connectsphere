import type { AttendeeEmail } from "@/core/domain/attendee";
import type { EventId } from "@/core/domain/event";
import { registrationId, type Registration, type RegistrationId } from "@/core/domain/registration";
import type { RegistrationRepository } from "@/core/ports/outbound/registration-repository";

import type { SupabaseServerClient } from "./client";
import { REGISTRATION_COLUMNS, toDomain, toRow, type RegistrationRow } from "./registration-mapper";

export class SupabaseRegistrationRepository implements RegistrationRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  nextId(): RegistrationId {
    return registrationId(crypto.randomUUID());
  }

  async placesTaken(eventId: EventId): Promise<number> {
    // A withdrawn registration has released its place, so only live rows count.
    const { count, error } = await this.client
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "registered");

    if (error) {
      throw new Error(`Failed to count registrations: ${error.message}`, { cause: error });
    }

    return count ?? 0;
  }

  async findForAttendee(eventId: EventId, email: AttendeeEmail): Promise<Registration | null> {
    // `attendeeEmail` already lower-cased the value, which is what the
    // registrations_one_live_per_attendee index is built on.
    const { data, error } = await this.client
      .from("registrations")
      .select(REGISTRATION_COLUMNS)
      .eq("event_id", eventId)
      .eq("attendee_email", email)
      .eq("status", "registered")
      .maybeSingle<RegistrationRow>();

    if (error) {
      throw new Error(`Failed to look up registration: ${error.message}`, { cause: error });
    }

    return data ? toDomain(data) : null;
  }

  async save(registration: Registration): Promise<void> {
    const { error } = await this.client.from("registrations").upsert(toRow(registration));

    if (error) {
      throw new Error(`Failed to save registration: ${error.message}`, { cause: error });
    }
  }
}
