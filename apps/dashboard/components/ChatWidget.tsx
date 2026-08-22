'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppUser } from '@/lib/AppUserContext';
import { firebaseAuth } from '@/lib/firebaseClient';
import { sendChatMessage, subscribeToChat, markChatRead, ChatMessage } from '@/lib/chat';

export default function ChatWidget() {
  const { apiUser } = useAppUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const uid = firebaseAuth.currentUser?.uid;

  useEffect(() => {
    if (!open || !uid) return;
    markChatRead(uid, 'customer').catch(() => {});
    const unsubscribe = subscribeToChat(uid, setMessages);
    return unsubscribe;
  }, [open, uid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !uid || !apiUser) return;
    setError(null);
    try {
      await sendChatMessage(uid, apiUser.id, 'customer', draft.trim());
      setDraft('');
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (!apiUser || apiUser.role !== 'customer') return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="glass rounded-2xl w-80 h-96 mb-3 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm font-medium">Live support</span>
            <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary text-sm">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-text-muted text-xs text-center mt-8">
                Send a message and our team will reply here.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  m.senderRole === 'customer' ? 'ml-auto bg-brand-gradient text-white' : 'bg-white/[0.06]'
                }`}
              >
                {m.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {error && <p className="text-xs text-red-400 px-3 pb-1">{error}</p>}

          <form onSubmit={handleSend} className="p-3 border-t border-white/10 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-sm placeholder:text-text-muted focus:outline-none focus:border-accent-violet/50"
            />
            <button
              type="submit"
              className="rounded-full bg-brand-gradient px-3 py-1.5 text-sm text-white hover:opacity-90"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="h-12 w-12 rounded-full bg-brand-gradient text-white flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity"
        aria-label="Open live chat"
      >
        💬
      </button>
    </div>
  );
}
