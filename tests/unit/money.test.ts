import { roundCurrency, roundQuantity } from '../../src/domain/money';

describe('roundCurrency', () => {
  it('rounds to 2 decimal places using half-up rounding', () => {
    expect(roundCurrency(59.995)).toBe(60);
    expect(roundCurrency(59.994)).toBe(59.99);
  });

  it('avoids classic floating point drift (0.1 + 0.2)', () => {
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
  });
});

describe('roundQuantity', () => {
  it('truncates (rounds down) rather than rounding to nearest', () => {
    // 1 / 3 = 0.333333... - rounding down at 3 places must not become 0.334
    expect(roundQuantity(1 / 3, 3)).toBe(0.333);
  });

  it('supports 0 decimal places (whole shares only)', () => {
    expect(roundQuantity(4.9, 0)).toBe(4);
  });

  it('supports a wider precision such as 7 decimal places', () => {
    expect(roundQuantity(10 / 3, 7)).toBe(3.3333333);
  });
});
