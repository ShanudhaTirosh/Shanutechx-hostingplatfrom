'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Settings, FileSignature, FileText, Sun, Ban, X, Trash2, Plus, Zap, HardDrive,
  MailCheck, ArrowUpCircle, CheckCircle2, ExternalLink, Globe, ShieldCheck, User,
  Check, RefreshCw, Layers, Key, Upload, Image, Camera, Code, Copy, Send, Eye, EyeOff, Server,
  Briefcase, Building, Phone, UserCircle, AlertCircle, Sparkles, SlidersHorizontal, Columns, Rows, Bell, Monitor
} from 'lucide-react';

export interface WebmailSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mailboxes?: any[];
  activeMailboxId?: string | null;
  onRefreshData?: () => void;
  density?: 'comfortable' | 'default' | 'compact';
  onDensityChange?: (d: 'comfortable' | 'default' | 'compact') => void;
  readingPane?: 'right' | 'bottom' | 'off';
  onReadingPaneChange?: (rp: 'right' | 'bottom' | 'off') => void;
}

export function WebmailSettingsModal({
  isOpen,
  onClose,
  mailboxes = [],
  activeMailboxId,
  onRefreshData,
  density = 'default',
  onDensityChange,
  readingPane = 'right',
  onReadingPaneChange,
}: WebmailSettingsModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'profile' | 'connect' | 'dns' | 'signatures' | 'templates' | 'autoreply' | 'blocklist' | 'upgrade'>('general');
  const [notificationStatus, setNotificationStatus] = useState<'default' | 'granted' | 'denied'>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationStatus(Notification.permission);
    }
  }, [isOpen]);

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotificationStatus(permission);
        if (permission === 'granted') {
          toast('Desktop notifications enabled successfully!', 'success');
        } else {
          toast('Desktop notifications were not enabled', 'info');
        }
      } catch (_) {}
    }
  };

  const [mailboxInfo, setMailboxInfo] = useState<any | null>(null);

  // Profile Tab State
  const [allMailboxes, setAllMailboxes] = useState<any[]>(mailboxes || []);
  const [profileMailboxId, setProfileMailboxId] = useState<string>(activeMailboxId || '');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Website Connect Tab State
  const [websiteConnectData, setWebsiteConnectData] = useState<any | null>(null);
  const [isLoadingConnect, setIsLoadingConnect] = useState(false);
  const [connectLang, setConnectLang] = useState<'wordpress' | 'resend_api' | 'nextjs' | 'nodejs' | 'laravel' | 'php' | 'python'>('wordpress');
  const [copiedConnectField, setCopiedConnectField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testSubject, setTestSubject] = useState('Website Connection Verification');
  const [isTestingSend, setIsTestingSend] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{ success: boolean; message: string } | null>(null);

  // DNS & Aliases Tab State
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [dnsResults, setDnsResults] = useState<any | null>(null);
  const [isVerifyingDns, setIsVerifyingDns] = useState(false);
  const [newAliasPrefix, setNewAliasPrefix] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);

  // Signatures, Templates, AutoReply, Blocklist State
  const [signatures, setSignatures] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [autoReply, setAutoReply] = useState<any | null>(null);
  const [blockedSenders, setBlockedSenders] = useState<any[]>([]);

  const [sigName, setSigName] = useState('');
  const [sigHtml, setSigHtml] = useState('');

  const [tempName, setTempName] = useState('');
  const [tempSubject, setTempSubject] = useState('');
  const [tempBody, setTempBody] = useState('');

  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoSubject, setAutoSubject] = useState('Out of Office');
  const [autoBody, setAutoBody] = useState('I am currently away and will reply upon return.');

  const [blockInput, setBlockInput] = useState('');
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const toast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (isOpen) {
      fetchAllSettings();
      api.email.mailboxes().then((r: any) => {
        const list = r.mailboxes || [];
        setAllMailboxes(list);
        if (list.length > 0) {
          const active = list.find((m: any) => m.id === (profileMailboxId || activeMailboxId)) || list[0];
          setMailboxInfo(active);
          setProfileMailboxId(active.id);
          setCustomDomainInput(active.customDomain || active.domain || 'shanutechx.com');
          setAliases(active.aliases || []);
          loadMailboxProfile(active.id, active);
        }
      }).catch(() => {});
    }
  }, [isOpen, activeMailboxId]);

  const loadMailboxProfile = async (mbId: string, initialMb?: any) => {
    if (initialMb?.profile) {
      setDisplayName(initialMb.profile.displayName || '');
      setAvatarUrl(initialMb.profile.avatarUrl || '');
      setJobTitle(initialMb.profile.jobTitle || '');
      setCompany(initialMb.profile.company || '');
      setPhone(initialMb.profile.phone || '');
      setBio(initialMb.profile.bio || '');
      setWebsite(initialMb.profile.website || '');
    }
    try {
      const res = await api.email.getMailboxProfile(mbId);
      if (res?.profile) {
        setDisplayName(res.profile.displayName || '');
        setAvatarUrl(res.profile.avatarUrl || '');
        setJobTitle(res.profile.jobTitle || '');
        setCompany(res.profile.company || '');
        setPhone(res.profile.phone || '');
        setBio(res.profile.bio || '');
        setWebsite(res.profile.website || '');
      }
    } catch {}
  };

  const handleSelectProfileMailbox = (mbId: string) => {
    setProfileMailboxId(mbId);
    const found = allMailboxes.find((m: any) => m.id === mbId);
    if (found) {
      setMailboxInfo(found);
      setCustomDomainInput(found.customDomain || found.domain || 'shanutechx.com');
      setAliases(found.aliases || []);
    }
    loadMailboxProfile(mbId, found);
  };

  const fetchAllSettings = () => {
    api.webmail.signatures.list().then((r: any) => setSignatures(r.signatures || [])).catch(() => {});
    api.webmail.templates.list().then((r: any) => setTemplates(r.templates || [])).catch(() => {});
    api.webmail.autoReply.get().then((r: any) => {
      if (r.autoReply) {
        setAutoReply(r.autoReply);
        setAutoEnabled(r.autoReply.enabled);
        setAutoSubject(r.autoReply.subject);
        setAutoBody(r.autoReply.body);
      }
    }).catch(() => {});
    api.webmail.blockedSenders.list().then((r: any) => setBlockedSenders(r.blockedSenders || [])).catch(() => {});
  };

  const copyConnectText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedConnectField(field);
    setTimeout(() => setCopiedConnectField(null), 2000);
  };

  const loadWebsiteConnect = async (mailboxId?: string) => {
    if (!mailboxId) return;
    setIsLoadingConnect(true);
    try {
      const res = await api.email.websiteConnect(mailboxId);
      setWebsiteConnectData(res);
    } catch {
      setWebsiteConnectData(null);
    } finally {
      setIsLoadingConnect(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'connect' && mailboxInfo?.id && !websiteConnectData) {
      void loadWebsiteConnect(mailboxInfo.id);
    }
  }, [activeSubTab, mailboxInfo?.id, websiteConnectData]);

  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTo.trim()) return;
    setIsTestingSend(true);
    setTestSendResult(null);
    try {
      const res = await api.email.sendTransactional({
        from: mailboxInfo?.email || 'user@shanutechx.com',
        to: testTo.trim(),
        subject: testSubject.trim() || 'Website Connection Test Email',
        html: `<h3>Test Email from ShanuTechX Webmail</h3><p>Your website connection is verified and operational! Sent at ${new Date().toISOString()}.</p>`,
      });
      setTestSendResult({ success: true, message: `Dispatched successfully! Message ID: ${res.id || 'ok'}` });
      toast('Test email delivered successfully!', 'success');
    } catch (err: any) {
      setTestSendResult({ success: false, message: err.message || 'Failed to dispatch test email' });
      toast(err.message || 'Test send failed', 'error');
    } finally {
      setIsTestingSend(false);
    }
  };

  if (!isOpen) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMime.includes(file.type)) {
      toast('Security restriction: Only JPG, PNG, WEBP, or GIF image files are allowed.', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast('Security restriction: File size exceeds 5MB limit.', 'error');
      return;
    }

    const targetMbId = profileMailboxId || mailboxInfo?.id;
    if (!targetMbId) {
      toast('Please select an active mailbox first.', 'error');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const res = await api.email.uploadMailboxAvatar(targetMbId, file);
      if (res.avatarUrl) {
        setAvatarUrl(res.avatarUrl);
        toast('Profile picture uploaded & binary magic bytes verified!', 'success');
        setAllMailboxes((prev) =>
          prev.map((m) =>
            m.id === targetMbId ? { ...m, profile: { ...m.profile, avatarUrl: res.avatarUrl } } : m
          )
        );
        onRefreshData?.();
      }
    } catch (err: any) {
      toast(err.message || 'Avatar upload failed. Magic byte inspection rejected the file.', 'error');
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    const targetMbId = profileMailboxId || mailboxInfo?.id;
    if (!targetMbId) return;

    try {
      await api.email.removeMailboxAvatar(targetMbId);
      setAvatarUrl('');
      setAllMailboxes((prev) =>
        prev.map((m) =>
          m.id === targetMbId ? { ...m, profile: { ...m.profile, avatarUrl: null } } : m
        )
      );
      toast('Profile picture removed', 'info');
      onRefreshData?.();
    } catch (err: any) {
      toast(err.message || 'Failed to remove avatar', 'error');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetMbId = profileMailboxId || mailboxInfo?.id;
    if (!targetMbId) {
      toast('No active mailbox selected', 'error');
      return;
    }

    setIsSavingProfile(true);
    try {
      const updatedProfile = {
        displayName: displayName.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        jobTitle: jobTitle.trim() || null,
        company: company.trim() || null,
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        website: website.trim() || null,
      };
      await api.email.updateMailboxProfile(targetMbId, updatedProfile);
      setAllMailboxes((prev) =>
        prev.map((m) =>
          m.id === targetMbId ? { ...m, profile: updatedProfile } : m
        )
      );
      toast('Mailbox profile preferences saved successfully!', 'success');
      onRefreshData?.();
    } catch (err: any) {
      toast(err.message || 'Failed to update mailbox profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleVerifyDns = async () => {
    const domainToTest = customDomainInput.trim() || 'shanutechx.com';
    setIsVerifyingDns(true);
    try {
      const res = await api.post('/smtp/verify-dns', { domain: domainToTest });
      setDnsResults(res);
      toast(`DNS Verification complete for ${domainToTest}`, 'success');
    } catch (err: any) {
      toast(err.message || 'DNS verification failed', 'error');
    } finally {
      setIsVerifyingDns(false);
    }
  };

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAliasPrefix.trim() || !mailboxInfo?.id) return;
    try {
      const res = await api.post(`/smtp-accounts/${mailboxInfo.id}/aliases`, { prefix: newAliasPrefix.trim() }).catch(async () => {
        return await api.webmail.createAlias({
          smtpAccountId: mailboxInfo.id,
          aliasEmail: `${newAliasPrefix.trim()}@${customDomainInput}`,
        });
      });
      setAliases(res.aliases || [...aliases, `${newAliasPrefix.trim()}@${customDomainInput}`]);
      setNewAliasPrefix('');
      toast(`Alias added successfully!`, 'success');
      onRefreshData?.();
    } catch (err: any) {
      toast(err.message || 'Failed to add alias', 'error');
    }
  };

  const handleDeleteAlias = async (aliasEmail: string) => {
    if (!mailboxInfo?.id) return;
    const prefix = aliasEmail.split('@')[0];
    try {
      const res = await api.delete(`/smtp-accounts/${mailboxInfo.id}/aliases/${prefix}`).catch(async () => {
        return await api.webmail.deleteAlias({ smtpAccountId: mailboxInfo.id, aliasEmail });
      });
      setAliases(res.aliases || aliases.filter((a) => a !== aliasEmail));
      toast(`Alias ${aliasEmail} removed!`, 'info');
      onRefreshData?.();
    } catch (err: any) {
      toast(err.message || 'Failed to remove alias', 'error');
    }
  };

  const handleSaveSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sigName || !sigHtml) return;
    try {
      await api.webmail.signatures.create({ name: sigName, htmlContent: sigHtml, isDefault: signatures.length === 0 });
      toast(`Signature "${sigName}" created!`, 'success');
      setSigName('');
      setSigHtml('');
      fetchAllSettings();
    } catch {
      toast('Failed to save signature', 'error');
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName || !tempBody) return;
    try {
      await api.webmail.templates.create({ name: tempName, subject: tempSubject, body: tempBody });
      toast(`Template "${tempName}" created!`, 'success');
      setTempName('');
      setTempSubject('');
      setTempBody('');
      fetchAllSettings();
    } catch {
      toast('Failed to save template', 'error');
    }
  };

  const handleSaveAutoReply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.webmail.autoReply.save({ enabled: autoEnabled, subject: autoSubject, body: autoBody });
      toast('Vacation auto-responder updated!', 'success');
      fetchAllSettings();
    } catch {
      toast('Failed to save auto-reply', 'error');
    }
  };

  const handleAddBlockedSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockInput) return;
    try {
      await api.webmail.blockedSenders.add({ emailOrDomain: blockInput });
      toast(`Blocked ${blockInput}`, 'info');
      setBlockInput('');
      fetchAllSettings();
    } catch {
      toast('Failed to block sender', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-3xl w-full space-y-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Settings className="h-4 w-4 text-indigo-400" />
            <span>Webmail Studio Settings & Preferences</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {toastMessage && (
          <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150 ${
            toastMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
            toastMessage.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' :
            'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
          }`}>
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMessage.message}</span>
          </div>
        )}

        {/* SUB TABS */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto">
          {[
            { id: 'general', label: 'General & View', icon: SlidersHorizontal },
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'connect', label: 'Website Connect', icon: Code },
            { id: 'dns', label: 'DNS & Aliases', icon: Globe },
            { id: 'signatures', label: 'Signatures', icon: FileSignature },
            { id: 'templates', label: 'Templates', icon: FileText },
            { id: 'autoreply', label: 'Vacation Reply', icon: Sun },
            { id: 'blocklist', label: 'Blocklist', icon: Ban },
            { id: 'upgrade', label: 'Upgrade & Plan', icon: Zap },
          ].map((tab) => {
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex-1 min-w-[72px] py-2 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                  activeSubTab === tab.id
                    ? tab.id === 'upgrade' ? 'bg-amber-500 text-white shadow' : 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <IconComp className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB: GENERAL & VIEW PREFERENCES */}
        {activeSubTab === 'general' && (
          <div className="space-y-5 text-xs max-h-[65vh] overflow-y-auto pr-1">
            {/* Display Density */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div>
                <h4 className="font-bold text-slate-100 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-indigo-400" /> Display Density
                </h4>
                <p className="text-[11px] text-slate-400">Choose how compact or spacious message list rows appear in your inbox</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'compact', label: 'Compact', desc: 'Maximum emails visible per screen' },
                  { id: 'default', label: 'Default', desc: 'Balanced spacing and clarity' },
                  { id: 'comfortable', label: 'Comfortable', desc: 'Spacious padding and breathing room' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onDensityChange?.(d.id as any)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      density === d.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold text-xs block">{d.label}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{d.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reading Pane Layout */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div>
                <h4 className="font-bold text-slate-100 flex items-center gap-2">
                  <Columns className="w-4 h-4 text-indigo-400" /> Reading Pane Placement
                </h4>
                <p className="text-[11px] text-slate-400">Configure how message contents are displayed alongside the mailbox list</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'right', label: 'Right of inbox', icon: Columns, desc: 'Side-by-side view (recommended)' },
                  { id: 'bottom', label: 'Below inbox', icon: Rows, desc: 'Horizontal split view' },
                  { id: 'off', label: 'No split', icon: Layers, desc: 'Full width reading mode' },
                ].map((rp) => {
                  const Icon = rp.icon;
                  return (
                    <button
                      key={rp.id}
                      type="button"
                      onClick={() => onReadingPaneChange?.(rp.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        readingPane === rp.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-bold text-xs">{rp.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">{rp.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Desktop Notifications */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-100 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-indigo-400" /> Desktop & Push Alerts
                  </h4>
                  <p className="text-[11px] text-slate-400">Receive instant operating system notifications when new messages arrive</p>
                </div>
                {notificationStatus === 'granted' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Notifications Active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-sm"
                  >
                    Enable Notifications
                  </button>
                )}
              </div>
            </div>

            {/* Keyboard Shortcuts Reference */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <h4 className="font-bold text-slate-100 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-indigo-400" /> Keyboard Shortcuts Support
              </h4>
              <p className="text-[11px] text-slate-400">
                Press <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-indigo-300">?</kbd> at any time in the mailbox to view all navigation shortcuts, <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-indigo-300">c</kbd> to compose, <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-indigo-300">/</kbd> to search, <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-indigo-300">r</kbd> to reply, <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-indigo-300">e</kbd> to archive, <kbd className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10px] text-indigo-300">#</kbd> to delete.
              </p>
            </div>
          </div>
        )}

        {/* TAB 0: PROFILE & AVATAR */}
        {activeSubTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-5 text-xs max-h-[65vh] overflow-y-auto pr-1">
            {/* Mailbox Selector */}
            {allMailboxes.length > 1 && (
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <label className="text-slate-300 font-bold block flex items-center gap-1.5">
                  <UserCircle className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Configuring Mailbox Profile</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allMailboxes.map((mb) => (
                    <button
                      type="button"
                      key={mb.id}
                      onClick={() => handleSelectProfileMailbox(mb.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        profileMailboxId === mb.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-mono font-bold text-xs block truncate">{mb.email}</span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {mb.profile?.displayName || mb.username}
                        </span>
                      </div>
                      {profileMailboxId === mb.id && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Profile Avatar Card */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-indigo-400 flex items-center gap-2">
                  <User className="h-4 w-4" /> Mailbox Profile Picture & Branding
                </h4>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Magic Byte Verification</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Configure your custom avatar picture and contact information for <span className="font-mono text-indigo-300 font-bold">{mailboxInfo?.email || 'this mailbox'}</span>. Outbound emails will use this display name and branding.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pt-1">
                {/* Avatar Display */}
                <div className="relative group shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white text-2xl font-black shadow-xl border-2 border-indigo-500/40 overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      (displayName || mailboxInfo?.username || 'U').slice(0, 2).toUpperCase()
                    )}
                  </div>
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 bg-slate-950/80 rounded-2xl flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Upload & Security Controls */}
                <div className="flex-1 space-y-3 w-full">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md flex items-center gap-2">
                      {isUploadingAvatar ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{isUploadingAvatar ? 'Scanning & Uploading...' : 'Upload Picture'}</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp, image/gif"
                        disabled={isUploadingAvatar}
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>

                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Remove Picture</span>
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-2.5 text-[11px] text-slate-400 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Security & Integrity Guard</span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Files are cryptographically sanitized and validated via binary magic bytes (JPEG, PNG, WebP, GIF only). Executables, shell scripts, SVGs, and files exceeding 5MB are strictly rejected.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Fields Grid */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
              <h4 className="font-bold text-slate-200 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" /> Profile Information & RFC 5322 From Header
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Display Name */}
                <div className="sm:col-span-2">
                  <label className="text-slate-300 font-bold block mb-1">
                    Display Name <span className="text-indigo-400 font-normal">(Sender name seen by email recipients)</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Sarah Connor"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
                  />
                </div>

                {/* Job Title */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1 flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    <span>Job Title / Designation</span>
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Principal Cloud Architect"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
                  />
                </div>

                {/* Company */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1 flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>Company / Organization</span>
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. ShanuTechX Global Corp"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Direct Phone Number</span>
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +1 555-0199"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
                  />
                </div>

                {/* Website */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>Website URL</span>
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="e.g. https://shanutechx.com"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
                  />
                </div>

                {/* Bio / Signature Note */}
                <div className="sm:col-span-2">
                  <label className="text-slate-300 font-bold block mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Bio / Professional Tagline</span>
                  </label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="e.g. Leading enterprise cloud modernization & resilient container orchestration."
                    className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Live Recipient Email Header Preview */}
            <div className="bg-gradient-to-r from-slate-950 to-indigo-950/40 p-4 rounded-2xl border border-indigo-500/30 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block flex items-center gap-1.5">
                <Eye className="w-3 h-3" />
                <span>Live Recipient Email Header Preview</span>
              </span>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0 border border-indigo-500/30 shadow">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    (displayName || mailboxInfo?.username || 'U').slice(0, 2).toUpperCase()
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-white truncate">
                      {displayName || mailboxInfo?.username || 'Sender Display Name'}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 truncate">
                      &lt;{mailboxInfo?.email || 'user@shanutechx.com'}&gt;
                    </span>
                  </div>
                  {(jobTitle || company) && (
                    <span className="text-[10px] text-indigo-300 block truncate mt-0.5">
                      {jobTitle} {company ? `• ${company}` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50 transition-all text-xs"
              >
                {isSavingProfile ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span>Save Mailbox Profile Preferences</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 1: WEBSITE CONNECT & API */}
        {activeSubTab === 'connect' && (
          <div className="space-y-4 text-xs max-h-[60vh] overflow-y-auto pr-1">
            {/* Mailbox SMTP & REST API Credentials Overview */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-indigo-400 flex items-center gap-2">
                  <Server className="h-4 w-4" /> Mailbox SMTP & API Credentials
                </h4>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                  Autonomous Cluster Ready
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Connect external websites, WordPress, WooCommerce, webhooks, or automated backend services using these dedicated mailbox credentials.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">SMTP Server Host</span>
                  <div className="flex items-center justify-between font-mono text-white text-xs">
                    <span>{websiteConnectData?.credentials?.smtpHost || 'mail.shanutechx.com'}</span>
                    <button
                      type="button"
                      onClick={() => copyConnectText(websiteConnectData?.credentials?.smtpHost || 'mail.shanutechx.com', 'smtpHost')}
                      className="text-slate-400 hover:text-indigo-400"
                    >
                      {copiedConnectField === 'smtpHost' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Port & Encryption</span>
                  <div className="font-mono text-white text-xs">
                    465 (SSL/TLS) • 587 (STARTTLS)
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">SMTP Username</span>
                  <div className="flex items-center justify-between font-mono text-white text-xs">
                    <span className="truncate">{mailboxInfo?.email || 'user@shanutechx.com'}</span>
                    <button
                      type="button"
                      onClick={() => copyConnectText(mailboxInfo?.email || 'user@shanutechx.com', 'username')}
                      className="text-slate-400 hover:text-indigo-400 ml-1"
                    >
                      {copiedConnectField === 'username' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">SMTP Password</span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-200 text-[10px] flex items-center gap-1"
                    >
                      {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPassword ? 'Hide' : 'Reveal'}</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between font-mono text-white text-xs">
                    <span>
                      {showPassword
                        ? (websiteConnectData?.credentials?.password || mailboxInfo?.smtpPassword || '••••••••')
                        : '••••••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyConnectText(websiteConnectData?.credentials?.password || mailboxInfo?.smtpPassword || '', 'password')}
                      className="text-slate-400 hover:text-indigo-400"
                    >
                      {copiedConnectField === 'password' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Integration Guides & Code Snippets */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="font-bold text-indigo-400 flex items-center gap-2">
                  <Code className="h-4 w-4" /> Ready-to-Use Website & API Code
                </h4>
                <div className="flex flex-wrap gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px]">
                  {[
                    { id: 'wordpress', label: 'WordPress' },
                    { id: 'resend_api', label: 'Resend API' },
                    { id: 'nextjs', label: 'Next.js' },
                    { id: 'nodejs', label: 'Node.js' },
                    { id: 'laravel', label: 'Laravel' },
                    { id: 'php', label: 'PHP' },
                    { id: 'python', label: 'Python' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setConnectLang(item.id as any)}
                      className={`px-2 py-1 rounded-lg font-mono transition-all ${
                        connectLang === item.id
                          ? 'bg-indigo-600 text-white font-bold shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Code Snippet Box */}
              <div className="relative bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-indigo-300 overflow-x-auto max-h-56">
                <button
                  type="button"
                  onClick={() => {
                    const snippet = websiteConnectData?.codeSnippets?.[
                      connectLang === 'resend_api' ? 'resendRestApi' :
                      connectLang === 'nextjs' ? 'nextjs14' :
                      connectLang === 'nodejs' ? 'nodemailer' :
                      connectLang === 'laravel' ? 'laravelEnv' :
                      connectLang === 'php' ? 'phpMailer' :
                      connectLang === 'python' ? 'python' : 'wordpress'
                    ];
                    const textToCopy = typeof snippet === 'object' ? (snippet.curl || JSON.stringify(snippet, null, 2)) : (snippet || '');
                    copyConnectText(textToCopy, 'activeSnippet');
                  }}
                  className="absolute top-2.5 right-2.5 p-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-[10px]"
                >
                  {copiedConnectField === 'activeSnippet' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedConnectField === 'activeSnippet' ? 'Copied' : 'Copy'}</span>
                </button>
                <pre className="whitespace-pre">
                  {connectLang === 'wordpress' && (
                    `// WordPress (WP Mail SMTP / FluentSMTP / wp_mail) Settings
// SMTP Host: ${websiteConnectData?.credentials?.smtpHost || 'mail.shanutechx.com'}
// SMTP Port: 465 (SSL) or 587 (TLS)
// Encryption: SSL / TLS
// Auto TLS: On
// Authentication: Yes
// SMTP Username: ${mailboxInfo?.email || 'user@shanutechx.com'}
// SMTP Password: ${websiteConnectData?.credentials?.password || mailboxInfo?.smtpPassword || '<YOUR_MAILBOX_PASSWORD>'}
// From Email: ${mailboxInfo?.email || 'user@shanutechx.com'}

// Or add directly to wp-config.php:
define('WP_MAIL_SMTP_HOST', '${websiteConnectData?.credentials?.smtpHost || 'mail.shanutechx.com'}');
define('WP_MAIL_SMTP_PORT', 465);
define('WP_MAIL_SMTP_ENCRYPTION', 'ssl');
define('WP_MAIL_SMTP_AUTH', true);
define('WP_MAIL_SMTP_USER', '${mailboxInfo?.email || 'user@shanutechx.com'}');
define('WP_MAIL_SMTP_PASS', '${websiteConnectData?.credentials?.password || mailboxInfo?.smtpPassword || '<YOUR_PASSWORD>'}');`
                  )}
                  {connectLang === 'resend_api' && (websiteConnectData?.codeSnippets?.resendRestApi?.curl || `// Resend-Compatible REST API
// POST https://${websiteConnectData?.credentials?.smtpHost || 'mail.shanutechx.com'}/api/v1/emails
// Header: Authorization: Bearer <ID_TOKEN> or Basic Auth (${mailboxInfo?.email}:<password>)
curl -X POST https://${websiteConnectData?.credentials?.smtpHost || 'mail.shanutechx.com'}/api/v1/emails \\
  -H "Authorization: Bearer <API_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "${mailboxInfo?.email || 'user@shanutechx.com'}",
    "to": "client@example.com",
    "subject": "Platform Automated Notification",
    "html": "<h3>Automated Message via REST API</h3>"
  }'`)}
                  {connectLang === 'nextjs' && (websiteConnectData?.codeSnippets?.nextjs14 || `// Next.js 14 API Route`)}
                  {connectLang === 'nodejs' && (websiteConnectData?.codeSnippets?.nodemailer || `// Node.js Nodemailer`)}
                  {connectLang === 'laravel' && (websiteConnectData?.codeSnippets?.laravelEnv || `# Laravel .env`)}
                  {connectLang === 'php' && (websiteConnectData?.codeSnippets?.phpMailer || `// PHP PHPMailer`)}
                  {connectLang === 'python' && (websiteConnectData?.codeSnippets?.python || `# Python smtplib`)}
                </pre>
              </div>
            </div>

            {/* Live Test Send */}
            <form onSubmit={handleTestSend} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-emerald-400 flex items-center gap-2">
                  <Send className="h-4 w-4" /> Live Website Email Dispatch Test
                </h4>
                <span className="text-[10px] text-slate-500">Test actual outbound delivery</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Send a real test email through your mailbox cluster to confirm your website and SMTP credentials are authenticated.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block text-[10px] mb-1">Recipient Email</label>
                  <input
                    type="email"
                    placeholder="recipient@example.com"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[10px] mb-1">Subject</label>
                  <input
                    type="text"
                    value={testSubject}
                    onChange={(e) => setTestSubject(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                    required
                  />
                </div>
              </div>

              {testSendResult && (
                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  testSendResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{testSendResult.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isTestingSend}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow flex items-center gap-2 disabled:opacity-50 transition-all text-xs"
              >
                {isTestingSend ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{isTestingSend ? 'Sending Test Email...' : 'Send Live Test Email'}</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: DNS & ALIASES */}
        {activeSubTab === 'dns' && (
          <div className="space-y-4 text-xs">
            {/* Domain DNS Verification */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-indigo-400 flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Domain DNS Record Verification
                </h4>
                <button
                  onClick={handleVerifyDns}
                  disabled={isVerifyingDns}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isVerifyingDns ? 'animate-spin' : ''}`} />
                  Verify DNS Now
                </button>
              </div>

              <input
                type="text"
                value={customDomainInput}
                onChange={(e) => setCustomDomainInput(e.target.value)}
                placeholder="Enter domain (e.g. mycompany.com)"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono"
              />

              {dnsResults && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Required DNS Records for {dnsResults.domain}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${dnsResults.verification?.mx ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                      <div>
                        <span className="font-bold text-xs block">MX Record</span>
                        <span className="text-[10px] font-mono opacity-80">10 mail.shanutechx.com</span>
                      </div>
                      {dnsResults.verification?.mx ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </div>

                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${dnsResults.verification?.spf ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                      <div>
                        <span className="font-bold text-xs block">SPF Record</span>
                        <span className="text-[10px] font-mono opacity-80">v=spf1 include:shanutechx.com ~all</span>
                      </div>
                      {dnsResults.verification?.spf ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </div>

                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${dnsResults.verification?.dkim ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                      <div>
                        <span className="font-bold text-xs block">DKIM Record</span>
                        <span className="text-[10px] font-mono opacity-80">wildduck._domainkey</span>
                      </div>
                      {dnsResults.verification?.dkim ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </div>

                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${dnsResults.verification?.dmarc ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                      <div>
                        <span className="font-bold text-xs block">DMARC Record</span>
                        <span className="text-[10px] font-mono opacity-80">v=DMARC1; p=quarantine</span>
                      </div>
                      {dnsResults.verification?.dmarc ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Aliases Config */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="font-bold text-indigo-400 flex items-center gap-2">
                <Layers className="h-4 w-4" /> Mailbox Custom Aliases
              </h4>

              <form onSubmit={handleAddAlias} className="flex gap-2">
                <div className="flex-1 flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1 text-xs">
                  <input
                    type="text"
                    placeholder="alias-name"
                    value={newAliasPrefix}
                    onChange={(e) => setNewAliasPrefix(e.target.value)}
                    className="flex-1 bg-transparent text-white outline-none py-1.5"
                    required
                  />
                  <span className="text-slate-500 font-mono text-[11px]">@{customDomainInput}</span>
                </div>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow">
                  Add Alias
                </button>
              </form>

              <div className="space-y-1.5 pt-2">
                {aliases.map((al) => (
                  <div key={al} className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between font-mono text-[11px]">
                    <span className="text-indigo-300">{al}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        Active Alias
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteAlias(al)}
                        className="p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded transition-colors"
                        title={`Remove alias ${al}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SIGNATURES */}
        {activeSubTab === 'signatures' && (
          <div className="space-y-4 text-xs">
            <form onSubmit={handleSaveSignature} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="font-bold text-indigo-400">Add New HTML Signature</h4>
              <input
                type="text"
                placeholder="Signature Label (e.g. Official Corporate)"
                value={sigName}
                onChange={(e) => setSigName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                required
              />
              <textarea
                rows={3}
                placeholder="HTML Signature (e.g. Best regards,<br/><b>Mike Robertson</b><br/>ShanuTechX Cloud)"
                value={sigHtml}
                onChange={(e) => setSigHtml(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white resize-none font-mono"
                required
              />
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span>Save Signature</span>
              </button>
            </form>

            <div className="space-y-2 max-h-36 overflow-y-auto">
              {signatures.map((s) => (
                <div key={s.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-start">
                  <div>
                    <span className="font-bold text-white">{s.name}</span> {s.isDefault && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded ml-2">Default</span>}
                    <div className="text-[11px] text-slate-400 mt-1 whitespace-pre-wrap">{s.htmlContent}</div>
                  </div>
                  <button onClick={() => api.webmail.signatures.delete(s.id).then(fetchAllSettings)} className="text-slate-500 hover:text-rose-400 p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: TEMPLATES */}
        {activeSubTab === 'templates' && (
          <div className="space-y-4 text-xs">
            <form onSubmit={handleSaveTemplate} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="font-bold text-indigo-400">Create Canned Response / Template</h4>
              <input
                type="text"
                placeholder="Template Title (e.g. Sales Inquiry Response)"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                required
              />
              <input
                type="text"
                placeholder="Default Subject Line"
                value={tempSubject}
                onChange={(e) => setTempSubject(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
              />
              <textarea
                rows={3}
                placeholder="Template body..."
                value={tempBody}
                onChange={(e) => setTempBody(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white resize-none"
                required
              />
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span>Save Template</span>
              </button>
            </form>

            <div className="space-y-2 max-h-36 overflow-y-auto">
              {templates.map((t) => (
                <div key={t.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-start">
                  <div>
                    <span className="font-bold text-white">{t.name}</span>
                    <p className="text-[11px] text-slate-400 truncate">{t.body}</p>
                  </div>
                  <button onClick={() => api.webmail.templates.delete(t.id).then(fetchAllSettings)} className="text-slate-500 hover:text-rose-400 p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: VACATION AUTO-REPLY */}
        {activeSubTab === 'autoreply' && (
          <form onSubmit={handleSaveAutoReply} className="space-y-4 text-xs">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Enable Out of Office Auto-Reply</span>
                <input
                  type="checkbox"
                  checked={autoEnabled}
                  onChange={(e) => setAutoEnabled(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 h-4 w-4 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Subject Line:</label>
                <input
                  type="text"
                  value={autoSubject}
                  onChange={(e) => setAutoSubject(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Auto-Reply Message Body:</label>
                <textarea
                  rows={4}
                  value={autoBody}
                  onChange={(e) => setAutoBody(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white resize-none"
                />
              </div>

              <button type="submit" className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow">
                Save Auto-Reply Settings
              </button>
            </div>
          </form>
        )}

        {/* TAB 5: BLOCKLIST */}
        {activeSubTab === 'blocklist' && (
          <div className="space-y-4 text-xs">
            <form onSubmit={handleAddBlockedSender} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex gap-2">
              <input
                type="text"
                placeholder="Block email or domain (e.g. spammer@domain.com or @badspammer.com)"
                value={blockInput}
                onChange={(e) => setBlockInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                required
              />
              <button type="submit" className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl shadow flex items-center gap-1.5">
                <Ban className="h-3.5 w-3.5" />
                <span>Block Sender</span>
              </button>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {blockedSenders.map((b) => (
                <div key={b.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="font-mono text-rose-300 font-bold">{b.emailOrDomain}</span>
                  <button onClick={() => api.webmail.blockedSenders.delete(b.id).then(fetchAllSettings)} className="text-slate-500 hover:text-white text-xs p-1">
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: MAILBOX UPGRADE */}
        {activeSubTab === 'upgrade' && (
          <div className="space-y-5 text-xs">
            {/* Current usage summary */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5" />
                Current Mailbox Usage
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] mb-1">Storage Quota</span>
                  <span className="font-extrabold text-white text-sm">
                    {mailboxInfo?.storageQuotaMb ? `${mailboxInfo.storageQuotaMb} MB` : '10,240 MB'}
                  </span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px] mb-1">Daily Send Limit</span>
                  <span className="font-extrabold text-white text-sm">
                    {mailboxInfo?.dailySendLimit ?? 2000} emails/day
                  </span>
                </div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-2">
                <MailCheck className="h-4 w-4 text-indigo-400" />
                <span className="text-slate-300">
                  <span className="font-bold text-white">{mailboxInfo?.email || 'user@shanutechx.com'}</span>
                  {' '}&mdash; <span className="text-emerald-400 font-bold">Active Service</span>
                </span>
              </div>
            </div>

            {/* Upgrade plan cards */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Available Upgrade Plans</h4>
              {[
                {
                  name: 'Starter',
                  storage: '2 GB',
                  sends: 500,
                  price: 'Free',
                  features: ['IMAP/SMTP Access', 'Basic Filters', '1 Alias'],
                  color: 'border-slate-700',
                  badge: 'text-slate-400 bg-slate-800',
                  current: !mailboxInfo?.storageQuotaMb || mailboxInfo.storageQuotaMb <= 2048,
                },
                {
                  name: 'Professional',
                  storage: '10 GB',
                  sends: 2000,
                  price: '$4/mo',
                  features: ['Everything in Starter', 'AI Drafts & Summarise', '5 Aliases', 'Priority Support'],
                  color: 'border-indigo-500/40',
                  badge: 'text-indigo-300 bg-indigo-500/20',
                  current: mailboxInfo?.storageQuotaMb > 2048 && mailboxInfo?.storageQuotaMb <= 10240,
                },
                {
                  name: 'Business',
                  storage: '50 GB',
                  sends: 10000,
                  price: '$12/mo',
                  features: ['Everything in Pro', 'Custom Domain', '20 Aliases', 'Delegated Admin', 'SLA 99.9%'],
                  color: 'border-amber-500/40',
                  badge: 'text-amber-300 bg-amber-500/20',
                  current: mailboxInfo?.storageQuotaMb > 10240,
                },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={`p-4 rounded-2xl border ${plan.color} bg-slate-950 flex items-start justify-between gap-3`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${plan.badge}`}>{plan.name}</span>
                      {plan.current && (
                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                          <CheckCircle2 className="h-3 w-3" /> Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-300">
                      <span><HardDrive className="h-3 w-3 inline mr-1 text-slate-500" />{plan.storage}</span>
                      <span><MailCheck className="h-3 w-3 inline mr-1 text-slate-500" />{plan.sends.toLocaleString()} sends/day</span>
                    </div>
                    <ul className="space-y-0.5 text-[11px] text-slate-400">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-slate-600 shrink-0" />{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-extrabold text-white">{plan.price}</p>
                    {!plan.current && (
                      <a
                        href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001'}/billing`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] rounded-xl transition-all"
                      >
                        <ArrowUpCircle className="h-3 w-3" />
                        Upgrade
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-[10px] text-slate-600">
              To change your mailbox plan or renew subscriptions, visit the Billing section of your dashboard.
              Upgrades apply immediately after payment approval.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export { WebmailSettingsModal as SettingsModal };
export default WebmailSettingsModal;
