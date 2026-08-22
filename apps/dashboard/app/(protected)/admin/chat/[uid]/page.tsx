'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAppUser } from '@/lib/AppUserContext';
import { sendChatMessage, subscribeToChat, markChatRead, ChatMessage } from '@/lib/chat';
import { api } from '@/lib/api';
import { Card, Spinner, ErrorBanner, Button, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  );
}

export default function AdminChatDetailPage() {
  const params = useParams<{ uid: string }>();
  const { apiUser } = useAppUser();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markChatRead(params.uid, 'staff').catch(() => {});
    const unsubscribe = subscribeToChat(params.uid, setMessages);
    
    // Resolve email
    api.admin.customerByFirebaseUid(params.uid)
      .then((d) => setCustomerEmail(d.customer.email))
      .catch(() => setCustomerEmail('Customer'));

    return unsubscribe;
  }, [params.uid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !apiUser) return;
    setError(null);
    try {
      await sendChatMessage(params.uid, apiUser.id, 'staff', draft.trim());
      setDraft('');
      markChatRead(params.uid, 'staff').catch(() => {});
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title={customerEmail || 'Live Chat'}
        description={`UID: ${params.uid.slice(0, 16)}...`}
        action={
          <Button variant="secondary" size="sm" onClick={() => window.history.back()}>
            <BackIcon /> Back to Inbox
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}
      {messages === null && <Spinner label="Loading conversation history..." />}

      <Card className="border border-white/[0.06] bg-white/[0.01] h-[500px] flex flex-col justify-between p-4">
        {/* Messages list */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 custom-scrollbar">
          {messages?.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-muted text-xs">
              No messages in this chat thread yet.
            </div>
          ) : (
            messages?.map((m) => {
              const isStaff = m.senderRole === 'staff';
              return (
                <div key={m.id} className="flex flex-col">
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isStaff
                        ? 'ml-auto bg-brand-gradient text-white rounded-tr-none shadow-glow-violet'
                        : 'mr-auto glass text-text-primary rounded-tl-none border border-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-6 text-[9px] opacity-75 mb-1">
                      <span>{isStaff ? '🛡️ Support' : 'User'}</span>
                      <span>
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input box */}
        <form onSubmit={handleSend} className="flex gap-2 border-t border-white/[0.06] pt-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type your response here..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-text-faint focus:outline-none focus:border-accent-violet/50 transition-colors"
          />
          <Button type="submit" disabled={!draft.trim()}>
            Send Message
          </Button>
        </form>
      </Card>
    </div>
  );
}
