/**
 * Centralised, validated application configuration.
 *
 * Everything that a real deployment might want to tune without touching
 * business logic (share quantity precision, fallback price, server port)
 * is read from the environment here, once, at boot time.
 */

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid number, got "${raw}"`);
  }
  return parsed;
}

export interface AppConfig {
  env: string;
  port: number;
  /**
   * Number of decimal places allowed for share quantities on buy/sell
   * orders. Configurable independently of the code so operators can widen
   * precision (e.g. 3 -> 7 decimal places) without a code change.
   */
  shareQuantityDecimalPlaces: number;
  /**
   * Fixed fallback price (USD) used for any stock in the model portfolio
   * that the partner does not supply an explicit market price for.
   */
  defaultStockPrice: number;
  /**
   * Allowed tolerance, in percentage points, when validating that a model
   * portfolio's weights sum to 100%. Guards against floating point noise
   * from callers (e.g. 33.33 + 33.33 + 33.34) without silently accepting
   * genuinely malformed portfolios.
   */
  portfolioWeightTolerance: number;
}

export const config: AppConfig = {
  env: process.env.NODE_ENV ?? 'development',
  port: readInt('PORT', 3000),
  shareQuantityDecimalPlaces: readInt('SHARE_QUANTITY_DECIMAL_PLACES', 3),
  defaultStockPrice: readInt('DEFAULT_STOCK_PRICE', 100),
  portfolioWeightTolerance: readInt('PORTFOLIO_WEIGHT_TOLERANCE', 0.01),
};

if (config.shareQuantityDecimalPlaces < 0 || config.shareQuantityDecimalPlaces > 12) {
  throw new Error('SHARE_QUANTITY_DECIMAL_PLACES must be between 0 and 12');
}

if (config.defaultStockPrice <= 0) {
  throw new Error('DEFAULT_STOCK_PRICE must be a positive number');
}
