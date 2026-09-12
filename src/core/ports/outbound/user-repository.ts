export interface UserWithRoles {
  userId: string;
  name: string;
  roles: string[];
}

export interface UserRepository {
  findByAuthUserId(authUserId: string): Promise<UserWithRoles | null>;
}
