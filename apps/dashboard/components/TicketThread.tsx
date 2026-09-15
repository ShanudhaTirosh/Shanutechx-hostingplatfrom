'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Ticket } from '@/lib/types';
import { Card, Button, Badge, Spinner, ErrorBanner, useToast } from '@/components/ui';
import { useAppUser } from '@/lib/AppUserContext';
import { MessageSquare, Smartphone } from 'lucide-react';
import { IconShield } from '@/components/Icons';


export function TicketThread({
  ticketId,
  adminControls,
}: {
  ticketId: string;
  /** Rendered above the thread — used by the admin page for status/priority controls. */
  adminControls?: (ticket: Ticket, reload: () => void) => React.ReactNode;
}) {
  const { apiUser } = useAppUser();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  function load() {
    api.tickets
      .get(ticketId)
      .then((data) => setTicket(data.ticket))
      .catch((err) => setError(err.message));
  }

  useEffect(load, [ticketId]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.tickets.reply(ticketId, reply);
      setReply('');
      toast('Reply sent successfully', 'success');
      load();
    } catch (err: any) {
      setError(err.message);
      toast('Failed to send reply', 'error');
    } finally {
      setSending(false);
    }
  }

  if (error) return <ErrorBanner message={error} />;
  if (!ticket) return <Spinner label="Loading ticket thread..." />;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{ticket.subject}</h1>
          <div className="flex items-center gap-3 text-text-muted text-xs mt-1 font-mono flex-wrap">
            <span>{ticket.user?.email}</span>
            {ticket.user?.discordUserId && (
              <span className="inline-flex items-center gap-1.5 rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-400 border border-indigo-500/20 font-sans">
                <MessageSquare className="h-3 w-3" /> Discord Linked ({ticket.user.discordUserId})
              </span>
            )}
            {ticket.user?.phoneNumber && (
              <span className="inline-flex items-center gap-1.5 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400 border border-emerald-500/20 font-sans">
                <Smartphone className="h-3 w-3" /> WhatsApp ({ticket.user.phoneNumber})
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          {ticket.priority && <Badge status={ticket.priority} />}
          <Badge status={ticket.status} />
        </div>
      </div>

      {adminControls?.(ticket, load)}

      {/* Messages list */}
      <div className="space-y-4 my-6">
        {ticket.messages?.map((message) => {
          const isMe = message.senderId === apiUser?.id;
          return (
            <div key={message.id} className="flex flex-col">
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  isMe
                    ? 'ml-auto bg-brand-gradient text-white rounded-tr-none shadow-glow-violet'
                    : 'mr-auto glass text-text-primary rounded-tl-none border border-white/[0.06]'
                }`}
              >
                <div className="flex justify-between items-center gap-6 text-[10px] opacity-75 mb-1.5 font-medium">
                  <span className="flex items-center gap-1">
                    {message.senderRole === 'admin' ? (
                      <>
                        <IconShield size={12} className="text-cyan-300" /> Support Team
                      </>
                    ) : (
                      message.sender?.email ?? 'User'
                    )}
                  </span>
                  <span>
                    {new Date(message.createdAt).toLocaleString('en-US', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Send message card */}
      {ticket.status !== 'closed' ? (
        <Card className="border border-white/[0.06] bg-white/[0.01]">
          <form onSubmit={handleReply} className="space-y-3">
            <textarea
              required
              rows={4}
              placeholder="Type your response here..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-text-faint focus:outline-none focus:border-accent-violet/50 transition-all resize-none"
            />
            <div className="flex justify-end">
              <Button type="submit" loading={sending} disabled={sending || !reply.trim()}>
                Send Response
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="border border-red-500/10 bg-red-500/[0.02] text-center p-6">
          <p className="text-sm text-red-300">This support ticket has been closed. Please open a new ticket if you need further assistance.</p>
        </Card>
      )}
    </div>
  );
}
