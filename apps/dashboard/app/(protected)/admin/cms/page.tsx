'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Card,
  Button,
  ErrorBanner,
  Spinner,
  Input,
  Textarea,
  PageHeader,
  useToast,
  Tabs,
  Badge,
  Table,
  Tr,
  Td,
  EmptyState,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

interface ContactSubmission {
  key: string;
  name: string;
  email: string;
  department: string;
  subject: string;
  message: string;
  submittedAt: string;
}

export default function AdminCmsPage() {
  const [activeTab, setActiveTab] = useState<'contact' | 'social' | 'branding' | 'inbox'>('contact');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Contact Info State
  const [supportEmail, setSupportEmail] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [supportHours, setSupportHours] = useState('');

  // Social Links State
  const [discordUrl, setDiscordUrl] = useState('');
  const [whatsappChannelUrl, setWhatsappChannelUrl] = useState('');
  const [telegramUrl, setTelegramUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');

  // Branding & Announcements State
  const [companyName, setCompanyName] = useState('');
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementActive, setAnnouncementActive] = useState(true);
  const [copyrightText, setCopyrightText] = useState('');

  // Submissions Inbox State
  const [submissions, setSubmissions] = useState<ContactSubmission[] | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  function loadCmsData() {
    setLoading(true);
    Promise.allSettled([api.cms.getContactInfo(), api.cms.getSubmissions()])
      .then(([infoRes, subRes]) => {
        if (infoRes.status === 'fulfilled') {
          const d = infoRes.value;
          setSupportEmail(d.supportEmail || '');
          setContactEmail(d.contactEmail || '');
          setContactPhone(d.contactPhone || '');
          setWhatsappPhone(d.whatsappPhone || '');
          setContactAddress(d.contactAddress || '');
          setSupportHours(d.supportHours || '');
          setDiscordUrl(d.discordUrl || '');
          setWhatsappChannelUrl(d.whatsappChannelUrl || '');
          setTelegramUrl(d.telegramUrl || '');
          setGithubUrl(d.githubUrl || '');
          setTwitterUrl(d.twitterUrl || '');
          setFacebookUrl(d.facebookUrl || '');
          setCompanyName(d.companyName || '');
          setHeroTitle(d.heroTitle || '');
          setHeroSubtitle(d.heroSubtitle || '');
          setAnnouncementText(d.announcementText || '');
          setAnnouncementActive(d.announcementActive !== false);
          setCopyrightText(d.copyrightText || '');
        }

        if (subRes.status === 'fulfilled') {
          setSubmissions(subRes.value.submissions || []);
        } else {
          setSubmissions([]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCmsData();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const blocks = [
      { key: 'supportEmail', value: supportEmail },
      { key: 'contactEmail', value: contactEmail },
      { key: 'contactPhone', value: contactPhone },
      { key: 'whatsappPhone', value: whatsappPhone },
      { key: 'contactAddress', value: contactAddress },
      { key: 'supportHours', value: supportHours },
      { key: 'discordUrl', value: discordUrl },
      { key: 'whatsappChannelUrl', value: whatsappChannelUrl },
      { key: 'telegramUrl', value: telegramUrl },
      { key: 'githubUrl', value: githubUrl },
      { key: 'twitterUrl', value: twitterUrl },
      { key: 'facebookUrl', value: facebookUrl },
      { key: 'companyName', value: companyName },
      { key: 'heroTitle', value: heroTitle },
      { key: 'heroSubtitle', value: heroSubtitle },
      { key: 'announcementText', value: announcementText },
      { key: 'announcementActive', value: announcementActive },
      { key: 'copyrightText', value: copyrightText },
    ];

    try {
      await api.cms.update('home', blocks);
      toast('Content saved & synced to Firebase in real-time!', 'success');
    } catch (err: any) {
      setError(err.message || 'Failed to save site content');
      toast('Failed to save CMS settings', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSubmission(key: string) {
    if (!confirm('Are you sure you want to delete this contact submission?')) return;
    setDeletingKey(key);
    try {
      await api.cms.deleteSubmission(key);
      toast('Submission deleted', 'success');
      setSubmissions((prev) => (prev ? prev.filter((s) => s.key !== key) : []));
    } catch (err: any) {
      toast(err.message || 'Failed to delete submission', 'error');
    } finally {
      setDeletingKey(null);
    }
  }

  if (loading) return <Spinner label="Loading CMS settings & contact desk..." />;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageHeader
        title="Site Content & Contact Management"
        description="Configure public contact numbers, emails, operating hours, social links, announcement banners, and inspect received contact form submissions."
      />

      {error && <ErrorBanner message={error} />}

      <Tabs
        tabs={[
          { label: 'Contact Info & Desk', value: 'contact' },
          { label: 'Social & Community', value: 'social' },
          { label: 'Branding & Banners', value: 'branding' },
          { label: 'Received Messages', value: 'inbox', count: submissions?.length || undefined },
        ]}
        active={activeTab}
        onChange={(v) => setActiveTab(v as any)}
      />

      {/* TAB 1: CONTACT INFO & DESK */}
      {activeTab === 'contact' && (
        <form onSubmit={handleSave} className="space-y-4 animate-fade-in">
          <Card className="border border-white/[0.06] space-y-4">
            <h2 className="font-semibold text-sm text-text-primary flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-teal-500/15 text-teal-300 flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </span>
              Contact Numbers & Support Inboxes
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Technical Support Email"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@shanutechx.cloud"
                hint="Used on support pages, ticket dispatch, and footer links."
              />

              <Input
                label="Sales & General Contact Email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="sales@shanutechx.cloud"
                hint="Used for sales inquiries and public contact page."
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Hotline Telephone Number"
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+1 (800) 589-STX1"
                hint="Direct voice line for urgent infrastructure alerts."
              />

              <Input
                label="WhatsApp Support Number"
                type="text"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                placeholder="+94 77 123 4567"
                hint="Shown in WhatsApp live chat action buttons."
              />
            </div>

            <Textarea
              label="Physical Office / HQ Address"
              rows={2}
              value={contactAddress}
              onChange={(e) => setContactAddress(e.target.value)}
              placeholder="ShanuTechX Cloud HQ, Tech City, Sri Lanka"
              hint="Displayed in legal footer and contact page."
            />

            <Input
              label="Support Operating Hours"
              type="text"
              value={supportHours}
              onChange={(e) => setSupportHours(e.target.value)}
              placeholder="24/7/365 Tier-3 Engineer Live Support"
              hint="Displayed on support badge and contact cards."
            />
          </Card>

          <Button type="submit" loading={busy} size="lg" className="w-full justify-center">
            Save Contact Details &amp; Sync to Firebase
          </Button>
        </form>
      )}

      {/* TAB 2: SOCIAL LINKS & COMMUNITY */}
      {activeTab === 'social' && (
        <form onSubmit={handleSave} className="space-y-4 animate-fade-in">
          <Card className="border border-white/[0.06] space-y-4">
            <h2 className="font-semibold text-sm text-text-primary flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-indigo-500/15 text-indigo-300 font-bold text-xs flex items-center justify-center">💬</span>
              Community &amp; Social Platform Links
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Discord Community URL"
                type="text"
                value={discordUrl}
                onChange={(e) => setDiscordUrl(e.target.value)}
                placeholder="https://discord.gg/shanutechx"
                hint="Direct invitation link to Discord server."
              />

              <Input
                label="WhatsApp Community / Channel URL"
                type="text"
                value={whatsappChannelUrl}
                onChange={(e) => setWhatsappChannelUrl(e.target.value)}
                placeholder="https://wa.me/94771234567?text=Hello"
                hint="WhatsApp direct message or channel link."
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Telegram Channel / Support URL"
                type="text"
                value={telegramUrl}
                onChange={(e) => setTelegramUrl(e.target.value)}
                placeholder="https://t.me/shanutechx"
              />

              <Input
                label="GitHub Repository / Org URL"
                type="text"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/shanutechx"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Twitter / X Profile URL"
                type="text"
                value={twitterUrl}
                onChange={(e) => setTwitterUrl(e.target.value)}
                placeholder="https://twitter.com/shanutechx"
              />

              <Input
                label="Facebook Page URL"
                type="text"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="https://facebook.com/shanutechx"
              />
            </div>
          </Card>

          <Button type="submit" loading={busy} size="lg" className="w-full justify-center">
            Save Social Links &amp; Sync to Firebase
          </Button>
        </form>
      )}

      {/* TAB 3: BRANDING & ANNOUNCEMENTS */}
      {activeTab === 'branding' && (
        <form onSubmit={handleSave} className="space-y-4 animate-fade-in">
          <Card className="border border-white/[0.06] space-y-4">
            <h2 className="font-semibold text-sm text-text-primary flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-violet-500/15 text-violet-300 font-bold text-xs flex items-center justify-center">✨</span>
              Branding &amp; Hero Content
            </h2>

            <Input
              label="Company Legal Name"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="ShanuTechX Cloud Services"
            />

            <Input
              label="Marketing Hero Title"
              type="text"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              placeholder="Autonomous High-Performance Cloud Hosting"
              hint="Main headline on the homepage."
            />

            <Textarea
              label="Marketing Hero Subtitle"
              rows={2}
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              placeholder="Deploy web apps, Node.js and Python services, and Discord bots in minutes."
            />
          </Card>

          <Card className="border border-white/[0.06] space-y-4">
            <h2 className="font-semibold text-sm text-text-primary flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-amber-500/15 text-amber-300 font-bold text-xs flex items-center justify-center">📢</span>
              Top Announcement Bar
            </h2>

            <Input
              label="Announcement Text"
              type="text"
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder="🚀 New VPS High-Performance Nodes Online in Ashburn & Frankfurt!"
            />

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div>
                <p className="text-xs font-semibold text-text-primary">Enable Top Announcement Bar</p>
                <p className="text-[11px] text-text-muted">Display ticker at the top of the marketing site.</p>
              </div>
              <button
                type="button"
                onClick={() => setAnnouncementActive(!announcementActive)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  announcementActive ? 'bg-accent-teal' : 'bg-white/10'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
                    announcementActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <Input
              label="Footer Copyright Text"
              type="text"
              value={copyrightText}
              onChange={(e) => setCopyrightText(e.target.value)}
              placeholder={`© ${new Date().getFullYear()} ShanuTechX Cloud. All rights reserved.`}
            />
          </Card>

          <Button type="submit" loading={busy} size="lg" className="w-full justify-center">
            Save Branding &amp; Publish Changes
          </Button>
        </form>
      )}

      {/* TAB 4: RECEIVED CONTACT MESSAGES */}
      {activeTab === 'inbox' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Contact Form Inquiries ({submissions?.length || 0})
            </h2>
            <Button variant="secondary" size="sm" onClick={loadCmsData} className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Messages
            </Button>
          </div>

          {submissions === null && <Spinner label="Loading received messages..." />}
          {submissions?.length === 0 && (
            <EmptyState message="No contact form submissions received yet." />
          )}

          {submissions && submissions.length > 0 && (
            <Table headers={['Applicant / Email', 'Department & Subject', 'Message', 'Date', 'Action']}>
              {submissions.map((sub) => (
                <Tr key={sub.key}>
                  <Td>
                    <div>
                      <p className="font-semibold text-text-primary text-sm">{sub.name}</p>
                      <p className="text-text-muted text-xs font-mono">{sub.email}</p>
                    </div>
                  </Td>
                  <Td>
                    <div className="space-y-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-violet-500/15 text-violet-300 border border-violet-500/30">
                        {sub.department}
                      </span>
                      {sub.subject && <p className="text-xs font-medium text-text-primary">{sub.subject}</p>}
                    </div>
                  </Td>
                  <Td className="max-w-xs">
                    <p className="text-xs text-text-muted leading-relaxed line-clamp-3" title={sub.message}>
                      {sub.message}
                    </p>
                  </Td>
                  <Td className="text-xs text-text-muted font-mono whitespace-nowrap">
                    {new Date(sub.submittedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Td>
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:text-red-400"
                      disabled={deletingKey === sub.key}
                      onClick={() => handleDeleteSubmission(sub.key)}
                    >
                      {deletingKey === sub.key ? 'Deleting...' : 'Delete'}
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
