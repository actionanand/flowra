import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfDay } from 'date-fns';
import { enUS, hi, ta } from 'date-fns/locale';

export type CalendarLanguage = 'en' | 'hi' | 'ta';

export function parseCalendarDate(value: string): Date {
  const parsed = startOfDay(parseISO(value));
  if (!isValid(parsed)) throw new Error(`Invalid calendar date: ${value}`);
  return parsed;
}

export function calendarDaysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseCalendarDate(to), parseCalendarDate(from));
}

export function addCalendarDays(value: string, days: number): string {
  return format(addDays(parseCalendarDate(value), days), 'yyyy-MM-dd');
}

export function todayCalendarDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function displayDate(
  value: string,
  pattern = 'd MMM yyyy',
  language: CalendarLanguage = 'en',
): string {
  const locale = language === 'ta' ? ta : language === 'hi' ? hi : enUS;
  return format(parseCalendarDate(value), pattern, { locale });
}
