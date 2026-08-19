import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfDay } from 'date-fns';
import { AppLanguage } from '../models/app.models';

const LANGUAGE_TAGS: Readonly<Record<AppLanguage, string>> = {
  en: 'en-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  ml: 'ml-IN',
  gu: 'gu-IN',
  bn: 'bn-IN',
  ur: 'ur-IN',
  or: 'or-IN',
  pa: 'pa-IN',
  si: 'si-LK',
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  fr: 'fr-FR',
  es: 'es-ES',
  ar: 'ar',
  cs: 'cs-CZ',
  pt: 'pt-PT',
  de: 'de-DE',
  ru: 'ru-RU',
  id: 'id-ID',
  ja: 'ja-JP',
  ko: 'ko-KR',
  sa: 'sa-IN',
};

const DATE_FORMATS: Readonly<Record<string, Intl.DateTimeFormatOptions>> = {
  'd MMM yyyy': { day: 'numeric', month: 'short', year: 'numeric' },
  'EEEE d MMMM yyyy': { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  'd MMMM yyyy': { day: 'numeric', month: 'long', year: 'numeric' },
  'EEEE, d MMMM': { weekday: 'long', day: 'numeric', month: 'long' },
  'd MMMM': { day: 'numeric', month: 'long' },
  'd MMM': { day: 'numeric', month: 'short' },
  'MMMM yyyy': { month: 'long', year: 'numeric' },
  'EEEE, d MMM': { weekday: 'long', day: 'numeric', month: 'short' },
};

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
  language: AppLanguage = 'en',
): string {
  return formatDisplayDate(parseCalendarDate(value), pattern, language);
}

export function formatDisplayDate(
  value: Date,
  pattern: string,
  language: AppLanguage = 'en',
): string {
  const options = DATE_FORMATS[pattern] ?? DATE_FORMATS['d MMM yyyy'];
  return new Intl.DateTimeFormat(LANGUAGE_TAGS[language], options).format(value);
}
