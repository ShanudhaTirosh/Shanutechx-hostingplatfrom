# Handoff Report: Milestone 2 Adversarial Stress-Testing & Empirical Verification

## 1. Observation

### 1.1 Process Bootability & Code Integrity (CRITICAL DEFECT)
- **File**: `services/node-agent/src/index.js`
- **Line 529**:
  ```javascript
  const { execFile: execFileCb } = require('child_process');
  const util = require('util');
  const execFileAsync = util.promisify(execFileCb);
  ```
- **Line 2019**:
  ```javascript
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const execFileAsync = promisify(execFile);
  ```
- **Command Executed**: `node -c services/node-agent/src/index.js`
- **Result & Verbatim Error**:
  ```
  C:\Users\tiros\OneDrive\Desktop\shanutechx\services\node-agent\src\index.js:2019
  const execFileAsync = promisify(execFile);
        ^

  SyntaxError: Identifier 'execFileAsync' has already been declared
      at wrapSafe (node:internal/modules/cjs/loader:1713:18)
      at checkSyntax (node:internal/main/check_syntax:78:3)

  Node.js v22.23.2
  Command exited with code 1.
  ```
- **Real Process Execution**:
  Spawning `node services/node-agent/src/index.js` in `tests/unit/m2-adversarial-challenger.test.ts` (subtests 7.B and 10.A4) failed to boot with the exact same `SyntaxError`. The Node Agent service daemon immediately crashes on startup.

### 1.2 Persistent Volumes System Root Mount Bypass (HIGH DEFECT)
- **File**: `apps/api/src/routes/volumes.ts`, lines 69-72:
  ```typescript
  const normalizedContainerPath = containerPath.replace(/\/+$/, '');
  if (FORBIDDEN_CONTAINER_PATHS.has(normalizedContainerPath)) {
    return res.status(400).json({ error: 'Container mount path cannot target system directories' });
  }
  ```
- **Vulnerability**:
  When a client requests `containerPath: "/"`, `containerPath.replace(/\/+$/, '')` removes the trailing slash and evaluates to `""` (empty string).
  `FORBIDDEN_CONTAINER_PATHS` contains `['/', '/proc', '/sys', '/dev', '/etc', '/var/run', '/var/run/docker.sock']`, but does NOT contain `""`.
  Consequently, `FORBIDDEN_CONTAINER_PATHS.has("")` evaluates to `false`.
- **Command Executed**: `npx tsx --test tests/unit/m2-adversarial-challenger.test.ts`
- **Result & Verbatim Failure**:
  ```
  # Subtest: 7.A2: Reject forbidden system mount paths (/proc, /sys, /dev, /etc, /var/run, /var/run/docker.sock, /)
  not ok 2 - 7.A2: Reject forbidden system mount paths (/proc, /sys, /dev, /etc, /var/run, /var/run/docker.sock, /)
    ---
    duration_ms: 21.4967
    type: 'test'
    location: 'C:\\Users\\tiros\\OneDrive\\Desktop\\shanutechx\\tests\\unit\\m2-adversarial-challenger.test.ts:2:2690'
    failureType: 'testCodeFailure'
    error: 'Expected HTTP status in [400], got 201. Body: {"ok":true,"volume":{"id":"new1","deploymentId":"dep_adv_vol_001","name":"vol-sys-path","hostPath":"/var/lib/shanutechx/volumes/dep_adv_vol_001/vol-sys-path","containerPath":"/","sizeGb":5}}'
    code: 'ERR_ASSERTION'
  ```
  A persistent host volume was successfully provisioned and bound to the root directory `/` of the container.

### 1.3 Test Server Mock Whitespace Validation Discrepancy (MEDIUM DEFECT)
- **File**: `tests/e2e/infra/test-server.ts`, lines 250-251:
  ```typescript
  const { image, envVars, ports, volumes, resources } = req.body || {};
  if (!image) return res.status(400).json({ error: 'image is required' });
  ```
- **File**: `services/node-agent/src/index.js`, line 644:
  ```javascript
  if (!req.body || !req.body.image || typeof req.body.image !== 'string' || !req.body.image.trim()) {
    return res.status(400).json({ error: 'image is required' });
  }
  ```
- **Observation**:
  `services/node-agent/src/index.js` properly enforces `typeof req.body.image === 'string' && req.body.image.trim()`. However, the mock test harness in `tests/e2e/infra/test-server.ts` accepts whitespace strings (`{ image: "   " }`), returning HTTP 201 instead of HTTP 400.

### 1.4 Feature 8: Direct Image Deployment Route & Tag Parsing (VERIFIED SAFE)
- **File**: `services/node-agent/src/docker.js`, lines 476-483:
  ```javascript
  async function pullImage(imageName, tag = 'latest') {
    let fullName = imageName;
    const lastColon = imageName.lastIndexOf(':');
    const lastSlash = imageName.lastIndexOf('/');
    const hasTag = (lastColon > lastSlash) || imageName.includes('@');
    if (!hasTag) {
      fullName = `${imageName}:${tag || 'latest'}`;
    }
  ```
- **Empirical Results from `tests/unit/m2-challenger2-adversarial.test.ts`**:
  * Tagged images (`redis:7-alpine`, `nginx:1.25-alpine`, `node:20.11.0-bookworm-slim`, `quay.io/prometheus/prometheus:v2.45.0`) retain their exact tags and DO NOT have `:latest` appended.
  * Digest-pinned images (`ubuntu@sha256:...`) retain their digest without appending `:latest`.
  * Custom registry paths with ports and no tags (`registry.company.com:5000/my-app`) correctly receive `:latest`.
  * Custom registry paths with ports and tags (`registry.company.com:5000/my-app:v2.1.0`) correctly retain `:v2.1.0`.
  * Bare image names (`nginx`, `redis`) correctly receive `:latest`.
- **Resource Limits & Port Plumbing in `docker.js` (lines 139-148)**:
  * `NanoCpus: cpuLimit * 1e9` correctly converts cores to nanocpus.
  * `Memory: memLimitMb * 1024 * 1024` correctly converts MB to bytes.
  * `SecurityOpt: ['no-new-privileges:true']` and `User: '1000:1000'` enforced.
  * `HostConfig.Binds` filters out dangerous root paths (`/var/run/docker.sock`, `/proc`, `/sys`, `/etc`, `/dev`, `/root`, `/`).

### 1.5 Feature 9: Build Pipeline Secrets Hardening (VERIFIED SAFE)
- **File**: `services/node-agent/src/build.js`, lines 259-272:
  ```javascript
  const effectiveBuildArgs = { ...(buildArgs || {}) };
  for (const [key, value] of Object.entries(envVars || {})) {
    if (key.startsWith('BUILD_ARG_')) {
      const cleanKey = key.slice('BUILD_ARG_'.length);
      effectiveBuildArgs[cleanKey] = value;
    }
  }
  for (const [key, value] of Object.entries(effectiveBuildArgs)) {
    dockerArgs.push('--build-arg', `${key}=${value}`);
  }
  ```
- **Empirical Results**:
  * Runtime `envVars` (`DB_PASSWORD`, `API_SECRET`, `DATABASE_URL`, `AWS_SECRET_ACCESS_KEY`, `JWT_SIGNING_KEY`) are NEVER injected into `--build-arg`.
  * Only declared `buildArgs` and explicit `BUILD_ARG_` variables are passed.
  * Railpack (line 358), Nixpacks CLI (line 377), and Containerized Nixpacks (line 406) strictly iterate over `buildArgs || {}`, never `envVars`.

### 1.6 Feature 11: Container Telemetry (VERIFIED SAFE)
- **File**: `services/node-agent/src/docker.js`, lines 283-346:
  * Zero occurrences of `Math.random()` in `docker.js`.
  * Returns raw byte counters: `memoryUsageBytes`, `memoryLimitBytes`, `networkRxBytes`, `networkTxBytes`, `blockReadBytes`, `blockWriteBytes`.
  * Returns calculated percentages: `cpuPercent`, `cpuUsagePercent`, `memoryPercent`, `memoryUsagePercent`.
  * Memory cache subtraction: `Math.max(0, rawUsage - cache)`.
  * Live stats streaming (`streamContainerStats`, lines 383-455) transforms raw Docker stats stream into JSON chunks without mocks.

### 1.7 Standard Test Suite Execution
1. `npx tsx --test tests/e2e/tier1-features/m2-container-build.test.ts`:
   * 25 tests, 6 suites: 25 passed, 0 failed (duration: 102s).
2. `npx tsx --test tests/e2e/tier2-boundary/limits-and-validation.test.ts`:
   * 15 tests, 4 suites: 15 passed, 0 failed (duration: 113s).
3. `npx tsx --test tests/e2e/tier3-interactions/auth-deployment-lifecycle.test.ts`:
   * 5 tests, 1 suite: 5 passed, 0 failed (duration: 58s).

---

## 2. Logic Chain

1. *Observation 1.1 establishes that `services/node-agent/src/index.js` declares `const execFileAsync` at line 529 and re-declares `const execFileAsync` at line 2019 in the same top-level module scope.*
2. *ECMAScript strict lexical scoping rules mandate that duplicate `const` declarations in the same scope result in an unrecoverable `SyntaxError` before code execution begins.*
3. *Direct verification via `node -c services/node-agent/src/index.js` confirmed exit code 1 with `SyntaxError: Identifier 'execFileAsync' has already been declared`.*
4. *Therefore, whenever `node-agent` is executed in a production container or standalone process, the process immediately crashes on boot, rendering Features 7, 8, 9, 10, and 11 completely non-functional in actual production.*
5. *Observation 1.2 establishes that `apps/api/src/routes/volumes.ts:69` performs `containerPath.replace(/\/+$/, '')`.*
6. *When `containerPath` is `'/'`, replacing trailing slashes results in `""`.*
7. *Because `FORBIDDEN_CONTAINER_PATHS` contains `'/'` and not `""`, the check `FORBIDDEN_CONTAINER_PATHS.has("")` returns `false`.*
8. *Therefore, an adversarial client can bypass system path validation and mount a persistent volume directly over the container's root filesystem `/`, creating severe container integrity and security risks.*
9. *These two empirical failures directly invalidate production readiness for Milestone 2.*

---

## 3. Caveats
- Tier 1, Tier 2, and Tier 3 E2E test suites passed cleanly because they interact with the control plane through `tests/e2e/infra/test-server.ts`, an in-memory test harness that mocks out the node-agent endpoints rather than booting `services/node-agent/src/index.js` as a child process. The fatal SyntaxError only became apparent when performing direct node syntax validation and spawning real node-agent worker instances during adversarial stress testing.
- Features 8, 9, and 11 algorithmic implementations (image tag parsing, secret exclusion, and telemetry byte calculations) are correctly implemented and verified. Once the duplicate variable declaration and path normalization issues are resolved, the underlying logic is sound.

---

## 4. Conclusion
**Verdict**: **REQUEST_CHANGES**

Milestone 2 cannot be approved in its current state due to two blocking issues:
1. **Critical Blocker**: `services/node-agent/src/index.js` cannot boot due to `SyntaxError: Identifier 'execFileAsync' has already been declared` at line 2019. The duplicate declaration on line 2019 must be removed (or reuse the existing declaration from line 529).
2. **Security Vulnerability**: `apps/api/src/routes/volumes.ts` lines 69-72 allows mounting to root `/` due to `containerPath.replace(/\/+$/, '')` stripping `'/'` to `""`. The normalization logic must preserve root `'/'` (e.g., `normalizedContainerPath = containerPath === '/' ? '/' : containerPath.replace(/\/+$/, '')`).
3. **Test Infrastructure Alignment**: `tests/e2e/infra/test-server.ts` line 251 should reject whitespace-only image strings (`!image.trim()`) to align with `services/node-agent/src/index.js`.

---

## 5. Verification Method

To independently reproduce all findings, run the following commands in powershell or bash from the repository root:

```bash
# 1. Reproduce the fatal Node Agent SyntaxError:
node -c services/node-agent/src/index.js
# Expected Output: SyntaxError: Identifier 'execFileAsync' has already been declared at line 2019

# 2. Reproduce the volume mount bypass and test suite failures:
npx tsx --test tests/unit/m2-adversarial-challenger.test.ts
# Expected Output: Subtest 7.A2 fails (HTTP 201 on '/') and Subtests 7.B / 10.A4 fail (node-agent boot crash)

# 3. Verify Challenger 2 adversarial suite:
npx tsx --test tests/unit/m2-challenger2-adversarial.test.ts

# 4. Verify baseline tier 1-3 test suites:
npx tsx --test tests/e2e/tier1-features/m2-container-build.test.ts
npx tsx --test tests/e2e/tier2-boundary/limits-and-validation.test.ts
npx tsx --test tests/e2e/tier3-interactions/auth-deployment-lifecycle.test.ts
```
