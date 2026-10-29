import type { ChangeRequestField } from "@/core/domain/change-request";

/** The Coordinator's pick on one row of the decision form. */
export type Choice = { outcome: "Accepted" } | { outcome: "Declined"; reason: string };

/**
 * SPM-100: Save waits until every row is decided and every decline has a
 * reason (#104). The core checks the same again on save.
 */
export function readyToSave(
  fields: readonly ChangeRequestField[],
  choices: Partial<Record<ChangeRequestField, Choice>>,
): boolean {
  return fields.every((field) => {
    const choice = choices[field];
    return choice !== undefined && (choice.outcome === "Accepted" || choice.reason.trim().length > 0);
  });
}
