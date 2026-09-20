# ShanuTechX Deployment Architecture & Network Exposure Guide

> [!NOTE]
> This document visualizes the complete end-to-end deployment lifecycle, network routing topology, database auto-wiring, secret vault encryption, and compute node orchestration in ShanuTechX.

---

## 1. High-Level Architecture Overview

```mermaid
flowchart TD
    subgraph Client ["Client Layer"]
        UserDashboard["Next.js 14 Dashboard"]
        ClientBrowser["Web Browser / Client App"]
    end

    subgraph ControlPlane ["ShanuTechX API (Port 4000)"]
        CatalogRoute["/api/catalog/deploy"]
        DeployRoute["/api/deployments"]
        ZipRoute["/api/deployments/upload-zip"]
        AbuseScanner["Automated Abuse Scanner"]
        SecretsVault["Secrets Vault (AES-256-GCM)"]
        NodeSelector["Node Selector & DNS Engine"]
    end

    subgraph DNSLayer ["Edge & DNS Routing"]
        CloudflareDNS["Cloudflare DNS & Proxy Engine"]
    end

    subgraph NodeLayer ["Compute VPS Node Node-Agent (Port 8001)"]
        NodeAgent["Node Agent Daemon"]
        Railpack["Railpack Build Pipeline"]
        DockerCompose["Docker Compose Engine"]
        
        subgraph Containers ["Deployed Container Stack"]
            WebApp["Web Application (Port 80/3000/8080)"]
            ManagedDB["Managed DB (PostgreSQL / MariaDB / Redis)"]
            DirectPortApp["Direct Port Service (Lavalink / LiveKit UDP)"]
        end
    end

    UserDashboard -->|1. Submit Deployment Request| CatalogRoute
    UserDashboard -->|1. Submit Custom Git/ZIP| DeployRoute
    DeployRoute --> ZipRoute
    CatalogRoute --> AbuseScanner
    AbuseScanner -->|Passed| SecretsVault
    SecretsVault --> NodeSelector
    NodeSelector -->|2. Register A-Record| CloudflareDNS
    NodeSelector -->|3. Trigger Build/Compose| NodeAgent
    NodeAgent --> Railpack
    NodeAgent --> DockerCompose
    DockerCompose --> Containers
    ClientBrowser -->|4a. HTTPS Subdomain| CloudflareDNS
    CloudflareDNS -->|SSL Proxy| WebApp
    ClientBrowser -->|4b. Direct Raw TCP/UDP| DirectPortApp
```

---

## 2. Network Exposure Modes & Traffic Routing

ShanuTechX enforces **system-recommended exposure modes** based on the workload type:

```mermaid
graph LR
    subgraph Inbound ["Inbound Client Traffic"]
        BrowserHTTP["HTTPS Client Traffic"]
        DBClient["Database GUI Client (TablePlus, Compass)"]
        InternalBot["Internal Service (Discord Bot)"]
    end

    subgraph Routing ["Exposure Mode"]
        ModeProxy["ssl_with_proxy (HTTPS Subdomain)"]
        ModeRawTCP["raw_tcp (Direct Host Port)"]
        ModeVPC["internal_only (Isolated VPC)"]
    end

    subgraph Target ["Target Service"]
        WebApps["WordPress, n8n, Next.js, Uptime Kuma"]
        Databases["Redis (6379), MongoDB (27017), Lavalink (2333)"]
        InternalServices["Background Workers, Discord/WhatsApp Bots"]
    end

    BrowserHTTP --> ModeProxy --> WebApps
    DBClient --> ModeRawTCP --> Databases
    InternalBot --> ModeVPC --> InternalServices
```

### Exposure Mode Topology Matrix

| Exposure Mode | Public Domain URL | SSL Certificate | Exposed Ports | Target Workloads |
| :--- | :--- | :--- | :--- | :--- |
| **`ssl_with_proxy`** *(Default)* | `https://<subdomain>.app.shanutechx.com` | Automated Cloudflare SSL | **None (Proxied)** | Web Apps, Storefronts, CMS (WordPress, n8n, Next.js, FastAPI, Grafana) |
| **`raw_tcp`** | `None` *(Direct Node IP)* | Client Handled / Direct TLS | **Host Port (`IP:port`)** | Databases & Media Servers (Redis, MongoDB, Lavalink, LiveKit UDP) |
| **`internal_only`** | `None` *(VPC Internal DNS)* | None | **Internal Docker Network** | Background Daemons, Discord Bots, WhatsApp Gateways, Internal APIs |

---

## 3. Database Auto-Wiring & Password Generation

When deploying 1-click catalog templates (WordPress, n8n, Redis, MongoDB, LiveKit, etc.), ShanuTechX automatically handles database setup:

```mermaid
sequenceDiagram
    autonumber
    participant U as User / Dashboard
    participant API as ShanuTechX API
    participant V as Secrets Vault
    participant DB as Postgres Meta DB
    participant Node as Node Agent

    U->>API: POST /api/catalog/deploy (slug: "wordpress")
    API->>API: Scan template for $SERVICE_PASSWORD_* & required secrets
    API->>V: Generate 24-char cryptographically strong secrets
    V-->>API: Encrpyted Credential References (AES-256-GCM)
    API->>DB: Provision ManagedDatabase record (mysql:3306)
    API->>Node: POST /agent/compose/up with populated envVars
    Node->>Node: Spin up WordPress + MariaDB containers
    API-->>U: Return Deployment + Copyable Master Passwords Banner
```

### Automated Master Passwords Generated per Template

> [!TIP]
> Customers can customize passwords during setup or rely on auto-generated cryptographically secure passwords. All generated secrets are presented in a copyable banner immediately upon creation.

* **WordPress:** `MYSQL_ROOT_PASSWORD`, `WORDPRESS_DB_PASSWORD`
* **n8n:** `DB_POSTGRESDB_PASSWORD`
* **Redis:** `REDIS_PASSWORD`
* **MongoDB:** `MONGO_INITDB_ROOT_PASSWORD`
* **Supabase Lite:** `POSTGRES_PASSWORD`
* **LiveKit:** `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
* **Lavalink:** `LAVALINK_PASSWORD`
* **Hermes Agent:** `HERMES_SECRET_KEY`

---

## 4. Custom Code & ZIP Archive Deployment Lifecycle

```mermaid
stateDiagram-v2
    [*] --> SourceSelection: User selects Git Repo or ZIP Upload
    SourceSelection --> UploadArchive: Upload .zip/.tar.gz (up to 100MB)
    SourceSelection --> GitClone: Fetch Git Branch & PAT Token
    
    UploadArchive --> ExtractWorkspace: Extract archive files into Node Workspace
    GitClone --> ExtractWorkspace

    ExtractWorkspace --> RailpackBuild: Trigger Railpack Framework Auto-Detection
    
    state RailpackBuild {
        NodeJS: Node.js / Next.js (Port 3000)
        Python: Python / FastAPI (Port 8000)
        Static: Static Web Hosting (Port 8080)
        Docker: Custom Dockerfile
    }

    RailpackBuild --> ContainerLaunch: Spin up Docker Container
    ContainerLaunch --> CloudflareDNS: Register HTTPS Subdomain Record
    CloudflareDNS --> LiveRunning: Status set to RUNNING (Live at URL)
    LiveRunning --> [*]
```

---

## 5. Security Guardrails & Operational Controls

> [!IMPORTANT]
> **Enforced Platform Security Rules:**
> 1. **DEV Superuser Gating:** Non-dev users (`customer`, `support`, `admin`) are strictly locked to system-recommended exposure modes (`ssl_with_proxy` for Web Apps; `raw_tcp` for Databases). Only users with `role: 'dev'` can override exposure modes.
> 2. **Abuse Protection:** All deployment inputs (start commands, repo URLs, environment variables) pass through the automated `scanTextForAbuse` filter before execution.
> 3. **Encrypted Vault Storage:** All sensitive environment variables and database passwords are encrypted at rest using AES-256-GCM ([`secretsVault.ts`](file:///c:/Users/tiros/OneDrive/Desktop/shanutechx/apps/api/src/lib/secretsVault.ts)).
