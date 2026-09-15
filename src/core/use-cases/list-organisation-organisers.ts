import { clientOrganisationId } from "../domain/client-organisation";
import type { OrganiserDirectory } from "../ports/outbound/organiser-directory";

export interface ListOrganisationOrganisersCommand {
  readonly clientOrganisationId: string;
}

export interface OrganiserOption {
  readonly userAccountId: string;
  readonly name: string;
}

export interface ListOrganisationOrganisersResult {
  readonly organisers: readonly OrganiserOption[];
}

export interface ListOrganisationOrganisersDeps {
  readonly organisers: OrganiserDirectory;
}

/** SPM-39 AC5: who a request could be reassigned to -- Organisers in the caller's own client organisation. */
export class ListOrganisationOrganisersUseCase {
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
