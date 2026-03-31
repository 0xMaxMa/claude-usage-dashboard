// Load .env file manually (no dotenv dependency needed)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
(function loadEnv() {
  try {
    const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (_) {}
})();

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'account';
}

function parseAccounts() {
  const accounts = [];

  // Parse ACCOUNT_N_* format
  let i = 1;
  while (true) {
    const name = process.env[`ACCOUNT_${i}_NAME`];
    const sessionKey = process.env[`ACCOUNT_${i}_SESSION_KEY`];
    const orgId = process.env[`ACCOUNT_${i}_ORG_ID`];
    if (!name && !sessionKey && !orgId) break;
    if (sessionKey || orgId) {
      accounts.push({
        id: slugify(name || `account-${i}`),
        name: name || `Account ${i}`,
        sessionKey: sessionKey || '',
        orgId: orgId || '',
      });
    }
    i++;
  }

  // Backward compat: single SESSION_KEY + ORG_ID
  if (accounts.length === 0 && (process.env.SESSION_KEY || process.env.ORG_ID)) {
    accounts.push({
      id: 'default',
      name: 'Default',
      sessionKey: process.env.SESSION_KEY || '',
      orgId: process.env.ORG_ID || '',
    });
  }

  // Fallback: at least one placeholder account
  if (accounts.length === 0) {
    accounts.push({
      id: 'default',
      name: 'Default',
      sessionKey: '',
      orgId: '',
    });
  }

  return accounts;
}

export const CONFIG = {
  PORT: process.env.PORT || 3737,
  SCRAPE_INTERVAL_MIN: parseInt(process.env.SCRAPE_INTERVAL_MIN) || 5,
  // Legacy single-account fields (backward compat)
  SESSION_KEY: process.env.SESSION_KEY || '',
  ORG_ID: process.env.ORG_ID || '',
  // Multi-account
  ACCOUNTS: parseAccounts(),
};
