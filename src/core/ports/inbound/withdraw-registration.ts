import type { AttendeeRegistration } from "./attendee-registration";

/**
 * The reference is the whole command.
 *
 * It identifies the registration and, in the absence of attendee accounts, is
 * also the only thing authorising the withdrawal -- see the note on
 * `attendee_registration` in the withdrawal migration.
 */
export interface WithdrawRegistrationCommand {
  readonly reference: string;
}

export interface WithdrawRegistrationResult {
  /** The registration as it now stands, so the confirmation can name the event (SPM-86). */
  readonly registration: AttendeeRegistration;
}

export interface WithdrawRegistration {
  execute(command: WithdrawRegistrationCommand): Promise<WithdrawRegistrationResult>;
}
