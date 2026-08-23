import { InjectionToken, inject } from '@angular/core';
import { AppSnapshot, RecordKind } from '../models/app.models';
import { PlatformRepository } from './platform.repository';

export interface LocalRecordRepository {
  list<T>(kind: RecordKind): Promise<readonly T[]>;
  put<T extends { readonly id: string }>(kind: RecordKind, value: T): Promise<void>;
  remove(kind: RecordKind, id: string): Promise<void>;
  replaceAll<T extends { readonly id: string }>(
    kind: RecordKind,
    values: readonly T[],
  ): Promise<void>;
  replaceSnapshot?(snapshot: AppSnapshot): Promise<void>;
}

export const LOCAL_RECORD_REPOSITORY = new InjectionToken<LocalRecordRepository>(
  'LOCAL_RECORD_REPOSITORY',
  {
    providedIn: 'root',
    factory: () => inject(PlatformRepository),
  },
);
