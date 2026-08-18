import { CUSTOM_ELEMENTS_SCHEMA, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AppSettings, ThemePreference } from '../../core/models/app.models';
import { AppStore } from '../../core/services/app-store.service';
import { BackupService } from '../../core/services/backup.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  SelectPicker,
  SelectPickerOption,
} from '../../shared/components/select-picker/select-picker';
import { SecurityService } from '../../core/services/security.service';
import { NativeIntegrationService } from '../../core/services/native-integration.service';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, SelectPicker],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss', './settings.fields.scss'],
})
export class SettingsPage {
  protected readonly store = inject(AppStore);
  private readonly backup = inject(BackupService);
  private readonly notificationService = inject(NotificationService);
  private readonly security = inject(SecurityService);
  protected readonly native = inject(NativeIntegrationService);
  protected readonly password = new FormControl('', { nonNullable: true });
  protected readonly newPin = new FormControl('', { nonNullable: true });
  protected readonly biometricPin = new FormControl('', { nonNullable: true });
  protected readonly status = signal('');
  protected readonly busy = signal(false);
  protected readonly themeOptions: readonly SelectPickerOption[] = [
    { value: 'LIGHT', label: 'Light', icon: 'sunny-outline' },
    { value: 'DARK', label: 'Dark', icon: 'moon-outline' },
    {
      value: 'AUTOMATIC',
      label: 'Automatic',
      detail: 'Follow device',
      icon: 'phone-portrait-outline',
    },
  ];
  protected readonly reminderOptions: readonly SelectPickerOption[] = [7, 5, 3, 2, 1, 0].map(
    (days) => ({
      value: String(days),
      label: days === 0 ? 'On predicted day' : `${days} day${days === 1 ? '' : 's'} before`,
    }),
  );
  protected setTheme(value: string): void {
    void this.store.updateSettings({ ...this.store.settings(), theme: value as ThemePreference });
  }
  protected async configurePin(): Promise<void> {
    try {
      if (this.store.settings().pinEnabled) {
        this.native.disableBiometric();
        await this.store.updateSettings({
          ...this.store.settings(),
          pinEnabled: false,
          biometricEnabled: false,
          pinSalt: undefined,
          pinVerifier: undefined,
        });
        this.status.set('App PIN and biometric unlock disabled.');
        return;
      }
      const result = await this.security.createPin(this.newPin.value);
      await this.store.updateSettings({ ...this.store.settings(), pinEnabled: true, ...result });
      this.newPin.setValue('');
      this.status.set('App PIN enabled.');
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : 'Could not configure PIN.');
    }
  }
  protected async configureBiometric(): Promise<void> {
    const settings = this.store.settings();
    if (settings.biometricEnabled) {
      this.native.disableBiometric();
      await this.store.updateSettings({ ...settings, biometricEnabled: false });
      this.status.set('Biometric unlock disabled.');
      return;
    }
    if (
      !(await this.security.verifyPin(
        this.biometricPin.value,
        settings.pinSalt,
        settings.pinVerifier,
      ))
    ) {
      this.status.set('Enter the current app PIN to enable biometric unlock.');
      return;
    }
    this.busy.set(true);
    try {
      await this.native.enableBiometric(this.biometricPin.value);
      await this.store.updateSettings({ ...settings, biometricEnabled: true });
      this.biometricPin.setValue('');
      this.status.set('Biometric unlock enabled on this Android device.');
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : 'Biometric setup failed.');
    } finally {
      this.busy.set(false);
    }
  }
  protected async toggle(
    key: keyof Pick<
      AppSettings,
      'lockWhenBackgrounded' | 'screenshotBlocking' | 'hideRecentPreview'
    >,
  ): Promise<void> {
    const updated = { ...this.store.settings(), [key]: !this.store.settings()[key] };
    await this.store.updateSettings(updated);
    if (key === 'screenshotBlocking' || key === 'hideRecentPreview')
      this.native.setScreenshotProtection(updated.screenshotBlocking || updated.hideRecentPreview);
  }
  protected async setReminderDays(value: string): Promise<void> {
    const profile = this.store.activeProfile();
    if (!profile) return;
    await this.store.updateReminder({
      ...this.store.reminderFor(profile.id),
      daysBefore: Number(value),
    });
  }
  protected async toggleReminder(key: 'enabled' | 'privacyMode'): Promise<void> {
    const profile = this.store.activeProfile();
    if (!profile) return;
    const setting = this.store.reminderFor(profile.id);
    if (
      key === 'enabled' &&
      !setting.enabled &&
      !(await this.notificationService.requestPermission())
    ) {
      this.status.set('Notification permission was not granted.');
      return;
    }
    await this.store.updateReminder({ ...setting, [key]: !setting[key] });
  }
  protected async createBackup(): Promise<void> {
    if (this.password.value.length < 8) {
      this.status.set('Enter at least 8 characters for the backup password.');
      return;
    }
    this.busy.set(true);
    try {
      const target = await this.backup.save(await this.backup.create(this.password.value));
      this.status.set(`Encrypted backup saved: ${target}`);
    } catch (error) {
      this.status.set(error instanceof Error ? error.message : 'Backup failed.');
    } finally {
      this.busy.set(false);
    }
  }
  protected async restore(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || this.password.value.length < 8) {
      this.status.set('Choose a backup and enter its password.');
      return;
    }
    this.busy.set(true);
    try {
      const summary = await this.backup.restore(await file.text(), this.password.value);
      this.status.set(
        `Restored ${summary.profiles} profiles, ${summary.periods} periods and ${summary.logs} daily logs. Reopen Flowra to refresh.`,
      );
    } catch (error) {
      this.status.set(
        error instanceof Error ? error.message : 'Restore failed without changing existing data.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
