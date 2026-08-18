import { Injectable, signal, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TRANSLATIONS } from './translations';

export type AppLanguage = 'en' | 'hi' | 'ta';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly translate = inject(TranslateService);

  readonly language = signal<AppLanguage>(this.readLanguage());
  readonly languageSelected = signal(this.hasStoredLanguage());

  constructor() {
    const translate = this.translate;

    translate.setTranslation('en', TRANSLATIONS.en);
    translate.setTranslation('hi', TRANSLATIONS.hi);
    translate.setTranslation('ta', TRANSLATIONS.ta);
    translate.setFallbackLang('en');
    translate.use(this.language());
  }

  setLanguage(language: AppLanguage): void {
    this.language.set(language);
    this.languageSelected.set(true);
    localStorage.setItem('flowra-language', language);
    this.translate.use(language);
  }

  confirmLanguage(): void {
    localStorage.setItem('flowra-language-confirmed', 'true');
  }

  hasStoredLanguage(): boolean {
    return localStorage.getItem('flowra-language-confirmed') === 'true';
  }

  private readLanguage(): AppLanguage {
    const value = localStorage.getItem('flowra-language');
    return value === 'hi' || value === 'ta' ? value : 'en';
  }
}
