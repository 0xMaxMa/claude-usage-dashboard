export const CONFIG = {
  PORT: process.env.PORT || 3737,
  SCRAPE_INTERVAL_MIN: parseInt(process.env.SCRAPE_INTERVAL_MIN) || 5,
  SESSION_KEY: process.env.SESSION_KEY || '',
  ORG_ID: process.env.ORG_ID || '',
}
