import pg from 'pg';

const { Pool } = pg;

let pool;
let dbReady = false;

// ── Contract addresses ──
export const ZAI_PRODUCTS_CONTRACT = '0xedd1a9446a2c0e50a8287c9527bf2a7498bfbc55';
export const ZAI_EXPERIENCE_CARD_CONTRACT = '0x3ec471e2a68238ee75b395eff068e04b6b5da5d';

export function getPool() {
  if (!pool) {
    const useSSL = process.env.DATABASE_SSL === 'true';
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function isAdmin(decoded) {
  if (!decoded?.userId && !decoded?.wallet) return false;
  try {
    const res = await getPool().query(
      'SELECT role FROM user_roles WHERE user_id = $1 OR LOWER(wallet) = LOWER($2)',
      [decoded.userId || '', decoded.wallet || '']
    );
    const role = res.rows[0]?.role;
    return role === 'owner' || role === 'admin';
  } catch {
    return false;
  }
}

export async function requireAdmin(decoded) {
  const admin = await isAdmin(decoded);
  if (!admin) throw new Error('FORBIDDEN');
  return true;
}

export async function getUserRole(userId, wallet) {
  try {
    const res = await getPool().query(
      'SELECT role FROM user_roles WHERE user_id = $1 OR LOWER(wallet) = LOWER($2)',
      [userId || '', wallet || '']
    );
    return res.rows[0]?.role || 'member';
  } catch {
    return 'member';
  }
}

export async function initDB() {
  if (dbReady) return;
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id TEXT PRIMARY KEY,
        wallet TEXT,
        name TEXT DEFAULT '',
        given_name TEXT DEFAULT '',
        family_name TEXT DEFAULT '',
        email TEXT DEFAULT '',
        phone_number TEXT DEFAULT '',
        address TEXT DEFAULT '',
        city TEXT DEFAULT '',
        country TEXT DEFAULT '',
        postal_code TEXT DEFAULT '',
        birthdate TEXT,
        is_public BOOLEAN DEFAULT false,
        image TEXT,
        salutation INT DEFAULT 0,
        language TEXT DEFAULT 'en',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY REFERENCES user_profiles(user_id) ON DELETE CASCADE,
        notifications JSONB DEFAULT '{"eventInvitations":true,"membershipUpdates":true,"productLaunches":false,"partnerOffers":false,"productUpdates":true,"eventReminders":true}',
        privacy JSONB DEFAULT '{"partnerDataSharing":true,"analytics":false,"profileVisibility":true,"communityVisibility":false}',
        card JSONB DEFAULT '{"nfcActive":true,"autoLoginOnTap":true}',
        region JSONB DEFAULT '{"country":"Switzerland","currency":"CHF","language":"English"}',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        cid TEXT NOT NULL,
        url TEXT NOT NULL,
        caption TEXT DEFAULT '',
        author_id TEXT NOT NULL,
        author_name TEXT DEFAULT 'Member',
        tagged_members TEXT[] DEFAULT '{}',
        comment_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS photo_comments (
        id TEXT PRIMARY KEY,
        photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT DEFAULT 'Member',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT DEFAULT 'Member',
        recipient_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        tag TEXT DEFAULT 'community',
        location TEXT DEFAULT '',
        date TIMESTAMPTZ NOT NULL,
        description TEXT DEFAULT '',
        image_url TEXT,
        tier TEXT DEFAULT 'all',
        max_attendees INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS event_registrations (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        registered_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(event_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS insurance_registrations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        sas_transaction_id INT,
        sas_certificate_id INT,
        sas_status TEXT DEFAULT 'pending',
        customer_data JSONB,
        device_data JSONB,
        products_data JSONB,
        error_detail TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS product_claims (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        wallet TEXT,
        product_name TEXT DEFAULT '',
        claimed_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, product_id)
      );

      CREATE TABLE IF NOT EXISTS blocked_members (
        user_id TEXT PRIMARY KEY,
        blocked_by TEXT NOT NULL,
        reason TEXT DEFAULT '',
        blocked_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        user_id TEXT PRIMARY KEY,
        role TEXT NOT NULL DEFAULT 'member',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS product_claim_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT DEFAULT '',
        user_email TEXT DEFAULT '',
        rwa_id TEXT,
        product_name TEXT DEFAULT '',
        proof_image_url TEXT NOT NULL,
        proof_image_cid TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_note TEXT DEFAULT '',
        reviewed_by TEXT,
        reviewed_at TIMESTAMPTZ,
        nft_id TEXT,
        mint_tx TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_photo_comments_photo ON photo_comments(photo_id);
      CREATE INDEX IF NOT EXISTS idx_photos_created ON photos(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_dm ON chat_messages(author_id, recipient_id);
      CREATE INDEX IF NOT EXISTS idx_events_date ON events(date DESC);
      CREATE INDEX IF NOT EXISTS idx_event_regs_event ON event_registrations(event_id);
      CREATE INDEX IF NOT EXISTS idx_event_regs_user ON event_registrations(user_id);
      CREATE INDEX IF NOT EXISTS idx_insurance_user ON insurance_registrations(user_id);
      CREATE INDEX IF NOT EXISTS idx_insurance_product ON insurance_registrations(product_id);
      CREATE INDEX IF NOT EXISTS idx_claims_user ON product_claims(user_id);
      CREATE INDEX IF NOT EXISTS idx_claims_product ON product_claims(product_id);
      CREATE INDEX IF NOT EXISTS idx_claim_requests_user ON product_claim_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON product_claim_requests(status);
    `);

    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS salutation INT DEFAULT 0;
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
      ALTER TABLE product_claim_requests ADD COLUMN IF NOT EXISTS product_id TEXT;
      ALTER TABLE product_claim_requests ADD COLUMN IF NOT EXISTS encryption_key TEXT DEFAULT '';
      ALTER TABLE product_claim_requests ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';
      ALTER TABLE product_claim_requests ADD COLUMN IF NOT EXISTS wallet TEXT DEFAULT '';
      ALTER TABLE product_claim_requests ALTER COLUMN proof_image_url DROP NOT NULL;
    `);

    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_product_claims_user_product ON product_claims(user_id, product_id)`);

    // ── Seed owner role from env var (no hardcoded ID) ──
    const OWNER_USER_ID = process.env.ZAI_OWNER_USER_ID;
    if (OWNER_USER_ID) {
      await pool.query(`
        INSERT INTO user_roles (user_id, role)
        VALUES ($1, 'owner')
        ON CONFLICT (user_id) DO NOTHING
      `, [OWNER_USER_ID]);
    } else {
      console.warn('[DB] ZAI_OWNER_USER_ID env var not set — skipping owner seed.');
    }

    dbReady = true;
  } finally {
    client.release();
  }
}

export async function tryInitDB() {
  try {
    await initDB();
    return true;
  } catch (err) {
    console.error('DB init failed (non-fatal):', err.message);
    return false;
  }
}