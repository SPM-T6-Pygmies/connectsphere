import { z } from "zod";

/**
 * The venue form's shape (SPM-146, SPM-147) -- and only its shape.
 *
 * Every field is mandatory, so a blank is refused here with a message for that
 * field. Whether a capacity is above 0, closing is after opening or a layout is
 * listed twice is `defineVenue`'s call, not this boundary's: this answers "is
 * each field the right kind of thing?". Times arrive as the time picker's
 * 24-hour `HH:MM`.
 */
const requiredText = (message: string) => z.string().trim().min(1, message);

const clockTime = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label} time.`)
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, `Enter the ${label} time.`);

const wholeNumber = (blank: string, invalid: string) =>
  z
    .string()
    .trim()
    .min(1, blank)
    .regex(/^\d+$/, invalid)
    .transform(Number);

const layout = z.object({
  name: requiredText("Enter a layout name."),
  capacity: wholeNumber("Enter this layout's capacity.", "Enter the capacity as a whole number."),
});

export const createVenueSchema = z.object({
  location: requiredText("Enter the location."),
  facilities: requiredText("Enter the facilities."),
  accessibility: requiredText("Enter the accessibility details."),
  operatingHoursStart: clockTime("opening"),
  operatingHoursEnd: clockTime("closing"),
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

/** Reads the repeated `layoutName` / `layoutCapacity` fields as rows. */
export function venueFormValues(formData: FormData) {
  const names = formData.getAll("layoutName");
  const capacities = formData.getAll("layoutCapacity");

  return {
    venueId: String(formData.get("venueId") ?? ""),
    location: String(formData.get("location") ?? ""),
    facilities: String(formData.get("facilities") ?? ""),
    accessibility: String(formData.get("accessibility") ?? ""),
    operatingHoursStart: String(formData.get("operatingHoursStart") ?? ""),
    operatingHoursEnd: String(formData.get("operatingHoursEnd") ?? ""),
    capacity: String(formData.get("capacity") ?? ""),
    bookingHorizonDays: String(formData.get("bookingHorizonDays") ?? ""),
    layouts: names.map((name, index) => ({
      name: String(name),
      capacity: String(capacities[index] ?? ""),
    })),
  };
}
