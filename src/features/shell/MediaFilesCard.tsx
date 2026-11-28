import React from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';

export interface SessionMediaItem {
  id: string;
  name: string;
  kind: 'image' | 'file';
  source: 'user' | 'ai';
  url?: string;
}

export default function MediaFilesCard({ items }: { items: SessionMediaItem[] }) {
  return (
    <aside className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200/70 dark:border-zinc-800/80 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Files & Media</h3>
        <span className="text-xs text-zinc-500">{items.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-8">
            Uploaded or AI-generated images and files will appear here.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 p-2.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800/70 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              {item.kind === 'image' ? (
                <ImageIcon className="w-4 h-4 text-[#2F6BFF] shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{item.name}</div>
                <div className="text-[11px] text-zinc-500">{item.source === 'ai' ? 'AI created' : 'Uploaded'}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
