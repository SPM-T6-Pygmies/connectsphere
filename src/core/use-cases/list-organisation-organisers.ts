import { clientOrganisationId } from "../domain/client-organisation";
import type {
  ListOrganisationOrganisers,
  ListOrganisationOrganisersCommand,
  ListOrganisationOrganisersResult,
} from "../ports/inbound/list-organisation-organisers";
import type { OrganiserDirectory } from "../ports/outbound/organiser-directory";

export interface ListOrganisationOrganisersDeps {
  readonly organisers: OrganiserDirectory;
}

/** SPM-39 AC5: who a request could be reassigned to -- Organisers in the caller's own client organisation. */
export class ListOrganisationOrganisersUseCase implements ListOrganisationOrganisers {
  constructor(private readonly deps: ListOrganisationOrganisersDeps) {}

  async execute(
    command: ListOrganisationOrganisersCommand,
  ): Promise<ListOrganisationOrganisersResult> {
    const organisers = await this.deps.organisers.listByClientOrganisation(
      clientOrganisationId(command.clientOrganisationId),
    );

    return {
      organisers: organisers.map((organiser) => ({
        userAccountId: organiser.userAccountId,
        name: organiser.name,
      })),
    };
  }
}
