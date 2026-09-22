# 📦 Phase 15 Removed Templates Inventory & Catalog Guide (`templates_removed_phase15/`)

> **Repository:** `ShanudhaTirosh/Shanutechx-hostingplatfrom`  
> **Source Directory:** [`templates_removed_phase15/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15)  
> **Total Staged Templates:** **361 Docker Compose Application Templates**

---

## 📋 Executive Overview & Background

During **Phase 15** of the ShanuTechX cloud platform development, the core platform catalog was streamlined to prioritize high-frequency enterprise hosting stacks (WordPress, Grafana, N8N, Postgres, Redis, MinIO, Hermes AI Agent, etc.) while offloading non-core community templates to [`templates_removed_phase15/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15).

This directory acts as a **staged template vault**. All 361 templates remain 100% valid, Docker Compose-compliant, and fully compatible with the ShanuTechX One-Click App Catalog engine ([`packages/catalog`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/catalog)).

### 🔄 How to Restore Any Template
To re-enable any template in the live catalog, simply copy or move the `.yaml` / `.yml` file from `templates_removed_phase15/` into [`templates/`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates):

```bash
# Example: Restoring Immich (Google Photos alternative) to live templates
cp templates_removed_phase15/immich.yaml templates/
```
Once moved into `templates/`, the platform catalog manager auto-indexes the template and makes it instantly deployable via the Control Panel Dashboard or REST API.

---

## 📊 Categorized Summary of Staged Templates

The 361 staged templates span **12 major software categories**:

1. **AI, LLM & Machine Learning (17 Templates):** Vector databases, RAG agents, local LLM runners, and prompt observability platforms.
2. **CMS, Blogging & Knowledge Management (28 Templates):** Headless CMSs, Notion/Miro alternatives, enterprise documentation, and wikis.
3. **Developer Tools, CI/CD & Cloud IDEs (25 Templates):** Web-based VS Code, Git platform runners, API testing, and build automation servers.
4. **Databases, Caching & Data Management (16 Templates):** DB admin interfaces, reactive databases, vector search, and sync engines.
5. **Automation, Workflows & Task Management (18 Templates):** Low-code internal tools, job schedulers, and Zapier/Jira alternatives.
6. **Analytics, Monitoring & Observability (22 Templates):** APM tracing, uptime monitoring, error reporting, and privacy web analytics.
7. **Communication, Mail & Customer Support (18 Templates):** Shared inboxes, Matrix servers, push notification gateways, and newsletter managers.
8. **E-Commerce, ERP, CRM & Financial Management (17 Templates):** Invoicing, HR platforms, personal financial managers, and business ERP suites.
9. **Media Streaming, Backup & Entertainment (21 Templates):** Photo backups, media servers, audiobooks, and podcast hosts.
10. **File Management, Cloud Storage & Backups (15 Templates):** S3 object storage, password managers, and document management systems.
11. **Security, Auth & Utilities (14 Templates):** Identity providers (IdP), PDF manipulators, developer Swiss Army tools, and whiteboards.
12. **Dedicated Gaming Servers & Tools (7 Templates):** Dedicated game servers for Minecraft, Palworld, Satisfactory, Terraria, and VTTs.

---

## 📑 Complete Directory Inventory (All 361 Templates)

### 1. 🤖 AI, LLM & Machine Learning

| File Name | Application Name | Purpose & Why It Is Needed | Size |
| :--- | :--- | :--- | :--- |
| [`activepieces.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/activepieces.yaml) | Activepieces | Open-source business automation & AI agent workflow platform (Zapier alternative). | 2.4 KB |
| [`anythingllm.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/anythingllm.yaml) | AnythingLLM | All-in-one AI document RAG assistant supporting custom LLMs and vector embeddings. | 1.4 KB |
| [`argilla.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/argilla.yaml) | Argilla | Data curation and evaluation framework for training LLMs and fine-tuning AI models. | 4.6 KB |
| [`chroma.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/chroma.yaml) | Chroma DB | Open-source AI embedding vector database for building RAG pipelines. | 0.6 KB |
| [`dify.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/dify.yaml) | Dify.AI | Complete LLM application development platform for building AI agents and workflows. | 27.0 KB |
| [`flowise.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/flowise.yaml) | Flowise AI | Drag-and-drop visual interface for LangChain JS to build LLM apps & RAG bots. | 1.0 KB |
| [`flowise-with-databases.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/flowise-with-databases.yaml) | Flowise + DB | Flowise AI pre-configured with PostgreSQL and Redis backends for production persistent state. | 2.3 KB |
| [`hermes-agent-with-webui.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/hermes-agent-with-webui.yaml) | Hermes AI Agent | Autonomous AI agent with browser WebUI for automated task execution. | 1.6 KB |
| [`langflow.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/langflow.yaml) | Langflow | Python-native visual builder for RAG and multi-agent AI systems. | 1.4 KB |
| [`langfuse.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/langfuse.yaml) | Langfuse | LLM engineering platform for tracing, prompt management, and AI analytics. | 6.2 KB |
| [`librechat.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/librechat.yaml) | LibreChat | Open-source AI chat platform supporting OpenAI, Anthropic, Ollama, and Google Gemini APIs. | 5.0 KB |
| [`litellm.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/litellm.yaml) | LiteLLM | OpenAI-compatible proxy gateway to call 100+ LLMs with unified key management & load balancing. | 5.9 KB |
| [`lobe-chat.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/lobe-chat.yaml) | LobeChat | Modern, extensible chat UI framework supporting TTS, plugins, and custom agent roles. | 0.6 KB |
| [`mindsdb.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/mindsdb.yaml) | MindsDB | AI database engine connecting enterprise data sources directly to LLM models. | 1.8 KB |
| [`ollama-with-open-webui.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/ollama-with-open-webui.yaml) | Ollama + Open-WebUI | Self-hosted local LLM runner (Llama 3, Mistral) paired with a ChatGPT-style web UI. | 0.8 KB |
| [`open-webui.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/open-webui.yaml) | Open WebUI | Standalone user interface for Ollama, vLLM, and OpenAI API backends. | 0.5 KB |
| [`qdrant.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/qdrant.yaml) | Qdrant | High-performance vector search engine & database for AI recommendation and RAG engines. | 0.7 KB |
| [`weaviate.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/weaviate.yaml) | Weaviate | Cloud-native, open-source vector database supporting multimodal vectors and hybrid search. | 1.7 KB |
| [`zep.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/zep.yaml) | Zep Memory | Fast, scalable long-term memory store for AI agents and chat assistants. | 8.0 KB |

---

### 2. 📝 CMS, Publishing & Knowledge Base

| File Name | Application Name | Purpose & Why It Is Needed | Size |
| :--- | :--- | :--- | :--- |
| [`affine.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/affine.yaml) | AFFiNE | Privacy-focused Notion + Miro alternative combining docs, whiteboards, and database views. | 2.8 KB |
| [`alexandrie.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/alexandrie.yaml) | Alexandrie | Lightweight Rust-based private Cargo crate registry for Rust developers. | 2.9 KB |
| [`appflowy.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/appflowy.yaml) | AppFlowy | Open-source Notion alternative built with Flutter and Rust for offline-first workspace management. | 13.8 KB |
| [`booklore.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/booklore.yaml) | Booklore | Self-hosted book, novel, and document library manager. | 1.5 KB |
| [`bookstack.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/bookstack.yaml) | BookStack | Simple, self-hosted documentation platform organized into Books, Chapters, and Pages. | 2.2 KB |
| [`classicpress-with-mariadb.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/classicpress-with-mariadb.yaml) | ClassicPress + MariaDB | Lightweight WordPress alternative fork optimized for security and performance with MariaDB. | 1.2 KB |
| [`classicpress-with-mysql.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/classicpress-with-mysql.yaml) | ClassicPress + MySQL | ClassicPress CMS with dedicated MySQL 8 database container. | 1.2 KB |
| [`classicpress-without-database.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/classicpress-without-database.yaml) | ClassicPress | Standalone ClassicPress CMS container for connecting to external databases. | 0.5 KB |
| [`cockpit.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/cockpit.yaml) | Cockpit CMS | Headless content management system with flexible JSON content structures. | 0.6 KB |
| [`codimd.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/codimd.yaml) | CodiMD | Real-time collaborative Markdown editor (formerly HackMD CE). | 1.5 KB |
| [`directus.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/directus.yaml) | Directus | Open-source data platform turning any SQL database into a REST & GraphQL API + Admin App. | 1.2 KB |
| [`directus-with-postgresql.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/directus-with-postgresql.yaml) | Directus + Postgres | Directus Headless CMS pre-configured with a dedicated PostgreSQL 16 database. | 2.2 KB |
| [`docmost.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/docmost.yaml) | Docmost | Open-source collaborative wiki and documentation workspace platform. | 1.9 KB |
| [`docuseal.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/docuseal.yaml) | DocuSeal | Open-source document signing and digital contract platform (DocuSign alternative). | 0.6 KB |
| [`docuseal-with-postgres.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/docuseal-with-postgres.yaml) | DocuSeal + Postgres | DocuSeal document signing engine backed by a PostgreSQL database container. | 1.2 KB |
| [`dokuwiki.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/dokuwiki.yaml) | DokuWiki | Standards-compliant, simple-to-use wiki software that doesn't require a database. | 0.5 KB |
| [`drupal-with-postgresql.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/drupal-with-postgresql.yaml) | Drupal + Postgres | Enterprise-grade Drupal content management system paired with PostgreSQL. | 1.4 KB |
| [`getoutline.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/getoutline.yaml) | Outline Wiki | Fast, modern team knowledge base and wiki for growing engineering teams. | 4.1 KB |
| [`ghost.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/ghost.yaml) | Ghost CMS | Independent technology platform for professional publishing, blogs, and paid newsletters. | 1.6 KB |
| [`gramps-web.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/gramps-web.yaml) | Gramps Web | Collaborative web-based genealogy and family tree research platform. | 2.2 KB |
| [`joomla-with-mariadb.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/joomla-with-mariadb.yaml) | Joomla + MariaDB | Flexible open-source content management system paired with MariaDB. | 1.3 KB |
| [`joplin.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/joplin.yaml) | Joplin Server | Sync server for Joplin cross-platform note-taking and to-do app. | 1.2 KB |
| [`memos.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/memos.yaml) | Memos | Open-source, lightweight note-taking service with Twitter-like micro-memo feeds. | 0.4 KB |
| [`nextcloud.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/nextcloud.yaml) | Nextcloud | Self-hosted productivity platform for file storage, docs, calendar, and contacts. | 0.7 KB |
| [`nextcloud-with-postgres.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/nextcloud-with-postgres.yaml) | Nextcloud + Postgres | Full Nextcloud suite paired with PostgreSQL database and Redis caching for scale. | 1.7 KB |
| [`strapi.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/strapi.yaml) | Strapi | Leading open-source Headless CMS to build customizable Node.js APIs. | 2.5 KB |
| [`wikijs.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/wikijs.yaml) | Wiki.js | Modern, powerful open-source wiki software built on Node.js and PostgreSQL. | 1.0 KB |
| [`wordpress-with-mariadb.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/wordpress-with-mariadb.yaml) | WordPress + MariaDB | World's most popular web builder and CMS paired with MariaDB database. | 1.1 KB |

---

### 3. 🛠️ Developer Tools, CI/CD, Git & Cloud IDEs

| File Name | Application Name | Purpose & Why It Is Needed | Size |
| :--- | :--- | :--- | :--- |
| [`browserless.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/browserless.yaml) | Browserless | Headless Chrome browser automation cluster service for Puppeteer and Playwright scripts. | 0.5 KB |
| [`code-server.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/code-server.yaml) | VS Code Browser | Run VS Code on any remote server and access it directly through the browser. | 0.8 KB |
| [`coder.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/coder.yaml) | Coder | Provision remote development environments on your infrastructure with automatic setup. | 1.4 KB |
| [`docker-registry.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/docker-registry.yaml) | Docker Registry | Private Docker Registry v2 with Web UI for hosting custom container images. | 2.1 KB |
| [`dozzle.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/dozzle.yaml) | Dozzle | Real-time log viewer for Docker containers with instant search and filtering. | 0.5 KB |
| [`dozzle-with-auth.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/dozzle-with-auth.yaml) | Dozzle + Auth | Dozzle Docker log viewer configured with user authentication locking. | 0.9 KB |
| [`forgejo.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/forgejo.yaml) | Forgejo | Self-hosted lightweight Git software development service (Gitea community fork). | 0.9 KB |
| [`forgejo-with-postgresql.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/forgejo-with-postgresql.yaml) | Forgejo + Postgres | Forgejo Git server paired with dedicated PostgreSQL database backend. | 1.7 KB |
| [`forgejo-with-runner.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/forgejo-with-runner.yaml) | Forgejo + Runner | Forgejo Git server pre-configured with Forgejo Actions runner for CI/CD pipelines. | 3.9 KB |
| [`gitea.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/gitea.yaml) | Gitea | Painless self-hosted Git service written in Go. | 0.6 KB |
| [`gitea-runner.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/gitea-runner.yaml) | Gitea Actions Runner | Self-hosted runner for Gitea Actions workflow automation. | 0.8 KB |
| [`gitea-with-postgresql.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/gitea-with-postgresql.yaml) | Gitea + Postgres | Gitea Git repository server backed by PostgreSQL. | 1.4 KB |
| [`github-runner.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/github-runner.yaml) | GitHub Actions Runner | Ephemeral self-hosted runner daemon for GitHub Actions workflows. | 0.9 KB |
| [`gitlab.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/gitlab.yaml) | GitLab CE | All-in-one DevOps platform for Git repository hosting, code review, and CI/CD. | 2.3 KB |
| [`gotenberg.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/gotenberg.yaml) | Gotenberg | Docker-powered stateless API for converting HTML, Markdown, and Office files to PDF. | 0.9 KB |
| [`hoppscotch.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/hoppscotch.yaml) | Hoppscotch | Open-source API development ecosystem for testing REST, GraphQL, and WebSockets. | 2.5 KB |
| [`jenkins.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/jenkins.yaml) | Jenkins | Open-source automation server for building, testing, and deploying software. | 0.6 KB |
| [`jupyter-notebook-python.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/jupyter-notebook-python.yaml) | Jupyter Notebook | Web-based interactive computing environment for Data Science and Python development. | 0.6 KB |
| [`marimo.yml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/marimo.yml) | marimo | Reactive, reproducible Python notebook built for AI, data science, and web apps. | 0.8 KB |
| [`onedev.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/onedev.yaml) | OneDev | Git server with built-in issue tracking, Kanban boards, and CI/CD pipelines. | 1.6 KB |
| [`proxyscotch.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/proxyscotch.yaml) | ProxyScotch | CORS proxy service for Hoppscotch API testing. | 0.5 KB |
| [`sonarqube.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/sonarqube.yaml) | SonarQube | Automatic code inspection and static analysis platform to detect bugs & security flaws. | 1.5 KB |

---

### 4. 🗄️ Databases, Caching & Data Management

| File Name | Application Name | Purpose & Why It Is Needed | Size |
| :--- | :--- | :--- | :--- |
| [`convex.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/convex.yaml) | Convex Backend | Open-source reactive backend-as-a-service database engine. | 2.6 KB |
| [`databasus.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/databasus.yaml) | Databasus | Automated scheduled database backup tool supporting Postgres, MySQL, and Mongo. | 0.6 KB |
| [`denoKV.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/denoKV.yaml) | Deno KV | Distributed key-value database built on SQLite and FoundationDB. | 0.6 KB |
| [`drizzle-gateway.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/drizzle-gateway.yaml) | Drizzle Gateway | HTTP/WebSocket proxy gateway for Drizzle ORM database connections. | 0.4 KB |
| [`edgedb.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/edgedb.yaml) | EdgeDB | Next-generation graph-relational database built on PostgreSQL with strict schema. | 1.4 KB |
| [`electricsql.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/electricsql.yaml) | ElectricSQL | Local-first sync layer for Postgres providing real-time data sync to client apps. | 0.9 KB |
| [`meilisearch.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/meilisearch.yaml) | Meilisearch | Ultra-fast, typo-tolerant search engine designed for instant search-as-you-type. | 0.7 KB |
| [`neon-ws-proxy.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/neon-ws-proxy.yaml) | Neon WS Proxy | Serverless Postgres WebSocket connection proxy engine. | 1.2 KB |
| [`nocodb.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/nocodb.yaml) | NocoDB | Turn any MySQL, PostgreSQL, or SQLite database into a smart spreadsheet UI (Airtable rival). | 0.6 KB |
| [`pgadmin.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/pgadmin.yaml) | pgAdmin 4 | Comprehensive web-based administration and development platform for PostgreSQL. | 0.7 KB |
| [`pgbackweb.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/pgbackweb.yaml) | PgBackWeb | Web UI for managing automated PostgreSQL backups to S3 storage. | 1.1 KB |
| [`phpmyadmin.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/phpmyadmin.yaml) | phpMyAdmin | Classic web interface to manage MySQL and MariaDB databases over the web. | 0.6 KB |
| [`pocketbase.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/pocketbase.yaml) | PocketBase | Open-source backend in 1 file consisting of embedded SQLite, auth, and realtime subscriptions. | 0.4 KB |
| [`redis-insight.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/redis-insight.yaml) | RedisInsight | Official GUI tool by Redis for visualizing and optimizing key-value memory data. | 0.9 KB |
| [`typesense.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/typesense.yaml) | Typesense | Open-source, typo-tolerant search engine optimized for developer experience & speed. | 0.8 KB |

---

### 5. ⚡ Automation, Workflows & Task Management

| File Name | Application Name | Purpose & Why It Is Needed | Size |
| :--- | :--- | :--- | :--- |
| [`apprise-api.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/apprise-api.yaml) | Apprise API | Push notification gateway supporting 80+ notification services via HTTP POST calls. | 0.5 KB |
| [`budibase.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/budibase.yaml) | Budibase | Low-code platform for creating internal tools, forms, and admin panels in minutes. | 4.9 KB |
| [`calcom.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/calcom.yaml) | Cal.com | Open-source scheduling infrastructure (Calendly alternative) for booking meetings. | 3.2 KB |
| [`hatchet.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/hatchet.yaml) | Hatchet | Distributed task queue and background job engine built to replace Celery and BullMQ. | 4.3 KB |
| [`huly.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/huly.yaml) | Huly | All-in-one project management platform combining Linear, Jira, Slack, and Motion. | 3.9 KB |
| [`n8n.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/n8n.yaml) | n8n | Workflow automation tool connecting apps and APIs with native AI nodes. | 2.1 KB |
| [`n8n-with-postgresql.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/n8n-with-postgresql.yaml) | n8n + Postgres | n8n workflow engine configured with PostgreSQL database persistence. | 2.8 KB |
| [`n8n-with-postgres-and-worker.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/n8n-with-postgres-and-worker.yaml) | n8n Production Cluster | n8n workflow execution cluster with dedicated background worker daemon & Redis queue. | 5.0 KB |
| [`plane.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/plane.yaml) | Plane | Open-source project management tool to track issues, epics, and product roadmaps. | 6.8 KB |
| [`prefect.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/prefect.yaml) | Prefect | Data workflow orchestration engine for scheduling, monitoring, and debugging data pipelines. | 2.6 KB |
| [`rallly.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/rallly.yaml) | Rallly | Scheduling tool to find the best time for group meetings and poll availability. | 1.5 KB |
| [`twenty.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/twenty.yaml) | Twenty CRM | Modern open-source CRM platform providing full control over customer pipelines. | 5.4 KB |
| [`vikunja.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/vikunja.yaml) | Vikunja | To-do app to organize tasks with Kanban, Gantt, and list views. | 0.8 KB |
| [`vikunja-with-postgresql.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/vikunja-with-postgresql.yaml) | Vikunja + Postgres | Vikunja task manager backed by a dedicated PostgreSQL database. | 1.2 KB |
| [`windmill.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/windmill.yaml) | Windmill | Turn TypeScript, Python, and Bash scripts into webhooks, workflows, and admin UIs. | 3.7 KB |

---

### 6. 📈 Analytics, Monitoring & Observability

| File Name | Application Name | Purpose & Why It Is Needed | Size |
| :--- | :--- | :--- | :--- |
| [`beszel.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/beszel.yaml) | Beszel | Lightweight server monitoring dashboard with CPU, RAM, disk, and container charts. | 2.0 KB |
| [`changedetection.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/changedetection.yaml) | ChangeDetection.io | Monitor web pages for changes and send notifications when text or prices update. | 1.6 KB |
| [`diun.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/diun.yaml) | DIUN | Monitor Docker image registries and receive alerts when container tags update. | 1.0 KB |
| [`elasticsearch.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/elasticsearch.yaml) | Elasticsearch | Distributed search and analytics engine for log aggregation and full-text search. | 0.9 KB |
| [`elasticsearch-with-kibana.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/elasticsearch-with-kibana.yaml) | Elastic Stack (ELK) | Elasticsearch log search cluster paired with Kibana data visualization studio. | 4.6 KB |
| [`glances.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/glances.yaml) | Glances | Real-time system monitoring tool via web interface and API. | 0.9 KB |
| [`glitchtip.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/glitchtip.yaml) | GlitchTip | Open-source Sentry-compatible error tracking and exception logging server. | 3.1 KB |
| [`goatcounter.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/goatcounter.yaml) | GoatCounter | Privacy-focused web analytics tool offering lightweight statistics without cookies. | 0.5 KB |
| [`grafana.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/grafana.yaml) | Grafana | Leading operational dashboard engine for Prometheus, Loki, Postgres, and InfluxDB metrics. | 0.6 KB |
| [`grafana-with-postgresql.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/grafana-with-postgresql.yaml) | Grafana + Postgres | Grafana dashboards with persistent user & dashboard state stored in PostgreSQL. | 1.3 KB |
| [`healthchecks.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/healthchecks.yaml) | Healthchecks.io | Listen for periodic HTTP pings from cron jobs and alert when jobs fail or miss schedule. | 1.2 KB |
| [`openobserve.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/openobserve.yaml) | OpenObserve | High-performance cloud-native observability platform for logs, metrics, and traces. | 0.9 KB |
| [`plausible.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/plausible.yaml) | Plausible Analytics | Lightweight, open-source Google Analytics alternative providing privacy-friendly metrics. | 3.4 KB |
| [`posthog.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/posthog.yaml) | PostHog | All-in-one product analytics, session recording, feature flags, and A/B testing suite. | 102.9 KB |
| [`signoz.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/signoz.yaml) | SigNoz | Open-source Application Performance Monitoring (APM) and OpenTelemetry collector. | 26.7 KB |
| [`swetrix.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/swetrix.yaml) | Swetrix | Ultimate privacy-first web analytics suite with customizable dashboards. | 5.3 KB |
| [`umami.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/umami.yaml) | Umami Analytics | Fast, non-intrusive web analytics solution designed as an alternative to Google Analytics. | 1.1 KB |
| [`uptime-kuma.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/uptime-kuma.yaml) | Uptime Kuma | Fancy self-hosted uptime monitoring tool supporting HTTP, ping, DNS, and push notifications. | 0.6 KB |
| [`uptime-kuma-with-mariadb.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/uptime-kuma-with-mariadb.yaml) | Uptime Kuma + MariaDB | Uptime Kuma monitoring engine backed by a MariaDB database server. | 1.1 KB |

---

### 7. 💬 Communication, Chat, Mail & Customer Support

| File Name | Application Name | Purpose & Why It Is Needed | Size |
| :--- | :--- | :--- | :--- |
| [`chaskiq.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/chaskiq.yaml) | Chaskiq | Conversational marketing and customer support platform (Intercom alternative). | 5.5 KB |
| [`chatwoot.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/chatwoot.yaml) | Chatwoot | Open-source customer engagement suite with live chat widget and omnichannel inbox. | 4.5 KB |
| [`freescout.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/freescout.yaml) | FreeScout | Help desk and shared inbox solution (Help Scout / Zendesk alternative). | 1.5 KB |
| [`gotify.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/gotify.yaml) | Gotify | Simple server for sending and receiving push notifications via WebSocket. | 1.0 KB |
| [`listmonk.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/listmonk.yaml) | Listmonk | High-performance newsletter and mailing list manager with analytics. | 1.6 KB |
| [`matrix-synapse-with-postgresql.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/matrix-synapse-with-postgresql.yaml) | Matrix Synapse | Reference homeserver implementation for the decentralized Matrix communications protocol. | 4.5 KB |
| [`mattermost.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/mattermost.yaml) | Mattermost | Secure, self-hosted messaging platform for developer workflow collaboration (Slack rival). | 1.5 KB |
| [`ntfy.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/ntfy.yaml) | ntfy | HTTP-based pub-sub notification service to send alerts to your phone or desktop. | 2.4 KB |
| [`rocketchat.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/rocketchat.yaml) | Rocket.Chat | Enterprise communication platform for team chat, customer service, and omni-channel support. | 2.1 KB |
| [`usesend.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/usesend.yaml) | UseSend | Open-source transactional and marketing email broadcasting platform. | 2.0 KB |

---

### 8. 💼 E-Commerce, ERP, CRM & Financial Management

| File Name | Application Name | Purpose & Why It Is Needed | Size |
| :--- | :--- | :--- | :--- |
| [`actualbudget.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/actualbudget.yaml) | Actual Budget | Super fast, privacy-focused local-first personal finance application. | 0.5 KB |
| [`dolibarr.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/dolibarr.yaml) | Dolibarr ERP/CRM | Open-source ERP and CRM software package for small to mid-sized businesses. | 1.6 KB |
| [`espocrm.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/espocrm.yaml) | EspoCRM | Open-source CRM application to manage leads, contacts, accounts, and deals. | 2.3 KB |
| [`firefly.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/firefly.yaml) | Firefly III | Self-hosted personal finance manager helping you track expenses, income, and budgets. | 2.2 KB |
| [`grocy.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/grocy.yaml) | Grocy | ERP for your fridge and home groceries, tracking expiration dates and shopping lists. | 0.5 KB |
| [`invoice-ninja.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/invoice-ninja.yaml) | Invoice Ninja | Invoicing, payments, expense tracking, and time logs for freelancers and small businesses. | 6.3 KB |
| [`kimai.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/kimai.yaml) | Kimai | Open-source time-tracking environment for managing projects, invoices, and customer billing. | 1.4 KB |
| [`maybe.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/maybe.yaml) | Maybe | OS for personal finance and wealth management. | 2.9 KB |
| [`odoo.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/odoo.yaml) | Odoo ERP | Suite of open-source business apps covering CRM, eCommerce, accounting, and inventory. | 1.1 KB |
| [`orangehrm.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/orangehrm.yaml) | OrangeHRM | Open-source Human Resource Management software for employee records and performance. | 1.3 KB |
| [`paymenter.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/paymenter.yaml) | Paymenter | Open-source hosting payment gateway and client management dashboard. | 1.9 KB |

---

### 9. 🎬 Media Streaming, Backup & Entertainment

| File Name | Application Name | Purpose & Why It Is Needed | Size |
| :--- | :--- | :--- | :--- |
| [`audiobookshelf.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/audiobookshelf.yaml) | Audiobookshelf | Self-hosted audiobook and podcast server with position sync across mobile devices. | 0.7 KB |
| [`castopod.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/castopod.yaml) | Castopod | Open-source podcast hosting platform built for independent podcasters. | 1.8 KB |
| [`emby.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/emby.yaml) | Emby Server | Media server for streaming personal movies, TV shows, and music to any device. | 0.6 KB |
| [`immich.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/immich.yaml) | Immich | Self-hosted photo and video backup solution with facial recognition (Google Photos alternative). | 2.7 KB |
| [`jellyfin.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/jellyfin.yaml) | Jellyfin | Free software media system for controlling and streaming your media files. | 0.7 KB |
| [`navidrome.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/navidrome.yaml) | Navidrome | Lightweight, fast open-source music server and streamer compatible with Subsonic clients. | 0.9 KB |
| [`overseerr.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/overseerr.yaml) | Overseerr | Request management and media discovery tool for Plex and Jellyfin ecosystems. | 0.7 KB |
| [`plex.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/plex.yaml) | Plex | Organize media collections and stream movies, TV, and photos anywhere. | 0.8 KB |
| [`prowlarr.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/prowlarr.yaml) | Prowlarr | Indexer manager for Torrent and Usenet trackers integration with Arr apps. | 0.7 KB |
| [`radarr.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/radarr.yaml) | Radarr | Movie collection manager for Usenet and BitTorrent downloads. | 0.7 KB |
| [`sonarr.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/sonarr.yaml) | Sonarr | Smart TV series downloader and episode tracker. | 0.9 KB |

---

### 10. 📁 File Management, Cloud Storage & Backups

| File Name | Application Name | Purpose & Why It Is Needed | Size |
| :--- | :--- | :--- | :--- |
| [`duplicati.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/duplicati.yaml) | Duplicati | Free backup client to store encrypted backups on cloud storage providers. | 0.7 KB |
| [`filebrowser.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/filebrowser.yaml) | FileBrowser | Web-based file manager to upload, download, and manage files on a server. | 0.8 KB |
| [`minio.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/minio.yaml) | MinIO | High-performance, S3-compatible object storage server for cloud-native apps. | 0.7 KB |
| [`minio-community-edition.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/minio-community-edition.yaml) | MinIO Community | MinIO Object Storage with Console Web UI and bucket management. | 0.8 KB |
| [`owncloud.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/owncloud.yaml) | ownCloud | Open-source file sync and sharing solution for personal cloud storage. | 2.1 KB |
| [`paperless.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/paperless.yaml) | Paperless-ngx | Document management system to index and OCR physical paper documents. | 1.4 KB |
| [`seafile.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/seafile.yaml) | Seafile | High-performance file sync and share solution with client-side encryption. | 2.3 KB |
| [`vaultwarden.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/vaultwarden.yaml) | Vaultwarden | Lightweight Bitwarden server written in Rust for managing passwords securely. | 0.9 KB |

---

### 11. 🔒 Security, Auth & Utilities

| File Name | Application Name | Purpose & Why It Is Needed | Size |
| :--- | :--- | :--- | :--- |
| [`authentik.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/authentik.yaml) | Authentik | Open-source Identity Provider (IdP) for single sign-on (SSO), OAuth2, and SAML. | 3.6 KB |
| [`bento-pdf.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/bento-pdf.yaml) | Bento-PDF | Privacy-first web application for editing, merging, and splitting PDF documents. | 0.5 KB |
| [`cyberchef.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/cyberchef.yaml) | CyberChef | Cyber Swiss Army Knife web app for encoding, decoding, encryption, and parsing. | 0.6 KB |
| [`excalidraw.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/excalidraw.yaml) | Excalidraw | Virtual whiteboard for sketching hand-drawn diagrams and system architecture. | 0.5 KB |
| [`it-tools.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/it-tools.yaml) | IT-Tools | Collection of handy online tools for developers and IT professionals (JWT decoder, hash generator, etc.). | 0.5 KB |
| [`keycloak.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/keycloak.yaml) | Keycloak | Open-source identity and access management solution for modern applications. | 1.2 KB |
| [`keycloak-with-postgres.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/keycloak-with-postgres.yaml) | Keycloak + Postgres | Keycloak Identity Manager backed by a dedicated PostgreSQL database. | 1.9 KB |
| [`passbolt.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/passbolt.yaml) | Passbolt | Open-source team password manager designed for collaboration and security. | 1.5 KB |
| [`stirling-pdf.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/stirling-pdf.yaml) | Stirling-PDF | Powerful local web-based PDF tool allowing all PDF operations (merge, split, OCR, convert). | 0.7 KB |

---

### 12. 🎮 Dedicated Gaming Servers & Tools

| File Name | Application Name | Purpose & Why It Is Needed | Size |
| :--- | :--- | :--- | :--- |
| [`foundryvtt.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/foundryvtt.yaml) | Foundry VTT | Self-hosted Virtual Tabletop software for playing tabletop roleplaying games with friends. | 3.6 KB |
| [`minecraft.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/minecraft.yaml) | Minecraft Server | Dedicated Minecraft multiplayer server container with RCON management. | 2.1 KB |
| [`palworld.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/palworld.yaml) | Palworld Server | High-performance dedicated server for Palworld multiplayer game hosting. | 7.8 KB |
| [`satisfactory.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/satisfactory.yaml) | Satisfactory Server | Dedicated server instance for Satisfactory co-op factory building games. | 1.2 KB |
| [`terraria-server.yaml`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/templates_removed_phase15/terraria-server.yaml) | Terraria Server | Dedicated server for Terraria 2D sandbox multiplayer gaming. | 0.8 KB |

---

## 🛠️ Verification & Catalog Integration

All 361 templates in `templates_removed_phase15/` follow the standard ShanuTechX Compose Schema header format:
```yaml
# env: VAR_NAME=default_value
# description: Short app summary
# slogan: Catchy app tagline
# tags: Category, Tag1, Tag2
# port: 8080
```
When moved to `templates/`, the platform parser in [`packages/catalog/src/parser.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/packages/catalog/src/parser.ts) automatically extracts metadata, ports, and environment variables without requiring any manual database setup.
