export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ENVIRONMENT?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  BANSIFY_JWT_SECRET?: string;
  ADMIN_SERVICE_TOKEN?: string;
}

export interface ProviderRow {
  id: string;
  name: string;
  base_url: string;
  key_env_name: string;
  free_tier_json: string;
  priority: number;
  status: string;
  last_checked: number | null;
}

export interface ModelRow {
  id: string;
  provider_id: string;
  model_id: string;
  display_name: string;
  context_len: number;
  speed_class: string;
  is_free: number;
  enabled: number;
}

export interface UsageRow {
  id: string;
  day: string;
  provider_id: string;
  requests: number;
  tokens_in: number;
  tokens_out: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  hasImage?: boolean;
}

export interface UserPersona {
  name?: string;
  profession?: string;
  goals?: string[];
  about?: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
  model?: string;
  persona?: UserPersona;
  style?: 'concise' | 'detailed' | 'hinglish';
}
