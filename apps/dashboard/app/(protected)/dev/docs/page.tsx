'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layers, Radio, X } from 'lucide-react';
import { api } from '@/lib/api';
import { KbArticle } from '@/lib/types';
import { Card, Button, Spinner, PageHeader, useToast } from '@/components/ui';

export const dynamic = 'force-dynamic';

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/vps-provisions', desc: 'List customer VPS instances' },
  { method: 'POST', path: '/api/vps-provisions/:id/power', desc: 'Issue SSH reboot or status telemetry' },
  { method: 'POST', path: '/api/vps-provisions/:id/ssh-ticket', desc: 'Mint 30-sec WebSocket SSH ticket' },
  { method: 'GET', path: '/api/vps-provisions/:id/reveal-password', desc: 'AES-256-GCM decrypt root credentials' },
  { method: 'POST', path: '/api/nodes/connect', desc: 'SSH onboarding script for compute target nodes' },
  { method: 'GET', path: '/api/deployments', desc: 'List customer container deployments' },
  { method: 'POST', path: '/api/deployments', desc: 'Provision Git repo / app catalog template container' },
  { method: 'GET', path: '/api/managed-databases', desc: 'Inspect MySQL / PostgreSQL instances' },
];

export default function DevTechnicalDocsPage() {
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'arch' | 'api' | 'articles'>('arch');
  const [selectedArticle, setSelectedArticle] = useState<KbArticle | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    api.knowledgebase
      .list('all', '', 'dev')
      .then((data) => setArticles(data.articles || []))
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Developer Technical Architecture & API Portal"
          description="Architecture design guides, REST API endpoint contracts, Node Agent protocols, and infrastructure system specs."
        />
        <Link href="/dev">
          <Button variant="secondary" size="sm">← Return to Dev Hub</Button>
        </Link>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl max-w-md">
        <button
          onClick={() => setSelectedTab('arch')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            selectedTab === 'arch' ? 'bg-accent-violet text-white shadow-md' : 'text-text-muted hover:text-white'
          }`}
        >
          System Architecture
        </button>
        <button
          onClick={() => setSelectedTab('api')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            selectedTab === 'api' ? 'bg-accent-violet text-white shadow-md' : 'text-text-muted hover:text-white'
          }`}
        >
          REST API Spec
        </button>
        <button
          onClick={() => setSelectedTab('articles')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            selectedTab === 'articles' ? 'bg-accent-violet text-white shadow-md' : 'text-text-muted hover:text-white'
          }`}
        >
          Dev Articles ({articles.length})
        </button>
      </div>

      {/* TAB 1: SYSTEM ARCHITECTURE */}
      {selectedTab === 'arch' && (
        <div className="space-y-6">
          <Card className="border border-white/10 p-6 space-y-4 bg-neutral-900/60 backdrop-blur-md">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-accent-violet-light shrink-0" /> Platform Monorepo Architecture Overview
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              ShanuTechX is built as a high-performance npm workspace monorepo. Core modules and execution layers:
            </p>

            <div className="grid md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                <span className="text-accent-teal font-bold text-sm">apps/api (Express REST API)</span>
                <p className="text-text-muted text-[11px] leading-relaxed font-sans">
                  Express TypeScript backend running on Node 20 with PostgreSQL 16 & Prisma 5.22. Source of truth for business logic, billing, authentication, secrets vault, and orchestration.
                </p>
                <div className="text-[10px] text-accent-teal">Entry: src/index.ts & src/worker.ts</div>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                <span className="text-accent-violet-light font-bold text-sm">services/node-agent (NodeEngine Daemon)</span>
                <p className="text-text-muted text-[11px] leading-relaxed font-sans">
                  Plain JavaScript Docker management & telemetry agent running per VPS host node. Executes docker API requests, disk/cpu telemetry, and network isolation rules.
                </p>
                <div className="text-[10px] text-accent-violet-light">Modules: nodeEngine.js & filesystem.js</div>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                <span className="text-cyan-400 font-bold text-sm">apps/dashboard (Next.js 14 Control Panel)</span>
                <p className="text-text-muted text-[11px] leading-relaxed font-sans">
                  Next.js App Router customer & admin dashboard. Uses Tailwind CSS, custom glassmorphism design system, and xterm.js WebSockets SSH gateway.
                </p>
                <div className="text-[10px] text-cyan-400">Path: apps/dashboard/app/(protected)</div>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                <span className="text-amber-400 font-bold text-sm">Interactive SSH Terminal Gateway</span>
                <p className="text-text-muted text-[11px] leading-relaxed font-sans">
                  WebSocket gateway (sshTerminalGateway.ts) implementing 30-second single-use tickets for web terminal access directly into target customer VPS instances.
                </p>
                <div className="text-[10px] text-amber-400">File: apps/api/src/lib/sshTerminalGateway.ts</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: REST API SPEC */}
      {selectedTab === 'api' && (
        <Card className="border border-white/10 p-6 space-y-4 bg-neutral-900/60 backdrop-blur-md">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 shrink-0" /> Core REST API Contract Specification
          </h3>
          <p className="text-xs text-text-muted">
            All requests require Bearer Token authorization (`Authorization: Bearer &lt;token&gt;`).
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white/5 text-text-muted uppercase text-[10px] border-b border-white/10">
                <tr>
                  <th className="p-3">HTTP Method</th>
                  <th className="p-3">Endpoint Path</th>
                  <th className="p-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {API_ENDPOINTS.map((ep, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="p-3 font-bold text-accent-violet-light">{ep.method}</td>
                    <td className="p-3 text-accent-teal font-bold">{ep.path}</td>
                    <td className="p-3 text-text-muted font-sans">{ep.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: DEV ARTICLES */}
      {selectedTab === 'articles' && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center"><Spinner label="Loading developer articles..." /></div>
          ) : articles.length === 0 ? (
            <Card className="border border-dashed border-white/10 p-8 text-center text-text-muted text-xs">
              No developer-targeted articles found in the documentation repository.
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
                    <h4 className="text-sm font-bold text-white group-hover:text-accent-violet-light transition-colors">
                      {art.title}
                    </h4>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">
                      {art.category}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">{art.summary}</p>
                  <div className="flex items-center justify-between text-[10px] text-text-muted font-mono pt-2 border-t border-white/5">
                    <span>Target: Developer</span>
                    <span>Updated: {new Date(art.updatedAt).toLocaleDateString()}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Article Reader Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/20 rounded-3xl p-6 md:p-8 w-full max-w-3xl max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] uppercase font-mono px-2.5 py-1 rounded bg-violet-500/20 text-violet-300 font-bold">
                  {selectedArticle.category}
                </span>
                <h2 className="text-lg md:text-xl font-bold text-white mt-2">
                  {selectedArticle.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="text-text-muted hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-text-primary whitespace-pre-wrap font-mono bg-black/50 p-4 rounded-2xl border border-white/10">
              {selectedArticle.content}
            </div>

            <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
              <Button size="sm" variant="secondary" onClick={() => setSelectedArticle(null)}>
                Close Article
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
