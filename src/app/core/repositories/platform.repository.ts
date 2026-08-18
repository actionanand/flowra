import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { IndexedDbService } from '../database/indexed-db.service';
import { SqliteService } from '../database/sqlite.service';
import { RecordKind } from '../models/app.models';
import type { LocalRecordRepository } from './repository.contracts';

@Injectable({ providedIn: 'root' })
export class PlatformRepository implements LocalRecordRepository {
  private readonly indexedDb = inject(IndexedDbService);
  private readonly sqlite = inject(SqliteService);
  private readonly repository = Capacitor.isNativePlatform() ? this.sqlite : this.indexedDb;

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
}
