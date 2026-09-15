import { clientOrganisationId } from "../domain/client-organisation";
import type {
  OrganiserSummary,
  UserAccountRepository,
} from "../ports/outbound/user-account-repository";

export type { OrganiserSummary } from "../ports/outbound/user-account-repository";

export interface ListOrganisationOrganisersCommand {
  readonly clientOrganisationId: string;
}

export interface ListOrganisationOrganisersResult {
  readonly organisers: readonly OrganiserSummary[];
}

export interface ListOrganisationOrganisersDeps {
  readonly userAccounts: UserAccountRepository;
}

/**
 * SPM-39 AC5: who a request could be reassigned to -- Organisers in the caller's own client organisation.
 *
 * A thin read slice (ARCHITECTURE.md section 11): the repository already answers with the view.
 */
export class ListOrganisationOrganisersUseCase {
  constructor(private readonly deps: ListOrganisationOrganisersDeps) {}

  async execute(
    command: ListOrganisationOrganisersCommand,
  ): Promise<ListOrganisationOrganisersResult> {
    return {
      organisers: await this.deps.userAccounts.listOrganisers(
        clientOrganisationId(command.clientOrganisationId),
      ),
    };
  }
}
