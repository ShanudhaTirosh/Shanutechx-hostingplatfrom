# Specification Analysis: `@shanutechx/catalog` and Type Compatibility

**Author:** Teamwork Specification Miner (`teamwork_spec_miner_m1_1`)  
**Target Milestone:** Milestone 1 (Platform Integrity & SDK Build Fix)  
**Date:** 2026-10-28  

---

## 1. Executive Summary

During the baseline audit (R1) and SDK verification, running `npm run build:sdk` failed at `@shanutechx/catalog@1.0.0` due to TypeScript compiler error **TS2345** in `packages/catalog/src/index.ts:42,43`:
1. `Argument of type 'string | undefined' is not assignable to parameter of type 'string'.`
2. `Argument of type 'Record<string, string> | undefined' is not assignable to parameter of type 'Record<string, string>'.`

This report provides the authoritative specification analysis of the interface contracts between `@shanutechx/types`, `@shanutechx/client`, `apps/api/src/routes/catalog.ts`, and `@shanutechx/catalog`, evaluates the return type contract (`Promise<Deployment>` vs `Promise<CatalogDeployResponse>`), documents all discovered features and edge cases, and provides the exact, production-ready code fix recommendation.

---

## 2. Code Inspection & Interface Contract Mapping

### 2.1 Interface Definitions in `@shanutechx/types` (`packages/types/src/catalog.ts`)

```typescript
export interface CatalogDeployInput {
  templateSlug?: string;
  slug?: string;
  nodeId?: string;
  envVars?: Record<string, string>;
  subdomain?: string;
  projectName?: string;
  preferredName?: string;
  cpuLimit?: string | number;
  memoryLimit?: string | number;
  storageLimit?: string | number;
  exposureMode?: string;
  orderItemId?: string;
  builder?: string;
}

export interface CatalogDeployResponse {
  ok: boolean;
  deploymentId: string;
  subdomain: string;
  serviceName: string;
  status: string;
}
```

**Key Observations:**
- Both `templateSlug` and `slug` are marked as optional (`string | undefined`). This accommodates callers using either Coolify-style `slug` or legacy `templateSlug`.
- `envVars` is marked as optional (`Record<string, string> | undefined`). Templates that do not require any environment variables (or where defaults suffice) may omit this parameter.

### 2.2 Client Implementation in `@shanutechx/client` (`packages/client/src/catalog.ts`)

```typescript
export class CatalogResource extends BaseClient {
  async deploy(input: CatalogDeployInput): Promise<Deployment> {
    const payload = {
      slug: (input as any).slug ?? input.templateSlug,
      nodeId: input.nodeId,
      envVars: input.envVars,
      projectName: input.projectName ?? input.subdomain ?? input.preferredName,
      subdomain: input.subdomain,
      preferredName: input.preferredName ?? input.projectName,
      cpuLimit: input.cpuLimit,
      memoryLimit: input.memoryLimit,
      storageLimit: input.storageLimit,
      exposureMode: input.exposureMode,
      orderItemId: input.orderItemId,
      builder: input.builder,
    };
    const res = await this.httpPost<{ ok: boolean; deployment?: Deployment } | Deployment>(
      '/api/catalog/deploy',
      payload,
    );
    if ('deployment' in res && res.deployment) {
      return res.deployment;
    }
    return res as Deployment;
  }
}
```

**Key Observations:**
- `client.catalog.deploy(input)` accepts `CatalogDeployInput`.
- It unboxes the server response and returns `Promise<Deployment>`.
- The fallback resolution `(input as any).slug ?? input.templateSlug` establishes that both `slug` and `templateSlug` are valid identifiers for the template.

### 2.3 API Route Implementation in `apps/api/src/routes/catalog.ts`

```typescript
const deploySchema = z
  .object({
    slug: z.string().min(1).optional(),
    templateSlug: z.string().min(1).optional(),
    nodeId: z.string().min(1),
    envVars: z.record(z.string()).optional(),
    projectName: z.string().min(1).optional(),
    teamId: z.string().nullable().optional(),
    orderItemId: z.string().optional(),
    exposureMode: z.enum(['ssl_with_proxy', 'ssl_direct', 'no_ssl', 'raw_tcp', 'internal_only', 'auto']).optional(),
    ...
  })
  .refine((data) => data.slug || data.templateSlug, {
    message: 'slug or templateSlug is required',
  });

catalogRouter.post('/catalog/deploy', async (req: AuthedRequest, res) => {
  ...
  const slug = parsed.data.slug || parsed.data.templateSlug!;
  ...
  res.status(201).json({
    deployment,
    agent: agentData,
    ...(managedDatabasesCreated.length > 0 ? { managedDatabases: managedDatabasesCreated } : {}),
    ...(Object.keys(generatedSecrets).length > 0 ? { generatedSecrets } : {}),
    ...(Object.keys(configFiles).length > 0 ? { configFiles: Object.keys(configFiles) } : {}),
  });
});
```

**Key Observations:**
- The backend API accepts either `slug` or `templateSlug` (validated via Zod refinement).
- It returns HTTP 201 with `{ deployment: Deployment, agent: ... }`.

### 2.4 Existing CatalogHelper in `packages/catalog/src/index.ts`

```typescript
40:   /** Deploy a template with env validation */
41:   async deployTemplate(input: CatalogDeployInput): Promise<Deployment> {
42:     const template = await this.getTemplate(input.templateSlug);
43:     const { valid, missingKeys } = CatalogHelper.validateEnv(template, input.envVars);
44: 
45:     if (!valid) {
46:       throw new Error(
47:         `Cannot deploy template '${input.templateSlug}': Missing required environment variables: ${missingKeys.join(', ')}`,
48:       );
49:     }
50: 
51:     return this.client.catalog.deploy(input);
52:   }
```

---

## 3. In-Depth Root Cause Analysis

### 3.1 TS2345 at Line 42: `input.templateSlug`
- **Compiler Error:** `Argument of type 'string | undefined' is not assignable to parameter of type 'string'.`
- **Root Cause:** `CatalogDeployInput.templateSlug` is `string | undefined`. `CatalogHelper.getTemplate(slug: string)` requires a non-nullable `string`.
- **Runtime Risk:** If a caller invokes `deployTemplate({ slug: 'redis' })` (using `slug` instead of `templateSlug`), `input.templateSlug` evaluates to `undefined`. This triggers an HTTP GET to `/api/catalog/undefined` instead of fetching the template, resulting in an unhandled 404 or 400 error.
- **Specification Remedy:**
  Resolve the slug using fallback order:
  ```typescript
  const slug = input.templateSlug || input.slug;
  if (!slug) {
    throw new Error("Cannot deploy template: 'templateSlug' or 'slug' is required");
  }
  ```
  This immediately narrows `slug` to `string` (satisfying TypeScript strict null checks) and provides early client-side validation with a descriptive error before any HTTP request is issued.

### 3.2 TS2345 at Line 43: `input.envVars`
- **Compiler Error:** `Argument of type 'Record<string, string> | undefined' is not assignable to parameter of type 'Record<string, string>'.`
- **Root Cause:** In `CatalogHelper`:
  ```typescript
  static validateEnv(
    template: CatalogTemplate,
    envVars: Record<string, string>,
  ): { valid: boolean; missingKeys: string[] }
  ```
  `envVars` is typed as a required `Record<string, string>`. However, `input.envVars` in `CatalogDeployInput` is optional (`Record<string, string> | undefined`).
- **Runtime Risk:** If `input.envVars` is omitted (`undefined`), executing `!envVars[schema.key]` in line 30 results in a runtime crash:
  `TypeError: Cannot read properties of undefined (reading '...')`.
- **Specification Remedy:**
  Two complementary fixes:
  1. Default `envVars` in `validateEnv`:
     ```typescript
     static validateEnv(
       template: CatalogTemplate,
       envVars: Record<string, string> = {},
     ): { valid: boolean; missingKeys: string[] }
     ```
  2. Coalesce `input.envVars` when calling `validateEnv` in `deployTemplate`:
     ```typescript
     const envVars = input.envVars ?? {};
     const { valid, missingKeys } = CatalogHelper.validateEnv(template, envVars);
     ```

### 3.3 Return Type Analysis: `Promise<Deployment>` vs `Promise<CatalogDeployResponse>`

The question arises whether `CatalogHelper.deployTemplate` should return `Promise<Deployment>` or `Promise<CatalogDeployResponse>`.

1. **`Deployment` Contract**:
   - `packages/client/src/catalog.ts` line 15 defines:
     `async deploy(input: CatalogDeployInput): Promise<Deployment>`
   - `this.client.catalog.deploy(input)` returns a `Deployment` instance.
   - `tests/unit/hosting_methods.test.ts:236` explicitly verifies the client return value against the `Deployment` model:
     `assert.equal(res.id, 'cat-789');`
   - In `packages/types/src/deployment.ts`, `Deployment` represents the complete platform resource (`id`, `status`, `internalPort`, `subdomain`, `cpuLimit`, `memoryLimit`, etc.).

2. **`CatalogDeployResponse` Contract**:
   - Defined in `packages/types/src/catalog.ts`:
     ```typescript
     export interface CatalogDeployResponse {
       ok: boolean;
       deploymentId: string;
       subdomain: string;
       serviceName: string;
       status: string;
     }
     ```
   - Notice that `CatalogDeployResponse` uses `deploymentId` rather than `id`, and includes `serviceName` and `ok`.
   - `CatalogDeployResponse` is NOT returned by `client.catalog.deploy()`.
   - If `deployTemplate` declared a return type of `Promise<CatalogDeployResponse>`, line 51 (`return this.client.catalog.deploy(input)`) would trigger **TS2322**:
     `Type 'Deployment' is not assignable to type 'CatalogDeployResponse'. Property 'deploymentId' is missing in type 'Deployment' but required in type 'CatalogDeployResponse'.`

3. **Conclusion & Recommendation**:
   `deployTemplate` must retain `Promise<Deployment>` as its return type. This maintains 100% type compatibility with `client.catalog.deploy(input)`, preserves access to all `Deployment` fields, and adheres to existing unit tests. `CatalogDeployResponse` remains available in `@shanutechx/types` as an alternate client DTO for lightweight representations.

---

## 4. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | SDK Catalog | `CatalogHelper.listTemplates` | Fetches all available catalog templates | None | `Promise<CatalogTemplate[]>` | Rejects if client API unreachable or 500 | `packages/catalog/src/index.ts:8-10` |
| 2 | SDK Catalog | `CatalogHelper.listByCategory` | Filters catalog templates by category | `category: TemplateCategory` | `Promise<CatalogTemplate[]>` | Rejects if `listTemplates()` fails | `packages/catalog/src/index.ts:13-16` |
| 3 | SDK Catalog | `CatalogHelper.getTemplate` | Fetches single template details & schema | `slug: string` | `Promise<CatalogTemplate>` | Rejects with 404 if template not found | `packages/catalog/src/index.ts:19-21` |
| 4 | SDK Catalog | `CatalogHelper.validateEnv` | Validates environment variables against template schema | `template: CatalogTemplate`, `envVars?: Record<string, string>` | `{ valid: boolean, missingKeys: string[] }` | Gracefully handles empty/missing env vars without throwing | `packages/catalog/src/index.ts:24-38` |
| 5 | SDK Catalog | `CatalogHelper.deployTemplate` | Validates inputs, fetches template, checks env vars, and deploys | `input: CatalogDeployInput` | `Promise<Deployment>` | Throws `Error` if slug missing or required env vars missing; rejects on API deploy error | `packages/catalog/src/index.ts:41-52` |
| 6 | Client SDK | `CatalogResource.deploy` | Dispatches deployment payload to `/api/catalog/deploy` | `input: CatalogDeployInput` | `Promise<Deployment>` | Rejects with `ApiError` on HTTP 4xx/5xx | `packages/client/src/catalog.ts:15-38` |
| 7 | Client SDK | `CatalogResource.listCategories` | Extracts distinct categories from templates | None | `Promise<string[]>` | Rejects if API unreachable | `packages/client/src/catalog.ts:40-43` |
| 8 | Client SDK | `CatalogResource.getByCategory` | Filters templates case-insensitively by category | `category: string` | `Promise<CatalogTemplate[]>` | Rejects if API unreachable | `packages/client/src/catalog.ts:45-48` |
| 9 | Client SDK | `CatalogResource.search` | Multi-field search across name, slug, description, tags | `query: string` | `Promise<CatalogTemplate[]>` | Empty query returns all templates | `packages/client/src/catalog.ts:50-61` |
| 10 | Control Plane | `POST /api/catalog/deploy` | Control plane endpoint provisioning compose stack, DBs, and DNS | JSON payload matching `deploySchema` | `HTTP 201 { deployment, agent, ... }` | 400 invalid schema; 403 no subscription or unauthorized node; 409 conflict | `apps/api/src/routes/catalog.ts:247-639` |
| 11 | Control Plane | `GET /api/catalog` | Searchable cached catalog of YAML templates | `query: { search?, category? }` | `HTTP 200 { templates, categories, total }` | 500 on disk read failure | `apps/api/src/routes/catalog.ts:148-176` |
| 12 | Control Plane | `GET /api/catalog/:slug` | Retrieve single template with YAML source | `params: { slug }` | `HTTP 200 { template: { ...meta, yaml } }` | 400 invalid slug format; 404 not found | `apps/api/src/routes/catalog.ts:183-198` |
| 13 | Control Plane | `GET /api/catalog/nodes` | List active nodes available for template deployments | None (Admin/Dev only) | `HTTP 200 { nodes: [...] }` | 401 unauthenticated; 403 non-staff | `apps/api/src/routes/catalog.ts:138-145` |
| 14 | Control Plane | `POST /api/catalog/:slug` | Create new template in catalog | `params: { slug }`, body: `createTemplateSchema` | `HTTP 201 { template }` | 400 invalid YAML / security fail; 409 exists | `apps/api/src/routes/catalog.ts:657-773` |
| 15 | Control Plane | `PATCH /api/catalog/:slug` | Update metadata/YAML for existing template | `params: { slug }`, body: `updateTemplateSchema` | `HTTP 200 { template }` | 400 invalid data; 404 not found | `apps/api/src/routes/catalog.ts:791-800+` |

---

## 5. Edge Cases & Observed Behavior

| # | Feature | Input | Observed / Expected Behavior |
|---|---------|-------|------------------------------|
| 1 | `deployTemplate` | `{ templateSlug: 'redis' }` (no `envVars`) | Before: TS2345 compiler error; runtime crash reading undefined `envVars`. After: Defaults `envVars` to `{}`, checks template requirements, proceeds if all valid. |
| 2 | `deployTemplate` | `{ slug: 'redis' }` (no `templateSlug`) | Before: TS2345 compiler error; queries `/api/catalog/undefined`. After: Correctly resolves `slug = 'redis'`, queries `/api/catalog/redis`. |
| 3 | `deployTemplate` | `{}` (neither `slug` nor `templateSlug`) | Before: Queries `/api/catalog/undefined`. After: Throws immediate client-side error: `"Cannot deploy template: 'templateSlug' or 'slug' is required"`. |
| 4 | `deployTemplate` | `{ templateSlug: 'n8n', envVars: { DB_POSTGRESDB_PASSWORD: '' } }` | Identifies `DB_POSTGRESDB_PASSWORD` as missing (empty string), throws `"Cannot deploy template 'n8n': Missing required environment variables: DB_POSTGRESDB_PASSWORD"`. |
| 5 | `validateEnv` | `template` with optional env vars, `envVars = {}` | Returns `{ valid: true, missingKeys: [] }`. |
| 6 | `validateEnv` | `template` with required env vars, called with `undefined` | Before: Runtime crash `Cannot read properties of undefined`. After: Safely returns `{ valid: false, missingKeys: ['...'] }`. |

---

## 6. Exact Code Fix Recommendation for `packages/catalog/src/index.ts`

### Recommended File Content for `packages/catalog/src/index.ts`:

```typescript
import type { CatalogTemplate, CatalogDeployInput, Deployment, TemplateCategory } from '@shanutechx/types';
import type { ShanuTechXClient } from '@shanutechx/client';

export class CatalogHelper {
  constructor(private readonly client: ShanuTechXClient) {}

  /** List all catalog templates */
  async listTemplates(): Promise<CatalogTemplate[]> {
    return this.client.catalog.list();
  }

  /** Filter templates by category */
  async listByCategory(category: TemplateCategory): Promise<CatalogTemplate[]> {
    const templates = await this.listTemplates();
    return templates.filter((t) => t.category === category);
  }

  /** Get a template by slug */
  async getTemplate(slug: string): Promise<CatalogTemplate> {
    return this.client.catalog.get(slug);
  }

  /** Validate environment variables against template schema */
  static validateEnv(
    template: CatalogTemplate,
    envVars: Record<string, string> = {},
  ): { valid: boolean; missingKeys: string[] } {
    const vars = envVars ?? {};
    const missingKeys: string[] = [];
    for (const schema of template.envSchema) {
      const val = vars[schema.key];
      if (schema.required && (!val || !val.trim())) {
        missingKeys.push(schema.key);
      }
    }
    return {
      valid: missingKeys.length === 0,
      missingKeys,
    };
  }

  /** Deploy a template with env validation */
  async deployTemplate(input: CatalogDeployInput): Promise<Deployment> {
    const slug = input.templateSlug || input.slug;
    if (!slug) {
      throw new Error("Cannot deploy template: 'templateSlug' or 'slug' is required");
    }

    const template = await this.getTemplate(slug);
    const envVars = input.envVars ?? {};
    const { valid, missingKeys } = CatalogHelper.validateEnv(template, envVars);

    if (!valid) {
      throw new Error(
        `Cannot deploy template '${slug}': Missing required environment variables: ${missingKeys.join(', ')}`,
      );
    }

    return this.client.catalog.deploy(input);
  }
}
```

### Git Diff Preview:

```diff
--- a/packages/catalog/src/index.ts
+++ b/packages/catalog/src/index.ts
@@ -23,11 +23,12 @@ export class CatalogHelper {
   /** Validate environment variables against template schema */
   static validateEnv(
     template: CatalogTemplate,
-    envVars: Record<string, string>,
+    envVars: Record<string, string> = {},
   ): { valid: boolean; missingKeys: string[] } {
+    const vars = envVars ?? {};
     const missingKeys: string[] = [];
     for (const schema of template.envSchema) {
-      if (schema.required && (!envVars[schema.key] || !envVars[schema.key].trim())) {
+      const val = vars[schema.key];
+      if (schema.required && (!val || !val.trim())) {
         missingKeys.push(schema.key);
       }
     }
@@ -38,13 +39,19 @@ export class CatalogHelper {
 
   /** Deploy a template with env validation */
   async deployTemplate(input: CatalogDeployInput): Promise<Deployment> {
-    const template = await this.getTemplate(input.templateSlug);
-    const { valid, missingKeys } = CatalogHelper.validateEnv(template, input.envVars);
+    const slug = input.templateSlug || input.slug;
+    if (!slug) {
+      throw new Error("Cannot deploy template: 'templateSlug' or 'slug' is required");
+    }
+
+    const template = await this.getTemplate(slug);
+    const envVars = input.envVars ?? {};
+    const { valid, missingKeys } = CatalogHelper.validateEnv(template, envVars);
 
     if (!valid) {
       throw new Error(
-        `Cannot deploy template '${input.templateSlug}': Missing required environment variables: ${missingKeys.join(', ')}`,
+        `Cannot deploy template '${slug}': Missing required environment variables: ${missingKeys.join(', ')}`,
       );
     }
 
     return this.client.catalog.deploy(input);
```
