import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Every surface that is not chat yet.
 *
 * Chat is live on the Bansify AI Worker. History, Models, Studio, Library and
 * Scheduled ship in the next release, so they say so plainly instead of showing
 * a placeholder that looks like a broken feature.
 */
export const ComingSoon: React.FC<{ title: string; body: string; onBack?: () => void }> = ({
  title,
  body,
  onBack,
}) => (
  <div className="h-full flex flex-col items-center justify-center text-center px-6">
    <div
      className="w-12 h-12 rounded-2xl mb-4 flex items-center justify-center text-white"
      style={{ background: 'linear-gradient(135deg, #0494f4, #7c5cff)' }}
    >
      <Sparkles className="w-6 h-6" strokeWidth={1.75} />
    </div>
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0494f4]">Coming soon</p>
    <h2 className="mt-1 text-xl font-black tracking-tight">{title}</h2>
    <p className="mt-2 max-w-sm text-sm text-zinc-500">{body}</p>
    {onBack && (
      <button
        type="button"
        onClick={onBack}
        className="mt-6 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
        style={{ backgroundColor: '#0494f4' }}
      >
        Back to Chat
      </button>
    )}
  </div>
);

export default ComingSoon;
