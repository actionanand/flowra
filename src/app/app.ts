import { NgOptimizedImage } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppStore } from './core/services/app-store.service';
import { ProfileForm } from './shared/components/profile-form/profile-form';
import { SelectPicker, SelectPickerOption } from './shared/components/select-picker/select-picker';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SecurityService } from './core/services/security.service';
import { NativeIntegrationService } from './core/services/native-integration.service';

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
  protected readonly onboardingOpen = signal(true);
  protected readonly locked = signal(false);
  protected readonly unlockError = signal('');
  protected readonly unlockPin = new FormControl('', { nonNullable: true });
  protected readonly profileOptions = computed<readonly SelectPickerOption[]>(() =>
    this.store
      .profiles()
      .map((profile) => ({
        value: profile.id,
        label: profile.name,
        detail: this.titleCase(profile.relationship),
        icon: 'person-circle-outline',
      })),
  );
  protected readonly nav = [
    { path: '/home', label: 'Home', icon: 'home-outline' },
    { path: '/calendar', label: 'Calendar', icon: 'calendar-outline' },
    { path: '/log', label: 'Log', icon: 'add-circle-outline' },
    { path: '/insights', label: 'Insights', icon: 'stats-chart-outline' },
    { path: '/profiles', label: 'Profiles', icon: 'people-outline' },
    { path: '/settings', label: 'Settings', icon: 'settings-outline' },
  ];
  constructor() {
    void this.initialize();
  }
  private async initialize(): Promise<void> {
    await this.store.initialize();
    const settings = this.store.settings();
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
    } else this.unlockError.set('That PIN did not match.');
  }
  protected async unlockWithBiometric(): Promise<void> {
    try {
      const pin = await this.native.authenticateBiometric();
      const settings = this.store.settings();
      if (!(await this.security.verifyPin(pin, settings.pinSalt, settings.pinVerifier)))
        throw new Error('The saved biometric credential no longer matches this PIN.');
      this.locked.set(false);
      this.unlockError.set('');
    } catch (error) {
      this.unlockError.set(
        error instanceof Error ? error.message : 'Biometric unlock failed. Use your PIN instead.',
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
}
