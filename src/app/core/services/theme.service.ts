import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';
import { ThemePreference } from '../models/app.models';
import { NativeIntegrationService } from './native-integration.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly native = inject(NativeIntegrationService);
  readonly preference = signal<ThemePreference>('AUTOMATIC');
  private readonly media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');

  constructor() {
    effect(() => this.apply(this.preference()));
    this.media?.addEventListener('change', () => this.apply(this.preference()));
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
  }

  private apply(preference: ThemePreference): void {
    const dark =
      preference === 'DARK' || (preference === 'AUTOMATIC' && Boolean(this.media?.matches));
    this.document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
    this.document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    this.native.setDarkMode(dark);
  }
}
