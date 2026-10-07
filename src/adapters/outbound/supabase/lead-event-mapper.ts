import { NotCoordinatorLeadError, type DomainError } from "@/core/domain/errors";

/** The domain error a Lead event function's custom SQLSTATE stands for, or null for any other failure. */
export function toLeadEventError(error: { readonly code?: string }): DomainError | null {
  return error.code === "CS060" ? new NotCoordinatorLeadError() : null;
}
