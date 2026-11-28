-- =============================================================================
-- 0005: Groq first, Sarvam only on request, cheaper Workers AI default.
--
-- Auto chain (what a plain "send" uses) is now:
--   130 groq → 90 gemini → 85 cloudflare-ai → 75 zai → 50 openrouter → 40 sambanova
--
-- Sarvam keeps priority 120 but `auto_enabled = 0`, so it is never spent
-- automatically: a user who wants the best answer picks it by name, and the
-- scheduler then routes to Sarvam only.
-- =============================================================================

ALTER TABLE providers ADD COLUMN auto_enabled INTEGER NOT NULL DEFAULT 1;

UPDATE providers SET priority = 130, auto_enabled = 1 WHERE id = 'groq';
UPDATE providers SET priority = 90,  auto_enabled = 1 WHERE id = 'gemini';
UPDATE providers SET priority = 85,  auto_enabled = 1 WHERE id = 'cloudflare-ai';
UPDATE providers SET priority = 75,  auto_enabled = 1 WHERE id = 'zai';
UPDATE providers SET priority = 50,  auto_enabled = 1 WHERE id = 'openrouter';
UPDATE providers SET priority = 40,  auto_enabled = 1 WHERE id = 'sambanova';
UPDATE providers SET priority = 120, auto_enabled = 0 WHERE id = 'sarvam';

-- 10,000 Neurons/day is ~49k output tokens on Llama 3.3 70B but ~287k on the 8B
-- fp8-fast model, so the free Workers AI slot defaults to the cheaper one.
UPDATE models SET enabled = 0 WHERE provider_id = 'cloudflare-ai';

INSERT OR IGNORE INTO models (id, provider_id, model_id, display_name, context_len, speed_class, is_free, enabled)
VALUES ('cf-llama-3.1-8b-fast', 'cloudflare-ai', '@cf/meta/llama-3.1-8b-instruct-fp8-fast', 'Llama 3.1 8B (Workers AI)', 131072, 'instant', 1, 1);

UPDATE models SET enabled = 1 WHERE id = 'cf-llama-3.1-8b-fast';
