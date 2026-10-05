"use client";

import { formatOptionList, parseOptionList } from "@/core/domain/venue-options";

/**
 * A pick-any-of list that posts as one comma-separated field, the form the
 * core's `parseOptionList` reads. `value` and `onChange` carry that same string.
 * `label` shows an option as something other than its value.
 */
export function OptionCheckboxes<T extends string>({
  name,
  options,
  value,
  onChange,
  label = (option) => option,
  disabled,
}: {
  name: string;
  options: readonly T[];
  value: string;
  onChange: (value: string) => void;
  label?: (option: T) => string;
  disabled?: boolean;
}) {
  const selected = parseOptionList(value);

  function toggle(option: string, checked: boolean) {
    // Keep the list's own order so the stored string does not depend on click order.
    onChange(
      formatOptionList(
        options.filter((each) => (each === option ? checked : selected.includes(each))),
      ),
    );
  }

  return (
    <div role="group" className="flex flex-wrap gap-x-4 gap-y-2">
      <input type="hidden" name={name} value={value} />
      {options.map((option) => (
        <label key={option} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={selected.includes(option)}
            disabled={disabled}
            onChange={(event) => toggle(option, event.target.checked)}
          />
          {label(option)}
        </label>
      ))}
    </div>
  );
}

/** A pick-one list. `blank` adds an empty first choice for an optional field. */
export function OptionSelect({
  id,
  name,
  options,
  value,
  onChange,
  blank,
  required,
  "aria-invalid": ariaInvalid,
}: {
  id: string;
  name: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  blank?: string;
  required?: boolean;
  "aria-invalid"?: boolean;
}) {
  return (
    <select
      id={id}
      name={name}
      required={required}
      aria-invalid={ariaInvalid}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="border-input aria-invalid:border-destructive h-8 w-full rounded-lg border bg-transparent px-2.5 text-base md:text-sm"
    >
      {blank !== undefined ? <option value="">{blank}</option> : null}
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
