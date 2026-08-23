import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { IndexedDbService } from '../database/indexed-db.service';
import { SqliteService } from '../database/sqlite.service';
import { AppSnapshot, RecordKind } from '../models/app.models';
import type { LocalRecordRepository } from './repository.contracts';

@Injectable({ providedIn: 'root' })
export class PlatformRepository implements LocalRecordRepository {
  private readonly indexedDb = inject(IndexedDbService);
  private readonly sqlite = inject(SqliteService);
  private readonly repository: LocalRecordRepository = Capacitor.isNativePlatform()
    ? this.sqlite
    : this.indexedDb;

  list<T>(kind: RecordKind): Promise<readonly T[]> {
    return this.repository.list<T>(kind);
  }
  put<T extends { readonly id: string }>(kind: RecordKind, value: T): Promise<void> {
    return this.repository.put(kind, value);
  }
  remove(kind: RecordKind, id: string): Promise<void> {
    return this.repository.remove(kind, id);
  }
  replaceAll<T extends { readonly id: string }>(
    kind: RecordKind,
    values: readonly T[],
  ): Promise<void> {
    return this.repository.replaceAll(kind, values);
  }
  replaceSnapshot(snapshot: AppSnapshot): Promise<void> {
    return this.repository.replaceSnapshot?.(snapshot) ?? this.replaceSnapshotFallback(snapshot);
  }

  private async replaceSnapshotFallback(snapshot: AppSnapshot): Promise<void> {
    await this.repository.replaceAll('profiles', snapshot.profiles);
    await this.repository.replaceAll('periods', snapshot.periods);
    await this.repository.replaceAll('daily_logs', snapshot.dailyLogs);
    await this.repository.replaceAll('health_events', snapshot.healthEvents);
    await this.repository.replaceAll('cycle_predictions', snapshot.predictions);
    await this.repository.replaceAll('notification_settings', snapshot.notificationSettings);
    await this.repository.replaceAll('app_settings', [snapshot.appSettings]);
  }
}
