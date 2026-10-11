import { describe, expect, it } from 'vitest';
import { Period } from '../models/app.models';
import { validateHistoricalPeriodRange } from './period-range';

const existingPeriod: Period = {
  id: 'existing',
  profileId: 'profile',
  startDate: '2026-08-10',
  endDate: '2026-08-14',
  confirmed: true,
  excludedFromPrediction: false,
  predictionEpoch: 'NORMAL',
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
};

describe('historical period range validation', () => {
  const today = '2026-08-28';

  it('accepts a complete non-overlapping past period', () => {
    expect(
      validateHistoricalPeriodRange('2026-07-20', '2026-07-24', today, [existingPeriod]),
    ).toBeUndefined();
  });

  it('rejects reversed and future ranges', () => {
    expect(validateHistoricalPeriodRange('2026-08-20', '2026-08-19', today, [])).toBe(
      'INVALID_RANGE',
    );
    expect(validateHistoricalPeriodRange('2026-08-27', '2026-08-29', today, [])).toBe(
      'FUTURE_DATE',
    );
  });

  it('rejects a range that overlaps an existing period', () => {
    expect(validateHistoricalPeriodRange('2026-08-08', '2026-08-11', today, [existingPeriod])).toBe(
      'OVERLAP',
    );
  });

  it('allows replacing the period with the same start date', () => {
    expect(
      validateHistoricalPeriodRange(
        '2026-08-10',
        '2026-08-15',
        today,
        [existingPeriod],
        existingPeriod.id,
      ),
    ).toBeUndefined();
  });
});
