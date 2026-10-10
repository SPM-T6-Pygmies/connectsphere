import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ViewCoordinatorEventResult } from "@/core/use-cases/view-coordinator-event";

import { ArrangementStatus } from "./arrangement-status";

/** SPM-285: registration readiness. Managing registration is not built yet. */
export function RegistrationTab({ readiness }: Pick<ViewCoordinatorEventResult, "readiness">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration</CardTitle>
        <CardDescription>Registration management isn&apos;t available yet.</CardDescription>
      </CardHeader>
      <CardContent>
        <ArrangementStatus readiness={readiness} type="registration" />
      </CardContent>
    </Card>
  );
}
