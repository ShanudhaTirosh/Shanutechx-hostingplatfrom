# 🚀 ShanuTechX — Project Architecture Graph

> **Generated:** 2026-07-29  
> **Purpose:** Visual representation of the ShanuTechX cloud platform architecture

---

## 📊 High-Level Architecture Flow

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[🌐 Browser/Mobile]
        SDK[📦 @shanutechx SDK]
    end

    subgraph "Frontend Applications"
        Dashboard[🎨 Dashboard<br/>Next.js 15<br/>Port: 3001]
        Web[🏠 Landing Website<br/>Next.js<br/>Marketing]
        Mobile[📱 Mobile Apps<br/>Android SMS Forwarder]
    end

    subgraph "API Layer"
        API[⚡ Express API<br/>Port: 3001<br/>27 Routes]
        Worker[👷 BullMQ Worker<br/>Background Jobs]
    end

    subgraph "Data Layer"
        DB[(🗄️ PostgreSQL<br/>Prisma ORM)]
        Redis[(📮 Redis<br/>BullMQ Queue)]
        Vault[🔐 Secrets Vault<br/>AES-256-GCM]
    end

    subgraph "Infrastructure Services"
        NodeAgent[🖥️ Node Agent<br/>Express on each VPS<br/>Port: 5000]
        Leaseweb[☁️ Leaseweb API<br/>VPS Management]
        Docker[🐳 Docker Engine<br/>Container Orchestration]
    end

    subgraph "Communication Services"
        WhatsApp[💬 WhatsApp Bot<br/>Customer Support]
        Discord[🤖 Discord Bot<br/>Team Alerts]
        SMTP[📧 SMTP Server<br/>Transactional Email]
        SMS[📱 SMS Gateway<br/>OTP & Alerts]
    end

    subgraph "External Services"
        Stripe[💳 Stripe<br/>Payments]
        Firebase[🔥 Firebase<br/>Push Notifications]
        LiveKit[📹 LiveKit<br/>Video/Audio]
    end

    Browser --> Dashboard
    Browser --> Web
    SDK --> API
    Dashboard --> API
    Mobile --> API
    
    API --> DB
    API --> Redis
    API --> Vault
    API --> Leaseweb
    API --> NodeAgent
    API --> Stripe
    API --> Firebase
    API --> LiveKit
    
    Worker --> Redis
    Worker --> DB
    
    NodeAgent --> Docker
    NodeAgent --> DB
    
    API --> WhatsApp
    API --> Discord
    API --> SMTP
    API --> SMS

    style Dashboard fill:#61dafb,stroke:#333,stroke-width:2px
    style API fill:#68a063,stroke:#333,stroke-width:3px
    style DB fill:#336791,stroke:#333,stroke-width:2px
    style NodeAgent fill:#ff6b6b,stroke:#333,stroke-width:2px
    style Stripe fill:#635bff,stroke:#333,stroke-width:2px
```

---

## 🏗️ Monorepo Structure

```mermaid
graph LR
    Root[📁 shanutechx/]
    
    Root --> Apps[📂 apps/]
    Root --> Packages[📦 packages/]
    Root --> Services[⚙️ services/]
    Root --> Templates[📋 templates/]
    Root --> Config[🔧 config/]
    Root --> Docs[📚 docs/]
    Root --> Android[🤖 android/]
    Root --> Infra[🐳 infra/]
    
    Apps --> API[api/<br/>Express REST API]
    Apps --> Dash[dashboard/<br/>Next.js Admin UI]
    Apps --> WebSite[web/<br/>Landing Site]
    
    Packages --> DBPkg[db/<br/>Prisma Schema]
    Packages --> AuthJS[auth-js/<br/>Auth Client]
    Packages --> SupaJS[supabase-js/<br/>Main SDK]
    Packages --> PostgREST[postgrest-js/<br/>Query Builder]
    Packages --> Realtime[realtime-js/<br/>WebSocket]
    Packages --> Storage[storage-js/<br/>Object Storage]
    Packages --> Functions[functions-js/<br/>Edge Functions]
    Packages --> Tracing[tracing/<br/>OpenTelemetry]
    
    Services --> Agent[node-agent/<br/>VPS Agent]
    Services --> DiscordBot[discord-bot/<br/>Notifications]
    Services --> WhatsAppBot[whatsapp-bot/<br/>Support]
    
    style Root fill:#ffd700,stroke:#333,stroke-width:3px
    style API fill:#68a063,stroke:#333,stroke-width:2px
    style Dash fill:#61dafb,stroke:#333,stroke-width:2px
    style DBPkg fill:#336791,stroke:#333,stroke-width:2px
    style Agent fill:#ff6b6b,stroke:#333,stroke-width:2px
```

---

## 🔌 API Routes Architecture

```mermaid
graph TB
    subgraph "API Entry Point"
        Entry[🚪 /api<br/>Express Server<br/>Port: 3001]
    end

    subgraph "Middleware Layer"
        Auth[🔐 JWT Auth<br/>verifyToken]
        RateLimit[⏱️ Rate Limiting<br/>express-rate-limit]
        Validation[✅ Zod Validation<br/>Request/Response]
        CORS[🌍 CORS<br/>Cross-Origin]
        Helmet[🛡️ Helmet<br/>Security Headers]
        Roles[👥 Role Guards<br/>requireAdmin/requireDev]
    end

    subgraph "Route Modules - 27 Routes"
        Health[/health<br/>Health Check]
        AuthRoute[/auth<br/>Login/Register]
        Me[/me<br/>Current User]
        
        Projects[/projects<br/>DB Provisioning]
        Deployments[/deployments<br/>Docker Deploy]
        Catalog[/catalog<br/>360+ Templates]
        Domains[/domains<br/>DNS Management]
        
        VPS[/vps<br/>VPS Management]
        Leaseweb[/leaseweb<br/>Leaseweb API]
        Nodes[/nodes<br/>Node Registry]
        Containers[/containers<br/>Docker Ops]
        FS[/filesystem<br/>File Browser]
        
        Billing[/billing<br/>Subscriptions]
        Payments[/payments<br/>Stripe]
        Invoices[/invoices<br/>PDF Generation]
        Orders[/orders<br/>Order Lifecycle]
        Products[/products<br/>Pricing]
        VPSPlans[/vps-plans<br/>VPS Products]
        
        Admin[/admin<br/>User Management]
        Analytics[/analytics<br/>Platform Stats]
        Tickets[/tickets<br/>Support]
        
        SMTP[/smtp<br/>Email Config]
        SMS[/sms<br/>SMS Gateway]
        LiveKitRoute[/livekit<br/>Video Rooms]
        Webhooks[/webhooks<br/>Event Hooks]
        
        AISub[/aiSubscription<br/>AI Features]
        ManagedDB[/managedDatabases<br/>DB as Service]
        APIKeys[/apiKeys<br/>API Key Gen]
        CMS[/cms<br/>Content Mgmt]
        Templates[/templates<br/>Template Editor]
    end

    Entry --> Auth
    Auth --> RateLimit
    RateLimit --> CORS
    CORS --> Helmet
    Helmet --> Validation
    Validation --> Roles

    Roles --> Health
    Roles --> AuthRoute
    Roles --> Me
    Roles --> Projects
    Roles --> Deployments
    Roles --> Catalog
    Roles --> Domains
    Roles --> VPS
    Roles --> Leaseweb
    Roles --> Nodes
    Roles --> Containers
    Roles --> FS
    Roles --> Billing
    Roles --> Payments
    Roles --> Invoices
    Roles --> Orders
    Roles --> Products
    Roles --> VPSPlans
    Roles --> Admin
    Roles --> Analytics
    Roles --> Tickets
    Roles --> SMTP
    Roles --> SMS
    Roles --> LiveKitRoute
    Roles --> Webhooks
    Roles --> AISub
    Roles --> ManagedDB
    Roles --> APIKeys
    Roles --> CMS
    Roles --> Templates

    style Entry fill:#68a063,stroke:#333,stroke-width:3px
    style Auth fill:#ff6b6b,stroke:#333,stroke-width:2px
    style Roles fill:#ffa500,stroke:#333,stroke-width:2px
```

---

## 🎨 Dashboard Application Structure

```mermaid
graph TB
    subgraph "Dashboard App - Next.js 15"
        DashRoot[📱 app/]
    end

    subgraph "Public Routes"
        Login[🔓 /login<br/>Authentication]
        Status[📊 /status<br/>Public Status Page]
        Home[🏠 /<br/>Landing/Redirect]
    end

    subgraph "Protected Routes - (protected)/"
        Protected[🔐 Protected Layout<br/>Auth Required]
    end

    subgraph "Customer Features"
        Dashboard[📊 /dashboard<br/>Overview]
        Profile[👤 /profile<br/>User Settings]
        Cart[🛒 /cart<br/>Shopping Cart]
        OrdersUI[📦 /orders<br/>Order History]
        BillingUI[💳 /billing<br/>Invoices & Payment]
        TicketsUI[🎫 /tickets<br/>Support Tickets]
    end

    subgraph "Infrastructure Management"
        VPSUI[🖥️ /vps<br/>VPS Control Panel]
        VPSPlansUI[📋 /vps-plans<br/>VPS Products]
        ProjectsUI[🗄️ /projects<br/>Database Studio]
        DeploymentsUI[🚀 /deployments<br/>Deploy Manager]
        ServicesUI[⚙️ /services<br/>Service Config]
        CatalogUI[📚 /catalog<br/>Template Browser]
        DomainsUI[🌐 /domains<br/>DNS Manager]
    end

    subgraph "Communication Features"
        SMTPUI[📧 /smtp<br/>Email Settings]
        LiveKitUI[📹 /livekit<br/>Video Rooms]
    end

    subgraph "Admin-Only Features"
        AdminPanel[👑 /admin<br/>Admin Dashboard]
        AdminUsers[👥 /admin/users<br/>User Management]
        AdminOrders[📦 /admin/orders<br/>All Orders]
        AdminAnalytics[📈 /admin/analytics<br/>Platform Stats]
        AdminSettings[⚙️ /admin/settings<br/>System Config]
    end

    subgraph "Developer-Only Features"
        DevPanel[🛠️ /dev<br/>Dev Dashboard]
        DevLogs[📋 /dev/logs<br/>System Logs]
        DevImpersonate[🎭 /dev/impersonate<br/>User Impersonation]
        DeveloperAPI[🔧 /developer<br/>API Keys & Docs]
    end

    DashRoot --> Login
    DashRoot --> Status
    DashRoot --> Home
    DashRoot --> Protected

    Protected --> Dashboard
    Protected --> Profile
    Protected --> Cart
    Protected --> OrdersUI
    Protected --> BillingUI
    Protected --> TicketsUI
    Protected --> VPSUI
    Protected --> VPSPlansUI
    Protected --> ProjectsUI
    Protected --> DeploymentsUI
    Protected --> ServicesUI
    Protected --> CatalogUI
    Protected --> DomainsUI
    Protected --> SMTPUI
    Protected --> LiveKitUI
    Protected --> AdminPanel
    Protected --> DevPanel

    AdminPanel --> AdminUsers
    AdminPanel --> AdminOrders
    AdminPanel --> AdminAnalytics
    AdminPanel --> AdminSettings

    DevPanel --> DevLogs
    DevPanel --> DevImpersonate
    DevPanel --> DeveloperAPI

    style DashRoot fill:#61dafb,stroke:#333,stroke-width:3px
    style Protected fill:#ffa500,stroke:#333,stroke-width:2px
    style AdminPanel fill:#ff6b6b,stroke:#333,stroke-width:2px
    style DevPanel fill:#9b59b6,stroke:#333,stroke-width:2px
```

---

## 📦 Package Dependencies Graph

```mermaid
graph TB
    subgraph "SDK Entry Point"
        SupabaseJS[📦 @shanutechx/supabase-js<br/>Main Client Library]
    end

    subgraph "Core Packages"
        AuthJS[🔐 @shanutechx/auth-js<br/>JWT, OAuth, MFA, Web3]
        PostgRESTJS[🗄️ @shanutechx/postgrest-js<br/>Type-safe Query Builder]
        RealtimeJS[⚡ @shanutechx/realtime-js<br/>WebSocket Subscriptions]
        StorageJS[📦 @shanutechx/storage-js<br/>Object Storage Client]
        FunctionsJS[⚙️ @shanutechx/functions-js<br/>Edge Function Invocation]
    end

    subgraph "Support Packages"
        TracingPkg[📊 @shanutechx/tracing<br/>OpenTelemetry Helpers]
        DBPkg[🗃️ @shanutechx/db<br/>Prisma Schema & Migrations]
    end

    SupabaseJS --> AuthJS
    SupabaseJS --> PostgRESTJS
    SupabaseJS --> RealtimeJS
    SupabaseJS --> StorageJS
    SupabaseJS --> FunctionsJS
    
    PostgRESTJS --> TracingPkg
    RealtimeJS --> TracingPkg
    
    API[⚡ API Server] --> DBPkg
    Dashboard[🎨 Dashboard] --> SupabaseJS
    NodeAgent[🖥️ Node Agent] --> DBPkg

    style SupabaseJS fill:#3ecf8e,stroke:#333,stroke-width:3px
    style AuthJS fill:#ff6b6b,stroke:#333,stroke-width:2px
    style PostgRESTJS fill:#336791,stroke:#333,stroke-width:2px
    style RealtimeJS fill:#ffa500,stroke:#333,stroke-width:2px
```

---

## 🔄 Deployment Flow

```mermaid
sequenceDiagram
    participant User as 👤 Customer
    participant Dashboard as 🎨 Dashboard
    participant API as ⚡ API Server
    participant DB as 🗄️ PostgreSQL
    participant Queue as 📮 Redis Queue
    participant Worker as 👷 BullMQ Worker
    participant Agent as 🖥️ Node Agent
    participant Docker as 🐳 Docker Engine

    User->>Dashboard: Select template from catalog
    Dashboard->>API: POST /catalog/:slug/deploy
    API->>DB: Create deployment record
    API->>Queue: Enqueue build job
    API-->>Dashboard: Return deployment ID
    Dashboard-->>User: Show "Building..." status

    Queue->>Worker: Pick up build job
    Worker->>Agent: POST /agent/deploy (Git URL + env vars)
    Agent->>Docker: docker build -t app:tag .
    Docker-->>Agent: Build logs stream
    Agent->>Docker: docker run -d app:tag
    Docker-->>Agent: Container ID
    Agent-->>Worker: Deployment success
    Worker->>DB: Update deployment status
    Worker->>API: Trigger webhook
    API->>Dashboard: WebSocket notification
    Dashboard-->>User: "Deployment live! 🚀"

    Note over Agent,Docker: Containers run with<br/>Traefik reverse proxy<br/>for automatic HTTPS
```

---

## 🔐 Authentication & Authorization Flow

```mermaid
graph TB
    subgraph "User Roles Hierarchy"
        Customer[👤 Customer<br/>Own resources only]
        Admin[👑 Admin<br/>All users + billing + VPS]
        Dev[🛠️ Developer<br/>Full access + impersonation]
    end

    Customer --> Admin
    Admin --> Dev

    subgraph "Auth Flow"
        Login[🔓 Login Request<br/>POST /auth/login]
        Verify[✅ Verify Credentials<br/>bcrypt compare]
        JWT[🎫 Generate JWT<br/>jsonwebtoken.sign]
        Store[💾 Store Session<br/>Firebase/DB]
        Return[📤 Return Token<br/>+ User Object]
    end

    Login --> Verify
    Verify --> JWT
    JWT --> Store
    Store --> Return

    subgraph "Middleware Guards"
        VerifyToken[🔍 verifyToken<br/>JWT validation]
        RequireAuth[🚪 requireAuth<br/>Must be logged in]
        RequireAdmin[👑 requireAdmin<br/>Admin or Dev only]
        RequireDev[🛠️ requireDev<br/>Dev only]
        RequireStaff[👥 requireStaff<br/>Admin/Dev only]
    end

    Return --> VerifyToken
    VerifyToken --> RequireAuth
    RequireAuth --> RequireAdmin
    RequireAdmin --> RequireDev
    RequireAdmin --> RequireStaff

    subgraph "Protected Resources"
        OwnProjects[🗄️ Own Projects<br/>Customer ✅]
        AllUsers[👥 All Users<br/>Admin ✅ Dev ✅]
        VPSManage[🖥️ VPS Control<br/>Admin ✅ Dev ✅]
        Impersonate[🎭 Impersonation<br/>Dev ✅ only]
        RawFS[📁 Raw Filesystem<br/>Dev ✅ only]
    end

    RequireAuth --> OwnProjects
    RequireAdmin --> AllUsers
    RequireAdmin --> VPSManage
    RequireDev --> Impersonate
    RequireDev --> RawFS

    style Customer fill:#3498db,stroke:#333,stroke-width:2px
    style Admin fill:#e74c3c,stroke:#333,stroke-width:2px
    style Dev fill:#9b59b6,stroke:#333,stroke-width:3px
    style JWT fill:#2ecc71,stroke:#333,stroke-width:2px
```

---

## 💳 Billing & Payment Flow

```mermaid
sequenceDiagram
    participant User as 👤 Customer
    participant Dashboard as 🎨 Dashboard
    participant API as ⚡ API Server
    participant DB as 🗄️ Database
    participant Stripe as 💳 Stripe
    participant PDFGen as 📄 PDF Generator
    participant Email as 📧 SMTP

    User->>Dashboard: Add VPS to cart
    Dashboard->>API: POST /orders
    API->>DB: Create order (pending)
    API-->>Dashboard: Order ID + amount (LKR)
    
    User->>Dashboard: Proceed to payment
    Dashboard->>API: POST /payments/intent
    API->>Stripe: Create payment intent
    Stripe-->>API: Client secret
    API-->>Dashboard: Client secret
    
    Dashboard->>Stripe: Confirm payment (Stripe.js)
    Stripe-->>Dashboard: Payment success
    Dashboard->>API: POST /webhooks/stripe
    
    API->>DB: Update order (active)
    API->>DB: Create invoice record
    API->>PDFGen: Generate invoice PDF
    PDFGen-->>API: PDF bytes
    API->>DB: Store PDF path
    
    API->>Email: Send invoice email
    Email-->>User: 📧 Invoice received
    
    API->>Leaseweb: Assign VPS to customer
    API->>DB: Link VPS to user
    
    API-->>Dashboard: Order complete ✅
    Dashboard-->>User: VPS ready! 🚀

    Note over API,Stripe: All amounts stored in<br/>smallest currency units<br/>(cents for USD/LKR)
    Note over API,PDFGen: Invoices include<br/>company details, items,<br/>taxes, and payment info
```

---

## 🗄️ Database Schema Overview

```mermaid
erDiagram
    User ||--o{ Project : owns
    User ||--o{ Order : places
    User ||--o{ Ticket : creates
    User ||--o{ ApiKey : generates
    User {
        string id PK
        string email
        string passwordHash
        enum role
        timestamp createdAt
    }

    Project ||--o{ Deployment : has
    Project ||--|| OrderItem : linked_to
    Project {
        string id PK
        string userId FK
        string name
        string dbName
        string dbUser
        string dbPasswordEncrypted
        string nodeId FK
        timestamp createdAt
    }

    Order ||--o{ OrderItem : contains
    Order ||--|| Invoice : generates
    Order {
        string id PK
        string userId FK
        enum status
        int totalAmount
        string currency
        timestamp createdAt
    }

    OrderItem ||--o{ VPSInstance : provisions
    OrderItem {
        string id PK
        string orderId FK
        string productId
        int quantity
        int price
    }

    VPSInstance ||--|| Node : registered_as
    VPSInstance {
        string id PK
        string leasewebId
        string userId FK
        string ipAddress
        enum status
        timestamp createdAt
    }

    Node ||--o{ Deployment : hosts
    Node ||--o{ Project : runs
    Node {
        string id PK
        string vpsId FK
        string hostname
        string agentUrl
        boolean isActive
        timestamp lastSeen
    }

    Deployment ||--o{ DeploymentLog : generates
    Deployment {
        string id PK
        string projectId FK
        string nodeId FK
        string gitUrl
        string dockerImage
        enum status
        timestamp deployedAt
    }

    Ticket ||--o{ TicketMessage : contains
    Ticket {
        string id PK
        string userId FK
        string subject
        enum status
        timestamp createdAt
    }

    Invoice ||--|| Payment : recorded_by
    Invoice {
        string id PK
        string orderId FK
        string pdfPath
        int amount
        string currency
        timestamp issuedAt
    }

    ApiKey {
        string id PK
        string userId FK
        string keyHash
        string scope
        timestamp expiresAt
    }

    Template {
        string slug PK
        string name
        string category
        json services
        json envSchema
    }

    Webhook {
        string id PK
        string userId FK
        string url
        string[] events
        boolean isActive
    }
```

---

## 🌐 Network & Infrastructure Topology

```mermaid
graph TB
    subgraph "Public Internet"
        Internet[🌍 Internet]
    end

    subgraph "Edge Layer - CDN & DNS"
        CloudFlare[☁️ CloudFlare<br/>DNS + DDoS Protection]
    end

    subgraph "Load Balancer / Reverse Proxy"
        Traefik[🔀 Traefik<br/>Automatic HTTPS<br/>Let's Encrypt]
    end

    subgraph "Application Tier"
        DashboardProd[🎨 Dashboard<br/>Next.js<br/>:3001]
        APIProd[⚡ API Server<br/>Express<br/>:3001]
        WebProd[🏠 Landing<br/>Next.js<br/>:3000]
    end

    subgraph "Data Tier"
        PostgreSQL[(🗄️ PostgreSQL<br/>:5432)]
        RedisProd[(📮 Redis<br/>:6379)]
    end

    subgraph "Worker Tier"
        WorkerProd[👷 BullMQ Worker<br/>Background Jobs]
    end

    subgraph "VPS Infrastructure - Leaseweb"
        VPS1[🖥️ VPS Node 1<br/>Agent :5000<br/>Docker Host]
        VPS2[🖥️ VPS Node 2<br/>Agent :5000<br/>Docker Host]
        VPS3[🖥️ VPS Node 3<br/>Agent :5000<br/>Docker Host]
    end

    subgraph "External Services"
        StripeProd[💳 Stripe API]
        LiveKitProd[📹 LiveKit Server]
        LeasewebAPI[☁️ Leaseweb API]
        FirebaseProd[🔥 Firebase]
        SMSGateway[📱 SMS Gateway]
    end

    subgraph "Communication Bots"
        WhatsAppProd[💬 WhatsApp Bot]
        DiscordProd[🤖 Discord Bot]
    end

    Internet --> CloudFlare
    CloudFlare --> Traefik
    
    Traefik --> DashboardProd
    Traefik --> APIProd
    Traefik --> WebProd
    
    DashboardProd --> APIProd
    APIProd --> PostgreSQL
    APIProd --> RedisProd
    
    WorkerProd --> RedisProd
    WorkerProd --> PostgreSQL
    
    APIProd --> VPS1
    APIProd --> VPS2
    APIProd --> VPS3
    
    APIProd --> StripeProd
    APIProd --> LiveKitProd
    APIProd --> LeasewebAPI
    APIProd --> FirebaseProd
    APIProd --> SMSGateway
    
    APIProd --> WhatsAppProd
    APIProd --> DiscordProd
    
    VPS1 --> PostgreSQL
    VPS2 --> PostgreSQL
    VPS3 --> PostgreSQL

    style Internet fill:#87ceeb,stroke:#333,stroke-width:2px
    style Traefik fill:#00aaff,stroke:#333,stroke-width:3px
    style APIProd fill:#68a063,stroke:#333,stroke-width:3px
    style PostgreSQL fill:#336791,stroke:#333,stroke-width:2px
    style VPS1 fill:#ff6b6b,stroke:#333,stroke-width:2px
    style VPS2 fill:#ff6b6b,stroke:#333,stroke-width:2px
    style VPS3 fill:#ff6b6b,stroke:#333,stroke-width:2px
```

---

## 📋 Template Catalog Categories

```mermaid
mindmap
  root((📚 360+ Templates))
    🤖 Automation
      n8n
      Activepieces
      Windmill
      Prefect
      Huginn
    📝 CMS
      WordPress
      Ghost
      Directus
      Strapi
      Payload
    🗄️ Database
      PostgreSQL
      MySQL
      Redis
      MongoDB
      CouchDB
    💻 Development
      Gitea
      Forgejo
      Code Server
      Jenkins
      GitLab
    📊 Analytics
      Plausible
      PostHog
      Umami
      Metabase
      Grafana
    🤖 AI/ML
      Dify
      Flowise
      LangFlow
      Ollama
      AnythingLLM
    🎬 Media
      Jellyfin
      Plex
      Immich
      Emby
      PhotoPrism
    📈 Monitoring
      Uptime Kuma
      Glances
      Dozzle
      Netdata
    🔐 Security
      Vaultwarden
      Authentik
      Keycloak
      Passbolt
    📦 Storage
      Nextcloud
      Seafile
      MinIO
      Filebrowser
    💬 Communication
      Mattermost
      Matrix
      Rocket.Chat
      Jitsi
    🎮 Gaming
      Minecraft
      Palworld
      Satisfactory
      Terraria
```

---

## 🔄 CI/CD Pipeline

```mermaid
graph LR
    subgraph "GitHub Workflows"
        CI[✅ CI<br/>ci.yml<br/>Lint + Test]
        Deploy[🚀 Deploy<br/>deploy.yml<br/>Production]
        Backup[💾 Backup<br/>backup.yml<br/>DB Snapshot]
        BillingCron[💳 Billing Cron<br/>billing-cron.yml<br/>Recurring Charges]
        UptimeCron[📊 Uptime Cron<br/>uptime-cron.yml<br/>Health Checks]
    end

    subgraph "Triggers"
        Push[📤 Push to main]
        PR[🔀 Pull Request]
        Schedule[⏰ Scheduled]
        Manual[👆 Manual Dispatch]
    end

    subgraph "Actions"
        Checkout[📥 Checkout code]
        Install[📦 Install deps]
        Lint[🔍 ESLint]
        Test[🧪 Vitest]
        Build[🏗️ Build]
        DockerBuild[🐳 Docker build]
        DockerPush[📤 Push to registry]
        SSHDeploy[🔌 SSH deploy]
    end

    Push --> CI
    PR --> CI
    Push --> Deploy
    Schedule --> Backup
    Schedule --> BillingCron
    Schedule --> UptimeCron
    Manual --> Deploy

    CI --> Checkout
    Checkout --> Install
    Install --> Lint
    Lint --> Test

    Deploy --> Build
    Build --> DockerBuild
    DockerBuild --> DockerPush
    DockerPush --> SSHDeploy

    style CI fill:#2ecc71,stroke:#333,stroke-width:2px
    style Deploy fill:#3498db,stroke:#333,stroke-width:2px
    style Test fill:#e74c3c,stroke:#333,stroke-width:2px
```

---

## 📱 Communication Architecture

```mermaid
graph TB
    subgraph "Notification Triggers"
        OrderComplete[📦 Order Complete]
        DeploySuccess[🚀 Deploy Success]
        DeployFail[❌ Deploy Failed]
        NodeDown[🔴 Node Down]
        TicketReply[💬 Ticket Reply]
        PaymentReceived[💳 Payment Received]
        InvoiceGenerated[🧾 Invoice Generated]
    end

    subgraph "Notification Router"
        Router[📡 Notification Router<br/>API Service]
    end

    subgraph "Communication Channels"
        Email[📧 SMTP<br/>Transactional Email]
        WhatsApp[💬 WhatsApp Bot<br/>Customer Support]
        Discord[🤖 Discord Bot<br/>Team Alerts]
        SMS[📱 SMS Gateway<br/>OTP & Alerts]
        Firebase[🔥 Firebase Push<br/>Mobile Notifications]
        Webhook[🔗 Webhooks<br/>Custom Integrations]
    end

    subgraph "Message Templates"
        OrderEmail[📧 Order Confirmation]
        InvoiceEmail[📧 Invoice PDF]
        DeployAlert[💬 Deploy Status]
        NodeAlert[🚨 Node Health]
        TicketUpdate[💬 Ticket Update]
    end

    OrderComplete --> Router
    DeploySuccess --> Router
    DeployFail --> Router
    NodeDown --> Router
    TicketReply --> Router
    PaymentReceived --> Router
    InvoiceGenerated --> Router

    Router --> Email
    Router --> WhatsApp
    Router --> Discord
    Router --> SMS
    Router --> Firebase
    Router --> Webhook

    Email --> OrderEmail
    Email --> InvoiceEmail
    WhatsApp --> DeployAlert
    Discord --> NodeAlert
    WhatsApp --> TicketUpdate

    style Router fill:#ffa500,stroke:#333,stroke-width:3px
    style Email fill:#ea4335,stroke:#333,stroke-width:2px
    style WhatsApp fill:#25d366,stroke:#333,stroke-width:2px
    style Discord fill:#5865f2,stroke:#333,stroke-width:2px
```

---

## 🔍 Key Technology Stack

```mermaid
graph TB
    subgraph "Frontend Stack"
        NextJS[⚛️ Next.js 15<br/>React 18<br/>App Router]
        TailwindCSS[🎨 Tailwind CSS<br/>Styling]
        Monaco[💻 Monaco Editor<br/>Code Editing]
        XTerm[🖥️ XTerm.js<br/>Terminal Emulator]
        Firebase[🔥 Firebase SDK<br/>Auth & Push]
    end

    subgraph "Backend Stack"
        Express[🚀 Express.js<br/>REST API]
        Prisma[🗃️ Prisma ORM<br/>Type-safe DB]
        BullMQ[📮 BullMQ<br/>Job Queue]
        JWT[🔐 JSON Web Tokens<br/>Auth]
        Zod[✅ Zod<br/>Validation]
    end

    subgraph "Infrastructure Stack"
        Docker[🐳 Docker<br/>Containerization]
        TraefikInfra[🔀 Traefik<br/>Reverse Proxy]
        PostgreSQLInfra[🗄️ PostgreSQL 15+<br/>Primary DB]
        RedisInfra[📮 Redis<br/>Cache & Queue]
        Leaseweb[☁️ Leaseweb<br/>VPS Provider]
    end

    subgraph "Integration Stack"
        StripeSDK[💳 Stripe SDK<br/>Payments]
        AWS_SDK[☁️ AWS SDK<br/>S3 Storage]
        SSH2[🔌 SSH2<br/>Remote Access]
        LiveKitSDK[📹 LiveKit SDK<br/>Video/Audio]
        WS[⚡ WebSocket<br/>Real-time]
    end

    subgraph "DevOps Stack"
        GitHub[🐙 GitHub Actions<br/>CI/CD]
        TSC[📘 TypeScript<br/>Type Safety]
        Vitest[🧪 Vitest<br/>Testing]
        ESLint[🔍 ESLint<br/>Linting]
        Pino[📋 Pino<br/>Logging]
    end

    NextJS --> Express
    Express --> Prisma
    Express --> BullMQ
    Prisma --> PostgreSQLInfra
    BullMQ --> RedisInfra
    Express --> Docker
    Docker --> TraefikInfra

    style NextJS fill:#000000,color:#fff,stroke:#333,stroke-width:2px
    style Express fill:#68a063,stroke:#333,stroke-width:2px
    style Docker fill:#2496ed,stroke:#333,stroke-width:2px
    style PostgreSQLInfra fill:#336791,stroke:#333,stroke-width:2px
    style StripeSDK fill:#635bff,stroke:#333,stroke-width:2px
```

---

## 🎯 Feature Matrix by Role

| Feature | Customer | Admin | Developer |
|---------|:--------:|:-----:|:---------:|
| **Authentication & Profile** | | | |
| Login / Register | ✅ | ✅ | ✅ |
| Update Profile | ✅ | ✅ | ✅ |
| Change Password | ✅ | ✅ | ✅ |
| **Projects & Databases** | | | |
| View Own Projects | ✅ | ✅ | ✅ |
| Create Projects | ✅ | ✅ | ✅ |
| View All Projects | ❌ | ✅ | ✅ |
| Execute SQL Queries | ✅ | ✅ | ✅ |
| Drop Database | ✅ | ✅ | ✅ |
| **Deployments** | | | |
| Deploy from Catalog | ✅ | ✅ | ✅ |
| Deploy from Git | ✅ | ✅ | ✅ |
| View Deployment Logs | ✅ | ✅ | ✅ |
| Stop/Restart Containers | ✅ | ✅ | ✅ |
| View All Deployments | ❌ | ✅ | ✅ |
| **VPS Management** | | | |
| View Assigned VPS | ✅ | ✅ | ✅ |
| Start/Stop VPS | ❌ | ✅ | ✅ |
| Reboot VPS | ❌ | ✅ | ✅ |
| VPS Console Access | ❌ | ✅ | ✅ |
| View All VPS | ❌ | ✅ | ✅ |
| Assign VPS to Users | ❌ | ✅ | ✅ |
| **Billing & Orders** | | | |
| Browse Catalog | ✅ | ✅ | ✅ |
| Place Orders | ✅ | ✅ | ✅ |
| View Own Orders | ✅ | ✅ | ✅ |
| View All Orders | ❌ | ✅ | ✅ |
| Process Payments | ✅ | ✅ | ✅ |
| Generate Invoices | ✅ | ✅ | ✅ |
| View Platform Revenue | ❌ | ✅ | ✅ |
| **Support & Communication** | | | |
| Create Tickets | ✅ | ✅ | ✅ |
| Reply to Tickets | ✅ | ✅ | ✅ |
| View All Tickets | ❌ | ✅ | ✅ |
| Close Tickets | ❌ | ✅ | ✅ |
| **Administration** | | | |
| View All Users | ❌ | ✅ | ✅ |
| Change User Roles | ❌ | ✅ | ✅ |
| Ban/Suspend Users | ❌ | ✅ | ✅ |
| View Analytics | ❌ | ✅ | ✅ |
| Manage Nodes | ❌ | ✅ | ✅ |
| **Developer Tools** | | | |
| Impersonate Users | ❌ | ❌ | ✅ |
| Access Filesystem | ❌ | ❌ | ✅ |
| View System Logs | ❌ | ❌ | ✅ |
| Generate API Keys | ✅ | ✅ | ✅ |
| Manage Webhooks | ✅ | ✅ | ✅ |
| **Real-time Features** | | | |
| LiveKit Rooms | ✅ | ✅ | ✅ |
| WebSocket Updates | ✅ | ✅ | ✅ |
| Chat Widget | ✅ | ✅ | ✅ |

---

## 📊 Platform Statistics (Example)

```
👥 Users:           1,247 (893 customers, 12 admins, 2 devs)
🖥️ VPS Instances:   47 (42 active, 5 provisioning)
🗄️ Projects:        324 (databases provisioned)
🚀 Deployments:     892 (753 active, 139 historical)
📦 Orders:          567 (481 completed, 86 pending)
💰 Revenue (LKR):   12,456,789 (this month)
📧 Templates:       360+ one-click deployable apps
🎫 Open Tickets:    23 (avg response time: 2.3 hours)
```

---

## 🔗 Quick Links

- **Main Repository:** [github.com/yourorg/shanutechx](https://github.com/yourorg/shanutechx)
- **API Documentation:** [api.shanutechx.com/docs](https://api.shanutechx.com/docs)
- **Template Catalog:** [templates/](./templates/)
- **SDK Packages:** [packages/](./packages/)
- **Deployment Guide:** [docs/deployment/](./docs/deployment/)
- **Contributing:** [CONTRIBUTING.md](./CONTRIBUTING.md)
- **License:** [MIT License](./LICENSE)

---

**Generated by Kiro AI • ShanuTechX Platform • 2026-07-29**
