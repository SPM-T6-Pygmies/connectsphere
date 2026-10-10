import type { ArrangementType } from "@/core/domain/event-readiness";

/** Display labels only -- the domain names arrangement types, not their prose. */
export const ARRANGEMENT_LABELS: Record<ArrangementType, string> = {
  venue: "Venue",
  equipment: "Equipment",
  technical_support: "Technical support",
  programme: "Programme",
  registration: "Registration",
  other: "Other",
};
