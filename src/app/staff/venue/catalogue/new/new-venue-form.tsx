"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { VenueFormState } from "../actions";
import { VenueForm } from "../venue-form";

/**
 * SPM-146: the Add venue form. Once a venue is added the form starts again empty,
 * so the fields of a venue that already exists are not left behind, and a toast
 * says it was added.
 */
export function NewVenueForm({
  action,
}: {
  action: (previous: VenueFormState, formData: FormData) => Promise<VenueFormState>;
}) {
  const [formKey, setFormKey] = useState(0);

  return (
    <VenueForm
      key={formKey}
      action={async (previous, formData) => {
        const next = await action(previous, formData);
        if (next.status === "created") {
          toast.success("Venue created.");
          setFormKey((current) => current + 1);
        }
        return next;
      }}
    />
  );
}
