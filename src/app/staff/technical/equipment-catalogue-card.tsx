import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EQUIPMENT_CATALOGUE } from "@/lib/wireframe";

/**
 * Pooled equipment counts, independent of any specific reservation -- so it
 * stays visible across all three technical sections rather than living on
 * just one of them.
 */
export function EquipmentCatalogueCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipment catalogue</CardTitle>
        <CardDescription>
          Pooled counts, not individual units. Items can be collected the day
          before and come back into the pool the day after return.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>In pool</TableHead>
              <TableHead>Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {EQUIPMENT_CATALOGUE.map((item) => (
              <TableRow key={item.type}>
                <TableCell className="font-medium">{item.type}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell className="text-muted-foreground">
                  {item.location}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
