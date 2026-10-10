/** SPM-285: the coordinator event page's tabs, in order. Kept out of the client module so the page can read it. */
export const EVENT_TABS = ["event", "venue", "equipment", "safety", "registration"] as const;
export type EventTab = (typeof EVENT_TABS)[number];
