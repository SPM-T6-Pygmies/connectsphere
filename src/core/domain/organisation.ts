import type { Brand } from "./brand";
import { InvalidClientOrganisationIdError } from "./errors";

export type ClientOrganisationId = Brand<string, "ClientOrganisationId">;

/**
 * The only way to obtain a `ClientOrganisationId`.
 *
 * Every event belongs to exactly one client organisation, and that
 * organisation is what visibility and edit access are scoped to -- so an
 * event can never be constructed with one that is missing or blank.
 */
export function clientOrganisationId(raw: string): ClientOrganisationId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidClientOrganisationIdError(raw);
  }
  return trimmed as ClientOrganisationId;
}
