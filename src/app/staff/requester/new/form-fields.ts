/**
 * The event request form's own fields -- the organiser's identity is not among
 * them; the composition root supplies that.
 *
 * A plain module rather than part of `actions.ts`, because a `"use server"`
 * module may only export async functions. Exporting a constant from one
 * type-checks and builds, and then arrives as `undefined` on the client.
 */
export const FORM_FIELDS = [
  "eventName",
  "description",
  "purpose",
  "preferredDate",
  "preferredTime",
  "expectedAttendance",
  "venueRequirements",
  "roomLayoutPreferences",
  "accessibilityNeeds",
  "equipmentRequirements",
  "registrationRequirements",
  "generalProgramme",
  "otherSpecialArrangements",
] as const;

export type FormField = (typeof FORM_FIELDS)[number];
export type FormValues = Record<FormField, string>;

export const EMPTY_FORM: FormValues = Object.fromEntries(
  FORM_FIELDS.map((field) => [field, ""]),
) as FormValues;

/**
 * How each field is named to the Organiser.
 *
 * The core reports which fields are missing, not how to say so -- putting a
 * sentence in a domain error would make the domain own copy. Translating one
 * into the other is the driving adapter's job.
 */
export const FIELD_LABELS: Record<FormField, string> = {
  eventName: "Event name",
  description: "Description",
  purpose: "Purpose",
  preferredDate: "Preferred date",
  preferredTime: "Preferred time",
  expectedAttendance: "Expected attendance",
  venueRequirements: "Venue requirements",
  roomLayoutPreferences: "Room layout preference",
  accessibilityNeeds: "Accessibility needs",
  equipmentRequirements: "Equipment requirements",
  registrationRequirements: "Registration requirements",
  generalProgramme: "General programme",
  otherSpecialArrangements: "Other special arrangements",
};
