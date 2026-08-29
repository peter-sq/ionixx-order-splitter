import { v4 as uuid } from 'uuid';
import { Decimal, roundCurrency, roundQuantity } from './money';
import { nextTradingDay, toIsoDate } from './marketCalendar';
import { ModelPortfolioItem, OrderAllocation, SplitOrderInput, SplitOrderResult } from './types';
import { ValidationError } from '../utils/AppError';

/**
 * Validates a model portfolio's structural invariants. Business-rule
 * validation lives here (not in the HTTP schema layer) because it depends
 * on cross-field relationships between portfolio entries, not just shape.
 */
function assertValidPortfolio(portfolio: ModelPortfolioItem[], toleranceInPoints: number): void {
  if (portfolio.length === 0) {
    throw new ValidationError('Model portfolio must contain at least one stock.');
  }

  const seen = new Set<string>();
  for (const item of portfolio) {
    const symbol = item.symbol.trim().toUpperCase();
    if (seen.has(symbol)) {
      throw new ValidationError(`Duplicate symbol "${symbol}" in model portfolio.`);
    }
    seen.add(symbol);

    if (item.weight <= 0 || item.weight > 100) {
      throw new ValidationError(
        `Weight for "${symbol}" must be greater than 0 and less than or equal to 100.`,
      );
    }

    if (item.price !== undefined && item.price <= 0) {
      throw new ValidationError(`Price override for "${symbol}" must be a positive number.`);
    }
  }

  const totalWeight = portfolio.reduce((sum, item) => sum + item.weight, 0);
  if (Math.abs(totalWeight - 100) > toleranceInPoints) {
    throw new ValidationError(
      `Model portfolio weights must sum to 100% (got ${totalWeight}%).`,
      { totalWeight },
    );
  }
}

export interface SplitOrderOptions {
  quantityDecimalPlaces: number;
  defaultStockPrice: number;
  portfolioWeightTolerance: number;
  /** Injectable for deterministic testing; defaults to "now". */
  now?: Date;
}

/**
 * Splits a total order amount across a model portfolio's constituents,
 * resolving each stock's price (partner-supplied market price takes
 * priority over the platform's fixed default), the quantity of shares to
 * buy/sell at the configured precision, and the next valid execution date.
 *
 * Pure function: no I/O, no persistence. Callers (the service layer) are
 * responsible for assigning an order id and persisting the result.
 */
export function splitOrder(input: SplitOrderInput, options: SplitOrderOptions): SplitOrderResult {
  const { side, amount, portfolio } = input;
  const { quantityDecimalPlaces, defaultStockPrice, portfolioWeightTolerance, now = new Date() } =
    options;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError('Order amount must be a positive number.');
  }

  assertValidPortfolio(portfolio, portfolioWeightTolerance);

  const totalAmount = new Decimal(amount);
  let allocatedTotal = new Decimal(0);

  const allocations: OrderAllocation[] = portfolio.map((item) => {
    const symbol = item.symbol.trim().toUpperCase();
    const priceUsed = item.price ?? defaultStockPrice;
    const priceSource = item.price !== undefined ? 'REQUEST' : 'DEFAULT';

    const targetAmount = totalAmount.times(item.weight).dividedBy(100);
    const quantity = roundQuantity(targetAmount.dividedBy(priceUsed), quantityDecimalPlaces);
    const actualAmount = new Decimal(quantity).times(priceUsed);

    allocatedTotal = allocatedTotal.plus(actualAmount);

    return {
      symbol,
      weight: item.weight,
      priceUsed,
      priceSource,
      targetAmount: roundCurrency(targetAmount),
      quantity,
      actualAmount: roundCurrency(actualAmount),
    };
  });

  const executionDate = toIsoDate(nextTradingDay(now));
  const residualCash = roundCurrency(totalAmount.minus(allocatedTotal));

  return {
    orderId: uuid(),
    side,
    totalAmount: roundCurrency(totalAmount),
    requestedAt: now.toISOString(),
    executionDate,
    quantityDecimalPlaces,
    allocations,
    residualCash,
  };
}
