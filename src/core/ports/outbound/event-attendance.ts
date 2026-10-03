/**
 * Driven port: how many people an event currently expects. Read each time, so
 * a capacity check reflects the figure now rather than when the venue was
 * chosen (SPM-45).
 */
export interface EventAttendance {
  /** Null when the event has no expected attendance recorded. */
  expectedAttendance(eventId: string): Promise<number | null>;
}
