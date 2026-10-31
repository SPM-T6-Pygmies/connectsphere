/**
 * The domain's ids are opaque strings, which is what keeps the core from
 * knowing that this store numbers its rows. Turning one back into a key is
 * this adapter's job, and an id that was never one of ours is simply not
 * found -- a hand-typed URL is a miss, not a failure.
 */
export function toKey(id: string): number | null {
  return /^\d+$/.test(id) ? Number(id) : null;
}
