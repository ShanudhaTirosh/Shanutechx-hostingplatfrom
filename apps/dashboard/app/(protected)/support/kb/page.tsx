'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { KbArticle } from '@/lib/types';
import { Card, Button, Spinner, PageHeader, useToast, Badge } from '@/components/ui';

export const dynamic = 'force-dynamic';

const SUPPORT_MACROS = [
  {
    title: 'VPS SSH Connection Reset / Timeout',
    category: 'VPS Troubleshooting',
    template: `Hello, thank you for reaching out to ShanuTechX Support.

If you are experiencing connection timeouts when connecting to your VPS via SSH:
1. Verify port 22 (or custom port) is open in your Host Firewall settings.
2. Confirm root SSH login is permitted (/etc/ssh/sshd_config PermitRootLogin yes).
3. Restart the SSH daemon using: sudo systemctl restart sshd.

If issues persist, please let us know your client IP address so we can verify firewall whitelist rules.`,
  },
  {
    title: 'Custom Domain SSL Certificate Provisioning Delay',
    category: 'Domains & SSL',
    template: `Hi there,

Automatic SSL certificate issuance requires a valid CNAME record pointing your domain to domain-proxy.shanutechx.com.

Please run the following DNS check:
dig CNAME yourdomain.com +short

Once DNS propagation completes (typically 5-15 minutes), our automated Let's Encrypt bot will issue the certificate automatically.`,
  },
  {
    title: 'Payment Verification Proof Under Review',
    category: 'Billing & Payments',
    template: `Hello,

We have received your uploaded payment slip/receipt proof. Our billing team is currently reviewing the transaction against our bank statement.

Manual verification typically completes within 1-2 hours. Once verified, your order and container services will be activated automatically. Thank you for your patience!`,
  },
];

export default function SupportRunbooksPage() {
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<KbArticle | null>(null);

  const { toast } = useToast();

  function loadRunbooks() {
    setLoading(true);
    api.knowledgebase
      .list('all', search, 'support')
      .then((data) => setArticles(data.articles || []))
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadRunbooks();
  }, []);

  function handleCopyMacro(templateText: string) {
    navigator.clipboard.writeText(templateText);
    toast('Ticket macro template copied to clipboard!', 'success');
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Support Operations Runbooks & Diagnostics"
          description="Internal diagnostic runbooks, ticket response macros, customer issue resolution guides, and troubleshooting steps for support staff."
        />
        <Link href="/admin/tickets">
          <Button variant="secondary" size="sm">← Return to Ticket Queue</Button>
        </Link>
      </div>

      {/* Ticket Response Macro Templates Quick Panel */}
      <Card className="bg-cyan-500/10 border border-cyan-500/20 p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          ⚡ Ready Support Ticket Macro Templates
        </h3>
        <div className="grid md:grid-cols-3 gap-3">
          {SUPPORT_MACROS.map((macro, idx) => (
            <div key={idx} className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold">
                  {macro.category}
                </span>
                <h4 className="text-xs font-bold text-white mt-1.5">{macro.title}</h4>
                <p className="text-[11px] text-text-muted line-clamp-3 leading-relaxed mt-1 font-mono">
                  {macro.template}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleCopyMacro(macro.template)}
                className="w-full text-xs text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20 mt-2"
              >
                📋 Copy Response Macro
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Runbooks Directory Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <input
            type="text"
            placeholder="Search diagnostic runbooks, error codes, SSH commands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder:text-text-muted focus:outline-none focus:border-accent-cyan font-mono"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={loadRunbooks}>
          Refresh Runbooks
        </Button>
      </div>

      {/* Runbooks Articles List */}
      {loading ? (
        <div className="py-12 text-center"><Spinner label="Loading Support Runbooks..." /></div>
      ) : articles.length === 0 ? (
        <Card className="border border-dashed border-white/10 p-8 text-center text-text-muted text-xs">
          No support runbooks found. Create internal runbooks via Admin Knowledge Base Manager.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((art) => (
            <Card
              key={art.id}
              onClick={() => setSelectedArticle(art)}
              className="p-5 border border-white/10 bg-neutral-900/60 hover:bg-white/[0.04] transition-all cursor-pointer space-y-3 group"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-bold text-white group-hover:text-accent-cyan transition-colors">
                  {art.title}
                </h4>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                  {art.category}
                </span>
              </div>
              <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">{art.summary}</p>
              <div className="flex items-center justify-between text-[10px] text-text-muted font-mono pt-2 border-t border-white/5">
                <span>Target Persona: Staff / Support</span>
                <span>Updated: {new Date(art.updatedAt).toLocaleDateString()}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Article Reader Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/20 rounded-3xl p-6 md:p-8 w-full max-w-3xl max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] uppercase font-mono px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                  {selectedArticle.category}
                </span>
                <h2 className="text-lg md:text-xl font-bold text-white mt-2">
                  {selectedArticle.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="text-text-muted hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-text-primary whitespace-pre-wrap font-mono bg-black/50 p-4 rounded-2xl border border-white/10">
              {selectedArticle.content}
            </div>

            <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
              <Button size="sm" variant="secondary" onClick={() => setSelectedArticle(null)}>
                Close Runbook
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
