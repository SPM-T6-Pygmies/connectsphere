import type { EquipmentLineState } from "@/core/domain/equipment-requirement";

/** A line's state from the columns that hold it: reserved quantity, and whether a change put it under review. */
export function lineState(quantityReserved: number, underReview: boolean): EquipmentLineState {
  if (quantityReserved === 0) {
    return "Requested";
  }
  return underReview ? "Under review" : "Reserved";
}
