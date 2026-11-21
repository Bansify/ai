import type { ChatMessage, UserPersona } from './types.ts';

const BASE_PERSONA = `You are Bansify AI, a helpful, concise assistant.
- Match the user's language (if Hinglish in, reply in Hinglish; if English in, reply in English; if Hindi in, reply in Hindi).
- Be concise by default.
- Admit uncertainty honestly; never fabricate citations, URLs, or facts.
- Never give medical or legal diagnosis.`;

const STYLE_HINTS: Record<string, string> = {
  concise: 'Keep the answer brief and to the point.',
  detailed: 'Provide a thorough, well-structured explanation.',
  hinglish: 'Reply naturally in Hinglish (Hindi written in Latin script mixed with English).',
};

export function buildSystemPrompt(persona?: UserPersona, style?: string): string {
  const parts: string[] = [BASE_PERSONA];

  if (persona) {
    const pLines: string[] = [];
    if (persona.name?.trim()) pLines.push(`Name: ${persona.name.trim()}`);
    if (persona.profession?.trim()) pLines.push(`Profession: ${persona.profession.trim()}`);
    if (persona.goals && persona.goals.length > 0) {
      const cleanGoals = persona.goals.map((g) => g.trim()).filter(Boolean);
      if (cleanGoals.length > 0) pLines.push(`Goals: ${cleanGoals.join(', ')}`);
    }
    if (persona.about?.trim()) pLines.push(`About: ${persona.about.trim()}`);
    if (pLines.length > 0) {
      parts.push(`User context:\n${pLines.join('\n')}`);
    }
  }

  if (style && STYLE_HINTS[style]) {
    parts.push(STYLE_HINTS[style]);
  }

  return parts.join('\n\n');
}

const MAX_HISTORY_TURNS = 12;
const MAX_TOTAL_CHARS = 24000;

export function trimMessages(messages: ChatMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  // Never trust client-supplied system prompts
  const filtered = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: String(m.content ?? '').slice(0, 8000),
    }));

  const recent = filtered.slice(-MAX_HISTORY_TURNS);
  let total = 0;
  const result: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (let i = recent.length - 1; i >= 0; i--) {
    const len = recent[i].content.length;
    if (total + len > MAX_TOTAL_CHARS && result.length > 0) break;
    total += len;
    result.unshift(recent[i]);
  }
  return result;
}
