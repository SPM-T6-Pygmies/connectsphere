/** "HH:mm" -> "h:mm AM/PM", the same wording `formatInstantTime` uses once submitted. */
export function formatTimeOnly(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours % 24 < 12 ? "AM" : "PM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

/** Hours 00–24; only a closing time may be 24, and only as 24:00. */
const HOURS = Array.from({ length: 25 }, (_, hour) => String(hour).padStart(2, "0"));
/** The 15-minute grid (#128). */
const MINUTES = ["00", "15", "30", "45"] as const;

const SELECT_CLASS =
  "border-input aria-invalid:border-destructive h-8 w-full rounded-lg border bg-transparent px-2.5 text-base disabled:opacity-50 md:text-sm";

/**
 * SPM-333: a time on the 15-minute grid, picked as an hour and then a minute,
 * and posted as one `HH:MM` field. Picking an hour fills the minute with 00;
 * 24 is offered only with `endOfDay`, and only as 24:00. Whether the window
 * makes sense is `defineVenue`'s call.
 */
export function TimePicker({
  id,
  name,
  label,
  value,
  onChange,
  endOfDay = false,
  invalid,
}: {
  id: string;
  name: string;
  label: string;
  /** `HH:MM`, or empty until an hour is picked. */
  value: string;
  onChange: (value: string) => void;
  endOfDay?: boolean;
  invalid?: boolean;
}) {
  const [hour = "", minute = ""] = value === "" ? [] : value.split(":");
  const hours = endOfDay ? HOURS : HOURS.slice(0, -1);
  const minutes = hour === "24" ? ["00"] : MINUTES;

  function pick(nextHour: string, nextMinute: string) {
    if (nextHour === "") {
      onChange("");
      return;
    }
    onChange(`${nextHour}:${nextHour === "24" ? "00" : nextMinute || "00"}`);
  }

  return (
    <div className="flex gap-2">
      <input type="hidden" name={name} value={value} />
      <select
        id={id}
        aria-label={`${label} hour`}
        aria-invalid={invalid}
        required
        value={hour}
        onChange={(event) => pick(event.target.value, minute)}
        className={SELECT_CLASS}
      >
        <option value="">Hour</option>
        {hours.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} minute`}
        aria-invalid={invalid}
        disabled={hour === ""}
        value={minute}
        onChange={(event) => pick(hour, event.target.value)}
        className={SELECT_CLASS}
      >
        {hour === "" ? <option value="">Min</option> : null}
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
