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

/** The most setup or turnaround a venue can have: two and a half hours. */
export const MAX_BUFFER_MINUTES = 150;

/** What the venue form offers for each of the two values: 0 to the most, in 15-minute steps. */
export const BUFFER_OPTIONS: readonly number[] = Array.from(
  { length: MAX_BUFFER_MINUTES / GRID_MINUTES + 1 },
  (_, step) => step * GRID_MINUTES,
);

/**
 * The only way to obtain valid setup and turnaround times (SPM-23 AC1, AC2): both or neither,
 * whole minutes on the 15-minute grid (#128), from 0 to 150. 0 is a value; blank is not.
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

/** The refusal for changing defined values; the database guard (`CS080`) is mapped to it. */
export function venueBuffersLocked(): InvalidVenueError {
  return new InvalidVenueError(
    "Setup and turnaround time are locked: they are set once, when they are first defined, and cannot be changed.",
    "setupMinutes",
  );
}

/**
 * SPM-23 AC3: whether a save may change a venue's setup and turnaround.
 *
 * They are defined once and then locked, 0 included, so a defined venue cannot change either
 * (sending its own values back is not a change).
 */
export function checkBuffersChange(current: VenueBuffers, next: VenueBuffers): void {
  if (current.setupMinutes === null && current.turnaroundMinutes === null) return;
  if (current.setupMinutes !== next.setupMinutes || current.turnaroundMinutes !== next.turnaroundMinutes) {
    throw venueBuffersLocked();
  }
}

/** The setup and turnaround a venue has, as `VenueBuffers` (undefined stays null). */
export function buffersOf(venue: Partial<VenueBuffers>): VenueBuffers {
  return { setupMinutes: venue.setupMinutes ?? null, turnaroundMinutes: venue.turnaroundMinutes ?? null };
}

/** SPM-23 AC10: how the venue list and the Coordinator's screens show a venue's two values. */
export function describeBuffers(venue: Partial<VenueBuffers>): string {
  const { setupMinutes, turnaroundMinutes } = buffersOf(venue);
  if (setupMinutes === null || turnaroundMinutes === null) return "Not set";
  return `Setup ${setupMinutes} min · Turnaround ${turnaroundMinutes} min`;
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
    throw new InvalidVenueError(`${label} must be at most ${MAX_BUFFER_MINUTES} minutes.`, field);
  }
  return minutes;
}
