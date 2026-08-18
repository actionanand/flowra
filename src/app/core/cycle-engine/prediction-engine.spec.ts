import { addCalendarDays, calendarDaysBetween } from '../utils/calendar-date';
import { Period, ReproductiveStage } from '../models/app.models';
import { PredictionEngine } from './prediction-engine';

function periodsFromLengths(
  lengths: readonly number[],
  stage: ReproductiveStage = 'ADULT_REPRODUCTIVE',
): readonly Period[] {
  let date = '2025-01-01';
  const starts = [date];
  for (const length of lengths) {
    date = addCalendarDays(date, length);
    starts.push(date);
  }
  return starts.map((startDate, index) => ({
    id: `period-${index}`,
    profileId: 'profile',
    startDate,
    endDate: addCalendarDays(startDate, 4),
    confirmed: true,
    excludedFromPrediction: false,
    predictionEpoch: stage === 'POSTPARTUM' ? 'POSTPARTUM_1' : 'NORMAL',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  }));
}

describe('PredictionEngine', () => {
  const engine = new PredictionEngine();

  it('keeps a stable profile close to 28–29 days', () => {
    const result = engine.predict(
      'profile',
      periodsFromLengths([28, 28, 29, 28, 28, 29, 28]),
      'ADULT_REPRODUCTIVE',
    );
    expect(result.prediction?.predictedCycleLength).toBeGreaterThanOrEqual(28);
    expect(result.prediction?.predictedCycleLength).toBeLessThanOrEqual(29);
  });

  it('does not let one real outlier drag the estimate toward 52', () => {
    const result = engine.predict(
      'profile',
      periodsFromLengths([28, 29, 28, 52, 29, 28, 29]),
      'ADULT_REPRODUCTIVE',
    );
    expect(result.prediction?.predictedCycleLength).toBeLessThanOrEqual(31);
    expect(result.debug.cyclesUsed).toContain(52);
  });

  it('widens the window and lowers confidence for variable cycles', () => {
    const stable = engine.predict(
      'profile',
      periodsFromLengths([28, 28, 29, 28, 28, 29, 28]),
      'ADULT_REPRODUCTIVE',
    ).prediction!;
    const variable = engine.predict(
      'profile',
      periodsFromLengths([26, 34, 29, 39, 27, 35, 31]),
      'ADULT_REPRODUCTIVE',
    ).prediction!;
    expect(calendarDaysBetween(variable.windowStart, variable.windowEnd)).toBeGreaterThan(
      calendarDaysBetween(stable.windowStart, stable.windowEnd),
    );
    expect(['VERY_LOW', 'LOW']).toContain(variable.confidence);
  });

  it('pauses prediction for pregnancy and pre-menarche', () => {
    const history = periodsFromLengths([28, 29, 28, 28]);
    expect(engine.predict('profile', history, 'PREGNANT').prediction).toBeUndefined();
    expect(engine.predict('profile', history, 'PRE_MENARCHE').prediction).toBeUndefined();
  });

  it('uses calendar arithmetic across leap day and year boundaries', () => {
    expect(calendarDaysBetween('2024-02-01', '2024-03-01')).toBe(29);
    expect(addCalendarDays('2025-12-20', 20)).toBe('2026-01-09');
  });
});
