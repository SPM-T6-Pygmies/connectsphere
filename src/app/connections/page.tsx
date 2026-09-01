import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { ConnectionRequestForm } from "./connection-request-form";

export default function ConnectionsPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Send a connection request</CardTitle>
          <CardDescription>
            A driving adapter over the SendConnectionRequest use case. See docs/ARCHITECTURE.md.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectionRequestForm />
        </CardContent>
      </Card>
    </main>
  );
}
