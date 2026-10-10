/** "HH:mm" -> "h:mm AM/PM", the same wording `formatInstantTime` uses once submitted. */
export function formatTimeOnly(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours % 24 < 12 ? "AM" : "PM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}
