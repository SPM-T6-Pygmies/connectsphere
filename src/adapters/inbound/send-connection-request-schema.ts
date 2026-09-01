import { z } from "zod";

/**
 * The boundary where untrusted input becomes a well-formed command.
 *
 * This is deliberately outside the core. It validates *shape* -- is this a
 * uuid, is the field present -- which is a transport concern. It does not
 * validate *rules*; whether these two members are allowed to connect is the
 * domain's call, and duplicating it here would give us two answers to keep in
 * sync.
 */
export const sendConnectionRequestSchema = z.object({
  requesterId: z.uuid("Requester must be a valid member id."),
  addresseeId: z.uuid("Addressee must be a valid member id."),
});

export type SendConnectionRequestInput = z.infer<typeof sendConnectionRequestSchema>;
