'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { subscribeToChatIndex, ChatIndexEntry } from '@/lib/chat';
import { api } from '@/lib/api';
import { Card, Spinner, EmptyState, ErrorBanner, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface InboxRow extends ChatIndexEntry {
  uid: string;
  email?: string;
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

export default function AdminChatInboxPage() {
  const [rows, setRows] = useState<InboxRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = subscribeToChatIndex(async (entries) => {
      try {
        const uids = Object.keys(entries);
        const resolved = await Promise.all(
          uids.map(async (uid) => {
            try {
              const { customer } = await api.admin.customerByFirebaseUid(uid);
              return { uid, email: customer.email, ...entries[uid] };
            } catch {
              return { uid, ...entries[uid] };
            }
          })
        );

        if (!cancelled) {
          resolved.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
          setRows(resolved);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const unreadCount = rows?.filter((row) => row.unreadByAdmin).length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageHeader
        title="Support Chat Inbox"
        description="Connect with users currently looking for technical or sales assistance."
        action={
          unreadCount > 0 ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-teal-bright/10 text-accent-teal-bright border border-accent-teal-bright/20 animate-pulse">
              {unreadCount} Unread
            </span>
          ) : undefined
        }
      />

      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      {rows === null && <Spinner label="Loading chat threads..." />}
      {rows?.length === 0 && <EmptyState message="No conversations yet." />}

      <div className="space-y-3">
        {rows?.map((row) => (
          <Link key={row.uid} href={`/admin/chat/${row.uid}`} className="block">
            <Card className="hover:bg-white/[0.06] hover:border-white/12 transition-all cursor-pointer flex items-center justify-between gap-4 border border-white/[0.06]">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${row.unreadByAdmin ? 'bg-accent-teal-bright/10 text-accent-teal-bright' : 'bg-white/5 text-text-muted'}`}>
                  <ChatIcon />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary text-sm truncate">{row.email ?? row.uid}</p>
                  <p className="text-text-muted text-xs truncate max-w-lg mt-0.5">
                    {row.lastSenderRole === 'staff' ? (
                      <span className="text-accent-violet-light font-medium">You: </span>
                    ) : (
                      <span className="text-text-primary font-medium">User: </span>
                    )}
                    {row.lastMessageText}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] text-text-faint font-medium">
                  {new Date(row.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {row.unreadByAdmin && (
                  <span className="h-2 w-2 rounded-full bg-accent-teal-bright shrink-0 animate-ping" />
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
