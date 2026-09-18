import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit, then blocks", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 2; i++) checkRateLimit(key, 2, 10);
    expect(checkRateLimit(key, 2, 10).allowed).toBe(false);

    vi.setSystemTime(11_000); // past the 10s window
    expect(checkRateLimit(key, 2, 10).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const keyA = `a-${Math.random()}`;
    const keyB = `b-${Math.random()}`;
    checkRateLimit(keyA, 1, 60);
    expect(checkRateLimit(keyA, 1, 60).allowed).toBe(false);
    expect(checkRateLimit(keyB, 1, 60).allowed).toBe(true);
  });
});
