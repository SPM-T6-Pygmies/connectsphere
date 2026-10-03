"use client";

import { PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { AddEquipmentForm } from "./add-equipment-form";

/** The "Add equipment" button; the form opens in a side panel and closes once the item is added. */
export function AddEquipmentSheet() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <PlusIcon aria-hidden />
          Add equipment
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add equipment</SheetTitle>
          <SheetDescription>
            A new item appears in the catalogue as soon as it is added.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <AddEquipmentForm onAdded={close} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
