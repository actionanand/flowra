import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
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
import { NotificationService } from './core/services/notification.service';
import { SnackbarService } from './core/services/snackbar.service';

const NOTIFICATION_PROMPT_KEY = 'flowra.notification-permission-v1';

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
  styleUrls: ['./app.scss', './app-lock.scss', './app-overlays.scss'],
  host: {
    '(document:visibilitychange)': 'visibilityChanged()',
    '(document:keydown.escape)': 'handleEscape()',
  },
})
export class App {
  protected readonly store = inject(AppStore);
  private readonly security = inject(SecurityService);
  protected readonly native = inject(NativeIntegrationService);
  protected readonly i18n = inject(I18nService);
  private readonly notifications = inject(NotificationService);
  protected readonly snackbar = inject(SnackbarService);
  private readonly document = inject(DOCUMENT);
  protected readonly languageOptions: readonly SelectPickerOption[] = LANGUAGE_OPTIONS.map(
    ({ code, nativeName, englishName }) => ({
      value: code,
      label: `${nativeName} (${englishName})`,
    }),
  );
  protected readonly languageSetupOpen = signal(false);
  protected readonly onboardingOpen = signal(true);
  protected readonly locked = signal(false);
  protected readonly mobileNavOpen = signal(false);
  protected readonly notificationPromptOpen = signal(false);
  protected readonly notificationPermissionBusy = signal(false);
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
  private readonly notificationPermissionButton = viewChild<ElementRef<HTMLButtonElement>>(
    'notificationPermissionButton',
  );
  private notificationPromptInitialised = false;
  constructor() {
    effect(() => {
      const canPrompt =
        this.store.ready() &&
        !this.languageSetupOpen() &&
        !this.locked() &&
        this.store.profiles().length > 0;
      if (!canPrompt || this.notificationPromptInitialised) return;
      this.notificationPromptInitialised = true;
      if (!this.shouldShowNotificationPrompt()) return;
      this.notificationPromptOpen.set(true);
      queueMicrotask(() => this.notificationPermissionButton()?.nativeElement.focus());
    });
    void this.initialize();
  }
  private async initialize(): Promise<void> {
    await this.store.initialize();
    const settings = this.store.settings();
    this.i18n.setLanguage(settings.language ?? 'en');
    this.languageSetupOpen.set(!(settings.languageConfirmed ?? false));
    this.locked.set(settings.pinEnabled);
    this.native.setScreenshotProtection(settings.screenshotBlocking || settings.hideRecentPreview);
    this.native.hideSplash();
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
  protected closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }
  protected handleEscape(): void {
    if (this.notificationPromptOpen() && !this.notificationPermissionBusy()) {
      this.notificationPromptOpen.set(false);
      return;
    }
    this.closeMobileNav();
  }
  protected dismissNotificationPrompt(): void {
    if (!this.notificationPermissionBusy()) this.notificationPromptOpen.set(false);
  }
  protected async allowNotifications(): Promise<void> {
    if (this.notificationPermissionBusy()) return;
    this.markNotificationPromptHandled();
    this.notificationPromptOpen.set(false);
    this.notificationPermissionBusy.set(true);
    try {
      const granted = await this.notifications.requestPermission();
      if (granted) await this.store.rescheduleAllReminders();
    } finally {
      this.notificationPermissionBusy.set(false);
    }
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
  private shouldShowNotificationPrompt(): boolean {
    if (!this.native.isAndroid()) return false;
    try {
      return this.document.defaultView?.localStorage.getItem(NOTIFICATION_PROMPT_KEY) !== 'handled';
    } catch {
      return true;
    }
  }
  private markNotificationPromptHandled(): void {
    try {
      this.document.defaultView?.localStorage.setItem(NOTIFICATION_PROMPT_KEY, 'handled');
    } catch {
      // Android permission can still be requested when WebView storage is unavailable.
    }
  }
}
