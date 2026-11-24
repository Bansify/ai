// =============================================================================
// Conversation storage — the same chat history on the web app and the Android
// app, because both talk to this one D1 table instead of keeping a local copy.
//
// Every function takes the caller's `userId` from the verified bearer token and
// scopes the SQL by it, so one account can never read another's conversation by
// guessing an id.
// =============================================================================

import type { ConversationRow, Env, MessageRow } from './types.ts';

const TITLE_MAX = 80;
const PREVIEW_MAX = 120;

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function cleanTitle(raw: unknown, fallback = 'New chat'): string {
  const text = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (!text) return fallback;
  return text.slice(0, TITLE_MAX);
}

export function cleanMessageText(raw: unknown): string {
  return typeof raw === 'string' ? raw.slice(0, 24000) : '';
}

function previewOf(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_MAX);
}

export async function listConversations(env: Env, userId: string, limit = 100): Promise<ConversationRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, user_id, title, model_id, preview, created_at, updated_at, archived
       FROM conversations
      WHERE user_id = ? AND archived = 0
      ORDER BY updated_at DESC
      LIMIT ?`
  )
    .bind(userId, Math.min(Math.max(limit, 1), 200))
    .all<ConversationRow>();
  return results ?? [];
}

export async function getConversation(
  env: Env,
  userId: string,
  conversationId: string
): Promise<{ conversation: ConversationRow; messages: MessageRow[] } | null> {
  const conversation = await env.DB.prepare(
    `SELECT id, user_id, title, model_id, preview, created_at, updated_at, archived
       FROM conversations WHERE id = ? AND user_id = ?`
  )
    .bind(conversationId, userId)
    .first<ConversationRow>();
  if (!conversation) return null;

  const { results } = await env.DB.prepare(
    `SELECT id, conversation_id, role, content, model_id, provider_id, created_at
       FROM messages WHERE conversation_id = ?
      ORDER BY created_at ASC, rowid ASC`
  )
    .bind(conversationId)
    .all<MessageRow>();

  return { conversation, messages: results ?? [] };
}

export async function createConversation(
  env: Env,
  userId: string,
  title?: unknown,
  modelId?: unknown
): Promise<ConversationRow> {
  const now = Date.now();
  const row: ConversationRow = {
    id: newId('conv'),
    user_id: userId,
    title: cleanTitle(title),
    model_id: typeof modelId === 'string' && modelId.trim() ? modelId.trim() : null,
    preview: '',
    created_at: now,
    updated_at: now,
    archived: 0,
  };
  await env.DB.prepare(
    `INSERT INTO conversations (id, user_id, title, model_id, preview, created_at, updated_at, archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
  )
    .bind(row.id, row.user_id, row.title, row.model_id, row.preview, row.created_at, row.updated_at)
    .run();
  return row;
}

/** Creates the conversation on demand for the first turn of a new chat. */
export async function ensureConversation(
  env: Env,
  userId: string,
  conversationId: string | undefined,
  titleHint: string | undefined,
  modelId: string | undefined
): Promise<ConversationRow> {
  if (conversationId) {
    const existing = await env.DB.prepare(
      `SELECT id, user_id, title, model_id, preview, created_at, updated_at, archived
         FROM conversations WHERE id = ? AND user_id = ?`
    )
      .bind(conversationId, userId)
      .first<ConversationRow>();
    if (existing) return existing;
  }
  return createConversation(env, userId, titleHint, modelId);
}

export async function renameConversation(
  env: Env,
  userId: string,
  conversationId: string,
  title: unknown
): Promise<boolean> {
  const res = await env.DB.prepare(
    `UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?`
  )
    .bind(cleanTitle(title), Date.now(), conversationId, userId)
    .run();
  return Boolean(res.meta?.changes);
}

export async function deleteConversation(
  env: Env,
  userId: string,
  conversationId: string
): Promise<boolean> {
  const owned = await env.DB.prepare(`SELECT id FROM conversations WHERE id = ? AND user_id = ?`)
    .bind(conversationId, userId)
    .first<{ id: string }>();
  if (!owned) return false;
  await env.DB.prepare(`DELETE FROM messages WHERE conversation_id = ?`).bind(conversationId).run();
  await env.DB.prepare(`DELETE FROM conversations WHERE id = ? AND user_id = ?`)
    .bind(conversationId, userId)
    .run();
  return true;
}

export async function deleteAllConversations(env: Env, userId: string): Promise<number> {
  const { results } = await env.DB.prepare(`SELECT id FROM conversations WHERE user_id = ?`)
    .bind(userId)
    .all<{ id: string }>();
  const ids = (results ?? []).map((r) => r.id);
  if (ids.length === 0) return 0;
  await env.DB.prepare(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)`)
    .bind(userId)
    .run();
  await env.DB.prepare(`DELETE FROM conversations WHERE user_id = ?`).bind(userId).run();
  return ids.length;
}

export async function appendMessage(
  env: Env,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  opts: { modelId?: string | null; providerId?: string | null } = {}
): Promise<MessageRow | null> {
  const text = cleanMessageText(content);
  if (!text.trim()) return null;
  const row: MessageRow = {
    id: newId('msg'),
    conversation_id: conversationId,
    role,
    content: text,
    model_id: opts.modelId ?? null,
    provider_id: opts.providerId ?? null,
    created_at: Date.now(),
  };
  await env.DB.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, model_id, provider_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(row.id, row.conversation_id, row.role, row.content, row.model_id, row.provider_id, row.created_at)
    .run();
  await env.DB.prepare(
    `UPDATE conversations SET preview = ?, updated_at = ? WHERE id = ?`
  )
    .bind(previewOf(text), row.created_at, conversationId)
    .run();
  return row;
}

/**
 * First user turn of a conversation sets the title, exactly like the Android
 * app's local behaviour ("New chat" until the first prompt lands).
 */
export async function titleFromFirstTurn(
  env: Env,
  conversation: ConversationRow,
  firstUserText: string
): Promise<string> {
  if (conversation.title && conversation.title !== 'New chat') return conversation.title;
  const title = cleanTitle(firstUserText);
  if (!title || title === 'New chat') return conversation.title;
  await env.DB.prepare(`UPDATE conversations SET title = ? WHERE id = ?`)
    .bind(title, conversation.id)
    .run();
  return title;
}
