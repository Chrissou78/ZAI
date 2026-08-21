// Seeds the launch set of points-only redemption items.
// Idempotent: matches on title, so re-running updates the points price
// rather than creating duplicates. Safe to run against any environment.
//
//   node scripts/seed-points-only-items.mjs
//
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import pg from 'pg';

const ITEMS = [
  ['Key ring or credit card holder',                                    'accessories',  1000],
  ['zai glasses or zai Bernina beanie',                                 'accessories',  2000],
  ['zai ski boot backpack by EVOC',                                     'accessories',  3000],
  ['zai ski roller bag by EVOC',                                        'accessories',  4000],
  ['Round of golf for 1 person in Zuoz or Samedan',                     'experience',   6000],
  ['Guided tour of the zai manufactory in Appenzell, lunch included',    'experience',   7000],
  ['Leather weekender by 07 14',                                        'accessories',  8000],
  ['Hotel voucher at Asten Hotels worth EUR 250',                       'experience',   9000],
  ['zai Pullover',                                                      'apparel',     11000],
  ['Round of golf for 2 people in Zuoz or Samedan',                     'experience',  12000],
  ['Hotel voucher at Kulm Hotel worth CHF 500',                         'experience',  13000],
  ['Ski day with a zai ambassador including ski pass and lunch',         'experience',  14000],
];

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(process.cwd(), 'apps', 'frontend', '.env.local');
  const m = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error('DATABASE_URL not found');
  return m[1].trim();
}

const client = new pg.Client({ connectionString: databaseUrl(), ssl: false });
await client.connect();

let created = 0, updated = 0;
for (const [title, category, points] of ITEMS) {
  const existing = await client.query('SELECT id, points_price FROM deals WHERE title = $1', [title]);
  if (existing.rows.length) {
    await client.query(
      `UPDATE deals SET points_only = true, points_price = $2, price_chf = 0,
              max_points_discount = 0, category = $3, active = true, updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id, points, category]
    );
    updated++;
    console.log(`updated  ${points.toString().padStart(6)} pts  ${title}`);
  } else {
    await client.query(
      `INSERT INTO deals (id, title, description, category, price_chf, max_points_discount,
                          image_url, spots_total, spots_left, members_only, featured,
                          contract_address, points_only, points_price)
       VALUES ($1,$2,$3,$4,0,0,'',0,0,true,false,'',true,$5)`,
      [randomUUID(), title, `Redeem with points: ${title}`, category, points]
    );
    created++;
    console.log(`created  ${points.toString().padStart(6)} pts  ${title}`);
  }
}

const total = await client.query('SELECT COUNT(*)::int AS n FROM deals WHERE points_only = true AND active = true');
console.log(`\n${created} created, ${updated} updated — ${total.rows[0].n} active points-only items total`);
await client.end();
