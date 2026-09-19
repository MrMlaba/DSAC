/**
 * Money rules shared by every screen:
 *  - Amounts are stored as Decimal(14,2) and read into JS numbers in rand.
 *  - Every addition goes through integer cents, so R0.10 + R0.20 is exactly R0.30.
 *  - Ratios are computed from raw sums — never from rounded/displayed figures, and
 *    never by averaging per-entity percentages (that would weight a R9m NPO the
 *    same as a R400m agency).
 */

export function toCents(rand: number): number {
  return Math.round(rand * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function sumMoney(values: readonly number[]): number {
  let cents = 0;
  for (const value of values) cents += toCents(value);
  return fromCents(cents);
}

export function subtractMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * numerator / denominator as a plain ratio (0.767 = 76.7%). Returns null when
 * the denominator is zero so screens show "—" rather than a misleading 0%.
 */
export function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}
