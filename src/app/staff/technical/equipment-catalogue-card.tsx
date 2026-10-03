import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildListEquipmentCatalogue } from "@/composition/container";

import { AddEquipmentSheet } from "./add-equipment-sheet";
import { EquipmentRow } from "./equipment-row";

/**
 * The equipment ConnectSphere owns, and where Technical Support Staff keep it
 * up to date (SPM-40) -- independent of any specific reservation, so it stays
 * visible across all three technical sections rather than living on just one
 * of them.
 *
 * Pooled counts, not individual units (#13): the catalogue tracks the quantity
 * available and nothing finer.
 */
export async function EquipmentCatalogueCard() {
  const { items } = await (await buildListEquipmentCatalogue()).execute();

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Equipment catalogue</CardTitle>
          <CardDescription>
            Pooled counts, not individual units. Items can be collected the day
            before and come back into the pool the day after return.
          </CardDescription>
        </div>
        <AddEquipmentSheet />
      </CardHeader>
      <CardContent className="space-y-6">
        {items.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            The catalogue is empty. Use Add equipment to add the first item.
          </p>
        ) : (
          <ul
            aria-label="Equipment catalogue items"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            {items.map((item) => (
              <EquipmentRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
