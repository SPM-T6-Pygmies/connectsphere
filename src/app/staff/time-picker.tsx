import { ClockIcon } from "lucide-react";
import { cn } from "cn";

import { Input } from "@/components/ui/input";

/** "HH:mm" -> "h:mm AM/PM", the same wording `formatInstantTime` uses once submitted. */
export function formatTimeOnly(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours < 12 ? "AM" : "PM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * A preferred start/end time. Still a real `<input type="time">` underneath
 * -- clicking it opens the browser's own time picker, same as `DatePicker`
 * opens a real Calendar -- but its native empty-state placeholder
 * ("--:-- --") and locale-dependent rendering can't be restyled directly, so
 * a formatted label sits visually on top while the actual input stays fully
 * interactive (and transparent) underneath it.
 */
export function TimePicker({
  id,
  value,
  onChange,
  "aria-invalid": ariaInvalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  "aria-invalid"?: boolean;
}) {
  return (
    <div className="group relative">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm",
          "group-focus-within:border-ring group-focus-within:ring-3 group-focus-within:ring-ring/50",
          !value && "text-muted-foreground",
          ariaInvalid && "border-destructive",
        )}
      >
        {value ? formatTimeOnly(value) : "HH:MM AM/PM"}
        <ClockIcon className="text-muted-foreground size-4" />
      </div>
      <Input
        id={id}
        type="time"
        required
        aria-invalid={ariaInvalid}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => {
          // Chrome only opens its popup from the native icon, which is invisible here.
          try {
            event.currentTarget.showPicker();
          } catch {
            // Not supported (older Safari) or blocked: the segments still take typing.
          }
        }}
        className="absolute inset-0 opacity-0"
      />
    </div>
  );
}
