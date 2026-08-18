import { Period, PredictionEpoch } from '../models/app.models';
import { calendarDaysBetween } from '../utils/calendar-date';

export interface NormalizedCycles {
  readonly lengths: readonly number[];
  readonly periodIds: readonly string[];
  readonly excluded: readonly { readonly periodId: string; readonly reason: string }[];
  readonly epoch: PredictionEpoch;
}

export function normalizeCycles(periods: readonly Period[]): NormalizedCycles {
  const ordered = [...periods]
    .filter((period) => period.confirmed)
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
  const latestEpoch = ordered.at(-1)?.predictionEpoch ?? 'NORMAL';
  const epochPeriods = ordered.filter((period) => period.predictionEpoch === latestEpoch);
  const lengths: number[] = [];
  const periodIds: string[] = [];
  const excluded: { periodId: string; reason: string }[] = [];

  for (let index = 0; index < epochPeriods.length - 1; index += 1) {
    const current = epochPeriods[index];
    const next = epochPeriods[index + 1];
    const length = calendarDaysBetween(current.startDate, next.startDate);
    if (current.excludedFromPrediction) {
      excluded.push({ periodId: current.id, reason: current.exclusionReason ?? 'User excluded' });
      continue;
    }
    if (length === 0) {
      excluded.push({ periodId: current.id, reason: 'Duplicate period start' });
      continue;
    }
    if (length < 10 || length > 180) {
      excluded.push({ periodId: current.id, reason: 'Impossible or corrupted cycle length' });
      continue;
    }
    lengths.push(length);
    periodIds.push(current.id);
  }

  return {
    lengths: lengths.slice(-18),
    periodIds: periodIds.slice(-18),
    excluded,
    epoch: latestEpoch,
  };
}
