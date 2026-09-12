'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Card,
  Button,
  Badge,
  Spinner,
  ErrorBanner,
  PageHeader,
  Tabs,
  Input,
  useToast,
} from '@/components/ui';
import {
  Bot,
  QrCode,
  RefreshCw,
  Power,
  Trash2,
  Phone,
  MessageSquare,
  ShieldCheck,
  Zap,
  Radio,
  Send,
  Hash,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const TABS = [
  { label: 'WhatsApp Gateway', value: 'whatsapp' },
  { label: 'Discord Bot Engine', value: 'discord' },
  { label: 'Live Gateway Tester', value: 'tester' },
];

export default function AdminBotStudioPage() {
  const [activeTab, setActiveTab] = useState('whatsapp');
  const [waState, setWaState] = useState<any>(null);
  const [discordState, setDiscordState] = useState<any>(null);
  const [loadingWa, setLoadingWa] = useState(true);
  const [loadingDiscord, setLoadingDiscord] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pairing code state
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  // Action states
  const [resetting, setResetting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  // Tester state
  const [testTarget, setTestTarget] = useState<'whatsapp' | 'discord_channel' | 'discord_dm'>('whatsapp');
  const [testRecipient, setTestRecipient] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const { toast } = useToast();

  const loadWaStatus = async () => {
    setLoadingWa(true);
    try {
      const data = await api.admin.bots.whatsappStatus();
      setWaState(data);
      if (data.pairingCode) setPairingCode(data.pairingCode);
    } catch (err: any) {
      setWaState({ state: 'unreachable', error: err.message });
    } finally {
      setLoadingWa(false);
    }
  };

  const loadDiscordStatus = async () => {
    setLoadingDiscord(true);
    try {
      const data = await api.admin.bots.discordStatus();
      setDiscordState(data);
    } catch (err: any) {
      setDiscordState({ status: 'unreachable', error: err.message });
    } finally {
      setLoadingDiscord(false);
    }
  };

  useEffect(() => {
    loadWaStatus();
    loadDiscordStatus();

    // Auto refresh status every 10 seconds for live QR / connection state updates
    const interval = setInterval(() => {
      loadWaStatus();
      loadDiscordStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingPhone.trim()) return;
    setGeneratingCode(true);
    try {
      const res = await api.admin.bots.whatsappPairingCode(pairingPhone.trim());
      setPairingCode(res.pairingCode);
      toast(`8-Digit Pairing Code Generated: ${res.pairingCode}`, 'success');
      loadWaStatus();
    } catch (err: any) {
      toast(err.message || 'Failed to generate pairing code', 'error');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleResetSession = async () => {
    if (!confirm('Are you sure you want to clear the WhatsApp session and generate a fresh QR code?')) return;
    setResetting(true);
    try {
      await api.admin.bots.whatsappResetSession();
      toast('WhatsApp session cleared & reset. Scan new QR code!', 'success');
      setPairingCode(null);
      loadWaStatus();
    } catch (err: any) {
      toast('Failed to reset WhatsApp session', 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      await api.admin.bots.whatsappReconnect();
      toast('WhatsApp reconnection sequence triggered', 'info');
      loadWaStatus();
    } catch (err: any) {
      toast('Failed to trigger reconnection', 'error');
    } finally {
      setReconnecting(false);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMessage.trim()) return;
    setSendingTest(true);
    try {
      if (testTarget === 'whatsapp') {
        await api.admin.bots.whatsappSendTest(testRecipient, testMessage);
        toast(`WhatsApp message sent to +${testRecipient}`, 'success');
      } else if (testTarget === 'discord_dm') {
        await api.admin.bots.discordSendTest(testMessage, undefined, testRecipient);
        toast(`Discord DM sent to User ID: ${testRecipient}`, 'success');
      } else {
        await api.admin.bots.discordSendTest(testMessage, testRecipient || undefined);
        toast(`Discord message posted to channel!`, 'success');
      }
      setTestMessage('');
    } catch (err: any) {
      toast(err.message || 'Failed to send test message', 'error');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <PageHeader
        title="Bot Management & Integration Studio"
        description="Configure, pair, and monitor real-time WhatsApp Gateway & Discord Bot Engine daemons."
      />

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {error && <ErrorBanner message={error} />}

      {/* WHATSAPP TAB */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          {/* Top Status Overview Banner */}
          <Card className="border border-white/[0.06] bg-white/[0.01] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    Baileys WhatsApp Bot Gateway
                    {waState?.state === 'connected' ? (
                      <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                        🟢 Connected
                      </span>
                    ) : waState?.state === 'qr_ready' ? (
                      <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/30">
                        🟡 QR Ready to Scan
                      </span>
                    ) : (
                      <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-bold text-rose-400 border border-rose-500/30">
                        🔴 Disconnected
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Multi-device session pairing with automatic QR code & phone code authentication.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={loadWaStatus}
                  loading={loadingWa}
                  className="text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh Status
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleReconnect}
                  loading={reconnecting}
                  className="text-xs flex items-center gap-1.5 text-amber-400 border-amber-500/20 hover:bg-amber-500/10"
                >
                  <Power className="h-3.5 w-3.5" /> Reconnect
                </Button>
                <Button
                  variant="danger"
                  onClick={handleResetSession}
                  loading={resetting}
                  className="text-xs flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Reset Session
                </Button>
              </div>
            </div>
          </Card>

          {/* QR Code & Pairing Code Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: QR Code Scan Panel */}
            <Card className="border border-white/[0.06] bg-white/[0.01] p-6 flex flex-col items-center text-center">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
                <QrCode className="h-4 w-4 text-emerald-400" />
                Scan QR Code to Pair
              </h3>

              {waState?.state === 'connected' ? (
                <div className="my-8 flex flex-col items-center justify-center p-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 space-y-3">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                  <p className="text-sm font-semibold">WhatsApp Bot Session Active</p>
                  <p className="text-xs text-text-muted max-w-xs">
                    Your WhatsApp number is authenticated and ready to dispatch customer notifications and handle interactive commands.
                  </p>
                </div>
              ) : waState?.qrDataUrl ? (
                <div className="my-4 p-4 bg-white rounded-2xl border-4 border-emerald-500 shadow-glow-emerald">
                  <img src={waState.qrDataUrl} alt="WhatsApp Pairing QR Code" className="w-56 h-56" />
                </div>
              ) : (
                <div className="my-8 flex flex-col items-center justify-center p-8 rounded-2xl border border-white/10 bg-white/5 text-text-muted space-y-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-indigo-400" />
                  <p className="text-xs">Generating fresh pairing QR code...</p>
                </div>
              )}

              <p className="text-xs text-text-muted max-w-sm mt-2">
                Open WhatsApp on your mobile phone &gt; Linked Devices &gt; Link a Device &gt; Scan this QR code.
              </p>
            </Card>

            {/* Right: Phone Pairing Code Panel */}
            <Card className="border border-white/[0.06] bg-white/[0.01] p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4 text-indigo-400" />
                  Link via 8-Digit Pairing Code
                </h3>
                <p className="text-xs text-text-muted mb-4">
                  Prefer not to scan a QR code? Enter your WhatsApp business phone number (with country code) to receive an 8-digit pair code.
                </p>

                <form onSubmit={handleRequestPairingCode} className="space-y-4">
                  <Input
                    label="WhatsApp Business Phone Number"
                    placeholder="e.g. 94771234567 or 14155552671"
                    value={pairingPhone}
                    onChange={(e) => setPairingPhone(e.target.value)}
                  />

                  <Button type="submit" loading={generatingCode} disabled={!pairingPhone.trim() || waState?.state === 'connected'} className="w-full">
                    Generate 8-Digit Pairing Code
                  </Button>
                </form>

                {pairingCode && (
                  <div className="mt-6 p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-center space-y-2">
                    <p className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">Your Pairing Code</p>
                    <div className="text-2xl font-mono font-bold tracking-widest text-white">{pairingCode}</div>
                    <p className="text-[11px] text-text-muted">Enter this code in WhatsApp on your phone under Linked Devices.</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.06] text-xs text-text-muted flex items-center justify-between">
                <span>Last Updated: {waState?.updatedAt ? new Date(waState.updatedAt).toLocaleTimeString() : 'N/A'}</span>
                <span className="font-mono bg-white/5 px-2 py-0.5 rounded text-[10px]">Baileys v6.7</span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* DISCORD TAB */}
      {activeTab === 'discord' && (
        <div className="space-y-6">
          <Card className="border border-white/[0.06] bg-white/[0.01] p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Bot className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    Discord Support Bot Daemon
                    {discordState?.status === 'connected' ? (
                      <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                        🟢 Online ({discordState?.botTag})
                      </span>
                    ) : (
                      <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-bold text-rose-400 border border-rose-500/30">
                        🔴 Offline / Check DISCORD_BOT_TOKEN
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Dedicated ticket channel creation with role permissions and bi-directional thread syncing.
                  </p>
                </div>
              </div>

              <Button variant="secondary" onClick={loadDiscordStatus} loading={loadingDiscord} className="text-xs flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh Status
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border border-white/[0.06] bg-white/[0.01] p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Connected Guilds</span>
                <Radio className="h-4 w-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-bold text-white">{discordState?.guildsCount ?? 0}</p>
              <p className="text-[11px] text-text-muted">Discord servers where bot resides</p>
            </Card>

            <Card className="border border-white/[0.06] bg-white/[0.01] p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Active Dedicated Ticket Channels</span>
                <Hash className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-white">{discordState?.activeTicketChannels ?? 0}</p>
              <p className="text-[11px] text-text-muted">Channels starting with ticket-*</p>
            </Card>

            <Card className="border border-white/[0.06] bg-white/[0.01] p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Staff Role Permission ID</span>
                <ShieldCheck className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-xs font-mono text-white truncate font-bold">{discordState?.staffRoleId || 'Configured via ENV'}</p>
              <p className="text-[11px] text-text-muted">Role granted access to ticket channels</p>
            </Card>
          </div>

          <Card className="border border-white/[0.06] bg-white/[0.01] p-6 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Zap className="h-4 w-4 text-indigo-400" />
              Dedicated Channel Permission Overwrites Policy
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-2">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" /> Staff Roles Access
                </div>
                <p className="text-text-muted">
                  Members with the configured Staff Role ID are granted full access (`ViewChannel`, `SendMessages`, `ReadMessageHistory`) to all `ticket-*` channels.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-2">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-indigo-400" /> Linked Customer Access
                </div>
                <p className="text-text-muted">
                  If the ticket creator has linked their Discord Account ID in the dashboard, they are automatically assigned private access to their dedicated ticket channel.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* LIVE TESTER TAB */}
      {activeTab === 'tester' && (
        <Card className="border border-white/[0.06] bg-white/[0.01] p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Send className="h-4 w-4 text-indigo-400" />
              Multi-Channel Bot Message Dispatcher
            </h3>
            <p className="text-xs text-text-muted mt-1">
              Send test notifications or manual replies directly through the WhatsApp or Discord Bot Gateways.
            </p>
          </div>

          <form onSubmit={handleSendTestMessage} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Target Gateway</label>
              <select
                value={testTarget}
                onChange={(e) => setTestTarget(e.target.value as any)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50"
              >
                <option value="whatsapp" className="bg-[#0a0a14]">📱 WhatsApp DM (via Phone Number)</option>
                <option value="discord_channel" className="bg-[#0a0a14]">💬 Discord Channel (Support / Dedicated Ticket)</option>
                <option value="discord_dm" className="bg-[#0a0a14]">✉️ Discord User DM (via Discord User ID)</option>
              </select>
            </div>

            <Input
              required
              label={
                testTarget === 'whatsapp'
                  ? 'Recipient Phone Number (with Country Code)'
                  : testTarget === 'discord_dm'
                  ? 'Discord User Snowflake ID'
                  : 'Discord Channel ID (Leave blank for default Admin Alert Channel)'
              }
              placeholder={
                testTarget === 'whatsapp'
                  ? 'e.g. 94771234567'
                  : testTarget === 'discord_dm'
                  ? 'e.g. 123456789012345678'
                  : 'e.g. 109876543210987654 (Optional)'
              }
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
            />

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Message Content</label>
              <textarea
                required
                rows={4}
                placeholder="Type your test message or alert content here..."
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-text-faint focus:outline-none focus:border-accent-violet/50 transition-all resize-none text-white"
              />
            </div>

            <Button type="submit" loading={sendingTest} className="w-full">
              Dispatch Message
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
