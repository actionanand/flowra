import { inject, Injectable } from '@angular/core';
import { CryptoService, EncryptedEnvelope } from '../crypto/crypto.service';
import { RecordKind } from '../models/app.models';
import type { LocalRecordRepository } from '../repositories/repository.contracts';

interface StoredRecord {
  readonly key: string;
  readonly kind: RecordKind;
  readonly id: string;
  readonly payload: EncryptedEnvelope;
}

const DATABASE_NAME = 'flowra-private-v1';
const RECORD_STORE = 'encrypted-records';
const META_STORE = 'secure-meta';
const KEY_ID = 'browser-encryption-key-v1';

@Injectable({ providedIn: 'root' })
export class IndexedDbService implements LocalRecordRepository {
  private readonly cryptoService = inject(CryptoService);
  private databasePromise?: Promise<IDBDatabase>;
  private keyPromise?: Promise<CryptoKey>;

  async list<T>(kind: RecordKind): Promise<readonly T[]> {
    const database = await this.database();
    const records = await this.request<readonly StoredRecord[]>((resolve, reject) => {
      const request = database
        .transaction(RECORD_STORE, 'readonly')
        .objectStore(RECORD_STORE)
        .index('kind')
        .getAll(kind);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const key = await this.encryptionKey();
    return Promise.all(records.map((record) => this.cryptoService.decrypt<T>(record.payload, key)));
  }

  async put<T extends { readonly id: string }>(kind: RecordKind, value: T): Promise<void> {
    const database = await this.database();
    const payload = await this.cryptoService.encrypt(value, await this.encryptionKey());
    await this.transaction(database, (store) =>
      store.put({ key: `${kind}:${value.id}`, kind, id: value.id, payload } satisfies StoredRecord),
    );
  }

  async remove(kind: RecordKind, id: string): Promise<void> {
    const database = await this.database();
    await this.transaction(database, (store) => store.delete(`${kind}:${id}`));
  }

  async replaceAll<T extends { readonly id: string }>(
    kind: RecordKind,
    values: readonly T[],
  ): Promise<void> {
    const database = await this.database();
    const keys = await this.request<readonly IDBValidKey[]>((resolve, reject) => {
      const request = database
        .transaction(RECORD_STORE, 'readonly')
        .objectStore(RECORD_STORE)
        .index('kind')
        .getAllKeys(kind);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const key = await this.encryptionKey();
    const records = await Promise.all(
      values.map(async (value) => ({
        key: `${kind}:${value.id}`,
        kind,
        id: value.id,
        payload: await this.cryptoService.encrypt(value, key),
      })),
    );
    await this.transaction(database, (store) => {
      for (const recordKey of keys) store.delete(recordKey);
      for (const record of records) store.put(record);
    });
  }

  private database(): Promise<IDBDatabase> {
    this.databasePromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        const records = request.result.createObjectStore(RECORD_STORE, { keyPath: 'key' });
        records.createIndex('kind', 'kind', { unique: false });
        request.result.createObjectStore(META_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.databasePromise;
  }

  private encryptionKey(): Promise<CryptoKey> {
    this.keyPromise ??= this.loadOrCreateKey();
    return this.keyPromise;
  }

  private async loadOrCreateKey(): Promise<CryptoKey> {
    const database = await this.database();
    const existing = await this.request<CryptoKey | undefined>((resolve, reject) => {
      const request = database
        .transaction(META_STORE, 'readonly')
        .objectStore(META_STORE)
        .get(KEY_ID);
      request.onsuccess = () => resolve(request.result as CryptoKey | undefined);
      request.onerror = () => reject(request.error);
    });
    if (existing) return existing;
    const key = await this.cryptoService.createKey();
    await this.request<void>((resolve, reject) => {
      const transaction = database.transaction(META_STORE, 'readwrite');
      transaction.objectStore(META_STORE).put(key, KEY_ID);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    return key;
  }

  private transaction(
    database: IDBDatabase,
    operation: (store: IDBObjectStore) => void,
  ): Promise<void> {
    return this.request((resolve, reject) => {
      const transaction = database.transaction(RECORD_STORE, 'readwrite');
      operation(transaction.objectStore(RECORD_STORE));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private request<T>(
    setup: (resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
  ): Promise<T> {
    return new Promise<T>(setup);
  }
}
