"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * SPM-155: the calendar could not be read. Says so rather than showing an
 * empty week, which would read as every slot being free.
 */
export default function CalendarError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4 p-6">
      <Alert variant="destructive">
        <AlertDescription>The venue calendar could not be loaded. No slots are shown.</AlertDescription>
      </Alert>
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
