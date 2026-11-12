// One-time copy of ALL data from Upstash Redis -> PostgreSQL.
// Run on the AWS server from the server/ folder:
//   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... DATABASE_URL=... node migrate-upstash-to-pg.js
// It only READS from Upstash (nothing is deleted there), so it is safe to re-run.
const { Pool } = require('pg');

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const DB_URL = process.env.DATABASE_URL;
const KEY = 'cbookssheet_data';

if (!URL_ || !TOKEN || !DB_URL) {
  console.error('Set UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN and DATABASE_URL first.');
  process.exit(1);
}

(async () => {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['GET', KEY]),
  });
  const { result } = await res.json();
  if (!result) { console.error('No data found in Upstash under key', KEY); process.exit(1); }
  const data = JSON.parse(result);

  const pool = new Pool({ connectionString: DB_URL });
  await pool.query(`CREATE TABLE IF NOT EXISTS app_data (
    key text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
  await pool.query(
    `INSERT INTO app_data (key, data, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [KEY, JSON.stringify(data)]
  );
  const counts = Object.entries(data).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k}: ${v.length}`);
  console.log('Copied OK ->', counts.join(', '));
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });