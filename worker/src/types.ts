export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ENVIRONMENT?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  BANSIFY_JWT_SECRET?: string;
  ADMIN_SERVICE_TOKEN?: string;
  ACCOUNTS_API_URL?: string;
  SARVAM_API_KEY?: string;
}

export interface AiUser {
  id: string;
  bansify_user_id?: string;
  username?: string | null;
  email?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  clientId?: string | null;
  created_at?: number;
}

export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  preview?: string | null;
  archived?: number;
  model_id?: string | null;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_id?: string | null;
  provider_id?: string | null;
  created_at: number;
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
