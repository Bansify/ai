-- Seed initial providers and models
INSERT OR IGNORE INTO providers (id, name, base_url, key_env_name, free_tier_json, priority, status, last_checked)
VALUES
  ('groq', 'Groq', 'https://api.groq.com/openai/v1', 'GROQ_API_KEY', '{"daily_requests":1000}', 100, 'healthy', 0),
  ('gemini', 'Google Gemini', 'https://generativelanguage.googleapis.com/v1beta', 'GEMINI_API_KEY', '{"daily_requests":500}', 90, 'healthy', 0),
  ('openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', 'OPENROUTER_API_KEY', '{"daily_requests":50}', 50, 'healthy', 0);

INSERT OR IGNORE INTO models (id, provider_id, model_id, display_name, context_len, speed_class, is_free, enabled)
VALUES
  ('groq-llama-3.3-70b', 'groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B', 131072, 'instant', 1, 1),
  ('groq-llama-3.1-8b', 'groq', 'llama-3.1-8b-instant', 'Llama 3.1 8B', 131072, 'instant', 1, 1),
  ('gemini-2.0-flash-lite', 'gemini', 'gemini-2.0-flash-lite', 'Gemini 2.0 Flash-Lite', 1048576, 'fast', 1, 1),
  ('gemini-2.0-flash', 'gemini', 'gemini-2.0-flash', 'Gemini 2.0 Flash', 1048576, 'fast', 1, 1),
  ('openrouter-deepseek-r1-free', 'openrouter', 'deepseek/deepseek-r1:free', 'DeepSeek R1 (Free)', 65536, 'reasoning', 1, 1);
