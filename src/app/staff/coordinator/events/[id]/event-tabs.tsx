"use client";

import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { EVENT_TABS, type EventTab } from "./event-tab-names";

const TAB_LABELS: Record<EventTab, string> = {
  event: "Event",
  venue: "Venue",
  equipment: "Equipment",
  safety: "Safety",
  registration: "Registration",
};

/**
 * SPM-285: the coordinator event page's tabs. The open tab lives in the URL
 * so a link can open it directly; switching rewrites `?tab=` in place rather
 * than navigating, so it does not re-run the page's reads.
 */
export function EventTabs({
  initialTab,
  panels,
}: {
  initialTab: EventTab;
  panels: Record<EventTab, ReactNode>;
}) {
  function select(tab: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
  }

  return (
    <Tabs defaultValue={initialTab} onValueChange={select}>
      <TabsList>
        {EVENT_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab}>
            {TAB_LABELS[tab]}
          </TabsTrigger>
        ))}
      </TabsList>
      {EVENT_TABS.map((tab) => (
        <TabsContent key={tab} value={tab} className="space-y-6 pt-2">
          {panels[tab]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
