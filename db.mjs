import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'usage.db'));

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

export function saveSnapshot(data) {
  // Cleanup old snapshots (>7 days)
  db.prepare(`DELETE FROM snapshots WHERE timestamp < datetime('now', '-7 days')`).run();

  const stmt = db.prepare(`
    INSERT INTO snapshots (five_hour_pct, seven_day_pct, seven_day_sonnet_pct, five_hour_resets_at, seven_day_resets_at, raw_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.session_pct ?? null,
    data.weekly_pct ?? null,
    data.sonnet_pct ?? null,
    data.session_resets_at ?? null,
    data.weekly_resets_at ?? null,
    JSON.stringify(data.raw ?? {})
  );
  return result.lastInsertRowid;
}

export function getLatest() {
  return db.prepare(`SELECT * FROM snapshots ORDER BY id DESC LIMIT 1`).get() || null;
}

export function getHistory(hours = 24) {
  return db.prepare(`
    SELECT * FROM snapshots
    WHERE timestamp >= datetime('now', '-${hours} hours')
    ORDER BY timestamp ASC
  `).all();
}

export function getTotalCount() {
  return db.prepare(`SELECT COUNT(*) as cnt FROM snapshots`).get().cnt;
}
