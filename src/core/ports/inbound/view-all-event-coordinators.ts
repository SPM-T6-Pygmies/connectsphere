export interface EventCoordinatorDetails {
  readonly userAccountId: string;
  readonly name: string;
  readonly contactDetails: string | null;
  readonly communicationPreferences: string | null;
  readonly department: string | null;
  readonly availability: string | null;
  readonly clientOrganisationId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ViewAllEventCoordinatorsResult {
  readonly eventCoordinators: readonly EventCoordinatorDetails[];
}

export interface ViewAllEventCoordinators {
  execute(): Promise<ViewAllEventCoordinatorsResult>;
}
