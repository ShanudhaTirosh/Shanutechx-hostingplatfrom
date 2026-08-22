'use client';

import { useEffect, useState } from 'react';
import { PageHeader, Card, Button, Badge, useToast } from '@/components/ui';

interface RealtimeEvent {
  id: string;
  channel: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | 'BROADCAST';
  table?: string;
  payload: Record<string, any>;
  timestamp: string;
}

export default function SupabaseRealtimePage() {
  const [connected, setConnected] = useState(true);
  const [activeChannel, setActiveChannel] = useState('db-changes:public:*');
  const [events, setEvents] = useState<RealtimeEvent[]>([
    {
      id: 'evt-1',
      channel: 'db-changes:public:users',
      event: 'INSERT',
      table: 'users',
      payload: { id: 'usr-99', email: 'alex@example.com', created_at: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    },
    {
      id: 'evt-2',
      channel: 'room-gaming-1',
      event: 'BROADCAST',
      payload: { type: 'PLAYER_MOVE', x: 140, y: 820 },
      timestamp: new Date().toISOString(),
    },
  ]);

  const [broadcastTopic, setBroadcastTopic] = useState('room-gaming-1');
  const [broadcastEvent, setBroadcastEvent] = useState('USER_STATUS');
  const [broadcastPayload, setBroadcastPayload] = useState('{\n  "status": "online"\n}');
  const [sending, setSending] = useState(false);

  const { toast } = useToast();

  function handleSendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const parsed = JSON.parse(broadcastPayload);
      const newEvt: RealtimeEvent = {
        id: `evt-${Date.now()}`,
        channel: broadcastTopic,
        event: 'BROADCAST',
        payload: { event: broadcastEvent, data: parsed },
        timestamp: new Date().toISOString(),
      };
      setEvents((prev) => [newEvt, ...prev]);
      toast(`Broadcasted "${broadcastEvent}" to channel "${broadcastTopic}"!`, 'success');
    } catch (err: any) {
      toast('Invalid JSON payload format', 'error');
    } finally {
      setSending(false);
    }
  }

  function handleClearLog() {
    setEvents([]);
    toast('Cleared event log.', 'info');
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Supabase Realtime & WebSockets Studio"
        description="Listen to PostgreSQL CDC database change broadcasts, Presence, and WebSockets channels in real time."
        action={
          <Button size="sm" variant={connected ? 'secondary' : 'primary'} onClick={() => setConnected(!connected)}>
            {connected ? '⏸ Pause Listener' : '▶ Reconnect WebSockets'}
          </Button>
        }
      />

      {/* WebSockets Connection Banner */}
      <div className={`p-4 border rounded-2xl flex items-center justify-between gap-4 flex-wrap ${
        connected ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : 'bg-amber-500/10 border-amber-500/25 text-amber-300'
      }`}>
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <div>
            <p className="text-xs font-bold font-mono">
              WebSocket URL: wss://realtime.shanutechx.net/socket/websocket
            </p>
            <p className="text-[11px] opacity-80 mt-0.5">
              Listening to Postgres Write-Ahead-Log (WAL) stream & Broadcast channels.
            </p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold px-3 py-1 rounded bg-black/40 border border-white/10">
          {connected ? 'STATE: CONNECTED' : 'STATE: PAUSED'}
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column: Broadcast Publisher */}
        <div className="space-y-4">
          <Card title="Publish Broadcast Message" description="Broadcast WebSocket messages to active subscribers on a channel.">
            <form onSubmit={handleSendBroadcast} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Channel Name</label>
                <input
                  type="text"
                  required
                  value={broadcastTopic}
                  onChange={(e) => setBroadcastTopic(e.target.value)}
                  placeholder="room-1"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">Event Type</label>
                <input
                  type="text"
                  required
                  value={broadcastEvent}
                  onChange={(e) => setBroadcastEvent(e.target.value)}
                  placeholder="USER_POS"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-muted block mb-1">JSON Payload</label>
                <textarea
                  rows={4}
                  required
                  value={broadcastPayload}
                  onChange={(e) => setBroadcastPayload(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan resize-none"
                />
              </div>

              <Button type="submit" size="sm" loading={sending} className="w-full justify-center">
                📡 Send Broadcast
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: Live Event Stream */}
        <div className="md:col-span-2 space-y-4">
          <Card
            title="Realtime Change Feed"
            description="Live stream of CDC database modifications (INSERT, UPDATE, DELETE) & Broadcast messages."
            action={<Button size="sm" variant="ghost" onClick={handleClearLog}>Clear Log</Button>}
          >
            <div className="bg-black/90 border border-white/10 rounded-xl p-4 font-mono text-xs text-text-primary leading-relaxed h-[420px] overflow-y-auto space-y-2 select-text shadow-inner">
              {events.length === 0 ? (
                <p className="text-text-faint italic text-center pt-20">No events received. Send a broadcast or modify database rows.</p>
              ) : (
                events.map((evt) => (
                  <div key={evt.id} className="p-3 border border-white/10 rounded-xl bg-white/[0.02] space-y-1.5 hover:bg-white/[0.04] transition-colors">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          evt.event === 'INSERT'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : evt.event === 'UPDATE'
                            ? 'bg-amber-500/20 text-amber-300'
                            : evt.event === 'DELETE'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-accent-cyan/20 text-accent-cyan'
                        }`}>
                          {evt.event}
                        </span>
                        <span className="text-text-muted">{evt.channel}</span>
                      </div>
                      <span className="text-text-faint">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                    </div>

                    <pre className="text-emerald-400 text-[11px] whitespace-pre-wrap font-mono bg-black/40 p-2 rounded">
                      {JSON.stringify(evt.payload, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
