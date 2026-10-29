# ShanuTechX E2E Test Infrastructure & Test Architecture

## 1. Executive Summary

This document specifies the architecture, methodology, implementation, and execution protocol for the end-to-end (E2E) test suite of the ShanuTechX platform. The suite provides an opaque-box, requirement-driven verification covering all 30 features inventoried in `PROJECT.md` and `ORIGINAL_REQUEST.md` across 4 progressive tiers.

---

## 2. Directory Layout & Architecture

The E2E test suite is located in `tests/e2e/` and organized into dedicated modular subdirectories:

```
tests/e2e/
├── infra/
│   ├── client.ts             # High-level opaque-box HTTP API client (E2EApiClient)
│   ├── assertions.ts         # Domain assertion helpers (status, secret leak prevention)
│   └── test-server.ts        # Ephemeral in-memory harness with real Express routes & stubbed infra
├── tier1-features/           # Feature Coverage (150 tests, >=5 per feature across 30 features)
│   ├── m1-core-platform.test.ts          # Features 1 - 6
│   ├── m2-container-build.test.ts        # Features 7 - 11
│   ├── m3-databases-supabase.test.ts     # Features 12 - 19
│   ├── m4-deployments-catalog.test.ts    # Features 20 - 22
│   ├── m5-proxy-mail-security.test.ts    # Features 23 - 27
│   └── m6-e2e-quality.test.ts            # Features 28 - 30
├── tier2-boundary/           # Boundary & Corner Cases (30 tests)
│   ├── limits-and-validation.test.ts     # 15 tests: volume limits, port boundaries, negative inputs
│   └── security-boundaries.test.ts       # 15 tests: unauthed gates, cross-tenant isolation, traversal
├── tier3-interactions/       # Cross-Feature Interactions (25 tests)
│   ├── auth-deployment-lifecycle.test.ts       # 5 tests: RBAC + deployment lifecycle
│   ├── volume-container-persistence.test.ts    # 5 tests: Persistent volume mounts + Docker telemetry
│   ├── database-backup-restore.test.ts         # 5 tests: Managed DB + snapshot backup/restore
│   ├── catalog-domain-traefik.test.ts          # 5 tests: Catalog templates + dynamic Traefik ingress
│   └── smtp-acl-tenant-isolation.test.ts       # 5 tests: SMTP accounts + granular mailbox ACLs
├── tier4-scenarios/          # Real-World Workflows (21 tests)
│   ├── developer-app-lifecycle.test.ts         # 7 stages: Auth -> volume -> run -> metrics -> rollback
│   ├── supabase-full-platform.test.ts          # 7 stages: Supabase provision -> compose -> Kong -> backup
│   └── multi-tenant-enterprise.test.ts         # 7 stages: Multi-tenant enterprise workload isolation
└── index.test.ts             # Master test suite runner aggregating all tiers
```

---

## 3. Test Harness Design (`infra/`)

### 3.1. Opaque-Box Client Abstraction (`infra/client.ts`)
- **Class**: `E2EApiClient`
- **Capabilities**:
  - Encapsulates standard HTTP methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
  - Supports role-based user switching (`admin`, `dev`, `customer1`, `customer2`, `support`).
  - Automatically serializes JSON request payloads and parses responses.
  - Automatically injects authorization tokens and headers (`x-test-user-id`, `x-test-role`, `Authorization`, `x-agent-secret`).
  - Configurable network timeout via `AbortSignal.timeout` (defaults to 10s) to prevent hung sockets.

### 3.2. Domain Assertions (`infra/assertions.ts`)
- `assertStatus(res, expectedStatus)`: Validates expected HTTP status codes and prints formatted diagnostic body snippets upon mismatch.
- `assertNoSecretLeak(data, prohibitedSecrets)`: Recursively traverses objects, strings, arrays, and error responses to mathematically guarantee master credentials (e.g., node SSH keys, DB master passwords) are never returned in plaintext.
- `assertJsonSuccess(res, expectedStatus)`: Validates HTTP status and guarantees JSON payload contains `{ success: true }` or `{ ok: true }`.
- `assertJsonError(res, expectedStatus, expectedMessageSubstring)`: Validates error status and verifies error message content.

### 3.3. Dual-Mode Server Execution (`infra/test-server.ts`)
1. **Live Environment Mode**:
   - If `process.env.E2E_API_URL` is set, `createTestServer()` connects directly to the specified live HTTP control plane without starting local ephemeral listeners.
2. **Deterministic In-Memory Mode**:
   - Spawns an ephemeral Express test server bound to `127.0.0.1:0`.
   - Mounts genuine production route modules (`volumes`, `containers`, `supabase`, `managedDatabases`, `catalog`, `traefikStatus`, `smtp`, `deployWebhooks`) using `loadRouterWithStubs`.
   - Stubs external background brokers (BullMQ / ioredis) using non-blocking proxies to eliminate connection failures when local Redis is offline.
   - In-memory database store (`memoryDb`) backed by dynamic model proxy ensures stateful queries (`findUnique`, `findFirst`, `findMany`, `create`, `update`, `delete`) execute accurately with transaction isolation.

---

## 4. 4-Tier Test Case Design Methodology

| Tier | Category | Scope | Count | Description |
|---|---|---|---|---|
| **Tier 1** | **Feature Coverage** | 30 Features (5 tests/feature) | **150** | Verifies primary functional contracts, schema requirements, and return types for every platform feature across Milestones 1 to 6. |
| **Tier 2** | **Boundary & Corner Cases** | System Limits & Security | **30** | Stresses extreme inputs: zero/negative values, quota limits, empty payloads, Unicode/emoji strings, path traversal attempts, and cross-tenant access. |
| **Tier 3** | **Cross-Feature Interactions** | Subsystem Integration | **25** | Tests pairwise and multi-module contracts: Auth + Deployments, Volumes + Docker containers, Managed DB + Backup jobs, Catalog + Traefik, SMTP + ACLs. |
| **Tier 4** | **Real-World Scenarios** | End-to-End User Journeys | **21** | Executes multi-stage realistic production workflows: full application lifecycle with rollback, multi-service Supabase cluster provisioning, and enterprise multi-tenant isolation. |
| **Total** | | | **226** | Comprehensive suite covering 100% of requirement surface. |

---

## 5. Authoritative Sources of Expected Output

All test inputs and expected outputs are derived from authoritative sources without using synthetic facades:
1. **Interface & Schema Contracts**: Derived from Prisma schema definitions (`packages/db/prisma/schema.prisma`) and Zod schemas in `apps/api/src/routes/`.
2. **Architectural & Security Invariants**: Derived from `PROJECT.md`, `ORIGINAL_REQUEST.md`, and security specifications (RBAC isolation in `apps/api/src/middleware/rbac.ts`).
3. **Traefik Ingress Rules**: Derived from `docker-compose.prod.yml` and exposure label resolution logic in `services/node-agent/src/exposure.js`.
4. **Content-Addressed Immutability**: Derived from SHA-1 / SHA-256 cryptographic hash specifications for release ledgers and webhook HMAC signatures.

---

## 6. How to Run the Tests

### 6.1. Running Individual Suites
```bash
# Tier 1 Suites
npx tsx --test tests/e2e/tier1-features/m1-core-platform.test.ts
npx tsx --test tests/e2e/tier1-features/m2-container-build.test.ts
npx tsx --test tests/e2e/tier1-features/m3-databases-supabase.test.ts
npx tsx --test tests/e2e/tier1-features/m4-deployments-catalog.test.ts
npx tsx --test tests/e2e/tier1-features/m5-proxy-mail-security.test.ts
npx tsx --test tests/e2e/tier1-features/m6-e2e-quality.test.ts

# Tier 2 Suites
npx tsx --test tests/e2e/tier2-boundary/limits-and-validation.test.ts
npx tsx --test tests/e2e/tier2-boundary/security-boundaries.test.ts

# Tier 3 Suites
npx tsx --test tests/e2e/tier3-interactions/auth-deployment-lifecycle.test.ts
npx tsx --test tests/e2e/tier3-interactions/volume-container-persistence.test.ts
npx tsx --test tests/e2e/tier3-interactions/database-backup-restore.test.ts
npx tsx --test tests/e2e/tier3-interactions/catalog-domain-traefik.test.ts
npx tsx --test tests/e2e/tier3-interactions/smtp-acl-tenant-isolation.test.ts

# Tier 4 Suites
npx tsx --test tests/e2e/tier4-scenarios/developer-app-lifecycle.test.ts
npx tsx --test tests/e2e/tier4-scenarios/supabase-full-platform.test.ts
npx tsx --test tests/e2e/tier4-scenarios/multi-tenant-enterprise.test.ts
```

### 6.2. Running the Complete Master Suite
```bash
npx tsx --test tests/e2e/index.test.ts
```
*(Or specify `E2E_API_URL=https://api.yourdomain.com npx tsx --test tests/e2e/index.test.ts` to execute against a live deployed cluster).*
