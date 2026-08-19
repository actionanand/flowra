import { DOCUMENT } from '@angular/common';
import { Injectable, signal, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AppLanguage } from '../models/app.models';
import { TRANSLATIONS } from './translations';

export interface LanguageOption {
  readonly code: AppLanguage;
  readonly nativeName: string;
  readonly englishName: string;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamizh' },
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'sa', nativeName: 'संस्कृतम्', englishName: 'Sanskrit' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu' },
  { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi' },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam' },
  { code: 'gu', nativeName: 'ગુજરાતી', englishName: 'Gujarati' },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali' },
  { code: 'ur', nativeName: 'اردو', englishName: 'Urdu' },
  { code: 'or', nativeName: 'ଓଡ଼ିଆ', englishName: 'Odia' },
  { code: 'pa', nativeName: 'ਪੰਜਾਬੀ', englishName: 'Punjabi' },
  { code: 'si', nativeName: 'සිංහල', englishName: 'Sinhala' },
  { code: 'zh-Hans', nativeName: '简体中文', englishName: 'Simplified Chinese' },
  { code: 'zh-Hant', nativeName: '繁體中文', englishName: 'Traditional Chinese' },
  { code: 'fr', nativeName: 'Français', englishName: 'French' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic' },
  { code: 'cs', nativeName: 'Čeština', englishName: 'Czech' },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian' },
  { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean' },
] as const;

export function isAppLanguage(value: string): value is AppLanguage {
  return LANGUAGE_OPTIONS.some((option) => option.code === value);
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  readonly language = signal<AppLanguage>('en');

  constructor() {
    const translate = this.translate;

    for (const option of LANGUAGE_OPTIONS) {
      translate.setTranslation(option.code, TRANSLATIONS[option.code]);
    }
    translate.setFallbackLang('en');
    translate.use('en');
  }

  setLanguage(language: AppLanguage): void {
    this.language.set(language);
    this.translate.use(language);
    this.document.documentElement.lang = language;
    this.document.documentElement.dir = language === 'ur' || language === 'ar' ? 'rtl' : 'ltr';
  }

  text(key: string, parameters?: Record<string, string | number>): string {
    return String(this.translate.instant(key, parameters));
  }
}
