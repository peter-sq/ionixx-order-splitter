export type OrderSide = 'BUY' | 'SELL';

export type PriceSource = 'REQUEST' | 'DEFAULT';

/**
 * A single constituent of a partner's model portfolio, as supplied on the
 * request. `weight` is a percentage in the range (0, 100]. `price`, when
 * present, is the partner-supplied market price and takes priority over
 * the platform's fixed default price.
 */
export interface ModelPortfolioItem {
  symbol: string;
  weight: number;
  price?: number;
}

/** Fully resolved per-symbol breakdown returned to the caller. */
export interface OrderAllocation {
  symbol: string;
  weight: number;
  priceUsed: number;
  priceSource: PriceSource;
  targetAmount: number;
  quantity: number;
  actualAmount: number;
}

export interface SplitOrderInput {
  side: OrderSide;
  amount: number;
  portfolio: ModelPortfolioItem[];
}

export interface SplitOrderResult {
  orderId: string;
  side: OrderSide;
  totalAmount: number;
  requestedAt: string;
  executionDate: string;
  quantityDecimalPlaces: number;
  allocations: OrderAllocation[];
  /**
   * Cash left unallocated because share quantities were rounded down to
   * the configured precision. Surfaced explicitly rather than hidden so
   * callers can decide how to handle rounding drift (e.g. carry forward,
   * reinvest, or return to the end user).
   */
  residualCash: number;
}
