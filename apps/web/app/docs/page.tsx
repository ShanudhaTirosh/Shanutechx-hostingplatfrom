'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

interface DocArticle {
  id: string;
  category: string;
  title: string;
  iconSvg: React.ReactNode;
  summary: string;
  content: string[];
  codeSnippets?: {
    curl: string;
    node: string;
    python: string;
  };
}

const DOC_ARTICLES: DocArticle[] = [
  {
    id: 'api-automation',
    category: 'Developer API',
    title: 'Public REST API & Developer Automation',
    iconSvg: (
      <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    summary: 'Automate deployments, managed databases, custom domain routing, and server monitoring using your API Key (`shx_...`).',
    content: [
      '1. Generate your API key in Client Space Dashboard -> Settings -> API Keys.',
      '2. Authenticate all API requests using the `x-api-key: shx_...` header or `Authorization: Bearer shx_...`.',
      '3. Manage Deployments: Create, inspect, trigger rebuilds, and view container logs via `POST /api/deployments`.',
      '4. Manage Databases: Provision PostgreSQL, MySQL, and Redis DBs via `POST /api/managed-databases`.',
      '5. Inspect Telemetry & Uptime: Fetch 90-day uptime metrics via `GET /api/status`.',
    ],
    codeSnippets: {
      curl: `curl -X POST https://api.shanutechx.com/api/deployments \\
  -H "x-api-key: shx_live_a1b2c3d4e5f6..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "repoUrl": "https://github.com/myorg/myapp",
    "runtime": "nodejs",
    "subdomain": "myapp"
  }'`,
      node: `import fetch from 'node-fetch';

const res = await fetch('https://api.shanutechx.com/api/deployments', {
  method: 'POST',
  headers: {
    'x-api-key': 'shx_live_a1b2c3d4e5f6...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    repoUrl: 'https://github.com/myorg/myapp',
    runtime: 'nodejs',
    subdomain: 'myapp'
  })
});
const data = await res.json();
console.log('Deployment ID:', data.deployment.id);`,
      python: `import requests

url = "https://api.shanutechx.com/api/deployments"
headers = {
    "x-api-key": "shx_live_a1b2c3d4e5f6...",
    "Content-Type": "application/json"
}
payload = {
    "repoUrl": "https://github.com/myorg/myapp",
    "runtime": "nodejs",
    "subdomain": "myapp"
}

response = requests.post(url, json=payload, headers=headers)
print("Response:", response.json())`,
    },
  },
  {
    id: 'deployments',
    category: 'Application Hosting',
    title: 'Deploying Applications & Discord Bots',
    iconSvg: (
      <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    summary: 'Learn how to deploy Node.js, Python apps, and Discord bots using Git integration or Zip uploads.',
    content: [
      '1. Navigate to "Deployments" in your Client Space Dashboard.',
      '2. Click "+ New Deployment" and select your deployment source (GitHub/GitLab URL or Upload Zip file).',
      '3. Choose your runtime environment (Node.js 20, Python 3.11, or Static Web).',
      '4. Add encrypted environment variables in the Env Vars section (AES-256 encrypted).',
      '5. Click "Deploy App". Our platform will build your deployment, assign a subdomain, and issue an SSL certificate automatically.',
    ],
  },
  {
    id: 'databases',
    category: 'Managed Databases',
    title: 'PostgreSQL, MySQL, Redis & MongoDB Setup',
    iconSvg: (
      <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21 3.582 4 8 4s8-1.79 8-4" />
      </svg>
    ),
    summary: 'Provision standalone managed database containers with 1-click credentials and DSN connection strings.',
    content: [
      '1. Open "Managed Databases" from your dashboard panel.',
      '2. Select your database engine: PostgreSQL 17, MySQL 8.4, Redis 7, or MongoDB 8.',
      '3. Click "Provision Database". Credentials (username, password, database name) will be generated securely.',
      '4. Use the "Copy DSN Connection String" utility to integrate with your backend applications.',
      '5. Power controls (Start, Stop, Restart) and automated daily cloud backups are managed from the database detail card.',
    ],
  },
  {
    id: 'domains',
    category: 'Network & Security',
    title: 'Custom Domains & SSL Setup',
    iconSvg: (
      <svg className="w-6 h-6 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    summary: 'Connect your own domain to any deployment with automated DNS mapping and free SSL certificates.',
    content: [
      '1. Select your target deployment and open the "Custom Domain" tab.',
      '2. Enter your custom domain name (e.g. app.mycompany.com).',
      '3. Add a CNAME record at your DNS provider pointing to `ingress.shanutechx.com`.',
      '4. (Optional) Provide a DNS API Token for 1-click automatic DNS record creation.',
      '5. Click "Verify & Route Domain". Once verified, dynamic reverse proxying and SSL certificates are configured instantly.',
    ],
  },
  {
    id: 'v2ray',
    category: 'Proxy & Tunneling',
    title: 'V2Ray & Netch Proxy Subscription Guide',
    iconSvg: (
      <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    summary: 'Import high-speed VMess, VLESS, and Trojan proxy configs into Netch, V2RayN, or shadowrocket.',
    content: [
      '1. Visit the STX Store Portal (`https://store.shanutechx.com`) to get your proxy subscription.',
      '2. Copy your unique subscription URL from your order confirmation email or dashboard.',
      '3. In Netch (Windows): Open Subscription -> Add -> Paste URL -> Click "Import Configs".',
      '4. In V2RayN / v2rayNG (Android/iOS): Tap "+" -> Import Subscription URL -> Update Subscription.',
      '5. Select your preferred low-latency node (Germany, USA, Singapore, or Colombo) and click Connect.',
    ],
  },
  {
    id: 'team',
    category: 'Team & Security',
    title: 'Client Team Invitations & Role-Based Access Control',
    iconSvg: (
      <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    summary: 'Invite team members, assign workspace roles (Admin, Developer, Billing, Viewer), and scope resource access.',
    content: [
      '1. Go to "Settings" -> "Team & RBAC" in your Client Space Dashboard.',
      '2. Click "Invite Team Member" and enter the recipient\'s email address.',
      '3. Assign a primary team role: Admin, Developer, Billing, or Viewer.',
      '4. Set per-resource permissions for specific deployments, databases, or VPS instances.',
      '5. Send invitation link. The invited user can click "Accept Invitation" to join your workspace instantly.',
    ],
  },
  {
    id: 'email',
    category: 'Email Services',
    title: 'Hostinger Mail & Multi-Provider SMTP Setup',
    iconSvg: (
      <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    summary: 'Configure Hostinger Mail and Postal SMTP relay accounts for transactional email and Webmail Studio.',
    content: [
      '1. Open "Email & Webmail" in your dashboard.',
      '2. Click "+ Provision Mailbox" to create your SMTP account with custom storage quotas (5 GB standard).',
      '3. View host credentials (`smtp.shanutechx.com`, Port 587 TLS).',
      '4. Open the built-in Webmail Studio to read and compose emails with 3-pane Column and 2-pane Row view options.',
      '5. Configure DKIM & SPF DNS records for maximum inbox deliverability.',
    ],
  },
];

export default function DocsPage() {
  const [selectedDoc, setSelectedDoc] = useState<DocArticle>(DOC_ARTICLES[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [codeTab, setCodeTab] = useState<'curl' | 'node' | 'python'>('curl');

  const filteredDocs = DOC_ARTICLES.filter(
    (doc) =>
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-transparent text-white font-sans">
      <Navbar />

      <div className="pt-32 pb-20 max-w-7xl mx-auto px-6 space-y-10">
        {/* Header */}
        <div className="space-y-4 max-w-2xl">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/20">
            Documentation &amp; User Guides
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Client <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-indigo-300 to-pink-500">Documentation Hub</span>
          </h1>
          <p className="text-text-muted text-sm leading-relaxed">
            Production-grade developer documentation, REST API automation guides, step-by-step instructions, and code snippets.
          </p>

          {/* Search Bar */}
          <div className="pt-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documentation (e.g. REST API, database, custom domain, V2Ray, team)..."
              className="w-full bg-[#0b0c1e] border border-white/15 rounded-2xl px-5 py-3 text-sm text-white placeholder-text-faint focus:outline-none focus:border-purple-500 shadow-xl"
            />
          </div>
        </div>

        {/* 2-Column Documentation View */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left Navigation Sidebar */}
          <div className="lg:col-span-4 space-y-2 bg-[#0b0c1e] border border-white/10 rounded-3xl p-4 shadow-xl">
            <span className="text-[11px] font-mono uppercase text-indigo-400 font-bold px-3 py-1 block">
              Topics &amp; APIs ({filteredDocs.length})
            </span>
            <div className="space-y-1">
              {filteredDocs.map((doc) => {
                const active = selectedDoc.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`w-full text-left p-3.5 rounded-2xl transition-all flex items-start gap-3 border ${
                      active
                        ? 'bg-gradient-to-r from-purple-900/40 to-indigo-900/20 border-purple-500/40 text-white shadow-glow-violet'
                        : 'bg-white/[0.01] border-transparent hover:bg-white/[0.04] text-text-muted hover:text-white'
                    }`}
                  >
                    <span className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0">{doc.iconSvg}</span>
                    <div>
                      <h3 className="font-bold text-xs leading-snug">{doc.title}</h3>
                      <span className="text-[10px] text-text-faint font-mono uppercase">{doc.category}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Article View Card */}
          <div className="lg:col-span-8 bg-[#0b0c1e] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-4 border-b border-white/10 pb-6">
              <span className="p-3 rounded-2xl bg-white/5 border border-white/10">{selectedDoc.iconSvg}</span>
              <div>
                <span className="text-xs font-mono uppercase text-indigo-400 font-bold">{selectedDoc.category}</span>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">{selectedDoc.title}</h2>
                <p className="text-xs text-text-muted mt-1">{selectedDoc.summary}</p>
              </div>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-purple-300 font-mono">
                Implementation Guide
              </h3>
              <div className="space-y-3 font-sans text-sm leading-relaxed text-indigo-100">
                {selectedDoc.content.map((step, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-purple-500/30 transition-all font-mono text-xs">
                    {step}
                  </div>
                ))}
              </div>
            </div>

            {/* Code Snippets Section (if available) */}
            {selectedDoc.codeSnippets && (
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 font-mono">
                    Code Automation Examples
                  </h3>
                  <div className="flex gap-2">
                    {(['curl', 'node', 'python'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setCodeTab(tab)}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                          codeTab === tab
                            ? 'bg-purple-600 text-white'
                            : 'bg-white/5 text-text-muted hover:text-white'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-black/60 border border-white/10 rounded-2xl p-4 font-mono text-xs text-indigo-200 overflow-x-auto">
                  <pre>{selectedDoc.codeSnippets[codeTab]}</pre>
                </div>
              </div>
            )}

            {/* Help Callout */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-text-muted">Have developer questions? Check out our GitHub or contact engineering.</span>
              <a
                href="/contact"
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow-violet transition-all"
              >
                Contact Support →
              </a>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
