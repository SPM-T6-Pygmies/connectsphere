import type { EquipmentQueue } from "@/core/domain/equipment-review";
import type { EquipmentQueueEntry } from "@/core/use-cases/list-equipment-queue";

function lines(count: number): string {
  return `${count} line${count === 1 ? "" : "s"}`;
}

/**
 * What an event's equipment comes to, on its list's table row and in the
 * sidebar (SPM-273 AC1, AC6) -- on Reviewed, how many lines could not be
 * fulfilled (SPM-274 AC3).
 */
export function queueTeaser(queue: EquipmentQueue, event: EquipmentQueueEntry): string {
  if (queue === "needsReview") {
    return `${lines(event.linesNeedingAttention)} of ${event.lineCount} need${event.linesNeedingAttention === 1 ? "s" : ""} attention`;
  }
  if (queue === "reviewed") {
    return event.linesUnfulfilled === 0
      ? `${lines(event.lineCount)}, all reserved`
      : `${lines(event.lineCount)}, ${event.linesUnfulfilled} unfulfilled`;
  }
  return lines(event.lineCount);
}
