'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { KbArticle, KbCategory } from '@/lib/types';
import { Card, Button, Spinner, PageHeader, useToast } from '@/components/ui';
import {
  BookOpen,
  Search,
  Rocket,
  Globe,
  Database,
  ShieldCheck,
  Terminal,
  CreditCard,
  AlertTriangle,
  Check,
  Copy,
  Eye,
  ThumbsUp,
  X,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Mail,
  LifeBuoy,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Wrench,
  Server,
  Zap,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

// ── Built-in Customer Knowledgebase Articles (What Customers Need to Know) ──
const BUILT_IN_CUSTOMER_ARTICLES: (KbArticle & { actionHref?: string; actionLabel?: string })[] = [
  {
    id: 'kb-deploy-first-app',
    slug: 'deploying-your-first-app',
    title: 'Deploying Your First Web Application or Git Repository',
    category: 'deployments',
    summary: 'Deploy any public or private GitHub repository, Docker container, or 1-click catalog template in under 60 seconds with automated runtime detection.',
    actionHref: '/deployments',
    actionLabel: 'Go to Deployments Hub',
    content: `## Quick Start: Deploying in 60 Seconds

ShanuTechX enables continuous deployment for web applications, background workers, and containerized services with zero complex infrastructure configuration.

### Method 1: Git Repository & GitHub Integration (Vercel Style)
1. Go to **Deployments** in your dashboard sidebar and click **Deploy New Project**.
2. Select **GitHub** or paste any public repository URL (e.g., \`https://github.com/org/repo\`).
3. Select your production branch (e.g., \`main\` or \`master\`).
4. **Automatic Detection:** The build engine automatically analyzes your repository structure and configures:
   - **Runtime:** Next.js, Vite, Node.js, Python (FastAPI/Flask/Django), Lavalink, Bots.
   - **Internal Container Port:** Auto-detected (e.g., \`3000\` for Next.js, \`5173\` for Vite, \`8000\` for FastAPI).
   - **Build Command:** Pre-populated according to your package manager.
5. Add any required environment variables (e.g. \`DATABASE_URL\`, \`API_KEY\`) with secret masking.
6. Click **Deploy Now**. Traefik will automatically provision your free SSL domain:
\`\`\`bash
https://your-project.app.shanutechx.com
\`\`\`

### Method 2: 1-Click App Catalog
1. Navigate to **App Catalog** from the dashboard.
2. Choose from curated production-ready templates: **WordPress**, **n8n**, **Redis**, **LiveKit**, **Lavalink**, **Grafana**, or **PostgreSQL**.
3. All network exposure, SSL routing, and persistent storage are pre-configured out of the box.
4. Fill in database passwords or click **Generate** for secure random secrets.
5. Click **Deploy Now** to launch your private isolated instance.`,
    published: true,
    views: 914,
    helpfulCount: 247,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'kb-custom-domains-ssl',
    slug: 'custom-domains-and-ssl',
    title: 'Connecting Custom Domains & Automated Free SSL via CNAME',
    category: 'domains',
    summary: 'Map your own custom domain or subdomain to your deployment with automated Let\'s Encrypt SSL certificate provisioning and live DNS verification.',
    actionHref: '/deployments',
    actionLabel: 'Manage Project Domains',
    content: `## Connecting Your Custom Domain

Every deployment on ShanuTechX receives an instant free platform subdomain (\`https://<project>.app.shanutechx.com\`). You can also attach any domain you own (e.g. \`app.yourdomain.com\` or \`yourdomain.com\`).

### Step 1: Add a DNS CNAME Record
Log in to your DNS provider (Cloudflare, Namecheap, GoDaddy, Route53, etc.) and create a new DNS record:

| Type | Name / Host | Target / Points To | Proxy Status |
| :--- | :--- | :--- | :--- |
| **CNAME** | \`app\` (or your subdomain) | \`your-project.app.shanutechx.com\` | DNS Only (Gray Cloud) |

> **Note for Apex Domains:** If you are mapping a root domain (e.g. \`example.com\`), use an **A Record** pointing directly to your cluster Node IP address found on your deployment overview page.

### Step 2: Connect the Domain in Your Dashboard
1. Open your deployment and go to the **Network & Domains** tab.
2. Enter your custom domain (e.g. \`app.yourdomain.com\`) and click **Connect Domain**.
3. Click **Verify DNS**. The platform will verify DNS propagation in real-time.
4. **Automated SSL:** Traefik SSL reverse proxy will immediately issue a free, auto-renewing Let's Encrypt TLS certificate. Within 1-2 minutes, your domain is fully active via HTTPS.`,
    published: true,
    views: 742,
    helpfulCount: 198,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'kb-managed-databases',
    slug: 'managed-databases-setup',
    title: 'Connecting to Managed PostgreSQL, MySQL, Redis & MongoDB',
    category: 'databases',
    summary: 'How to provision isolated containerized databases, retrieve master credentials, and securely connect your applications internally.',
    actionHref: '/services',
    actionLabel: 'View Managed Databases',
    content: `## Managed Databases Overview

ShanuTechX provides managed, isolated database instances running in secure sandboxed containers with dedicated persistent volume mounts.

### Supported Engines & Default Internal Ports
- **PostgreSQL:** Internal port \`5432\`
- **MySQL:** Internal port \`3306\`
- **Redis:** Internal port \`6379\`
- **MongoDB:** Internal port \`27017\`

### Retrieving Credentials & Connection Strings
1. In the dashboard, navigate to **Deployments** -> select your database container.
2. Open the **Databases** tab to view your credentials.
3. Master passwords are encrypted with AES-256-GCM at rest and only viewable by authorized project owners.

### Connecting Your Application Internally
Inside the ShanuTechX platform network, you can connect your application to your database using internal environment variables:

\`\`\`env
# PostgreSQL connection string example
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db-postgres:5432/production_db"

# Redis cache connection string example
REDIS_URL="redis://:YOUR_PASSWORD@redis-cache:6379/0"
\`\`\`

> **Security Tip:** Never expose raw database host ports directly to the public internet. Keep your database internal to your container network for maximum security.`,
    published: true,
    views: 618,
    helpfulCount: 169,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'kb-container-isolation-security',
    slug: 'container-isolation-and-security',
    title: 'Container Isolation, Dedicated Networks & Zero Public Host Ports',
    category: 'security',
    summary: 'Learn how ShanuTechX isolates every customer workload using private Docker bridge networks, sandboxed persistent storage, and Traefik reverse proxy routing.',
    actionHref: '/deployments',
    actionLabel: 'Inspect Container Security',
    content: `## Enterprise Container Isolation Architecture

Security and multi-tenant isolation are fundamental guarantees of the ShanuTechX architecture. Every customer deployment runs in an isolated, sandboxed execution environment.

### 1. Dedicated Private Network Bridge
- Every deployment is provisioned onto its own dedicated Docker bridge network (\`shanutechx-net-<id>\`).
- Containers cannot snoop or intercept packets from other customer deployments on the same compute node.
- Inter-service communication is restricted to explicitly linked services within your own project.

### 2. Sandboxed Storage Volumes
- All file writes, database data directories, and upload assets are stored in private Docker volumes.
- No deployment can read, inspect, or modify another deployment's filesystem.

### 3. Zero Public Host Ports
- Applications run on **internal container ports only** (e.g., container port \`3000\`, \`8000\`, etc.).
- **No host ports are opened to the public internet**, protecting your services from port scanners and brute-force attacks.
- All ingress traffic is routed through the hardened Traefik reverse proxy over HTTPS (Port 443) with automated SSL termination and request filtering.`,
    published: true,
    views: 529,
    helpfulCount: 154,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'kb-console-and-web-ide',
    slug: 'interactive-console-and-file-manager',
    title: 'Using the Real-time Interactive Console & Browser Web IDE',
    category: 'console',
    summary: 'Monitor live stdout/stderr streams, execute interactive terminal commands, and edit files directly in your browser without local tools.',
    actionHref: '/deployments',
    actionLabel: 'Open Project Console',
    content: `## Monitoring & Managing Containers in Real Time

You can inspect, debug, and modify your running deployment directly from the ShanuTechX dashboard without needing external SSH clients or local developer tools.

### 1. Live Interactive Server Console
- Open your deployment and click the **Console** tab.
- Stream real-time container output (\`stdout\` and \`stderr\`) with automatic log buffering.
- Features: auto-scroll toggle, search filtering, and 1-click log clearing.

### 2. Built-in Sandboxed File Manager
- Click the **Files** tab to browse your container's workspace filesystem.
- Upload assets, create folders, rename configuration files, and download backups.
- Supports drag-and-drop file uploads for instant asset deployment.

### 3. Multi-Tab Browser Web IDE
- Open and edit \`.env\`, \`config.yaml\`, \`package.json\`, and source files in a full-featured code editor.
- Syntax highlighting for JavaScript, TypeScript, Python, JSON, YAML, HTML, and Shell.
- Press \`Ctrl+S\` or \`Cmd+S\` to save changes directly to the container filesystem.`,
    published: true,
    views: 452,
    helpfulCount: 137,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'kb-business-email',
    slug: 'business-email-and-webmail-hub',
    title: 'Setting Up Professional Business Email & Webmail Hub',
    category: 'email',
    summary: 'Create custom branded email accounts, access webmail in your browser, and connect desktop or mobile clients with IMAP/SMTP.',
    actionHref: '/email',
    actionLabel: 'Go to Business Email Hub',
    content: `## Professional Business Email Setup

ShanuTechX includes enterprise business email hosting directly connected to your domain with spam protection, webmail client access, and standard mail client protocols.

### 1. Creating Mailboxes
1. Navigate to **Business Email** from the dashboard.
2. Click **Create Mailbox** and specify:
   - Email address: \`user@yourdomain.com\`
   - Password: secure password or generate random
   - Quota limit: e.g. 5GB or Unlimited
3. Save to provision your mailbox instantly.

### 2. Accessing Webmail
- Open \`/webmail\` in your browser to access the sleek Next.js mail client.
- Send messages, manage folders, tag important threads, and configure auto-responders.

### 3. Connecting to Outlook, Apple Mail & Thunderbird
Use these standard secure connection settings:

| Setting | Value |
| :--- | :--- |
| **Incoming Server (IMAP)** | \`mail.shanutechx.com\` (Port 993, SSL/TLS) |
| **Outgoing Server (SMTP)** | \`mail.shanutechx.com\` (Port 465 or 587, STARTTLS) |
| **Username** | Your full email address (\`user@yourdomain.com\`) |
| **Password** | Your mailbox password |

### 4. Required DNS Records
Ensure your DNS provider has these records configured:
- **MX Record:** Priority \`10\` pointing to \`mail.shanutechx.com\`
- **SPF Record (TXT):** \`v=spf1 include:mail.shanutechx.com ~all\`
- **DKIM & DMARC:** Auto-generated in your Business Email settings tab.`,
    published: true,
    views: 384,
    helpfulCount: 121,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'kb-billing-and-invoices',
    slug: 'billing-subscriptions-and-invoices',
    title: 'Managing Subscriptions, Invoices & Manual Bank Slip Approvals',
    category: 'billing',
    summary: 'Everything you need to know about billing cycles, resource quotas, payment slip submissions, and downloading PDF invoices.',
    actionHref: '/orders?tab=orders',
    actionLabel: 'View Orders & Invoices',
    content: `## Billing & Subscription Lifecycle

ShanuTechX offers transparent, predictable pricing with automatic renewal monitoring and flexible payment methods.

### 1. Subscriptions & Billing Cycles
- Subscriptions run on a monthly cycle from the date of initial provisioning.
- Automated daily checks verify active services and send advance notifications before renewal deadlines.

### 2. Manual Bank Transfer Slip Submissions
1. When placing an order or renewing a service, choose **Bank Transfer**.
2. Transfer funds to our designated corporate bank account shown on the checkout screen.
3. Upload a clear photograph or PDF of your transaction slip.
4. Our finance team verifies slips within minutes, immediately activating your service.

### 3. Downloading Official PDF Invoices
- Go to **Billing & Invoices** from the dashboard.
- Click **Download PDF** on any paid invoice to download an official invoice with tax breakdown and transaction reference numbers.`,
    published: true,
    views: 574,
    helpfulCount: 181,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'kb-troubleshooting-errors',
    slug: 'troubleshooting-common-errors',
    title: 'Troubleshooting Common Container Errors: OOM, Port Mismatch & Crashes',
    category: 'troubleshooting',
    summary: 'Fast diagnostics and solutions for common deployment issues including exit code 137, host binding errors, and missing environment variables.',
    actionHref: '/deployments',
    actionLabel: 'Troubleshoot Deployments',
    content: `## Fast Diagnostics & Solutions

If your deployment fails to start or encounters an error, use these quick diagnostic steps.

### 1. Exit Code 137 (OOMKilled - Out of Memory)
- **Cause:** Your application exceeded its allotted container RAM limit.
- **Solution:** 
  1. Optimize memory-heavy operations (e.g. Node.js heap limits with \`--max-old-space-size\`).
  2. Upgrade your container resource tier in the deployment settings to allocate additional RAM.

### 2. Port Mismatch / Connection Refused
- **Cause:** Your application is listening on \`127.0.0.1\` or \`localhost\` instead of \`0.0.0.0\`.
- **Solution:** In Docker containers, servers must bind to all network interfaces:
\`\`\`javascript
// Express.js / Node.js
app.listen(PORT, '0.0.0.0', () => console.log('Listening'));
\`\`\`
\`\`\`python
# FastAPI / Uvicorn
uvicorn.run("main:app", host="0.0.0.0", port=8000)
\`\`\`

### 3. Missing Environment Variables
- Ensure all required keys (e.g. \`DATABASE_URL\`, \`SECRET_KEY\`) are defined in the **Startup & Env** tab.
- Click **Restart Container** after updating environment variables to apply them immediately.

### 4. 502 Bad Gateway
- **Cause:** Your container is still starting up, crashed on boot, or listening on a different port than configured in the dashboard.
- **Solution:** Check the **Console** tab for crash stack traces and verify that your app's listening port matches the internal container port.`,
    published: true,
    views: 820,
    helpfulCount: 265,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'kb-support-tickets',
    slug: 'how-to-get-customer-support',
    title: 'Getting 24/7 Priority Support & Opening Support Tickets',
    category: 'support',
    summary: 'How to contact our engineering team, submit logs, track issue resolution, and receive immediate alerts via Discord and email.',
    actionHref: '/tickets',
    actionLabel: 'Open Support Ticket',
    content: `## Fast Priority Support

Whenever you need technical assistance, our support engineers are available 24/7 to help resolve infrastructure, deployment, and networking issues.

### 1. Submitting a Support Ticket
1. Go to **Support Tickets** from the dashboard sidebar.
2. Click **Create New Ticket**.
3. Select your issue category: **Deployment Issue**, **Custom Domain / DNS**, **Database Connection**, or **Billing & Invoices**.
4. Choose the priority level:
   - **Low / Normal:** General guidance, non-blocking questions.
   - **High / Urgent:** Production service degraded.
   - **Critical / Outage:** Container down, live website inaccessible.
5. Provide relevant container logs or error messages from the Console tab.

### 2. Real-Time Status & Notifications
- You will receive instant notifications when our engineers respond to your ticket.
- Integrated Discord and WhatsApp alerts provide instant updates right to your phone or team channel.`,
    published: true,
    views: 412,
    helpfulCount: 143,
    updatedAt: new Date().toISOString(),
  },
];

// ── Category Definitions ──
const CATEGORIES: { slug: string; name: string; icon: string; count: number }[] = [
  { slug: 'all', name: 'All Guides', icon: 'BookOpen', count: 9 },
  { slug: 'deployments', name: 'Deployments & Apps', icon: 'Rocket', count: 1 },
  { slug: 'domains', name: 'Domains & SSL', icon: 'Globe', count: 1 },
  { slug: 'databases', name: 'Managed Databases', icon: 'Database', count: 1 },
  { slug: 'security', name: 'Isolation & Security', icon: 'ShieldCheck', count: 1 },
  { slug: 'console', name: 'Live Console & IDE', icon: 'Terminal', count: 1 },
  { slug: 'email', name: 'Business Email', icon: 'Mail', count: 1 },
  { slug: 'billing', name: 'Billing & Invoices', icon: 'CreditCard', count: 1 },
  { slug: 'troubleshooting', name: 'Troubleshooting', icon: 'AlertTriangle', count: 1 },
  { slug: 'support', name: 'Customer Support', icon: 'LifeBuoy', count: 1 },
];

function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  switch (slug) {
    case 'deployments': return <Rocket className={className || 'w-4 h-4'} />;
    case 'domains': return <Globe className={className || 'w-4 h-4'} />;
    case 'databases': return <Database className={className || 'w-4 h-4'} />;
    case 'security': return <ShieldCheck className={className || 'w-4 h-4'} />;
    case 'console': return <Terminal className={className || 'w-4 h-4'} />;
    case 'email': return <Mail className={className || 'w-4 h-4'} />;
    case 'billing': return <CreditCard className={className || 'w-4 h-4'} />;
    case 'troubleshooting': return <AlertTriangle className={className || 'w-4 h-4'} />;
    case 'support': return <LifeBuoy className={className || 'w-4 h-4'} />;
    default: return <BookOpen className={className || 'w-4 h-4'} />;
  }
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  function copyToClipboard() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast('Snippet copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-white/10 bg-[#0a0a0c] font-mono text-xs shadow-inner">
      <div className="flex items-center justify-between px-3.5 py-2 bg-white/[0.04] border-b border-white/[0.08] text-[11px] text-neutral-400">
        <span className="font-semibold text-neutral-300">Terminal / Code Block</span>
        <button
          type="button"
          onClick={copyToClipboard}
          className="text-neutral-400 hover:text-white transition-colors font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          {copied ? (
            <span className="flex items-center gap-1 text-emerald-400"><Check className="w-3.5 h-3.5" /> Copied</span>
          ) : (
            <span className="flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> Copy</span>
          )}
        </button>
      </div>
      <pre className="p-3.5 text-neutral-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">{code}</pre>
    </div>
  );
}

// ── Interactive Customer DNS CNAME Generator Helper ──
function InteractiveDnsHelper() {
  const [customDomain, setCustomDomain] = useState('app.mycompany.com');
  const [projectSubdomain, setProjectSubdomain] = useState('my-cool-app');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  const targetHost = `${projectSubdomain.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'your-project'}.app.shanutechx.com`;
  const hostName = customDomain.split('.')[0] || 'app';

  function copyText(val: string, label: string) {
    navigator.clipboard.writeText(val);
    setCopiedField(label);
    toast(`Copied ${label} to clipboard!`, 'success');
    setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <div className="p-6 rounded-3xl border border-white/10 bg-[#0c0d12] space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-white">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Interactive DNS CNAME Helper</h4>
            <p className="text-[11px] text-neutral-400">Generate the exact DNS records to point your custom domain to ShanuTechX.</p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white font-semibold">Live Tool</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-semibold text-neutral-400 block mb-1">Your Custom Subdomain</label>
          <input
            type="text"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="e.g. app.mycompany.com"
            className="w-full bg-[#0a0a0c] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-500 font-mono focus:outline-none focus:border-white/40"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-neutral-400 block mb-1">Your Project Subdomain Name</label>
          <input
            type="text"
            value={projectSubdomain}
            onChange={(e) => setProjectSubdomain(e.target.value)}
            placeholder="e.g. my-cool-app"
            className="w-full bg-[#0a0a0c] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-500 font-mono focus:outline-none focus:border-white/40"
          />
        </div>
      </div>

      {/* Generated Table */}
      <div className="rounded-xl border border-white/10 bg-[#0a0a0c] overflow-hidden text-xs font-mono">
        <table className="w-full text-left">
          <thead className="bg-white/5 border-b border-white/10 text-[10px] text-neutral-400 uppercase">
            <tr>
              <th className="p-2.5">Record Type</th>
              <th className="p-2.5">Host / Name</th>
              <th className="p-2.5">Target / Points To</th>
              <th className="p-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-neutral-200">
            <tr>
              <td className="p-2.5 font-bold text-white">CNAME</td>
              <td className="p-2.5 text-white">{hostName}</td>
              <td className="p-2.5 text-neutral-300 truncate max-w-xs">{targetHost}</td>
              <td className="p-2.5 text-right">
                <button
                  type="button"
                  onClick={() => copyText(targetHost, 'Target Host')}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-sans font-semibold transition-colors cursor-pointer"
                >
                  {copiedField === 'Target Host' ? 'Copied!' : 'Copy Target'}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-neutral-400 italic">
        Tip: Set Cloudflare Proxy to DNS Only (Gray Cloud) during verification. Traefik handles SSL termination automatically.
      </p>
    </div>
  );
}

// ── Interactive Database Connection String Helper ──
function InteractiveDbHelper() {
  const [dbType, setDbType] = useState<'postgres' | 'mysql' | 'redis' | 'mongodb'>('postgres');
  const [user, setUser] = useState('postgres');
  const [password, setPassword] = useState('supersecretpassword');
  const [dbName, setDbName] = useState('production_db');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const connectionString = useMemo(() => {
    switch (dbType) {
      case 'postgres':
        return `DATABASE_URL="postgresql://${user}:${password}@db-postgres:5432/${dbName}"`;
      case 'mysql':
        return `DATABASE_URL="mysql://${user}:${password}@db-mysql:3306/${dbName}"`;
      case 'redis':
        return `REDIS_URL="redis://:${password}@redis-cache:6379/0"`;
      case 'mongodb':
        return `MONGODB_URI="mongodb://${user}:${password}@mongodb-cluster:27017/${dbName}?authSource=admin"`;
    }
  }, [dbType, user, password, dbName]);

  function copyConn() {
    navigator.clipboard.writeText(connectionString);
    setCopied(true);
    toast('Connection string copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 rounded-3xl border border-white/10 bg-[#0c0d12] space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-white">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Interactive Database Connection Generator</h4>
            <p className="text-[11px] text-neutral-400">Generate your copy-paste internal environment variable string.</p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white font-semibold">Live Tool</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(['postgres', 'mysql', 'redis', 'mongodb'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setDbType(type);
              if (type === 'postgres') setUser('postgres');
              else if (type === 'mysql') setUser('root');
              else if (type === 'redis') setUser('');
              else if (type === 'mongodb') setUser('admin');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
              dbType === type
                ? 'bg-white text-black shadow-md'
                : 'bg-[#0a0a0c] border border-white/10 text-neutral-400 hover:text-white'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {dbType !== 'redis' && (
          <div>
            <label className="text-[11px] font-semibold text-neutral-400 block mb-1">Username</label>
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full bg-[#0a0a0c] border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-white/40"
            />
          </div>
        )}
        <div>
          <label className="text-[11px] font-semibold text-neutral-400 block mb-1">Password</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#0a0a0c] border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-white/40"
          />
        </div>
        {dbType !== 'redis' && (
          <div>
            <label className="text-[11px] font-semibold text-neutral-400 block mb-1">Database Name</label>
            <input
              type="text"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              className="w-full bg-[#0a0a0c] border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-white/40"
            />
          </div>
        )}
      </div>

      <div className="p-3 rounded-xl border border-white/10 bg-[#0a0a0c] flex items-center justify-between gap-3 font-mono text-xs text-neutral-200">
        <span className="truncate">{connectionString}</span>
        <button
          type="button"
          onClick={copyConn}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-sans font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
}

// ── Customer FAQ Accordion ──
const FAQ_ITEMS = [
  {
    q: 'Do I need to configure or open host ports for my deployment?',
    a: 'No! ShanuTechX uses internal-only container ports and Traefik automated reverse proxying. Your application listens internally (e.g. port 3000 or 8000), and all external requests are securely routed via HTTPS port 443 with automated SSL.',
  },
  {
    q: 'How fast does my custom domain Let\'s Encrypt SSL activate?',
    a: 'SSL certificate issuance takes approximately 60 to 120 seconds after your CNAME record propagates worldwide. Traefik automatically negotiates the TLS certificate and renews it before expiration with zero manual intervention.',
  },
  {
    q: 'Can other customers see or access my container files or database?',
    a: 'Never. Every deployment is strictly sandboxed on its own private Docker bridge network (shanutechx-net-<id>) and dedicated persistent storage volumes. Zero host ports are exposed publicly, preventing port scanning and lateral movement.',
  },
  {
    q: 'How do I pay with manual Bank Transfer and upload a slip?',
    a: 'Select Bank Transfer at checkout to see our official corporate bank accounts. Transfer the exact amount via your bank app, upload a clear photo or PDF of the transaction slip, and our finance team approves it within minutes to activate your services.',
  },
  {
    q: 'How do I fix Exit Code 137 (OOMKilled)?',
    a: 'Exit Code 137 means your application attempted to use more RAM than its container resource limit. You can either optimize your app memory usage (e.g., Node.js heap flags) or upgrade your container resource tier in the deployment settings.',
  },
];

export default function CustomerKnowledgeBasePage() {
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [articles, setArticles] = useState<(KbArticle & { actionHref?: string; actionLabel?: string })[]>(BUILT_IN_CUSTOMER_ARTICLES);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<(KbArticle & { actionHref?: string; actionLabel?: string }) | null>(null);
  const [votedHelpful, setVotedHelpful] = useState<Record<string, boolean>>({});
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [activeToolTab, setActiveToolTab] = useState<'dns' | 'db'>('dns');

  const { toast } = useToast();

  async function loadKb() {
    try {
      const data = await api.knowledgebase.list(selectedCategory, searchQuery, 'customer');
      if (data && data.articles && data.articles.length > 0) {
        // Merge server articles with built-in articles to ensure complete customer coverage
        const serverIds = new Set(data.articles.map((a: any) => a.slug || a.id));
        const filteredBuiltIn = BUILT_IN_CUSTOMER_ARTICLES.filter(
          (b) => !serverIds.has(b.slug) && !serverIds.has(b.id)
        );
        setArticles([...data.articles, ...filteredBuiltIn]);
      } else {
        setArticles(BUILT_IN_CUSTOMER_ARTICLES);
      }
      if (data && data.categories && data.categories.length > 0) {
        setCategories(data.categories);
      }
    } catch {
      // Fallback to rich built-in customer guides
      setArticles(BUILT_IN_CUSTOMER_ARTICLES);
    }
  }

  useEffect(() => {
    loadKb();
  }, [selectedCategory]);

  // Filter articles based on search and category
  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      const matchesCategory = selectedCategory === 'all' || a.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [articles, selectedCategory, searchQuery]);

  async function handleVoteHelpful(articleId: string) {
    if (votedHelpful[articleId]) return;
    try {
      await api.knowledgebase.voteHelpful(articleId);
    } catch {
      // ignore
    }
    setVotedHelpful((prev) => ({ ...prev, [articleId]: true }));
    setArticles((prev) =>
      prev.map((a) => (a.id === articleId ? { ...a, helpfulCount: a.helpfulCount + 1 } : a))
    );
    if (selectedArticle && selectedArticle.id === articleId) {
      setSelectedArticle({ ...selectedArticle, helpfulCount: selectedArticle.helpfulCount + 1 });
    }
    toast('Thank you for your feedback!', 'success');
  }

  // Parse lines for code blocks, tables, & markdown headers
  function renderContent(text: string) {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^[a-z]+\n/i, '').trim();
        return <CodeBlock key={i} code={code} />;
      }
      // Render text blocks
      const lines = part.split('\n');
      return (
        <div key={i} className="space-y-2 text-neutral-300 leading-relaxed text-xs">
          {lines.map((line, idx) => {
            if (line.startsWith('## ')) {
              return (
                <h3 key={idx} className="text-base font-bold text-white pt-3 pb-1 border-b border-white/[0.08]">
                  {line.replace('## ', '')}
                </h3>
              );
            }
            if (line.startsWith('### ')) {
              return (
                <h4 key={idx} className="text-sm font-semibold text-white pt-2">
                  {line.replace('### ', '')}
                </h4>
              );
            }
            if (line.startsWith('> ')) {
              return (
                <div key={idx} className="p-3 my-2 rounded-xl bg-white/[0.03] border-l-2 border-white/40 text-neutral-300 text-xs italic">
                  {line.replace('> ', '')}
                </div>
              );
            }
            if (line.startsWith('| ') && line.includes(' | ')) {
              // Simple markdown table renderer line
              const cells = line.split('|').filter((c) => c.trim() !== '');
              if (cells.some((c) => c.includes('---'))) return null; // Divider
              return (
                <div key={idx} className="grid grid-cols-4 gap-2 p-2 rounded bg-white/[0.02] border border-white/5 font-mono text-[11px]">
                  {cells.map((cell, cIdx) => (
                    <span key={cIdx} className={cIdx === 0 ? 'font-bold text-white' : 'text-neutral-300'}>
                      {cell.trim()}
                    </span>
                  ))}
                </div>
              );
            }
            if (line.startsWith('- ') || line.startsWith('* ')) {
              return (
                <div key={idx} className="flex items-start gap-2 pl-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 mt-1.5 shrink-0" />
                  <span>{line.replace(/^[-*]\s+/, '')}</span>
                </div>
              );
            }
            if (/^\d+\.\s/.test(line)) {
              return (
                <div key={idx} className="flex items-start gap-2 pl-2">
                  <span className="font-mono text-neutral-400 font-bold">{line.match(/^\d+\./)?.[0]}</span>
                  <span>{line.replace(/^\d+\.\s+/, '')}</span>
                </div>
              );
            }
            if (!line.trim()) return <div key={idx} className="h-1.5" />;
            return <p key={idx}>{line}</p>;
          })}
        </div>
      );
    });
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-fade-in pb-16">
      <PageHeader
        title="Knowledge Base & Help Center"
        description="Clear, actionable guides, interactive DNS/database tools, command snippets, and troubleshooting for your deployments."
      />

      {/* ── Search & Quick Tags Banner (Pure Black Hero) ── */}
      <div className="p-8 border border-white/10 rounded-3xl bg-black text-center space-y-4 shadow-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-neutral-300 mb-1">
          <BookOpen className="w-3.5 h-3.5 text-white" />
          <span>Customer Documentation</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          What do you need help with?
        </h2>
        <p className="text-xs text-neutral-400 max-w-lg mx-auto">
          Everything you need to know: Deploying Git repositories, custom domains, database credentials, container isolation, and billing.
        </p>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search GitHub deploys, CNAME setup, PostgreSQL, SSL, memory limits..."
            className="w-full bg-[#0c0d12] border border-white/15 rounded-2xl pl-11 pr-10 py-3.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 shadow-inner font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Search Tags */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
          <span className="text-[11px] text-neutral-500 mr-1">Popular:</span>
          {['Deployments', 'Domains & SSL', 'Databases', 'Container Security', 'Live Console', 'Business Email', 'Billing', 'Troubleshooting'].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setSearchQuery(tag);
                setSelectedCategory('all');
              }}
              className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* ── Featured Quick-Start Guides ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-white" />
          <span>Essential Guides for Customers</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              title: '1-Click & Git Deploys',
              desc: 'Deploy in under 60 seconds with automatic port detection.',
              icon: Rocket,
              targetId: 'kb-deploy-first-app',
            },
            {
              title: 'Connect Custom Domain',
              desc: 'Add a CNAME record with free automated Let\'s Encrypt SSL.',
              icon: Globe,
              targetId: 'kb-custom-domains-ssl',
            },
            {
              title: 'Managed Databases',
              desc: 'Connect PostgreSQL, MySQL, Redis & MongoDB securely.',
              icon: Database,
              targetId: 'kb-managed-databases',
            },
            {
              title: 'Container Security',
              desc: 'Isolated bridge network, private volumes & zero host ports.',
              icon: ShieldCheck,
              targetId: 'kb-container-isolation-security',
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                onClick={() => {
                  const target = BUILT_IN_CUSTOMER_ARTICLES.find((a) => a.id === item.targetId);
                  if (target) setSelectedArticle(target);
                }}
                className="p-4 rounded-2xl border border-white/10 bg-[#0c0d12] hover:bg-white/[0.04] hover:border-white/20 transition-all cursor-pointer group space-y-2 shadow-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-white">
                  <Icon className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-neutral-200 transition-colors">
                  {item.title}
                </h4>
                <p className="text-[11px] text-neutral-400 leading-snug">
                  {item.desc}
                </p>
                <div className="text-[10px] font-semibold text-white flex items-center gap-1 pt-1">
                  <span>Read Guide</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Interactive Customer Tools Bar (DNS & Database Helpers) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-white" />
            <span>Interactive Customer Tools</span>
          </h3>
          <div className="flex items-center gap-1.5 p-1 bg-[#0c0d12] border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveToolTab('dns')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeToolTab === 'dns'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              DNS CNAME Generator
            </button>
            <button
              type="button"
              onClick={() => setActiveToolTab('db')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeToolTab === 'db'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Database Connection Generator
            </button>
          </div>
        </div>

        {activeToolTab === 'dns' ? <InteractiveDnsHelper /> : <InteractiveDbHelper />}
      </div>

      {/* ── Category Filter Pills ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
          Browse by Topic
        </h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.slug;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => setSelectedCategory(cat.slug)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-white text-black shadow-md'
                    : 'bg-[#0c0d12] border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <CategoryIcon slug={cat.slug} className={`w-3.5 h-3.5 ${isSelected ? 'text-black' : 'text-neutral-400'}`} />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Articles Grid ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            {selectedCategory === 'all' ? 'All Documentation Articles' : `Category: ${selectedCategory}`}
          </h3>
          <span className="text-xs text-neutral-500 font-mono">{filteredArticles.length} article(s)</span>
        </div>

        {loading ? (
          <div className="py-12 text-center"><Spinner label="Loading Documentation..." /></div>
        ) : filteredArticles.length === 0 ? (
          <Card className="border border-dashed border-white/10 p-12 text-center text-neutral-400 text-xs bg-black/40">
            No customer articles found matching current topic or search query.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArticles.map((article) => (
              <div
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                className="p-5 border border-white/10 rounded-2xl bg-[#0c0d12] hover:bg-white/[0.04] hover:border-white/20 transition-all cursor-pointer space-y-3 group shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/10 text-neutral-300 font-semibold inline-block">
                      {article.category}
                    </span>
                    <h4 className="text-sm font-bold text-white group-hover:text-neutral-200 transition-colors leading-snug">
                      {article.title}
                    </h4>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </div>
                <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                  {article.summary}
                </p>
                <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono pt-2 border-t border-white/5">
                  <span className="flex items-center gap-1.5 text-neutral-400">
                    <Eye className="w-3 h-3 text-neutral-500" /> {article.views} views
                  </span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3 text-emerald-400" /> {article.helpfulCount} helpful
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Customer FAQ Accordion ── */}
      <div className="p-6 md:p-8 rounded-3xl border border-white/10 bg-[#0c0d12] space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-white" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Frequently Asked Customer Questions
          </h3>
        </div>
        <p className="text-xs text-neutral-400">
          Fast answers to common questions about ports, custom domains, container safety, and payments.
        </p>

        <div className="divide-y divide-white/10">
          {FAQ_ITEMS.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div key={idx} className="py-3.5 space-y-2">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 text-left cursor-pointer group"
                >
                  <span className="text-xs font-semibold text-neutral-200 group-hover:text-white transition-colors">
                    {faq.q}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-neutral-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-500 group-hover:text-white shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <p className="text-xs text-neutral-400 leading-relaxed pl-1 pt-1 animate-fade-in font-sans">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Article Reader Modal (Black Glass) ── */}
      {selectedArticle && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedArticle(null)}
        >
          <div
            className="bg-[#0a0a0d] border border-white/15 rounded-3xl p-6 md:p-8 w-full max-w-3xl max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl shadow-black relative scrollbar-thin"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-mono px-2.5 py-1 rounded bg-white/10 text-white font-bold border border-white/10 inline-block">
                  {selectedArticle.category}
                </span>
                <h2 className="text-lg md:text-xl font-bold text-white">
                  {selectedArticle.title}
                </h2>
                <p className="text-xs text-neutral-400">
                  {selectedArticle.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 text-xs leading-relaxed">
              {renderContent(selectedArticle.content)}
            </div>

            {/* Modal Footer with Direct Action CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/[0.08] pt-4 text-xs">
              <span className="text-neutral-500 font-mono text-[11px]">
                Updated {new Date(selectedArticle.updatedAt).toLocaleDateString()}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {selectedArticle.actionHref && (
                  <Link href={selectedArticle.actionHref}>
                    <Button
                      size="sm"
                      className="bg-white text-black hover:bg-neutral-200 font-bold shadow-md flex items-center gap-1.5"
                    >
                      <span>{selectedArticle.actionLabel || 'Open Dashboard'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => handleVoteHelpful(selectedArticle.id)}
                  disabled={votedHelpful[selectedArticle.id]}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    votedHelpful[selectedArticle.id]
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>
                    {votedHelpful[selectedArticle.id]
                      ? 'Helpful'
                      : `Helpful (${selectedArticle.helpfulCount})`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-300 border border-white/15 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
