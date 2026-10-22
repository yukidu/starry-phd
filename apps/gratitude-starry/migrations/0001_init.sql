CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS entries (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 3),
  body TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, day, slot)
);
CREATE INDEX IF NOT EXISTS idx_entries_history ON entries(user_id, day DESC);
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 3),
  kind TEXT NOT NULL CHECK(kind IN ('image','video')),
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id,day,slot)
);
CREATE INDEX IF NOT EXISTS idx_media_user ON media(user_id);
CREATE TABLE IF NOT EXISTS entitlements (
  user_id TEXT PRIMARY KEY,
  tier TEXT NOT NULL CHECK(tier IN ('free','pro')) DEFAULT 'free',
  updated_at INTEGER NOT NULL
);
