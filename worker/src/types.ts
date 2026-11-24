export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ENVIRONMENT?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  SARVAM_API_KEY?: string;
  BANSIFY_JWT_SECRET?: string;
  ADMIN_SERVICE_TOKEN?: string;
  /** Server-to-server base for Bansify Accounts (no trailing slash), e.g. https://api.bansify.com */
  ACCOUNTS_API_URL?: string;
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
  /**
   * 1 = usable by the automatic fallback chain. Paid providers (Sarvam) are 0:
   * they only run when the user picks that model by name.
   */
  auto_enabled?: number;
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
  /** When signed in, the server appends both turns to this conversation. */
  conversation_id?: string;
  /** Client-side conversation title hint (first user message) for a new conversation. */
  conversation_title?: string;
}

/** A signed-in Bansify Accounts identity, resolved from an OAuth bearer token. */
export interface AiUser {
  /** Stable subject: Accounts `sub` when present, otherwise the username. */
  id: string;
  username: string;
  email?: string;
  name?: string;
  clientId?: string;
}

export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  model_id: string | null;
  preview: string;
  created_at: number;
  updated_at: number;
  archived: number;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  model_id: string | null;
  provider_id: string | null;
  created_at: number;
}
