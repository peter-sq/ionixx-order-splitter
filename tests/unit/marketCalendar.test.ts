import { nextTradingDay, toIsoDate } from '../../src/domain/marketCalendar';

describe('nextTradingDay', () => {
  it('returns the same date when the reference is a weekday', () => {
    const wednesday = new Date('2026-08-26T15:00:00.000Z');
    expect(toIsoDate(nextTradingDay(wednesday))).toBe('2026-08-26');
  });

  it('returns Friday unchanged', () => {
    const friday = new Date('2026-08-28T23:59:00.000Z');
    expect(toIsoDate(nextTradingDay(friday))).toBe('2026-08-28');
  });

  it('rolls Saturday forward to the following Monday', () => {
    const saturday = new Date('2026-08-29T09:00:00.000Z');
    expect(toIsoDate(nextTradingDay(saturday))).toBe('2026-08-31');
  });

  it('rolls Sunday forward to the following Monday', () => {
    const sunday = new Date('2026-08-30T09:00:00.000Z');
    expect(toIsoDate(nextTradingDay(sunday))).toBe('2026-08-31');
  });
});
