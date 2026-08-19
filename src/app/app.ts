import { NgOptimizedImage } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppStore } from './core/services/app-store.service';
import { ProfileForm } from './shared/components/profile-form/profile-form';
import { SelectPicker, SelectPickerOption } from './shared/components/select-picker/select-picker';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SecurityService } from './core/services/security.service';
import { NativeIntegrationService } from './core/services/native-integration.service';
import { I18nService } from './core/i18n/i18n.service';
import { isAppLanguage, LANGUAGE_OPTIONS } from './core/i18n/i18n.service';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ReactiveFormsModule,
    NgOptimizedImage,
    SelectPicker,
    ProfileForm,
    TranslatePipe,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './app.html',
  styleUrls: ['./app.scss', './app-lock.scss'],
  host: { '(document:visibilitychange)': 'visibilityChanged()' },
})
export class App {
  protected readonly store = inject(AppStore);
  private readonly security = inject(SecurityService);
  protected readonly native = inject(NativeIntegrationService);
  protected readonly i18n = inject(I18nService);
  protected readonly languageOptions: readonly SelectPickerOption[] = LANGUAGE_OPTIONS.map(
    ({ code, nativeName }) => ({ value: code, label: nativeName }),
  );
  protected readonly languageSetupOpen = signal(false);
  protected readonly onboardingOpen = signal(true);
  protected readonly locked = signal(false);
  protected readonly unlockError = signal('');
  protected readonly unlockPin = new FormControl('', { nonNullable: true });
  protected readonly unlockForm = new FormGroup({ pin: this.unlockPin });
  protected readonly profileOptions = computed<readonly SelectPickerOption[]>(() =>
    this.store.profiles().map((profile) => ({
      value: profile.id,
      label: profile.name,
      detail: `i18n.profile.${profile.relationship.toLowerCase()}`,
      icon: 'person-circle-outline',
    })),
  );
  protected readonly nav = [
    { path: '/home', label: 'nav.home', icon: 'home-outline' },
    { path: '/calendar', label: 'nav.calendar', icon: 'calendar-outline' },
    { path: '/log', label: 'nav.log', icon: 'add-circle-outline' },
    { path: '/insights', label: 'nav.insights', icon: 'stats-chart-outline' },
    { path: '/profiles', label: 'nav.profiles', icon: 'people-outline' },
    { path: '/settings', label: 'nav.settings', icon: 'settings-outline' },
  ];
  constructor() {
    void this.initialize();
  }
  private async initialize(): Promise<void> {
    await this.store.initialize();
    const settings = this.store.settings();
    this.i18n.setLanguage(settings.language ?? 'en');
    this.languageSetupOpen.set(!(settings.languageConfirmed ?? false));
    this.locked.set(settings.pinEnabled);
    this.native.setScreenshotProtection(settings.screenshotBlocking || settings.hideRecentPreview);
  }
  protected async unlock(): Promise<void> {
    const settings = this.store.settings();
    if (
      await this.security.verifyPin(this.unlockPin.value, settings.pinSalt, settings.pinVerifier)
    ) {
      this.locked.set(false);
      this.unlockError.set('');
      this.unlockPin.setValue('');
    } else this.unlockError.set(this.i18n.text('app.pinMismatch'));
  }
  protected async unlockWithBiometric(): Promise<void> {
    try {
      const pin = await this.native.authenticateBiometric();
      const settings = this.store.settings();
      if (!(await this.security.verifyPin(pin, settings.pinSalt, settings.pinVerifier)))
        throw new Error(this.i18n.text('app.biometricMismatch'));
      this.locked.set(false);
      this.unlockError.set('');
    } catch (error) {
      this.unlockError.set(
        error instanceof Error ? error.message : this.i18n.text('app.biometricFailed'),
      );
    }
  }
  protected visibilityChanged(): void {
    if (
      document.visibilityState === 'hidden' &&
      this.store.settings().pinEnabled &&
      this.store.settings().lockWhenBackgrounded
    )
      this.locked.set(true);
  }
  protected titleCase(value: string): string {
    return value
      .toLowerCase()
      .replace(
        /(^|_)([a-z])/g,
        (_, space: string, letter: string) => `${space ? ' ' : ''}${letter.toUpperCase()}`,
      );
  }
  protected chooseLanguage(value: string): void {
    if (!isAppLanguage(value)) return;
    this.i18n.setLanguage(value);
    void this.store.updateSettings({ ...this.store.settings(), language: value });
  }
  protected async confirmLanguage(): Promise<void> {
    await this.store.updateSettings({
      ...this.store.settings(),
      language: this.i18n.language(),
      languageConfirmed: true,
    });
    this.languageSetupOpen.set(false);
  }
}
