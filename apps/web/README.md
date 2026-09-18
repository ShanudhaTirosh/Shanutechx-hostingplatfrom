# 🌐 ShanuTechX Public Storefront & Marketing Site (`apps/web`)

The public storefront, product pricing catalog, and documentation portal for the ShanuTechX cloud hosting platform, built with **Next.js 14 App Router** and **Tailwind CSS**.

Operational Quick-Start: see [`AGENTS.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/AGENTS.md)  
Defect Audit & Vulnerability Report: see [`BUG_AUDIT.md`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/BUG_AUDIT.md)

---

## ⚡ Key Capabilities & Design

- **Dark-Theme Glassmorphism UI**: High-impact marketing pages for web hosting, Node.js/Python containers, VPS reselling, and database hosting.
- **Product Catalog & Pricing**: Live product pricing tables with checkout routing.
- **SEO & Metadata Optimization**: Full Next.js Metadata API integration (`sitemap.xml`, `robots.txt`, dynamic OG images via `next/og`).
- **OAuth SSO Standard**: Public auth entrypoints redirect directly to Firebase Google, GitHub, and Discord OAuth flows.

---

## 📂 Codebase Structure

```text
apps/web/
├── app/
│   ├── layout.tsx               # Root marketing layout (SEO tags, header, footer)
│   ├── page.tsx                 # Main platform storefront homepage
│   ├── sitemap.ts               # Dynamic sitemap generator (/sitemap.xml)
│   ├── robots.ts                # Dynamic robots.txt generator (/robots.txt)
│   ├── opengraph-image.tsx      # Dynamic brand OG image generator
│   ├── pricing/                 # Product pricing plans and feature comparison
│   ├── docs/                    # Public platform documentation pages
│   ├── terms/                   # Terms of Service
│   └── privacy/                 # Privacy Policy
├── components/                  # Glassmorphism marketing UI components
├── lib/                         # Shared metadata & site configuration
├── package.json
└── tsconfig.json
```

---

## 🛠️ Commands & Development

- **Start Dev Server:** `npm run dev:web` (runs on port `3000`)
- **Build Production Bundle:** `npm run build --workspace=apps/web`
