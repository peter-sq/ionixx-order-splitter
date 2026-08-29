/**
 * Determines the next date on which equity orders can be executed.
 *
 * Assumption (documented in ANSWERS.md): markets are open Monday-Friday
 * with no concept of holidays, market hours, or same-day cutoff times for
 * this proof of concept. If the reference instant falls on a trading day,
 * the order is scheduled for that same day; otherwise it rolls forward to
 * the next Monday.
 */
export function nextTradingDay(reference: Date = new Date()): Date {
  const result = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()),
  );

  const day = result.getUTCDay(); // 0 = Sunday, 6 = Saturday
  if (day === 6) {
    result.setUTCDate(result.getUTCDate() + 2); // Saturday -> Monday
  } else if (day === 0) {
    result.setUTCDate(result.getUTCDate() + 1); // Sunday -> Monday
  }

  return result;
}

/** Formats a Date as an ISO calendar date (YYYY-MM-DD), UTC-based. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
