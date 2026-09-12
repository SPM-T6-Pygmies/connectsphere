export interface UserWithRoles {
  userId: string;
  name: string;
  roles: string[];
  /** Set only for Event Organiser accounts belonging to a client org. */
  clientOrganisationId: string | null;
}

export interface UserRepository {
  findByAuthUserId(authUserId: string): Promise<UserWithRoles | null>;
}
