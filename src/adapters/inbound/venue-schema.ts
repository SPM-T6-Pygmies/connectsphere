import { z } from "zod";


/**
 * The venue form's shape (SPM-146, SPM-147) -- and only its shape.
 *
 * Every field is mandatory, so a blank is refused here with a message for that
 * field. Whether a capacity is above 0, a window ends after it starts or a
 * layout is listed twice is `defineVenue`'s call, not this boundary's: this
 * answers "is each field the right kind of thing?".
 */
const requiredText = (message: string) => z.string().trim().min(1, message);

const wholeNumber = (blank: string, invalid: string) =>
  z
    .string()
    .trim()
    .min(1, blank)
    .regex(/^\d+$/, invalid)
    .transform(Number);

const time = (blank: string) =>
  z
    .string()
    .trim()
    .min(1, blank)
    .regex(/^\d{2}:\d{2}$/, "Enter the time as HH:MM, such as 07:00.");

/** SPM-333: one opening window, as the start and end selects post it. */
const openingWindow = z.object({
  start: time("Choose when this window opens."),
  end: time("Choose when this window closes."),
});

const layout = z.object({
  name: requiredText("Enter a layout name."),
  capacity: wholeNumber("Enter this layout's capacity.", "Enter the capacity as a whole number."),
});

export const createVenueSchema = z.object({
  location: requiredText("Enter the location."),
  facilities: requiredText("Enter the facilities."),
  accessibility: requiredText("Enter the accessibility details."),
  openingHours: z.array(openingWindow).min(1, "Set the venue's opening and closing time."),
  capacity: wholeNumber("Enter the venue capacity.", "Enter the venue capacity as a whole number."),
  bookingHorizonDays: wholeNumber(
    "Enter the booking horizon in days.",
    "Enter the booking horizon as a whole number of days.",
  ),
  layouts: z.array(layout).min(1, "Add at least one supported room layout."),
});

export const updateVenueSchema = createVenueSchema.extend({
  venueId: requiredText("The venue is missing."),
});

/** The first message for each field, keyed by field (`layouts.0.capacity` for a layout's). */
export function venueFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in errors)) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

/** Reads the repeated `openingStart` / `openingEnd` and `layoutName` / `layoutCapacity` fields as rows. */
export function venueFormValues(formData: FormData) {
  const starts = formData.getAll("openingStart");
  const ends = formData.getAll("openingEnd");
  const names = formData.getAll("layoutName");
  const capacities = formData.getAll("layoutCapacity");

  return {
    venueId: String(formData.get("venueId") ?? ""),
    location: String(formData.get("location") ?? ""),
    facilities: String(formData.get("facilities") ?? ""),
    accessibility: String(formData.get("accessibility") ?? ""),
    openingHours: starts.map((start, index) => ({
      start: String(start),
      end: String(ends[index] ?? ""),
    })),
    capacity: String(formData.get("capacity") ?? ""),
    bookingHorizonDays: String(formData.get("bookingHorizonDays") ?? ""),
    layouts: names.map((name, index) => ({
      name: String(name),
      capacity: String(capacities[index] ?? ""),
    })),
  };
}
