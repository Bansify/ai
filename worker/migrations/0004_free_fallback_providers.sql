-- =============================================================================
-- 0004: free fallback providers (zero-rupee tiers), behind Sarvam.
--
-- Order is set by `priority` and nothing else now (see scheduler.sortCandidates):
--
--   120  sarvam        paid, primary — best quality, Indian languages
--   100  groq          200k tokens/day, very fast, no card
--    90  gemini        AI Studio free tier, OpenAI-compatible endpoint
--    85  cloudflare-ai 10k Neurons/day on this very Cloudflare account
--    75  zai           GLM-4.5/4.7-Flash are $0 permanently, no card
--    50  openrouter    rotating `:free` models
--    40  sambanova     20 requests/day — emergency only
--
-- Every row is useless until its secret exists (`wrangler secret put ...`).
-- A missing secret is not an error: the candidate fails immediately and the
-- scheduler walks to the next provider.
--
-- `daily_requests` is the per-UTC-day cap this Worker counts against that
-- provider. Where a provider publishes tokens instead of requests, the number
-- here is a deliberately conservative request estimate.
-- =============================================================================

INSERT OR IGNORE INTO providers (id, name, base_url, key_env_name, free_tier_json, priority, status, last_checked)
VALUES
  ('cloudflare-ai', 'Cloudflare Workers AI',
   'https://api.cloudflare.com/client/v4/accounts/53c7503cbecd6c548349980df2dc7b7f/ai/v1',
   'CLOUDFLARE_AI_API_TOKEN', '{"daily_requests":300}', 85, 'healthy', 0),
  ('zai', 'Z.ai (GLM)', 'https://api.z.ai/api/paas/v4',
   'ZAI_API_KEY', '{"daily_requests":500}', 75, 'healthy', 0),
  ('sambanova', 'SambaNova Cloud', 'https://api.sambanova.ai/v1',
   'SAMBANOVA_API_KEY', '{"daily_requests":20}', 40, 'healthy', 0);

-- Model ids verified against the providers' own free-model lists (Nov 2026).
INSERT OR IGNORE INTO models (id, provider_id, model_id, display_name, context_len, speed_class, is_free, enabled)
VALUES
  ('cf-llama-3.3-70b', 'cloudflare-ai', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'Llama 3.3 70B (Workers AI)', 131072, 'fast', 1, 1),
  ('zai-glm-4.7-flash', 'zai', 'glm-4.7-flash', 'GLM 4.7 Flash', 131072, 'fast', 1, 1),
  ('zai-glm-4.5-flash', 'zai', 'glm-4.5-flash', 'GLM 4.5 Flash', 131072, 'fast', 1, 1),
  ('sambanova-gemma-4-31b', 'sambanova', 'gemma-4-31B-it', 'Gemma 4 31B (SambaNova)', 131072, 'fast', 1, 1),
  ('sambanova-gpt-oss-120b', 'sambanova', 'gpt-oss-120b', 'GPT-OSS 120B (SambaNova)', 131072, 'fast', 1, 1);

-- Keep the shipped order stable on a database that already had these rows.
UPDATE providers SET priority = 85 WHERE id = 'cloudflare-ai';
UPDATE providers SET priority = 75 WHERE id = 'zai';
UPDATE providers SET priority = 40 WHERE id = 'sambanova';
