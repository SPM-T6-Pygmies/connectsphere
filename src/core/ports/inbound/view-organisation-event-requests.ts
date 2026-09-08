export interface ViewOrganisationEventRequestsCommand {
  readonly userAccountId: string;
  readonly clientOrganisationId: string;
}

export interface OrganisationEventRequestSummary {
  readonly id: string;
  readonly eventName: string;
  readonly status: string;
  /** Whether the caller may edit this request right now -- for the UI to gate the edit affordance on, not to trust in place of a server-side check. */
  readonly canEdit: boolean;
}

export interface ViewOrganisationEventRequestsResult {
  readonly eventRequests: readonly OrganisationEventRequestSummary[];
}

export interface ViewOrganisationEventRequests {
  execute(command: ViewOrganisationEventRequestsCommand): Promise<ViewOrganisationEventRequestsResult>;
}
