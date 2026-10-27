'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { NotificationChannel } from '@/lib/types';

export default function NotificationsPage() {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'discord' | 'whatsapp' | 'email' | 'webhook'>('discord');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, []);

  async function fetchChannels() {
    setLoading(true);
    try {
      const res = await api.notifications.listChannels();
      setChannels(res.channels || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const configJson: Record<string, any> = {};
      if (type === 'discord' || type === 'webhook') {
        configJson.webhookUrl = webhookUrl.trim();
      } else if (type === 'whatsapp') {
        configJson.phoneNumber = phoneNumber.trim();
      } else if (type === 'email') {
        configJson.emailAddress = emailAddress.trim();
      }

      await api.notifications.createChannel({
        name: name.trim(),
        type,
        configJson,
        isEnabled: true,
      });

      setShowAddModal(false);
      setName('');
      setWebhookUrl('');
      setPhoneNumber('');
      setEmailAddress('');
      setNotice(`Notification channel '${name}' created successfully!`);
      setTimeout(() => setNotice(null), 4000);
      fetchChannels();
    } catch (err: any) {
      alert(`Failed to create channel: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTestChannel(id: string) {
    setTestingId(id);
    try {
      const res = await api.notifications.testChannel(id);
      if (res.success) {
        setNotice(`Test notification sent successfully! (${res.detail})`);
      } else {
        alert(`Test notification failed: ${res.detail}`);
      }
      setTimeout(() => setNotice(null), 5000);
    } catch (err: any) {
      alert(`Test dispatch error: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  }

  async function handleToggleChannel(channel: NotificationChannel) {
    try {
      await api.notifications.updateChannel(channel.id, { isEnabled: !channel.isEnabled });
      fetchChannels();
    } catch (err: any) {
      alert(`Failed to update channel: ${err.message}`);
    }
  }

  async function handleDeleteChannel(id: string) {
    if (!confirm('Are you sure you want to delete this notification channel?')) return;
    try {
      await api.notifications.deleteChannel(id);
      fetchChannels();
    } catch (err: any) {
      alert(`Failed to delete channel: ${err.message}`);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-5">
        <div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/5 text-neutral-300 border border-white/15">
            Multi-Channel Alerts
          </span>
          <h1 className="text-2xl font-bold text-white mt-1">Notification Channels</h1>
          <p className="text-xs text-text-muted mt-1">
            Configure real-time alerts across Discord webhooks, WhatsApp messaging, Email, and HTTP endpoints for deployment failures, payment events, and system incidents.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl font-bold text-xs bg-indigo-500 hover:bg-white text-black text-white shadow-lg shadow-md transition-all flex items-center gap-2"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Channel
        </button>
      </div>

      {notice && (
        <div className="p-3 bg-white/5 border border-white/15 rounded-xl text-xs font-semibold text-neutral-300 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-white hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-text-muted animate-pulse">Loading notification channels...</div>
      ) : channels.length === 0 ? (
        <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-12 text-center space-y-3">
          <p className="text-sm font-semibold text-white">No Notification Channels Configured</p>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Click &quot;Add Channel&quot; to configure your first Discord webhook, WhatsApp gateway, or custom HTTP endpoint.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((channel) => (
            <div key={channel.id} className="bg-[#0b0c16] border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/15 text-white">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{channel.name}</h3>
                    <span className="text-[10px] text-text-muted uppercase font-semibold tracking-wider">
                      Type: {channel.type}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleChannel(channel)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                    channel.isEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                  }`}
                >
                  {channel.isEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="p-3 bg-black/40 border border-white/5 rounded-xl font-mono text-xs text-text-muted truncate">
                {channel.configJson?.webhookUrl || channel.configJson?.phoneNumber || channel.configJson?.emailAddress || 'Configured'}
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-[10px] text-text-muted">Added {new Date(channel.createdAt).toLocaleDateString()}</span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestChannel(channel.id)}
                    disabled={testingId === channel.id}
                    className="px-3 py-1 rounded-lg bg-white/5 border border-white/15 text-neutral-300 hover:bg-white/10 text-xs font-semibold disabled:opacity-30"
                  >
                    {testingId === channel.id ? 'Testing...' : 'Test Alert'}
                  </button>

                  <button
                    onClick={() => handleDeleteChannel(channel.id)}
                    className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Channel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0b0c16] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Add Notification Channel</h3>
              <button onClick={() => setShowAddModal(false)} className="text-text-muted hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-3 text-xs">
              <div>
                <label className="block text-text-muted mb-1">Channel Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production Alerts Discord"
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-text-muted mb-1">Integration Type *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-white/30"
                >
                  <option value="discord">Discord Webhook</option>
                  <option value="whatsapp">WhatsApp Gateway</option>
                  <option value="email">Email Alert</option>
                  <option value="webhook">Custom HTTP Webhook</option>
                </select>
              </div>

              {(type === 'discord' || type === 'webhook') && (
                <div>
                  <label className="block text-text-muted mb-1">Webhook URL *</label>
                  <input
                    type="url"
                    required
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-white/30"
                  />
                </div>
              )}

              {type === 'whatsapp' && (
                <div>
                  <label className="block text-text-muted mb-1">Recipient Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+94771234567"
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-white/30"
                  />
                </div>
              )}

              {type === 'email' && (
                <div>
                  <label className="block text-text-muted mb-1">Alert Email Address *</label>
                  <input
                    type="email"
                    required
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="devs@mycompany.com"
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-white/30"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-white font-semibold hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-white text-black text-white font-bold disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Save Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
