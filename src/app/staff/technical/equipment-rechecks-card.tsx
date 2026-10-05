import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EquipmentRecheck } from "@/core/use-cases/list-equipment-rechecks";

/**
 * SPM-41 AC15: the equipment lines a coordinator changed, or asked to remove,
 * after Technical Support reserved equipment against them. Read-only: acting
 * on a re-check -- release, replace, add -- is SPM-108.
 */
export function EquipmentRechecksCard({ rechecks }: { rechecks: readonly EquipmentRecheck[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs re-check</CardTitle>
        <CardDescription>
          Lines a coordinator changed or asked to remove after equipment was reserved against them.
          The reserved equipment stays held until you release it. A request the coordinator
          withdraws, or a change they reverse, leaves this list.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rechecks.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing needs re-checking.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Equipment</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Why</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rechecks.map((recheck) => (
                <TableRow key={`${recheck.eventId}-${recheck.equipmentItemId}`}>
                  <TableCell>
                    <div className="font-medium">{recheck.eventName}</div>
                    <div className="text-muted-foreground text-xs">{recheck.preferredDate ?? "No date yet"}</div>
                  </TableCell>
                  <TableCell>{recheck.equipmentType}</TableCell>
                  <TableCell>{recheck.quantityRequested}</TableCell>
                  <TableCell>{recheck.quantityReserved}</TableCell>
                  <TableCell>
                    {recheck.reason === "removalRequested" ? (
                      <Badge variant="destructive">Removal requested</Badge>
                    ) : (
                      <Badge variant="warning">Changed</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
