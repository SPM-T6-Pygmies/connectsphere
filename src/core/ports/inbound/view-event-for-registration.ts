import type { AvailableEvent } from "./available-event";

export interface ViewEventForRegistrationCommand {
  readonly eventId: string;
}

export interface ViewEventForRegistrationResult {
  readonly event: AvailableEvent;
}

/**
 * Driving port: one event, as an Attendee may see it.
 *
 * Separate from the list because it refuses differently: an event that is not
 * open for registration is absent from the list, but addressing it directly is
 * a distinct outcome the detail page has to render.
 */
export interface ViewEventForRegistration {
  execute(command: ViewEventForRegistrationCommand): Promise<ViewEventForRegistrationResult>;
}
