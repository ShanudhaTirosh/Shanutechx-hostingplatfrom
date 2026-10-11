# 🌐 ShanuTechX SEO, AI Bot Discovery & Security Standards Guide

This guide documents the enterprise SEO architecture, AI search engine discovery mechanisms, crawler governance policies, and RFC security standards implemented across the ShanuTechX platform.

---

## 📌 1. Architectural Overview & Threat-Aware Bot Governance

In a cloud-orchestration monorepo hosting both public storefront content and multi-tenant customer/admin panels, unconstrained web crawlers present severe security, privacy, and performance risks:
- Uncontrolled indexing could expose authentication portals, API payloads, and internal dashboard routes to public search engines.
- Aggressive AI web scrapers consume significant compute and bandwidth if not guided to structured content.

ShanuTechX resolves this through a **perimeter-shielded dual-tier architecture**:

```
                       Internet Crawlers & AI Bots
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
       ┌────────────▼────────────┐   ┌────────────▼────────────┐
       │   Public Web Storefront │   │ Protected Monorepo Apps │
       │        (apps/web)       │   │  (dashboard, webmail,   │
       │                         │   │          api)           │
       └────────────┬────────────┘   └────────────┬────────────┘
                    │                             │
       ┌────────────▼────────────┐   ┌────────────▼────────────┐
       │  Dynamic sitemap.xml    │   │ Disallow: /             │
       │  Dual-Policy robots.txt │   │ (Noindex, Noarchive,    │
       │  llms.txt / llms-full   │   │  No AI scraping)        │
       │  RFC 9116 security.txt  │   │                         │
       │  RFC 8461 mta-sts.txt   │   │                         │
       │  humans.txt & JSON-LD   │   │                         │
       └─────────────────────────┘   └─────────────────────────┘
```

1. **Public Storefront (`apps/web`):** Full, high-performance SEO indexing, structured JSON-LD graphs, automated sitemaps, and dedicated AI discovery feeds.
2. **Internal Applications (`apps/dashboard`, [`apps/webmail`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/webmail), [`apps/api`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api)):** Universal crawler shielding via `robots.txt` declaring `Disallow: /`, preventing accidental indexing or cache exposure of administrative interfaces.

---

## 🗺️ 2. Dynamic Sitemap Engine (`apps/web/app/sitemap.ts`)

Next.js 14 App Router dynamically compiles [`apps/web/app/sitemap.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/app/sitemap.ts) to `https://shanutechx.com/sitemap.xml`.

### 2.1 Canonical Routes & Indexing Matrix

The sitemap indexes **20 canonical public routes** organized by priority and change frequency:

| Route | Priority | Change Frequency | Purpose |
| :--- | :---: | :---: | :--- |
| `/` | `1.0` | `daily` | Homepage & interactive cloud platform showcase |
| `/pricing` | `0.9` | `daily` | VPS, dedicated node, and database tier pricing |
| `/features` | `0.9` | `weekly` | Core orchestration and deployment feature specs |
| `/docs` | `0.9` | `weekly` | Developer and DevOps documentation portal |
| `/status` | `0.8` | `always` | Real-time platform cluster & network health |
| `/blog` | `0.8` | `daily` | Platform engineering updates and tech guides |
| `/templates` | `0.8` | `weekly` | 500+ One-Click Docker Compose catalog |
| `/security` | `0.8` | `monthly` | Security posture, compliance, and vault specs |
| `/reviews` | `0.8` | `weekly` | Customer feedback, testimonials, case studies |
| `/faqs` | `0.7` | `monthly` | Frequently asked billing and technical questions |
| `/help` | `0.7` | `weekly` | Support portal, contact options, knowledge base |
| `/changelog` | `0.7` | `weekly` | Platform patch notes and release tracker |
| `/integrations` | `0.7` | `monthly` | GitHub, GitLab, Stripe, Cloudflare ecosystem |
| `/about` | `0.6` | `monthly` | Company background, team, and infrastructure |
| `/contact` | `0.6` | `monthly` | Direct support inquiry and sales channels |
| `/legal/terms` | `0.3` | `yearly` | Terms of service and SLA policies |
| `/legal/privacy` | `0.3` | `yearly` | Privacy policy and data protection guidelines |
| `/legal/refund` | `0.3` | `yearly` | Refund policy and dunning lifecycle |
| `/legal/acceptable-use` | `0.3` | `yearly` | Acceptable use policy and abuse reporting |
| `/legal/sla` | `0.3` | `yearly` | Service level agreement uptime commitments |

### 2.2 Environment Configuration
`sitemap.ts` respects the `NEXT_PUBLIC_APP_URL` environment variable (falling back to `https://shanutechx.com`), ensuring URLs match development, staging, or production domains.

---

## 🤖 3. Crawler Governance Policies (`robots.ts`)

### 3.1 Public Web Storefront Policy (`apps/web/app/robots.ts`)

[`apps/web/app/robots.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/app/robots.ts) implements a granular dual-policy model:

```typescript
// 1. General search engines (Googlebot, Bingbot, DuckDuckBot, etc.)
{
  userAgent: '*',
  allow: '/',
  disallow: [
    '/api/',
    '/dashboard/',
    '/admin/',
    '/_next/',
    '/login',
    '/register',
    '/checkout/',
    '/oauth/',
    '/*.json$',
  ],
}

// 2. Verified AI scrapers and reasoning agents
{
  userAgent: [
    'GPTBot',
    'ChatGPT-User',
    'ClaudeBot',
    'anthropic-ai',
    'PerplexityBot',
    'Google-Extended',
    'Applebot-Extended',
    'Amazonbot',
    'Bytespider',
    'CCBot',
    'cohere-ai',
  ],
  allow: [
    '/',
    '/docs',
    '/docs/*',
    '/pricing',
    '/features',
    '/templates',
    '/status',
    '/blog',
    '/blog/*',
    '/changelog',
    '/reviews',
    '/faqs',
    '/help',
    '/legal/*',
    '/llms.txt',
    '/llms-full.txt',
  ],
  disallow: [
    '/api/',
    '/dashboard/',
    '/admin/',
    '/_next/',
    '/login',
    '/register',
    '/checkout/',
    '/oauth/',
    '/settings/',
  ],
}
```

### 3.2 Shielded Application Subsystems

To prevent internal apps from leaking routes to search indexes:
1. **[`apps/dashboard/app/robots.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/dashboard/app/robots.ts):**
   ```typescript
   export default function robots(): MetadataRoute.Robots {
     return {
       rules: { userAgent: '*', disallow: '/' },
     };
   }
   ```
2. **[`apps/webmail/app/robots.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/webmail/app/robots.ts):**
   ```typescript
   export default function robots(): MetadataRoute.Robots {
     return {
       rules: { userAgent: '*', disallow: '/' },
     };
   }
   ```
3. **[`apps/api/src/index.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/index.ts):**
   ```typescript
   app.get('/robots.txt', (_req, res) => {
     res.type('text/plain').send('User-agent: *\nDisallow: /\n');
   });
   ```

---

## 🧠 4. AI & LLM Standards (`llms.txt` & `llms-full.txt`)

Following the emerging `/llms.txt` standard for LLM search engines (Perplexity, ChatGPT Search, Claude Search, Gemini), ShanuTechX publishes curated knowledge feeds:

### 4.1 Index Summary (`apps/web/public/llms.txt`)
Located at `https://shanutechx.com/llms.txt`. Contains:
- Concise elevator pitch and architectural summary.
- Core capabilities: VPS Orchestration, 1-Click Compose Catalog, Multi-Tier DBs, Automated DNS, OAuth SSO, SSH Terminal Gateway.
- Markdown links to canonical specification endpoints and full technical ingestion feed (`/llms-full.txt`).

### 4.2 Comprehensive Context (`apps/web/public/llms-full.txt`)
Located at `https://shanutechx.com/llms-full.txt`. Contains:
- Complete monorepo subsystem breakdown (`apps/`, `services/`, `packages/`).
- API schemas and SDK interface types (`@shanutechx/client`).
- Security architecture (AES-256-GCM vault, timing-safe HMAC node authentication, OAuth SSO enforcement).
- Full hosting specifications and pricing matrices.

---

## 👥 5. Team Attribution (`humans.txt`)

Located at `https://shanutechx.com/humans.txt` and linked in HTML `<head>` via `<link rel="author" href="/humans.txt" />`:
- Credits the core engineering, DevOps, and product design contributors.
- Documents the tech stack: Next.js 14, TypeScript, Express, Prisma 5, Tailwind CSS, Dockerode, BullMQ, PostgreSQL 16, Redis 7.

---

## 🛡️ 6. RFC 9116 Vulnerability Disclosure (`security.txt`)

Deployed at both canonical locations:
- `https://shanutechx.com/.well-known/security.txt`
- `https://shanutechx.com/security.txt`

Conforms strictly to **RFC 9116**:
```text
Contact: mailto:security@shanutechx.com
Contact: https://shanutechx.com/help
Encryption: https://shanutechx.com/.well-known/pgp-key.txt
Acknowledgments: https://shanutechx.com/security
Policy: https://shanutechx.com/legal/security
Hiring: https://shanutechx.com/careers
Canonical: https://shanutechx.com/.well-known/security.txt
Preferred-Languages: en
Expires: 2027-12-31T23:59:59.000Z
```
Includes a Safe Harbor declaration protecting security researchers acting in good faith.

---

## 📧 7. RFC 8461 MTA-STS Email Transport Security (`mta-sts.txt`)

Deployed at `https://mta-sts.shanutechx.com/.well-known/mta-sts.txt` (served from [`apps/web/public/.well-known/mta-sts.txt`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/public/.well-known/mta-sts.txt)):

```text
version: STSv1
mode: testing
mx: mail.shanutechx.com
mx: smtp.shanutechx.com
max_age: 86400
```
Protects enterprise mail delivery against SMTP man-in-the-middle downgrade attacks (STARTTLS stripping) by requiring cryptographic TLS validation.

---

## 📊 8. Schema.org JSON-LD Structured Graph

[`apps/web/app/layout.tsx`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/app/layout.tsx) injects a structured Schema.org `@graph` script enabling rich snippet cards in Google, Bing, and AI search results:

1. **`WebSite`**: Platform URL, name, alternateName (`ShanuTechX Cloud`), description, and OpenSearch search potential.
2. **`Organization`**: Brand name, logo, founders, contact points, and social profiles.
3. **`SoftwareApplication`**:
   - `applicationCategory`: `BusinessApplication`, `DeveloperApplication`
   - `operatingSystem`: `Linux, Docker, Cloud VPS`
   - `offers`: Free Tier ($0/mo) and Professional Tier ($15/mo)
   - `featureList`: Autonomous container provisioning, Docker Compose catalog, managed DBs, real-time SSH web terminal.

---

## 📑 9. Page-Level Layout Metadata

Dedicated `layout.tsx` files provide tailored OpenGraph and Twitter card metadata for core routes:
- [`apps/web/app/docs/layout.tsx`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/app/docs/layout.tsx) — Developer Documentation & API Guides
- [`apps/web/app/pricing/layout.tsx`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/app/pricing/layout.tsx) — Pricing, VPS & Dedicated Node Plans
- [`apps/web/app/faqs/layout.tsx`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/app/faqs/layout.tsx) — Frequently Asked Questions
- [`apps/web/app/help/layout.tsx`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/app/help/layout.tsx) — Help Center & 24/7 Technical Support
- [`apps/web/app/status/layout.tsx`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/app/status/layout.tsx) — Real-Time Infrastructure Status
- [`apps/web/app/reviews/layout.tsx`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/web/app/reviews/layout.tsx) — Verified Customer Reviews & Case Studies

---

## 🧪 10. Audit & Verification Checklist

To verify that all SEO, bot discovery, and security endpoints function correctly:

```bash
# 1. Verify dynamic sitemap (should return 200 with XML content)
curl -sI http://localhost:3000/sitemap.xml

# 2. Verify robots.txt on public storefront
curl -s http://localhost:3000/robots.txt | grep -E "GPTBot|ClaudeBot|Sitemap"

# 3. Verify robots.txt on protected dashboard (should return Disallow: /)
curl -s http://localhost:3001/robots.txt

# 4. Verify robots.txt on protected webmail (should return Disallow: /)
curl -s http://localhost:3002/robots.txt

# 5. Verify robots.txt on Express API (should return Disallow: /)
curl -s http://localhost:4000/robots.txt

# 6. Verify LLM ingest feeds
curl -sI http://localhost:3000/llms.txt
curl -sI http://localhost:3000/llms-full.txt

# 7. Verify RFC 9116 security.txt
curl -s http://localhost:3000/.well-known/security.txt | grep "Contact:"

# 8. Verify RFC 8461 mta-sts.txt
curl -s http://localhost:3000/.well-known/mta-sts.txt | grep "STSv1"

# 9. Verify humans.txt credits
curl -s http://localhost:3000/humans.txt | grep "/* TEAM */"
```
