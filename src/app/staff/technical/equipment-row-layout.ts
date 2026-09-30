/**
 * Column template shared by the catalogue's header and every row, so they line
 * up from `sm` up. Its own module rather than living in `equipment-row.tsx`: a
 * value exported from a client component reaches a server component as a
 * client reference, not as this string.
 */
export const EQUIPMENT_ROW_COLUMNS = "sm:grid-cols-[minmax(0,1fr)_6rem_minmax(0,1fr)_5.5rem]";
