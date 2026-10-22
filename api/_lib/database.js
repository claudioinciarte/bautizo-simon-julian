import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function createResponseStore(path) {
  const databasePath = resolve(path);
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS responses (
      response_id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL,
      sheets_status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS responses_pending ON responses(sheets_status, updated_at);
  `);

  const select = db.prepare('SELECT data FROM responses WHERE response_id = ?');
  const upsert = db.prepare(`
    INSERT INTO responses (response_id, revision, sheets_status, updated_at, data)
    VALUES (@responseId, @revision, @sheetsStatus, @updatedAt, @data)
    ON CONFLICT(response_id) DO UPDATE SET
      revision = excluded.revision,
      sheets_status = excluded.sheets_status,
      updated_at = excluded.updated_at,
      data = excluded.data
    WHERE excluded.revision > responses.revision
      OR (excluded.revision = responses.revision
        AND (responses.sheets_status != 'synced' OR excluded.sheets_status = 'synced'))
  `);
  const pending = db.prepare(`
    SELECT data FROM responses WHERE sheets_status != 'synced'
    ORDER BY updated_at ASC LIMIT ?
  `);

  return {
    get(responseId) {
      const row = select.get(responseId);
      return row ? JSON.parse(row.data) : null;
    },
    save(record) {
      upsert.run({
        responseId: record.responseId,
        revision: record.revision,
        sheetsStatus: record.sheets?.status || 'pending',
        updatedAt: record.sheets?.lastAttemptAt || record.submittedAt,
        data: JSON.stringify(record),
      });
    },
    listPending(limit) {
      return pending.all(limit).map((row) => JSON.parse(row.data));
    },
    close() { db.close(); },
  };
}

let store;
function defaultStore() {
  store ??= createResponseStore(process.env.DATABASE_PATH || 'data/rsvp.sqlite');
  return store;
}

export const getRecord = (responseId) => defaultStore().get(responseId);
export const saveRecord = (record) => defaultStore().save(record);
export const listPendingRecords = (limit) => defaultStore().listPending(limit);
export function closeDatabase() {
  store?.close();
  store = undefined;
}
