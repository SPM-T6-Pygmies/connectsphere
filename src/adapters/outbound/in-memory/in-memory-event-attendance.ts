import type { EventAttendance } from "@/core/ports/outbound/event-attendance";

export class InMemoryEventAttendance implements EventAttendance {
  private readonly figures = new Map<string, number | null>();

  constructor(seed: Readonly<Record<string, number | null>> = {}) {
    for (const [eventId, attendance] of Object.entries(seed)) {
      this.figures.set(eventId, attendance);
    }
  }

  async expectedAttendance(eventId: string): Promise<number | null> {
    return this.figures.get(eventId) ?? null;
  }

  /** Test helper: the event's expected attendance changes. */
  set(eventId: string, attendance: number | null): void {
    this.figures.set(eventId, attendance);
  }
}
