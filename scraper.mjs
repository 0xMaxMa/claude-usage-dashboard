import { CONFIG } from './config.mjs';

export async function fetchUsage(sessionKey, orgId) {
  // Support legacy call with no args (use CONFIG defaults)
  sessionKey = sessionKey ?? CONFIG.SESSION_KEY;
  orgId = orgId ?? CONFIG.ORG_ID;

  const url = `https://api.anthropic.com/api/organizations/${orgId}/usage`;
  const res = await fetch(url, {
    headers: {
      'Cookie': `sessionKey=${sessionKey}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122.0 Safari/537.36',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
  }

  const raw = await res.json();

  return {
    session_pct: raw.five_hour?.utilization ?? null,
    weekly_pct: raw.seven_day?.utilization ?? null,
    sonnet_pct: raw.seven_day_sonnet?.utilization ?? null,
    session_resets_at: raw.five_hour?.resets_at ?? null,
    weekly_resets_at: raw.seven_day?.resets_at ?? null,
    raw,
  };
}

export async function fetchClaudeStatus() {
  try {
    const res = await fetch('https://status.claude.com/api/v2/summary.json', {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`Status API error: ${res.status}`);
    const raw = await res.json();

    const allowedComponents = [
      'claude.ai',
      'Claude API (api.anthropic.com)',
      'Claude Code',
      'platform.claude.com',
    ];

    const components = (raw.components || [])
      .filter(c => allowedComponents.includes(c.name))
      .map(c => ({ name: c.name, status: c.status }));

    const incidents = (raw.incidents || []).map(i => ({ name: i.name, status: i.status }));

    return {
      indicator: raw.status?.indicator ?? 'none',
      description: raw.status?.description ?? 'All Systems Operational',
      components,
      incidents,
      fetched_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Claude status fetch failed:', err.message);
    return null;
  }
}
