import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.mjs';
import { fetchUsage, fetchClaudeStatus } from './scraper.mjs';
import { saveSnapshot, getLatest, getHistory, getTotalCount } from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let lastFetchedAt = null;
let nextFetchAt = null;
let latestClaudeStatus = null;
let scrapeIntervalHandle = null;

async function doScrape() {
  try {
    const [dataResult, claudeStatusResult] = await Promise.allSettled([fetchUsage(), fetchClaudeStatus()]);
    if (dataResult.status === 'rejected') throw dataResult.reason;
    const data = dataResult.value;
    if (claudeStatusResult.status === 'fulfilled' && claudeStatusResult.value) {
      latestClaudeStatus = claudeStatusResult.value;
    }
    saveSnapshot(data);
    lastFetchedAt = new Date().toISOString();
    const intervalMs = CONFIG.SCRAPE_INTERVAL_MIN * 60 * 1000;
    nextFetchAt = new Date(Date.now() + intervalMs).toISOString();
    console.log(`[${lastFetchedAt}] Fetched: session=${data.session_pct}% weekly=${data.weekly_pct}% sonnet=${data.sonnet_pct}%`);
    return data;
  } catch (err) {
    console.error('Scrape failed:', err.message);
    throw err;
  }
}

function startScrapeLoop() {
  doScrape().catch(() => {});
  const intervalMs = CONFIG.SCRAPE_INTERVAL_MIN * 60 * 1000;
  scrapeIntervalHandle = setInterval(() => {
    doScrape().catch(() => {});
  }, intervalMs);
}

// Routes
app.get('/api/usage', (req, res) => {
  const latest = getLatest();
  if (!latest) return res.json({ ok: false, data: null });
  res.json({
    ok: true,
    data: {
      ...latest,
      raw: latest.raw_json ? JSON.parse(latest.raw_json) : null,
    },
    last_fetched_at: lastFetchedAt,
    next_fetch_at: nextFetchAt,
    claude_status: latestClaudeStatus,
  });
});

app.get('/api/history', (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  const rows = getHistory(hours);
  res.json({ ok: true, data: rows });
});

app.post('/api/scrape', async (req, res) => {
  try {
    const data = await doScrape();
    const latest = getLatest();
    res.json({
      ok: true,
      data: {
        ...latest,
        raw: latest.raw_json ? JSON.parse(latest.raw_json) : null,
      },
      last_fetched_at: lastFetchedAt,
      next_fetch_at: nextFetchAt,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    last_fetched_at: lastFetchedAt,
    next_fetch_at: nextFetchAt,
    total_snapshots: getTotalCount(),
    claude_status: latestClaudeStatus,
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(CONFIG.PORT, () => {
  console.log(`Claude Usage Dashboard running on http://localhost:${CONFIG.PORT}`);
  startScrapeLoop();
});
