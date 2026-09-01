/**
 * Nominal typing for primitives.
 *
 * A `MemberId` and a `ConnectionId` are both strings at runtime, but the
 * compiler refuses to swap them. This is the cheapest possible defence against
 * the single most common bug in this kind of code: passing the right-shaped
 * value from the wrong column.
 */
declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };
