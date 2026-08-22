import { Injectable } from '@angular/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { RecordKind } from '../models/app.models';
import type { LocalRecordRepository } from '../repositories/repository.contracts';

const TABLES: readonly RecordKind[] = [
  'profiles',
  'periods',
  'daily_logs',
  'health_events',
  'cycle_predictions',
  'notification_settings',
  'app_settings',
];

@Injectable({ providedIn: 'root' })
export class SqliteService implements LocalRecordRepository {
  private databasePromise?: Promise<SQLiteDBConnection>;
  private writeQueue: Promise<void> = Promise.resolve();

  async list<T>(kind: RecordKind): Promise<readonly T[]> {
    const database = await this.database();
    const result = await database.query(`SELECT payload FROM ${kind} ORDER BY updated_at ASC`);
    return (result.values ?? []).map((row) => JSON.parse(String(row['payload'])) as T);
  }

  async put<T extends { readonly id: string }>(kind: RecordKind, value: T): Promise<void> {
    await this.enqueueWrite(async (database) => {
      await database.run(
        `INSERT OR REPLACE INTO ${kind} (id, payload, updated_at) VALUES (?, ?, ?)`,
        [value.id, JSON.stringify(value), new Date().toISOString()],
      );
    });
  }

  async remove(kind: RecordKind, id: string): Promise<void> {
    await this.enqueueWrite(async (database) => {
      await database.run(`DELETE FROM ${kind} WHERE id = ?`, [id]);
    });
  }

  async replaceAll<T extends { readonly id: string }>(
    kind: RecordKind,
    values: readonly T[],
  ): Promise<void> {
    await this.enqueueWrite(async (database) => {
      const transaction = await database.isTransactionActive();
      if (transaction.result) await database.rollbackTransaction();
      const updatedAt = new Date().toISOString();
      await database.executeTransaction([
        { statement: `DELETE FROM ${kind}` },
        ...values.map((value) => ({
          statement: `INSERT INTO ${kind} (id, payload, updated_at) VALUES (?, ?, ?)`,
          values: [value.id, JSON.stringify(value), updatedAt],
        })),
      ]);
    });
  }

  private enqueueWrite(operation: (database: SQLiteDBConnection) => Promise<void>): Promise<void> {
    const pending = this.writeQueue.then(async () => operation(await this.database()));
    this.writeQueue = pending.catch(() => undefined);
    return pending;
  }

  private database(): Promise<SQLiteDBConnection> {
    this.databasePromise ??= this.openDatabase();
    return this.databasePromise;
  }

  private async openDatabase(): Promise<SQLiteDBConnection> {
    const connection = new SQLiteConnection(CapacitorSQLite);
    const database = await connection.createConnection(
      'flowra-private',
      false,
      'no-encryption',
      1,
      false,
    );
    await database.open();
    const tables = TABLES.map(
      (table) =>
        `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);`,
    ).join('\n');
    await database.execute(`${tables}
      CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL);
      INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (1, datetime('now'));
      CREATE TABLE IF NOT EXISTS profile_reproductive_state (id TEXT PRIMARY KEY NOT NULL, profile_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS flow_logs (id TEXT PRIMARY KEY NOT NULL, daily_log_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS symptoms (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS profile_custom_symptoms (id TEXT PRIMARY KEY NOT NULL, profile_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS daily_symptoms (id TEXT PRIMARY KEY NOT NULL, daily_log_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS moods (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS daily_moods (id TEXT PRIMARY KEY NOT NULL, daily_log_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS prediction_results (id TEXT PRIMARY KEY NOT NULL, profile_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS prediction_model_scores (id TEXT PRIMARY KEY NOT NULL, prediction_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS profile_cycle_statistics (id TEXT PRIMARY KEY NOT NULL, profile_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);`);
    return database;
  }
}
