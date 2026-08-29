import Decimal from 'decimal.js';

// Money and share-quantity arithmetic must never use raw JS floating point
// (0.1 + 0.2 !== 0.3), since we're computing dollar allocations and share
// counts that are reported back to a financial partner. Decimal.js gives us
// exact base-10 arithmetic with explicit, auditable rounding behaviour.

Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_UP });

/** Rounds a currency amount to 2 decimal places using standard rounding. */
export function roundCurrency(value: Decimal | number): number {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Rounds a share quantity down to the configured number of decimal places.
 * Rounding DOWN (never up) guarantees an order never costs more than the
 * amount the partner authorised, which is the safer default for a
 * buy/sell execution API.
 */
export function roundQuantity(value: Decimal | number, decimalPlaces: number): number {
  return new Decimal(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_DOWN).toNumber();
}

export { Decimal };
