-- Audit finding H1: replaces the old in-memory Knowledge Base
-- articles/categories arrays in routes/knowledgebase.ts with real,
-- persisted tables. Seed data equivalent to the old SEEDED_CATEGORIES /
-- SEEDED_ARTICLES constants is inserted below so behavior is unchanged
-- immediately after this migration runs -- admins can then edit/add/
-- remove articles for real, with changes actually persisting.

CREATE TABLE "KbCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,

    CONSTRAINT "KbCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KbCategory_slug_key" ON "KbCategory"("slug");

CREATE TABLE "KbArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "views" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KbArticle_slug_key" ON "KbArticle"("slug");
CREATE INDEX "KbArticle_categoryId_published_idx" ON "KbArticle"("categoryId", "published");

ALTER TABLE "KbArticle" ADD CONSTRAINT "KbArticle_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "KbCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "KbCategory" ("id", "name", "slug", "description", "icon") VALUES
  ('cat-deploy', 'Deployments & Apps', 'deployments', 'Deploying Node.js, Python, Docker apps & Git repos.', '🚀'),
  ('cat-vps', 'VPS Fleet & Nodes', 'vps', 'Managing VPS resources, SSH keys, root access, and specs.', '🖥'),
  ('cat-db', 'Managed Databases', 'databases', 'PostgreSQL, MySQL, Redis, and MongoDB cluster setup.', '🗄️'),
  ('cat-domains', 'Domains & SSL', 'domains', 'Configuring subdomains, custom CNAMEs, and Traefik SSL certificates.', '🌐'),
  ('cat-billing', 'Billing & Invoices', 'billing', 'Subscriptions, bank slip manual verification, and payment methods.', '💳'),
  ('cat-api', 'API & Developer SDK', 'api', 'Using @shanutechx/* SDKs, webhooks, and REST endpoints.', '⚡');

INSERT INTO "KbArticle" ("id", "slug", "title", "categoryId", "summary", "content", "published", "views", "helpfulCount", "updatedAt") VALUES
  ('kb-1', 'deploying-your-first-app', 'Deploying your first Web App on ShanuTechX', 'cat-deploy',
   'Learn how to create a deployment from Docker images, GitHub repos, or 1-click catalog templates.',
   E'## Quick Start Guide\n\nDeploying an application on ShanuTechX takes under 60 seconds.\n\n### Method 1: 1-Click App Catalog\n1. Navigate to **App Catalog** from the dashboard sidebar.\n2. Select a pre-configured template such as **Node.js Starter**, **Redis**, **WordPress**, or **n8n**.\n3. Choose your desired subdomain (e.g. `my-app.shanutechx.com`).\n4. Click **Deploy Now**.\n\n### Method 2: Git Repository Integration\n1. Go to **Deployments** -> **Create New Deployment**.\n2. Connect your GitHub or GitLab account under **Developer Settings**.\n3. Select your repository, branch, and build command.\n4. Set any required environment variables.\n\n### Traefik SSL Automation\nAll deployments automatically receive a free Let''s Encrypt TLS certificate routed via Traefik. No manual SSL configuration required!',
   true, 342, 89, CURRENT_TIMESTAMP),
  ('kb-2', 'custom-subdomains-and-cnames', 'Configuring Custom Subdomains & CNAME Records', 'cat-domains',
   'Step-by-step guide to mapping custom domains and choosing subdomains.',
   E'## Custom Subdomain Selection\n\nEvery deployment on ShanuTechX gets a default subdomain under your primary domain.\n\n### Changing your Subdomain\n1. Open your deployment details page.\n2. Select the **Network & Domains** tab.\n3. Enter your desired subdomain slug (e.g., `api-v2`).\n4. Click **Update Subdomain**. Traefik will re-route traffic in real time.\n\n### Pointing a Custom Domain (CNAME / A Record)\nIf you own a domain like `example.com`:\n1. Add an **A Record** pointing to your Node IP address, OR a **CNAME Record** pointing to `your-app.shanutechx.com`.\n2. Enter the domain in the **Custom Domain** field on your deployment page.\n3. Wait 1-2 minutes for DNS propagation and automatic SSL certificate generation.',
   true, 218, 64, CURRENT_TIMESTAMP),
  ('kb-3', 'managed-database-connections', 'Connecting to Managed PostgreSQL, Redis & MongoDB', 'cat-db',
   'How to provision databases and secure your connection strings.',
   E'## Managed Databases Overview\n\nShanuTechX provides fully isolated, containerized database instances for PostgreSQL, MySQL, Redis, and MongoDB.\n\n### Provisioning a Database\n1. Go to **App Catalog** or **Deployments**.\n2. Select your database engine:\n   - **PostgreSQL**: Port 5432\n   - **MySQL**: Port 3306\n   - **Redis**: Port 6379\n   - **MongoDB**: Port 27017\n3. Once created, view connection credentials under **Deployments** -> **Databases Tab**.\n\n### Environment Variable Integration\nPass database connection strings to your application using internal container hostnames or node IP addresses. Environment variables are encrypted at rest using AES-256-GCM.',
   true, 189, 52, CURRENT_TIMESTAMP),
  ('kb-4', 'using-web-ide-file-manager', 'Using the Web IDE & Code Editor', 'cat-deploy',
   'Edit code, manage workspace files, and save directly in your browser.',
   E'## Browser-Based Web IDE Features\n\nShanuTechX includes an online code editor and file manager built into every deployment.\n\n### Features\n- **Multi-Tab File Editor**: Open and edit multiple code/config files simultaneously.\n- **Dirty State Indicator**: A dot (`*`) appears next to modified tabs. Press `Ctrl+S` or `Cmd+S` to save instantly.\n- **File Management**: Create files/directories, rename, delete, upload assets, and download backups.\n- **Syntax Highlighting**: Supports JavaScript, TypeScript, JSON, Python, HTML/CSS, YAML, Dockerfile, and Shell scripts.',
   true, 145, 41, CURRENT_TIMESTAMP),
  ('kb-5', 'vps-fleet-management', 'VPS Fleet Management & SSH Access', 'cat-vps',
   'Managing VPS resources, SSH keys, node health, and root password resets.',
   E'## VPS Fleet Control\n\nControl your Virtual Private Server nodes directly from the dashboard.\n\n### SSH Key Access\n1. Generate an SSH keypair on your machine (`ssh-keygen -t ed25519`).\n2. Add your public key in **Profile Settings** -> **SSH Keys**.\n3. Connect using: `ssh root@<NODE_IP>`.\n\n### Resource Gauges & Monitoring\nView live CPU utilization, RAM usage, and Disk consumption under **VPS** or **Nodes Overview**.',
   true, 290, 78, CURRENT_TIMESTAMP);
