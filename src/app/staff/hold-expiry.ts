/**
 * SPM-218: when a Tentative Hold lapses, in the words both pages show --
 * "Sun, 4 Oct, 9:00 am", in Singapore time whatever zone the server runs in,
 * as every other date in the app is (#36).
 */
export function formatHoldExpiry(iso: string): string {
  return new Date(iso).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
