# AI Agents Guide — Bansify AI

Every AI agent working in `Bansify/ai` must follow these rules:

1. **File size <= 500 lines**: Hard rule. Split large files by responsibility.
2. **Zero Supabase, Zero Express**: All backend logic lives in `worker/`. Auth = Bansify Accounts (`https://accounts.bansify.com`).
3. **Zero provider keys in browser**: Keys live only in Cloudflare Worker secrets.
4. **Always update `docs/`**: Whenever you add/change an endpoint, screen, binding, or rule, update `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, or `docs/PARITY.md` in the same PR.
5. **Single implementations only**: 1 chat (`src/features/chat/v2/`), 1 workspace tree (`src/features/common/workspace/WorkspaceTree.tsx`), 1 editor (`src/components/editor/CodeEditor.tsx`), 1 highlighter (`prismjs`).
6. **Mobile-first**: Everything must work on a 360px-wide phone viewport first.
7. **Verification**: `npm run lint` (`tsc --noEmit`), `npm run build`, and `cd worker && npm run lint && npm test` must all pass with 0 errors before committing.
