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

export interface ListOrganisationOrganisers {
  execute(
    command: ListOrganisationOrganisersCommand,
  ): Promise<ListOrganisationOrganisersResult>;
}
