export interface AuthPort {
  login(email: string, password: string): Promise<LoginResult>;
  getSession(): Promise<SessionData | null>;
  logout(): Promise<void>;
}

export interface LoginResult {
  userId: string;
  expiresAt: Date;
}

export interface SessionData {
  userId: string;
  expiresAt: Date;
}
