import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { CryptoService, PasswordEnvelope } from '../crypto/crypto.service';
import {
  AppSnapshot,
  AppSettings,
  CyclePrediction,
  DailyLog,
  DEFAULT_APP_SETTINGS,
  HealthEvent,
  NotificationSettings,
  Period,
  Profile,
} from '../models/app.models';
import { LOCAL_RECORD_REPOSITORY } from '../repositories/repository.contracts';
import { NativeIntegrationService } from './native-integration.service';
import { NotificationService } from './notification.service';

interface VersionedBackup {
  readonly format: 'flowra-data';
  readonly schemaVersion: 1;
  readonly createdAt: string;
  readonly data: AppSnapshot;
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly repository = inject(LOCAL_RECORD_REPOSITORY);
  private readonly crypto = inject(CryptoService);
  private readonly native = inject(NativeIntegrationService);
  private readonly notifications = inject(NotificationService);
  private readonly document = inject(DOCUMENT);

  async create(password: string): Promise<string> {
    const [
      profiles,
      periods,
      dailyLogs,
      healthEvents,
      predictions,
      notificationSettings,
      appSettings,
    ] = await Promise.all([
      this.repository.list<Profile>('profiles'),
      this.repository.list<Period>('periods'),
      this.repository.list<DailyLog>('daily_logs'),
      this.repository.list<HealthEvent>('health_events'),
      this.repository.list<CyclePrediction>('cycle_predictions'),
      this.repository.list<NotificationSettings>('notification_settings'),
      this.repository.list<AppSettings>('app_settings'),
    ]);
    const backup: VersionedBackup = {
      format: 'flowra-data',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      data: {
        profiles,
        periods,
        dailyLogs,
        healthEvents,
        predictions,
        notificationSettings,
        appSettings: appSettings[0] ?? DEFAULT_APP_SETTINGS,
      },
    };
    return JSON.stringify(await this.crypto.encryptWithPassword(backup, password));
  }

  async save(content: string): Promise<string> {
    const filename = `flowra-backup-${new Date().toISOString().slice(0, 10)}.flowra`;
    if (this.native.isAndroid()) {
      await this.native.saveBackup(filename, content);
      return filename;
    }
    const file = new File([content], filename, { type: 'application/json' });
    const navigatorRef = this.document.defaultView?.navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
    };
    if (navigatorRef?.share && navigatorRef.canShare?.({ files: [file] })) {
      try {
        await navigatorRef.share({ files: [file], title: 'Flowra encrypted backup' });
        return filename;
      } catch {
        // Fall through to a normal browser download.
      }
    }
    const url = URL.createObjectURL(file);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    this.document.body.append(anchor);
    anchor.click();
    anchor.remove();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    return filename;
  }

  async choose(): Promise<string> {
    if (this.native.isAndroid()) return this.native.openBackup();
    return new Promise<string>((resolve, reject) => {
      const input = this.document.createElement('input');
      input.type = 'file';
      input.accept = '.flowra,application/json';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error('No backup file was selected.'));
          return;
        }
        void file.text().then(resolve, reject);
      });
      input.click();
    });
  }

  async restore(
    content: string,
    password: string,
  ): Promise<{ profiles: number; periods: number; logs: number }> {
    const parsed = JSON.parse(content) as PasswordEnvelope;
    const backup = await this.crypto.decryptWithPassword<VersionedBackup>(parsed, password);
    if (backup.format !== 'flowra-data' || backup.schemaVersion !== 1)
      throw new Error('This is not a supported Flowra backup.');
    const data = backup.data;
    if (!Array.isArray(data.profiles) || !Array.isArray(data.periods) || !data.appSettings)
      throw new Error('Backup validation failed.');
    const safety = await Promise.all([
      this.repository.list<Profile>('profiles'),
      this.repository.list<Period>('periods'),
      this.repository.list<DailyLog>('daily_logs'),
      this.repository.list<HealthEvent>('health_events'),
      this.repository.list<CyclePrediction>('cycle_predictions'),
      this.repository.list<NotificationSettings>('notification_settings'),
      this.repository.list<AppSettings>('app_settings'),
    ]);
    try {
      await this.replaceSnapshot(data);
      await this.notifications.rebuildAfterRestore(safety[0], data);
    } catch (error) {
      await this.replaceSnapshot({
        profiles: safety[0],
        periods: safety[1],
        dailyLogs: safety[2],
        healthEvents: safety[3],
        predictions: safety[4],
        notificationSettings: safety[5],
        appSettings: safety[6][0] ?? DEFAULT_APP_SETTINGS,
      });
      await this.notifications.rebuildAfterRestore(data.profiles, {
        profiles: safety[0],
        periods: safety[1],
        dailyLogs: safety[2],
        healthEvents: safety[3],
        predictions: safety[4],
        notificationSettings: safety[5],
        appSettings: safety[6][0] ?? DEFAULT_APP_SETTINGS,
      });
      throw error;
    }
    return {
      profiles: data.profiles.length,
      periods: data.periods.length,
      logs: data.dailyLogs.length,
    };
  }

  private async replaceSnapshot(data: AppSnapshot): Promise<void> {
    // Capacitor SQLite exposes one connection. Starting these transactions in
    // parallel races the connection and fails with "Already in transaction".
    await this.repository.replaceAll('profiles', data.profiles);
    await this.repository.replaceAll('periods', data.periods);
    await this.repository.replaceAll('daily_logs', data.dailyLogs);
    await this.repository.replaceAll('health_events', data.healthEvents);
    await this.repository.replaceAll('cycle_predictions', data.predictions);
    await this.repository.replaceAll('notification_settings', data.notificationSettings);
    await this.repository.replaceAll('app_settings', [data.appSettings]);
  }
}
