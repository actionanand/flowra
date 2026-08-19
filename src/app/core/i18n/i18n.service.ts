import { DOCUMENT } from '@angular/common';
import { Injectable, signal, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AppLanguage } from '../models/app.models';
import { TRANSLATIONS } from './translations';

export interface LanguageOption {
  readonly code: AppLanguage;
  readonly nativeName: string;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'ta', nativeName: 'தமிழ்' },
  { code: 'en', nativeName: 'English' },
  { code: 'sa', nativeName: 'संस्कृतम्' },
  { code: 'hi', nativeName: 'हिन्दी' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ' },
  { code: 'te', nativeName: 'తెలుగు' },
  { code: 'mr', nativeName: 'मराठी' },
  { code: 'ml', nativeName: 'മലയാളം' },
  { code: 'gu', nativeName: 'ગુજરાતી' },
  { code: 'bn', nativeName: 'বাংলা' },
  { code: 'ur', nativeName: 'اردو' },
  { code: 'or', nativeName: 'ଓଡ଼ିଆ' },
  { code: 'pa', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'si', nativeName: 'සිංහල' },
  { code: 'zh-Hans', nativeName: '简体中文' },
  { code: 'zh-Hant', nativeName: '繁體中文' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'es', nativeName: 'Español' },
  { code: 'ar', nativeName: 'العربية' },
  { code: 'cs', nativeName: 'Čeština' },
  { code: 'pt', nativeName: 'Português' },
  { code: 'de', nativeName: 'Deutsch' },
  { code: 'ru', nativeName: 'Русский' },
  { code: 'id', nativeName: 'Bahasa Indonesia' },
  { code: 'ja', nativeName: '日本語' },
  { code: 'ko', nativeName: '한국어' },
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
