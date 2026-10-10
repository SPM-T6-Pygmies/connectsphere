import { CoordinatorEventNotFoundError, EventRegistrationLockedError } from "../domain/errors";
import {
  chooseRegistrationSettings,
  eventRegistrationEditable,
  sameRegistrationSettings,
  type RegistrationSettings,
} from "../domain/event-registration-settings";
import { userAccountId } from "../domain/user-account";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";

export interface SetEventRegistrationCommand {
  readonly eventId: string;
  /** The Event Coordinator asking. */
  readonly userAccountId: string;
  /** The settings as the form now has them; dates are `YYYY-MM-DD`, blank or null when unset. */
  readonly settings: RegistrationSettings;
}

export interface SetEventRegistrationResult {
  /** What is now stored. */
  readonly settings: RegistrationSettings;
  /** False when the save matched what was already stored, so nothing was written. */
  readonly changed: boolean;
}

export interface SetEventRegistrationDeps {
  readonly events: CoordinatorEventRepository;
}

/**
 * SPM-25: the assigned Event Coordinator turns registration on or off for an
 * event and sets the window Attendees can register in.
 *
 * Only the coordinator planning the event may do this; anyone else is told the
 * event does not exist (#91). Whether the settings are valid and when they
 * lock are the domain's calls. Attendees are kept out of a disabled event by
 * `isOpenForRegistration`, which every Attendee path already asks.
 */
export class SetEventRegistrationUseCase {
  constructor(private readonly deps: SetEventRegistrationDeps) {}

  async execute(command: SetEventRegistrationCommand): Promise<SetEventRegistrationResult> {
    const { events } = this.deps;
    const coordinatorId = userAccountId(command.userAccountId);

    const event = await events.findAssigned(coordinatorId, command.eventId);
    if (event === null) {
      throw new CoordinatorEventNotFoundError(command.eventId);
    }
    if (!eventRegistrationEditable(event.status)) {
      throw new EventRegistrationLockedError(event.status);
    }

    const settings = chooseRegistrationSettings(command.settings);
    const current: RegistrationSettings = {
      enabled: event.registrationEnabled,
      opensOn: event.registrationOpensOn,
      closesOn: event.registrationClosesOn,
    };
    if (sameRegistrationSettings(current, settings)) {
      return { settings, changed: false };
    }

    await events.setRegistrationSettings(coordinatorId, event.id, settings);
    return { settings, changed: true };
  }
}
