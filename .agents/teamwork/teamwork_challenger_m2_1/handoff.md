# Challenger Handoff Report: Milestone 2 — Container Management & Build System

## 1. Observation

### Verified Tests Passing
1. `npx tsx --test tests/e2e/tier1-features/m2-container-build.test.ts`:
   - 25 tests, 6 suites passed, 0 failures (duration: 7267ms).
2. `npx tsx --test tests/e2e/tier3-interactions/volume-container-persistence.test.ts`:
   - 5 tests, 1 suite passed, 0 failures (duration: 40532ms).
3. TypeScript compilation:
   - `npx tsc --noEmit --project apps/api/tsconfig.json`: Passed with code 0 (0 errors).
4. Node agent helper modules syntax:
   - `node -c services/node-agent/src/repo.js services/node-agent/src/build.js services/node-agent/src/docker.js`: Passed with code 0.

### Empirical Defects Discovered via Adversarial Harness
Harness executed: `npx tsx --test tests/unit/m2-adversarial-challenger.test.ts` (13 tests total, 8 passed, 5 failed).

#### Defect 1: Fatal SyntaxError in `services/node-agent/src/index.js` (Crash on Startup)
- **File**: `services/node-agent/src/index.js`
- **Lines**: Line 529 and Line 2019
- **Command**: `node -c services/node-agent/src/index.js`
- **Verbatim Error**:
  ```
  C:\Users\tiros\OneDrive\Desktop\shanutechx\services\node-agent\src\index.js:2019
  const execFileAsync = promisify(execFile);
        ^

  SyntaxError: Identifier 'execFileAsync' has already been declared
      at wrapSafe (node:internal/modules/cjs/loader:1713:18)
      at checkSyntax (node:internal/main/check_syntax:78:3)

  Node.js v22.23.2
  ```
- **Context**: Line 529 declares `const execFileAsync = util.promisify(execFileCb);` for `terminateProcessTree`. However, line 2019 in the same file already had `const execFileAsync = promisify(execFile);` at top-level module scope. In CommonJS, duplicate top-level `const` declarations trigger a fatal `SyntaxError`. As a result, the standalone node-agent daemon fails to start up on real compute nodes. The mock `test-server.ts` concealed this defect because it stubs node-agent HTTP endpoints in-memory without loading `services/node-agent/src/index.js`.

#### Defect 2: Container Root Mount Bypass in `apps/api/src/routes/volumes.ts`
- **File**: `apps/api/src/routes/volumes.ts`
- **Lines**: Lines 43-51, 69-72
- **Command**: `POST /api/deployments/:id/volumes` with `{ containerPath: '/' }` or `{ containerPath: '//' }`
- **Verbatim Result**:
  ```json
  HTTP 201 Created
  {
    "ok": true,
    "volume": {
      "id": "new1",
      "deploymentId": "dep_adv_vol_001",
      "name": "vol-sys-path",
      "hostPath": "/var/lib/shanutechx/volumes/dep_adv_vol_001/vol-sys-path",
      "containerPath": "/",
      "sizeGb": 5
    }
  }
  ```
- **Context**: In `apps/api/src/routes/volumes.ts`, line 69 normalizes the path with `const normalizedContainerPath = containerPath.replace(/\/+$/, '');`. For `containerPath: '/'`, this expression strips all trailing slashes and evaluates to `""` (empty string). `FORBIDDEN_CONTAINER_PATHS.has("")` evaluates to `false`. Consequently, attaching a persistent volume to container root `'/'` completely bypasses protection, permitting a user to mount over the container's root filesystem. Furthermore, `FORBIDDEN_CONTAINER_PATHS.has()` performs an exact set match rather than a directory prefix match, which means dangerous paths like `/etc/shadow`, `/proc/kcore`, or `/dev/null` are not rejected at the API layer.

---

## 2. Logic Chain

1. *Node Agent Startup Integrity*:
   - The worker added `terminateProcessTree` into `services/node-agent/src/index.js` (lines 527-535) and declared `const execFileAsync = util.promisify(execFileCb);`.
   - Line 2019 of `services/node-agent/src/index.js` already contained `const execFileAsync = promisify(execFile);`.
   - Node.js prohibits re-declaring lexical bindings (`const`) in the same scope. Running `node -c services/node-agent/src/index.js` throws `SyntaxError: Identifier 'execFileAsync' has already been declared` and exits with code 1.
   - Any deployment environment running the node-agent as an independent service will crash on boot.

2. *Volume Mount Path Validation Integrity*:
   - The user request and security architecture demand that container mount paths cannot target system directories.
   - In `apps/api/src/routes/volumes.ts`, `FORBIDDEN_CONTAINER_PATHS` includes `'/'`.
   - However, `normalizedContainerPath = containerPath.replace(/\/+$/, '')` converts `'/'` to `""`.
   - Because `"" !== '/'` and `""` is not in `FORBIDDEN_CONTAINER_PATHS`, the request is treated as valid, returning HTTP 201 Created.
   - Additionally, subpaths like `/etc/passwd` or `/dev/null` are not in the exact Set, allowing subpaths to be mounted unless prefix matching is applied.

3. *Other Verified Features (Robust)*:
   - Volume path traversal with `..` is strictly rejected (HTTP 400).
   - Duplicate volume names on the same deployment return HTTP 409 Conflict.
   - Duplicate container mount paths on the same deployment return HTTP 409 Conflict.
   - Distinct deployments can reuse volume names and container mount paths without collision.
   - `POST /agent/deployments/:id/cancel-build` returns HTTP 404 with diagnostic details on absent builds and is fully idempotent.
   - `ActiveBuildSession` process tree kill (`taskkill /PID <pid> /T /F` on Windows) and cleanup of `.git/index.lock`, `HEAD.lock`, `Dockerfile`, and `nixpacks.toml` are functional.

---

## 3. Caveats

- `tests/e2e/tier1-features/m2-container-build.test.ts` and `tests/e2e/tier3-interactions/volume-container-persistence.test.ts` pass 100% because the test harness in `test-server.ts` uses in-memory stubs for `/agent/volumes` and `/agent/deployments/:id/cancel-build`, which masks the syntax error in `services/node-agent/src/index.js`.
- The adversarial harness `tests/unit/m2-adversarial-challenger.test.ts` was written in `tests/unit/` (in compliance with layout rules) and directly exposes both defects.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

Milestone 2 cannot be approved in its current state due to two blocking issues:
1. **Critical Syntax Error**: `services/node-agent/src/index.js:2019` has a duplicate identifier `execFileAsync`, preventing the node agent daemon from starting.
2. **Security Vulnerability**: `apps/api/src/routes/volumes.ts:69` strips `'/'` to `""`, bypassing system directory checks and allowing volume mounts to overwrite container root `'/'`.

### Actionable Remediation Required:
1. In `services/node-agent/src/index.js`: Remove the redundant `const execFileAsync = promisify(execFile);` at line 2019 (or reuse the binding declared at line 529).
2. In `apps/api/src/routes/volumes.ts`: Handle `'/'` properly when normalizing (e.g., `const normalizedContainerPath = containerPath === '/' ? '/' : containerPath.replace(/\/+$/, '');`) and check that `normalizedContainerPath` is neither `'/'` nor within system directories (`p !== '/' && (normalizedContainerPath === p || normalizedContainerPath.startsWith(p + '/'))`).

---

## 5. Verification Method

To independently verify the defects and remediation, run:

```bash
# 1. Verify SyntaxError in node-agent
node -c services/node-agent/src/index.js

# 2. Run the empirical adversarial challenger test suite
npx tsx --test tests/unit/m2-adversarial-challenger.test.ts

# 3. Verify Tier 1 and Tier 3 suites
npx tsx --test tests/e2e/tier1-features/m2-container-build.test.ts
npx tsx --test tests/e2e/tier3-interactions/volume-container-persistence.test.ts
```
Invalidation condition: When both `node -c services/node-agent/src/index.js` exits 0 and `npx tsx --test tests/unit/m2-adversarial-challenger.test.ts` passes 100% (13/13 tests), this challenge is resolved.
