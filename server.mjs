import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.mjs';
import { fetchUsage, fetchClaudeStatus } from './scraper.mjs';
import { saveSnapshot, getLatest, getHistory, getHistoryHourly, getTotalCount } from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let lastFetchedAt = null;
let nextFetchAt = null;
let latestClaudeStatus = null;
let scrapeIntervalHandle = null;

// Per-account scrape state
const accountState = {};
for (const acc of CONFIG.ACCOUNTS) {
  accountState[acc.id] = { lastFetchedAt: null, nextFetchAt: null };
}

function getAccountId(req) {
  const qid = req.query.account;
  if (qid && CONFIG.ACCOUNTS.find(a => a.id === qid)) return qid;
  return CONFIG.ACCOUNTS[0]?.id || 'default';
}

async function doScrapeAccount(account) {
  const data = await fetchUsage(account.sessionKey, account.orgId);
  saveSnapshot(data, account.id);
  const now = new Date().toISOString();
  const intervalMs = CONFIG.SCRAPE_INTERVAL_MIN * 60 * 1000;
  accountState[account.id].lastFetchedAt = now;
  accountState[account.id].nextFetchAt = new Date(Date.now() + intervalMs).toISOString();
  console.log(`[${now}] [${account.name}] Fetched: session=${data.session_pct}% weekly=${data.weekly_pct}% sonnet=${data.sonnet_pct}%`);
  return data;
}

async function doScrape() {
  try {
    // Scrape all accounts in parallel + claude status
    const [claudeStatusResult, ...accountResults] = await Promise.allSettled([
      fetchClaudeStatus(),
      ...CONFIG.ACCOUNTS.map(acc => doScrapeAccount(acc)),
    ]);

    if (claudeStatusResult.status === 'fulfilled' && claudeStatusResult.value) {
      latestClaudeStatus = claudeStatusResult.value;
    }

    // Update legacy fields from first account
    const firstResult = accountResults[0];
    if (firstResult?.status === 'fulfilled') {
      lastFetchedAt = accountState[CONFIG.ACCOUNTS[0].id].lastFetchedAt;
      nextFetchAt = accountState[CONFIG.ACCOUNTS[0].id].nextFetchAt;
    }

    // Log errors per account
    accountResults.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Scrape failed for [${CONFIG.ACCOUNTS[i].name}]:`, r.reason?.message);
      }
    });

    return firstResult?.value;
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

app.get('/api/accounts', (req, res) => {
  res.json(CONFIG.ACCOUNTS.map(a => ({ id: a.id, name: a.name })));
});

app.get('/api/usage', (req, res) => {
  const accountId = getAccountId(req);
  const latest = getLatest(accountId);
  if (!latest) return res.json({ ok: false, data: null });
  const state = accountState[accountId] || {};
  res.json({
    ok: true,
    data: {
      ...latest,
      raw: latest.raw_json ? JSON.parse(latest.raw_json) : null,
    },
    last_fetched_at: state.lastFetchedAt || lastFetchedAt,
    next_fetch_at: state.nextFetchAt || nextFetchAt,
    claude_status: latestClaudeStatus,
    account_id: accountId,
  });
});

app.get('/api/history', (req, res) => {
  const accountId = getAccountId(req);
  const rows = getHistoryHourly(accountId);
  res.json({ ok: true, data: rows, account_id: accountId });
});

app.post('/api/scrape', async (req, res) => {
  try {
    await doScrape();
    const accountId = getAccountId(req);
    const latest = getLatest(accountId);
    const state = accountState[accountId] || {};
    res.json({
      ok: true,
      data: {
        ...latest,
        raw: latest?.raw_json ? JSON.parse(latest.raw_json) : null,
      },
      last_fetched_at: state.lastFetchedAt || lastFetchedAt,
      next_fetch_at: state.nextFetchAt || nextFetchAt,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  const accountId = getAccountId(req);
  const state = accountState[accountId] || {};
  res.json({
    ok: true,
    last_fetched_at: state.lastFetchedAt || lastFetchedAt,
    next_fetch_at: state.nextFetchAt || nextFetchAt,
    total_snapshots: getTotalCount(accountId),
    claude_status: latestClaudeStatus,
    accounts: CONFIG.ACCOUNTS.map(a => ({ id: a.id, name: a.name })),
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/rpg-preview', (req, res) => {
  import('fs').then(({readFileSync}) => {
    let html = readFileSync(new URL('./public/index.html', import.meta.url)).toString();
    html = html.replace('data-theme="default"', 'data-theme="rpg"');
    html = html.replace('<head>', '<head><script>localStorage.setItem("claude-usage-theme","rpg");</script>');
    res.send(html);
  });
});

app.listen(CONFIG.PORT, () => {
  console.log(`Claude Usage Dashboard running on http://localhost:${CONFIG.PORT}`);
  console.log(`Accounts configured: ${CONFIG.ACCOUNTS.map(a => a.name).join(', ')}`);
  startScrapeLoop();
});
