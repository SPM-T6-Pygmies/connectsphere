import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildListEquipmentCatalogue } from "@/composition/container";

import { AddEquipmentForm } from "./add-equipment-form";
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
      <CardHeader>
        <CardTitle>Equipment catalogue</CardTitle>
        <CardDescription>
          Pooled counts, not individual units. Items can be collected the day
          before and come back into the pool the day after return.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {items.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            The catalogue is empty. Add the first item below.
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

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Add equipment</h3>
          <AddEquipmentForm />
        </div>
      </CardContent>
    </Card>
  );
}
