import { InvalidVenueError, type VenueField } from "./errors";
import { GRID_MINUTES } from "./time-of-day";

/**
 * SPM-23: the time a venue needs to be set up before an event and reset after it, in minutes.
 * Both are entered together, once, and then locked. `null` means the venue has none defined,
 * which is not the same as a defined 0, and counts as 0 in every check (AC4).
 */
export interface VenueBuffers {
  readonly setupMinutes: number | null;
  readonly turnaroundMinutes: number | null;
}

/** A day: more than that would run a window past the neighbouring date. */
export const MAX_BUFFER_MINUTES = 24 * 60;

/**
 * The only way to obtain valid setup and turnaround times (SPM-23 AC1, AC2): both or neither,
 * whole minutes on the 15-minute grid (#128), from 0 to a day. 0 is a value; blank is not.
 */
export function defineVenueBuffers(input: {
  readonly setupMinutes?: number | null;
  readonly turnaroundMinutes?: number | null;
}): VenueBuffers {
  const setup = input.setupMinutes ?? null;
  const turnaround = input.turnaroundMinutes ?? null;

  if (setup === null && turnaround === null) {
    return { setupMinutes: null, turnaroundMinutes: null };
  }
  if (setup === null) {
    throw new InvalidVenueError("Enter the setup time too: setup and turnaround are entered together.", "setupMinutes");
  }
  if (turnaround === null) {
    throw new InvalidVenueError(
      "Enter the turnaround time too: setup and turnaround are entered together.",
      "turnaroundMinutes",
    );
  }

  return {
    setupMinutes: validMinutes(setup, "The setup time", "setupMinutes"),
    turnaroundMinutes: validMinutes(turnaround, "The turnaround time", "turnaroundMinutes"),
  };
}

/** What every check uses: an undefined value counts as 0 minutes (SPM-23 AC4). */
export function bufferMinutes(venue: Partial<VenueBuffers>): { setup: number; turnaround: number } {
  return { setup: venue.setupMinutes ?? 0, turnaround: venue.turnaroundMinutes ?? 0 };
}

function validMinutes(minutes: number, label: string, field: VenueField): number {
  if (!Number.isInteger(minutes)) {
    throw new InvalidVenueError(`${label} must be a whole number of minutes.`, field);
  }
  if (minutes < 0) {
    throw new InvalidVenueError(`${label} must be 0 or more minutes.`, field);
  }
  if (minutes % GRID_MINUTES !== 0) {
    throw new InvalidVenueError(
      `${label} must be a multiple of 15 minutes -- use 0, 15, 30, 45 and so on.`,
      field,
    );
  }
  if (minutes > MAX_BUFFER_MINUTES) {
    throw new InvalidVenueError(`${label} must be at most ${MAX_BUFFER_MINUTES} minutes (24 hours).`, field);
  }
  return minutes;
}
