import { splitOrder } from '../../src/domain/orderSplitter';
import { ValidationError } from '../../src/utils/AppError';

const baseOptions = {
  quantityDecimalPlaces: 3,
  defaultStockPrice: 100,
  portfolioWeightTolerance: 0.01,
  // Fixed Wednesday so tests are deterministic regardless of when they run.
  now: new Date('2026-08-26T10:00:00.000Z'),
};

describe('splitOrder', () => {
  it('splits the README example: $100 across AAPL 60% / TSLA 40% at the default $100 price', () => {
    const result = splitOrder(
      {
        side: 'BUY',
        amount: 100,
        portfolio: [
          { symbol: 'AAPL', weight: 60 },
          { symbol: 'TSLA', weight: 40 },
        ],
      },
      baseOptions,
    );

    expect(result.totalAmount).toBe(100);
    expect(result.allocations).toEqual([
      expect.objectContaining({
        symbol: 'AAPL',
        priceUsed: 100,
        priceSource: 'DEFAULT',
        targetAmount: 60,
        quantity: 0.6,
        actualAmount: 60,
      }),
      expect.objectContaining({
        symbol: 'TSLA',
        priceUsed: 100,
        priceSource: 'DEFAULT',
        targetAmount: 40,
        quantity: 0.4,
        actualAmount: 40,
      }),
    ]);
    expect(result.residualCash).toBe(0);
  });

  it('prioritises a partner-supplied market price over the fixed default price', () => {
    const result = splitOrder(
      {
        side: 'BUY',
        amount: 1000,
        portfolio: [
          { symbol: 'AAPL', weight: 60, price: 150.25 },
          { symbol: 'TSLA', weight: 40 },
        ],
      },
      baseOptions,
    );

    const aapl = result.allocations.find((a) => a.symbol === 'AAPL')!;
    const tsla = result.allocations.find((a) => a.symbol === 'TSLA')!;

    expect(aapl.priceUsed).toBe(150.25);
    expect(aapl.priceSource).toBe('REQUEST');
    expect(tsla.priceUsed).toBe(100);
    expect(tsla.priceSource).toBe('DEFAULT');
  });

  it('rounds share quantity down to the configured decimal precision and surfaces residual cash', () => {
    const result = splitOrder(
      {
        side: 'BUY',
        amount: 100,
        portfolio: [
          { symbol: 'AAPL', weight: 33.33, price: 7 },
          { symbol: 'TSLA', weight: 33.33, price: 7 },
          { symbol: 'MSFT', weight: 33.34, price: 7 },
        ],
      },
      { ...baseOptions, quantityDecimalPlaces: 2 },
    );

    for (const allocation of result.allocations) {
      const decimals = allocation.quantity.toString().split('.')[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(2);
    }
    // Sum of actual allocated amounts must never exceed the requested total.
    const allocatedSum = result.allocations.reduce((sum, a) => sum + a.actualAmount, 0);
    expect(allocatedSum).toBeLessThanOrEqual(100);
    expect(result.residualCash).toBeCloseTo(100 - allocatedSum, 5);
  });

  it('respects a wider configured decimal precision (e.g. 7 places)', () => {
    const result = splitOrder(
      {
        side: 'BUY',
        amount: 10,
        portfolio: [{ symbol: 'AAPL', weight: 100, price: 3 }],
      },
      { ...baseOptions, quantityDecimalPlaces: 7 },
    );

    // 10 / 3 = 3.3333333... truncated to 7 places
    expect(result.allocations[0]!.quantity).toBe(3.3333333);
  });

  it('computes the same output shape for SELL orders', () => {
    const result = splitOrder(
      {
        side: 'SELL',
        amount: 50,
        portfolio: [{ symbol: 'AAPL', weight: 100 }],
      },
      baseOptions,
    );

    expect(result.side).toBe('SELL');
    expect(result.allocations[0]!.quantity).toBe(0.5);
  });

  it('rejects a non-positive amount', () => {
    expect(() =>
      splitOrder(
        { side: 'BUY', amount: 0, portfolio: [{ symbol: 'AAPL', weight: 100 }] },
        baseOptions,
      ),
    ).toThrow(ValidationError);
  });

  it('rejects an empty portfolio', () => {
    expect(() =>
      splitOrder({ side: 'BUY', amount: 100, portfolio: [] }, baseOptions),
    ).toThrow(ValidationError);
  });

  it('rejects a portfolio with duplicate symbols', () => {
    expect(() =>
      splitOrder(
        {
          side: 'BUY',
          amount: 100,
          portfolio: [
            { symbol: 'AAPL', weight: 50 },
            { symbol: 'aapl', weight: 50 },
          ],
        },
        baseOptions,
      ),
    ).toThrow(/Duplicate symbol/);
  });

  it('rejects weights that do not sum to 100% beyond tolerance', () => {
    expect(() =>
      splitOrder(
        {
          side: 'BUY',
          amount: 100,
          portfolio: [
            { symbol: 'AAPL', weight: 60 },
            { symbol: 'TSLA', weight: 30 },
          ],
        },
        baseOptions,
      ),
    ).toThrow(/must sum to 100/);
  });

  it('accepts weights within the configured tolerance of 100%', () => {
    expect(() =>
      splitOrder(
        {
          side: 'BUY',
          amount: 100,
          portfolio: [
            { symbol: 'AAPL', weight: 33.33 },
            { symbol: 'TSLA', weight: 33.33 },
            { symbol: 'MSFT', weight: 33.34 },
          ],
        },
        baseOptions,
      ),
    ).not.toThrow();
  });

  it('rejects a non-positive price override', () => {
    expect(() =>
      splitOrder(
        {
          side: 'BUY',
          amount: 100,
          portfolio: [{ symbol: 'AAPL', weight: 100, price: -5 }],
        },
        baseOptions,
      ),
    ).toThrow(/must be a positive number/);
  });

  it('rejects an individual weight greater than 100', () => {
    expect(() =>
      splitOrder(
        { side: 'BUY', amount: 100, portfolio: [{ symbol: 'AAPL', weight: 150 }] },
        baseOptions,
      ),
    ).toThrow(ValidationError);
  });

  it('schedules execution for the same day when submitted on a weekday', () => {
    const result = splitOrder(
      { side: 'BUY', amount: 100, portfolio: [{ symbol: 'AAPL', weight: 100 }] },
      { ...baseOptions, now: new Date('2026-08-26T10:00:00.000Z') }, // Wednesday
    );
    expect(result.executionDate).toBe('2026-08-26');
  });

  it('rolls execution forward to Monday when submitted on a weekend', () => {
    const result = splitOrder(
      { side: 'BUY', amount: 100, portfolio: [{ symbol: 'AAPL', weight: 100 }] },
      { ...baseOptions, now: new Date('2026-08-29T10:00:00.000Z') }, // Saturday
    );
    expect(result.executionDate).toBe('2026-08-31'); // Monday
  });

  it('assigns each order a unique orderId', () => {
    const input = { side: 'BUY' as const, amount: 10, portfolio: [{ symbol: 'AAPL', weight: 100 }] };
    const first = splitOrder(input, baseOptions);
    const second = splitOrder(input, baseOptions);
    expect(first.orderId).not.toBe(second.orderId);
  });
});
