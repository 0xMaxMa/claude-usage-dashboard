import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'data', 'usage.db'));

// Init schema
db.exec(`
  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    five_hour_pct REAL,
    seven_day_pct REAL,
    seven_day_sonnet_pct REAL,
    five_hour_resets_at TEXT,
    seven_day_resets_at TEXT,
    raw_json TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON snapshots(timestamp);
`);

// Migration: add account_id column if not exists
const cols = db.prepare("PRAGMA table_info(snapshots)").all().map(c => c.name);
if (!cols.includes('account_id')) {
  db.exec(`ALTER TABLE snapshots ADD COLUMN account_id TEXT NOT NULL DEFAULT 'default'`);
  console.log('[db] Migrated: added account_id column');
}

export function saveSnapshot(data, accountId = 'default') {
  // Cleanup old snapshots (>7 days) for this account
  db.prepare(`DELETE FROM snapshots WHERE timestamp < datetime('now', '-7 days') AND account_id = ?`).run(accountId);

  const stmt = db.prepare(`
    INSERT INTO snapshots (account_id, five_hour_pct, seven_day_pct, seven_day_sonnet_pct, five_hour_resets_at, seven_day_resets_at, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    accountId,
    data.session_pct ?? null,
    data.weekly_pct ?? null,
    data.sonnet_pct ?? null,
    data.session_resets_at ?? null,
    data.weekly_resets_at ?? null,
    JSON.stringify(data.raw ?? {})
  );
  return result.lastInsertRowid;
}

export function getLatest(accountId = 'default') {
  return db.prepare(`SELECT * FROM snapshots WHERE account_id = ? ORDER BY id DESC LIMIT 1`).get(accountId) || null;
}

export function getHistory(hours = 24, accountId = 'default') {
  return db.prepare(`
    SELECT * FROM snapshots
    WHERE timestamp >= datetime('now', '-${hours} hours')
      AND account_id = ?
    ORDER BY timestamp ASC
  `).all(accountId);
}

export function getHistoryHourly(accountId = 'default') {
  // Generate last 24 hours (hour slots) and LEFT JOIN with actual data
  // Return exactly 24 rows, one per hour, oldest first
  const rows = db.prepare(`
    WITH RECURSIVE hours(h) AS (
      SELECT 0 UNION ALL SELECT h+1 FROM hours WHERE h < 23
    ),
    hour_slots AS (
      SELECT
        strftime('%Y-%m-%d %H:00:00', datetime('now', '-' || (23-h) || ' hours')) AS slot_start,
        strftime('%Y-%m-%d %H:00:00', datetime('now', '-' || (22-h) || ' hours')) AS slot_end,
        h AS hour_index
      FROM hours
    ),
    aggregated AS (
      SELECT
        strftime('%Y-%m-%d %H:00:00', timestamp) AS hour_bucket,
        ROUND(AVG(five_hour_pct), 1) AS avg_session,
        ROUND(AVG(seven_day_pct), 1) AS avg_weekly,
        ROUND(AVG(seven_day_sonnet_pct), 1) AS avg_sonnet,
        COUNT(*) AS snapshot_count,
        MIN(five_hour_resets_at) AS session_resets_at
      FROM snapshots
      WHERE timestamp >= datetime('now', '-24 hours')
        AND account_id = ?
      GROUP BY hour_bucket
    )
    SELECT
      s.slot_start AS timestamp,
      s.hour_index,
      a.avg_session AS five_hour_pct,
      a.avg_weekly AS seven_day_pct,
      a.avg_sonnet AS seven_day_sonnet_pct,
      COALESCE(a.snapshot_count, 0) AS snapshot_count,
      a.session_resets_at
    FROM hour_slots s
    LEFT JOIN aggregated a ON a.hour_bucket = s.slot_start
    ORDER BY s.hour_index ASC
  `).all(accountId);
  return rows;
}

export function getTotalCount(accountId = 'default') {
  return db.prepare(`SELECT COUNT(*) as cnt FROM snapshots WHERE account_id = ?`).get(accountId).cnt;
}
