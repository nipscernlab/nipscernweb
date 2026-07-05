-- NIPS-CERN hearts — D1 schema
-- Apply with:
--   wrangler d1 execute nipscern-hearts --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS hearts (
  slug  TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hearts_votes (
  slug       TEXT    NOT NULL,
  voter      TEXT    NOT NULL,   -- SHA-256(ip | user-agent | salt), never the raw IP
  created_at INTEGER NOT NULL,   -- ms epoch, useful later for "trending"
  PRIMARY KEY (slug, voter)
);

CREATE INDEX IF NOT EXISTS idx_hearts_votes_slug ON hearts_votes (slug);
