/**
 * The part of `document` this needs, named so the scheduler can be exercised
 * without a DOM -- the suite runs under `environment: "node"`.
 */
export interface VisibilitySource {
  readonly hidden: boolean;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

/**
 * Call `onTick` every `intervalMs`, but only while the tab is in front.
 *
 * A background tab is polled for nobody: browsers throttle its timers anyway,
 * and a staff member with ten request tabs open should not have all ten asking
 * the server for a thread none of them is reading. Coming back to a tab ticks
 * at once rather than an interval later, so returning to a conversation shows
 * what was said while you were away instead of a stale copy of it.
 *
 * Returns its own teardown; the clock and the visibility source are both
 * supplied rather than reached for, which is what keeps this testable.
 */
export function pollWhileVisible({
  intervalMs,
  onTick,
  visibility,
}: {
  intervalMs: number;
  onTick: () => void;
  visibility: VisibilitySource;
}): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;

  function start(): void {
    if (timer === null) {
      timer = setInterval(onTick, intervalMs);
    }
  }

  function stopTimer(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function onVisibilityChange(): void {
    if (visibility.hidden) {
      stopTimer();
      return;
    }
    onTick();
    start();
  }

  visibility.addEventListener("visibilitychange", onVisibilityChange);
  if (!visibility.hidden) {
    start();
  }

  return () => {
    stopTimer();
    visibility.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
