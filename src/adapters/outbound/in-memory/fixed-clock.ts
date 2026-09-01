import type { Clock } from "@/core/ports/outbound/clock";

export class FixedClock implements Clock {
  constructor(private readonly instant: Date) {}

  now(): Date {
    return new Date(this.instant);
  }
}
