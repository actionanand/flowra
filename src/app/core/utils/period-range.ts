import { Period } from '../models/app.models';
import { parseCalendarDate } from './calendar-date';

export type HistoricalPeriodValidationError =
  'REQUIRED' | 'INVALID_DATE' | 'START_NOT_EARLIER' | 'FUTURE_DATE' | 'INVALID_RANGE' | 'OVERLAP';

export function validateHistoricalPeriodRange(
  startDate: string,
  endDate: string,
  today: string,
  periods: readonly Period[],
  ignoredPeriodId?: string,
): HistoricalPeriodValidationError | undefined {
  if (!startDate || !endDate) return 'REQUIRED';
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate)) return 'INVALID_DATE';
  if (startDate >= today) return startDate === today ? 'START_NOT_EARLIER' : 'FUTURE_DATE';
  if (endDate > today) return 'FUTURE_DATE';
  if (endDate < startDate) return 'INVALID_RANGE';

  const overlaps = periods.some((period) => {
    if (period.id === ignoredPeriodId) return false;
    const periodEnd = period.endDate ?? today;
    return period.startDate <= endDate && periodEnd >= startDate;
  });
  return overlaps ? 'OVERLAP' : undefined;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  try {
    const parsed = parseCalendarDate(value);
    return (
      parsed.getFullYear() === Number(value.slice(0, 4)) &&
      parsed.getMonth() + 1 === Number(value.slice(5, 7)) &&
      parsed.getDate() === Number(value.slice(8, 10))
    );
  } catch {
    return false;
  }
}
