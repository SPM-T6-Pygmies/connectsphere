export interface AuditLogger {
  logLogout(userId: string): Promise<void>;
}
