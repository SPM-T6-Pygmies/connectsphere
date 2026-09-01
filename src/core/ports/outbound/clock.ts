/**
 * Driven port: time.
 *
 * `new Date()` is a call to the outside world, so it is a boundary, so it gets
 * a port. This is the cheapest port in the codebase and it buys the most:
 * every test that involves a timestamp becomes deterministic without stubbing
 * globals.
 */
export interface Clock {
  now(): Date;
}
