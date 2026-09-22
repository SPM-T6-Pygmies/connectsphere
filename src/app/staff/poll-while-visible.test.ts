import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pollWhileVisible } from "./poll-while-visible";

/**
 * A stand-in for `document`, so the scheduler is testable without a DOM.
 *
 * `hidden` is mutable here where the port has it readonly -- the browser only
 * ever reports it, while the fake has to be able to change it.
 */
interface FakeVisibility {
  hidden: boolean;
  readonly listeners: number;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
  show(): void;
  hide(): void;
}

function fakeVisibility(): FakeVisibility {
  const listeners = new Set<() => void>();

  return {
    hidden: false,
    get listeners() {
      return listeners.size;
    },
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    show() {
      this.hidden = false;
      for (const listener of listeners) listener();
    },
    hide() {
      this.hidden = true;
      for (const listener of listeners) listener();
    },
  };
}

// Untagged: no Linear issue was named for the live-refresh work. See
// docs/tests/README.md -- a tag is not invented for a case that has no ticket.
describe("pollWhileVisible", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks once per interval while the tab is visible", () => {
    const onTick = vi.fn();
    pollWhileVisible({ intervalMs: 1000, onTick, visibility: fakeVisibility() });

    vi.advanceTimersByTime(3000);

    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it("does not tick while the tab is hidden", () => {
    const onTick = vi.fn();
    const visibility = fakeVisibility();
    pollWhileVisible({ intervalMs: 1000, onTick, visibility });

    visibility.hide();
    vi.advanceTimersByTime(5000);

    expect(onTick).not.toHaveBeenCalled();
  });

  it("ticks immediately when the tab becomes visible again", () => {
    const onTick = vi.fn();
    const visibility = fakeVisibility();
    pollWhileVisible({ intervalMs: 1000, onTick, visibility });

    visibility.hide();
    vi.advanceTimersByTime(5000);
    visibility.show();

    // Whatever was said while the tab was away should be on screen on return,
    // rather than a further interval later.
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it("stops ticking and detaches its listener once torn down", () => {
    const onTick = vi.fn();
    const visibility = fakeVisibility();
    const stop = pollWhileVisible({ intervalMs: 1000, onTick, visibility });

    stop();
    vi.advanceTimersByTime(5000);

    expect(onTick).not.toHaveBeenCalled();
    expect(visibility.listeners).toBe(0);
  });
});
