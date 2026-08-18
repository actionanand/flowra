import { inject, Injectable } from '@angular/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
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
    if (Capacitor.isNativePlatform()) {
      const result = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      return result.uri;
    }
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return filename;
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
      throw error;
    }
    return {
      profiles: data.profiles.length,
      periods: data.periods.length,
      logs: data.dailyLogs.length,
    };
  }

  private async replaceSnapshot(data: AppSnapshot): Promise<void> {
    await Promise.all([
      this.repository.replaceAll('profiles', data.profiles),
      this.repository.replaceAll('periods', data.periods),
      this.repository.replaceAll('daily_logs', data.dailyLogs),
      this.repository.replaceAll('health_events', data.healthEvents),
      this.repository.replaceAll('cycle_predictions', data.predictions),
      this.repository.replaceAll('notification_settings', data.notificationSettings),
      this.repository.replaceAll('app_settings', [data.appSettings]),
    ]);
  }
}
