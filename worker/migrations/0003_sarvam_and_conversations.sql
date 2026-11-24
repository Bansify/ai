-- =============================================================================
-- 0003: Sarvam AI as the primary provider + conversation storage.
--
-- Sarvam is first-party to this product (the user's own API account), so it gets
-- the highest priority: the scheduler picks the provider with the most remaining
-- daily budget, then the highest priority, so a big Sarvam budget keeps it in
-- front of the free Groq/Gemini tiers while still failing over cleanly.
--
-- Conversation tables are what make the same chat history show up in the web app
-- and the Android app: both clients read/write these rows through the worker
-- instead of keeping a private local copy.
-- =============================================================================

INSERT OR IGNORE INTO providers (id, name, base_url, key_env_name, free_tier_json, priority, status, last_checked)
VALUES
  ('sarvam', 'Sarvam AI', 'https://api.sarvam.ai/v1', 'SARVAM_API_KEY', '{"daily_requests":100000}', 120, 'healthy', 0);

INSERT OR IGNORE INTO models (id, provider_id, model_id, display_name, context_len, speed_class, is_free, enabled)
VALUES
  ('sarvam-105b', 'sarvam', 'sarvam-105b', 'Sarvam 105B', 131072, 'fast', 0, 1),
  ('sarvam-105b-conversations', 'sarvam', 'sarvam-105b-conversations', 'Sarvam 105B Chat', 32768, 'instant', 0, 1);

-- Keep the shipped defaults current even on a database seeded before this file.
UPDATE providers SET priority = 120, base_url = 'https://api.sarvam.ai/v1' WHERE id = 'sarvam';

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT 'New chat',
  model_id   TEXT,
  preview    TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  model_id        TEXT,
  provider_id     TEXT,
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, created_at);
