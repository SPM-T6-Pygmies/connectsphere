import type { Clock } from "@/core/ports/outbound/clock";

export const systemClock: Clock = {
  now: () => new Date(),
};
