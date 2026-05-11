import pg from 'pg';

const { Pool } = pg;

let pool;
let dbReady = false;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

export async function initDB() {
  if (dbReady) return;
  const client = await getPool().connect();
  try {
    await client.query(`
      -- User profiles
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

      -- User settings
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY REFERENCES user_profiles(user_id) ON DELETE CASCADE,
        notifications JSONB DEFAULT '{"eventInvitations":true,"membershipUpdates":true,"productLaunches":false,"partnerOffers":false,"productUpdates":true,"eventReminders":true}',
        privacy JSONB DEFAULT '{"partnerDataSharing":true,"analytics":false,"profileVisibility":true,"communityVisibility":false}',
        card JSONB DEFAULT '{"nfcActive":true,"autoLoginOnTap":true}',
        region JSONB DEFAULT '{"country":"Switzerland","currency":"CHF","language":"English"}',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Photos
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

      -- Photo comments
      CREATE TABLE IF NOT EXISTS photo_comments (
        id TEXT PRIMARY KEY,
        photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT DEFAULT 'Member',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Chat messages
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT DEFAULT 'Member',
        recipient_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Events
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

      -- Event registrations
      CREATE TABLE IF NOT EXISTS event_registrations (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        registered_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(event_id, user_id)
      );

      -- Insurance registrations (SAS API)
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

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_photo_comments_photo ON photo_comments(photo_id);
      CREATE INDEX IF NOT EXISTS idx_photos_created ON photos(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_dm ON chat_messages(author_id, recipient_id);
      CREATE INDEX IF NOT EXISTS idx_events_date ON events(date DESC);
      CREATE INDEX IF NOT EXISTS idx_event_regs_event ON event_registrations(event_id);
      CREATE INDEX IF NOT EXISTS idx_event_regs_user ON event_registrations(user_id);
      CREATE INDEX IF NOT EXISTS idx_insurance_user ON insurance_registrations(user_id);
      CREATE INDEX IF NOT EXISTS idx_insurance_product ON insurance_registrations(product_id);
    `);

    // Add columns if they don't exist (for existing DBs)
    await client.query(`
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS salutation INT DEFAULT 0;
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
    `);

    dbReady = true;
  } finally {
    client.release();
  }
}
