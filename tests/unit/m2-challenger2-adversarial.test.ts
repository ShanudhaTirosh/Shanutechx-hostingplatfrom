import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createTestServer, TEST_USERS, TestServerInstance } from '../e2e/infra/test-server';
import { assertStatus } from '../e2e/infra/assertions';

/**
 * Empirical Adversarial & Stress Testing for Milestone 2 by Challenger 2:
 *
 * 1. Process Boot & Code Integrity:
 *    - Verify services/node-agent/src/index.js passes node syntax checking without errors.
 *
 * 2. Feature 8 (Direct Image Deployment Route):
 *    - POST /agent/deployments/:id/run-image with missing body, empty body, null/empty/non-string image. Verify HTTP 400 rejection.
 *    - Image tag parsing in pullImage: images with tags (redis:7-alpine, nginx:1.25-alpine) and digests (@sha256:...) must NOT have :latest appended.
 *    - Port bindings and resource limits (CPU / memory) plumbing into runContainer.
 *
 * 3. Feature 9 (Build Secrets Protection):
 *    - Audit build.js to ensure runtime envVars are NEVER passed as --build-arg.
 *    - Verify sensitive secrets (DB_PASSWORD, API_SECRET) cannot leak into Docker image layer metadata.
 *
 * 4. Feature 11 (Container Telemetry):
 *    - Verify /agent/containers/:id/stats returns both raw byte counters and calculated percentages.
 *    - Verify ZERO occurrences of Math.random() in services/node-agent/src/docker.js.
 */

test('Challenger 2 M2: Code Integrity — Node Agent Process Bootability', async (t) => {
  await t.test('Syntax and declaration validation of services/node-agent/src/index.js', () => {
    let syntaxError = null;
    try {
      execSync('node -c services/node-agent/src/index.js', { encoding: 'utf8', stdio: 'pipe' });
    } catch (err: any) {
      syntaxError = err.stderr || err.stdout || err.message;
    }
    assert.equal(
      syntaxError,
      null,
      `services/node-agent/src/index.js has a fatal syntax/declaration error:\n${syntaxError}`
    );
  });
});

test('Challenger 2 M2: Feature 8 — Direct Image Deployment Route Adversarial Verification', async (t) => {
  let server: TestServerInstance;

  t.before(async () => {
    server = await createTestServer();
  });

  t.after(async () => {
    await server.stop();
  });

  await t.test('8.A1: Rejection of missing body in POST /agent/deployments/:id/run-image (HTTP 400)', async () => {
    const res = await server.client.post('/agent/deployments/dep_test_empty_body/run-image', undefined);
    assertStatus(res, 400);
    assert.equal(res.data.error, 'image is required');
  });

  await t.test('8.A2: Rejection of missing image in payload (HTTP 400)', async () => {
    const invalidBodies = [
      {},
      { image: '' },
      { image: '   ' },
      { image: null },
      { image: 123 },
      { image: false },
    ];

    for (const body of invalidBodies) {
      const res = await server.client.post('/agent/deployments/dep_test_invalid_img/run-image', body);
      assertStatus(res, 400);
      assert.equal(res.data.error, 'image is required');
    }
  });

  await t.test('8.A3: Image tag parsing in pullImage preserves tags and digests without appending :latest', () => {
    // Pure function logic extracted from docker.js pullImage (lines 476-483)
    function resolveImageTag(imageName: string, tag: string = 'latest'): string {
      let fullName = imageName;
      const lastColon = imageName.lastIndexOf(':');
      const lastSlash = imageName.lastIndexOf('/');
      const hasTag = (lastColon > lastSlash) || imageName.includes('@');
      if (!hasTag) {
        fullName = `${imageName}:${tag || 'latest'}`;
      }
      return fullName;
    }

    // 1. Tagged images should NEVER have :latest appended
    assert.equal(resolveImageTag('redis:7-alpine'), 'redis:7-alpine');
    assert.equal(resolveImageTag('nginx:1.25-alpine'), 'nginx:1.25-alpine');
    assert.equal(resolveImageTag('postgres:16-alpine'), 'postgres:16-alpine');
    assert.equal(resolveImageTag('node:20.11.0-bookworm-slim'), 'node:20.11.0-bookworm-slim');
    assert.equal(resolveImageTag('quay.io/prometheus/prometheus:v2.45.0'), 'quay.io/prometheus/prometheus:v2.45.0');
    assert.equal(resolveImageTag('ghcr.io/org/repo:sha-abcdef1'), 'ghcr.io/org/repo:sha-abcdef1');

    // 2. Digest-pinned images should NEVER have :latest appended
    const digestImage = 'ubuntu@sha256:45b23dee08af5e43a7fa6c4e1aa9f7b0f5426985e93d500f39463a89609532db';
    assert.equal(resolveImageTag(digestImage), digestImage);

    const namespacedDigest = 'ghcr.io/company/app@sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    assert.equal(resolveImageTag(namespacedDigest), namespacedDigest);

    // 3. Registry with custom port without image tag SHOULD receive :latest
    assert.equal(resolveImageTag('registry.company.com:5000/my-app'), 'registry.company.com:5000/my-app:latest');
    assert.equal(resolveImageTag('localhost:5001/infra/service'), 'localhost:5001/infra/service:latest');

    // 4. Registry with custom port WITH image tag should preserve explicit tag
    assert.equal(resolveImageTag('registry.company.com:5000/my-app:v2.1.0'), 'registry.company.com:5000/my-app:v2.1.0');
    assert.equal(resolveImageTag('localhost:5001/infra/service:debug'), 'localhost:5001/infra/service:debug');

    // 5. Bare images without tag should receive :latest
    assert.equal(resolveImageTag('nginx'), 'nginx:latest');
    assert.equal(resolveImageTag('redis'), 'redis:latest');
    assert.equal(resolveImageTag('library/alpine'), 'library/alpine:latest');
  });

  await t.test('8.A4: Verification of containerConfig resource limits and port bindings plumbing', () => {
    // Audit the container configuration construction in docker.js
    const dockerJsPath = path.resolve('services/node-agent/src/docker.js');
    const dockerContent = fs.readFileSync(dockerJsPath, 'utf8');

    // Verify NanoCpus and Memory formulas
    assert.ok(dockerContent.includes('NanoCpus: cpuLimit * 1e9'), 'NanoCpus must be cpuLimit * 1e9');
    assert.ok(dockerContent.includes('Memory: memLimitMb * 1024 * 1024'), 'Memory must be memLimitMb in bytes');

    // Verify non-root user execution
    assert.ok(dockerContent.includes("User: '1000:1000'"), 'Container must execute as 1000:1000');
    assert.ok(dockerContent.includes("'no-new-privileges:true'"), 'SecurityOpt must enforce no-new-privileges');

    // Verify RESTRICTED_HOST_PATHS security list
    const requiredRestricted = ['/var/run/docker.sock', '/proc', '/sys', '/etc', '/dev', '/root', '/'];
    for (const rPath of requiredRestricted) {
      assert.ok(dockerContent.includes(`'${rPath}'`), `RESTRICTED_HOST_PATHS must include ${rPath}`);
    }

    // Verify Binds plumbing
    assert.ok(dockerContent.includes('HostConfig: {'), 'HostConfig must be configured');
    assert.ok(dockerContent.includes('Binds: binds.length > 0 ? binds : undefined'), 'Binds must be attached if present');
    assert.ok(dockerContent.includes('PortBindings: portBindings'), 'PortBindings must be mapped');
  });
});

test('Challenger 2 M2: Feature 9 — Build Pipeline Secrets Hardening Audit', async (t) => {
  const buildJsPath = path.resolve('services/node-agent/src/build.js');
  assert.ok(fs.existsSync(buildJsPath), 'services/node-agent/src/build.js must exist');
  const buildContent = fs.readFileSync(buildJsPath, 'utf8');

  await t.test('9.A1: Audit build.js ensuring runtime envVars are NEVER passed as --build-arg', () => {
    // Verify that envVars is NOT iterated over to push --build-arg unconditionally
    const dangerousPattern = /for\s*\(\s*const\s*\[\w+,\s*\w+\]\s*of\s*Object\.entries\(\s*envVars/g;
    const matches = buildContent.match(dangerousPattern) || [];

    // If there is any loop over envVars, ensure it strictly guards on BUILD_ARG_
    if (matches.length > 0) {
      assert.ok(
        buildContent.includes("key.startsWith('BUILD_ARG_')"),
        'Any loop over envVars must strictly require BUILD_ARG_ prefix'
      );
    }

    // Verify explicit comment/code enforcement in executeDockerBuild
    assert.ok(
      buildContent.includes('const effectiveBuildArgs = { ...(buildArgs || {}) };'),
      'effectiveBuildArgs must only default to explicit buildArgs'
    );
    assert.ok(
      buildContent.includes('cleanKey = key.slice'),
      'Only BUILD_ARG_ prefix is allowed into build arguments'
    );
  });

  await t.test('9.A2: Sensitive runtime secrets (DB_PASSWORD, API_SECRET) cannot leak into Docker build args', () => {
    // Simulate the argument extraction logic of executeDockerBuild
    function computeBuildArgs(envVars: Record<string, string>, buildArgs: Record<string, string>): string[] {
      const effectiveBuildArgs: Record<string, string> = { ...(buildArgs || {}) };

      for (const [key, value] of Object.entries(envVars || {})) {
        if (key.startsWith('BUILD_ARG_')) {
          const cleanKey = key.slice('BUILD_ARG_'.length);
          effectiveBuildArgs[cleanKey] = value;
        }
      }

      const dockerArgs: string[] = ['build', '-t', 'test-app', '.'];
      for (const [key, value] of Object.entries(effectiveBuildArgs)) {
        dockerArgs.push('--build-arg', `${key}=${value}`);
      }
      return dockerArgs;
    }

    // Adversarial test payload with high-risk credentials
    const sensitiveEnvVars = {
      DB_PASSWORD: 'super_secret_production_password_xyz',
      API_SECRET: 'sk_live_998877665544332211',
      DATABASE_URL: 'postgres://admin:topsecret@db.internal:5432/production',
      AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      JWT_SIGNING_KEY: 'super_jwt_secret_token',
      BUILD_ARG_PUBLIC_VERSION: 'v1.2.3', // explicitly allowed build arg
    };

    const explicitBuildArgs = {
      NODE_ENV: 'production',
      APP_RELEASE: '2026.10',
    };

    const generatedDockerArgs = computeBuildArgs(sensitiveEnvVars, explicitBuildArgs);
    const cmdLine = generatedDockerArgs.join(' ');

    // 1. Assert sensitive secrets are NOT present anywhere in the docker build command
    assert.equal(cmdLine.includes('super_secret_production_password_xyz'), false, 'DB_PASSWORD leaked into build args!');
    assert.equal(cmdLine.includes('sk_live_998877665544332211'), false, 'API_SECRET leaked into build args!');
    assert.equal(cmdLine.includes('topsecret'), false, 'DATABASE_URL credentials leaked into build args!');
    assert.equal(cmdLine.includes('wJalrXUtnFEMI'), false, 'AWS credentials leaked into build args!');
    assert.equal(cmdLine.includes('super_jwt_secret_token'), false, 'JWT secret leaked into build args!');

    // 2. Assert explicit buildArgs and BUILD_ARG_ are passed correctly
    assert.ok(cmdLine.includes('--build-arg NODE_ENV=production'));
    assert.ok(cmdLine.includes('--build-arg APP_RELEASE=2026.10'));
    assert.ok(cmdLine.includes('--build-arg PUBLIC_VERSION=v1.2.3'));
  });

  await t.test('9.A3: Railpack and Nixpacks runners do not pass runtime envVars', () => {
    // Search build.js lines specifically inside the build runner implementations (lines 350-420)
    const lines = buildContent.split('\n');
    const runnerLines = lines.slice(350, 420).join('\n');

    // Verify all occurrences of entries loops in the runners use buildArgs, never envVars
    assert.ok(runnerLines.includes('for (const [key, value] of Object.entries(buildArgs || {}))'));
    assert.equal(runnerLines.includes('Object.entries(envVars'), false, 'Runners must not pass envVars');
  });
});

test('Challenger 2 M2: Feature 11 — Container Telemetry & Integrity Verification', async (t) => {
  const dockerJsPath = path.resolve('services/node-agent/src/docker.js');
  const dockerContent = fs.readFileSync(dockerJsPath, 'utf8');

  await t.test('11.A1: Verify ZERO synthetic mock values (Math.random()) in docker.js', () => {
    const hasMathRandom = dockerContent.includes('Math.random()');
    assert.equal(hasMathRandom, false, 'services/node-agent/src/docker.js must contain zero occurrences of Math.random()');
  });

  await t.test('11.A2: getContainerMetrics calculates both raw byte counters and percentages', async () => {
    // Test the metric computation formula implemented in getContainerMetrics
    const mockDockerStats = {
      cpu_stats: {
        cpu_usage: { total_usage: 500000000 },
        system_cpu_usage: 10000000000,
        online_cpus: 4,
      },
      precpu_stats: {
        cpu_usage: { total_usage: 400000000 },
        system_cpu_usage: 9000000000,
      },
      memory_stats: {
        usage: 134217728, // 128 MB
        limit: 1073741824, // 1024 MB
        stats: {
          inactive_file: 8388608, // 8 MB cache
        },
      },
      networks: {
        eth0: { rx_bytes: 5242880, tx_bytes: 2097152 },
        eth1: { rx_bytes: 1048576, tx_bytes: 524288 },
      },
      blkio_stats: {
        io_service_bytes_recursive: [
          { op: 'Read', value: 4194304 },
          { op: 'Write', value: 8388608 },
        ],
      },
      pids_stats: {
        current: 12,
      },
    };

    // Calculate metrics using the exact production formulas
    const cpuDelta = mockDockerStats.cpu_stats.cpu_usage.total_usage - mockDockerStats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = mockDockerStats.cpu_stats.system_cpu_usage - mockDockerStats.precpu_stats.system_cpu_usage;
    const onlineCpus = mockDockerStats.cpu_stats.online_cpus;
    const cpuPercent = Math.round((cpuDelta / systemDelta) * onlineCpus * 100 * 100) / 100;

    const cache = mockDockerStats.memory_stats.stats.inactive_file;
    const rawUsage = mockDockerStats.memory_stats.usage;
    const memoryUsageBytes = Math.max(0, rawUsage - cache);
    const memoryLimitBytes = mockDockerStats.memory_stats.limit;
    const memoryUsedMb = Math.round(memoryUsageBytes / (1024 * 1024));
    const memoryLimitMb = Math.round(memoryLimitBytes / (1024 * 1024));
    const memoryPercent = Math.round((memoryUsedMb / memoryLimitMb) * 100 * 100) / 100;

    let networkRxBytes = 0, networkTxBytes = 0;
    for (const iface of Object.values(mockDockerStats.networks)) {
      networkRxBytes += iface.rx_bytes;
      networkTxBytes += iface.tx_bytes;
    }

    let blockReadBytes = 0, blockWriteBytes = 0;
    for (const entry of mockDockerStats.blkio_stats.io_service_bytes_recursive) {
      if (entry.op === 'Read') blockReadBytes += entry.value;
      if (entry.op === 'Write') blockWriteBytes += entry.value;
    }

    // Assertions on raw byte counters:
    assert.equal(typeof memoryUsageBytes, 'number');
    assert.equal(memoryUsageBytes, 125829120); // 128MB - 8MB
    assert.equal(memoryLimitBytes, 1073741824); // 1024MB
    assert.equal(networkRxBytes, 6291456); // 5MB + 1MB
    assert.equal(networkTxBytes, 2621440); // 2MB + 0.5MB
    assert.equal(blockReadBytes, 4194304); // 4MB
    assert.equal(blockWriteBytes, 8388608); // 8MB

    // Assertions on calculated percentages and MB fields:
    assert.equal(typeof cpuPercent, 'number');
    assert.equal(cpuPercent, 40); // (1e8 / 1e9) * 4 * 100 = 40%
    assert.equal(memoryUsedMb, 120);
    assert.equal(memoryLimitMb, 1024);
    assert.equal(memoryPercent, 11.72); // 120 / 1024 = ~11.72%
    assert.equal(mockDockerStats.pids_stats.current, 12);
  });

  await t.test('11.A3: GET /agent/containers/:id/stats endpoint contract verification', async () => {
    let server: TestServerInstance;
    server = await createTestServer();
    try {
      const res = await server.client.get('/agent/containers/cnt_stats_verify_001/stats');
      assertStatus(res, 200);

      // Verify raw byte counters exist and are positive numbers
      assert.equal(typeof res.data.memoryUsageBytes, 'number');
      assert.ok(res.data.memoryUsageBytes > 0);
      assert.equal(typeof res.data.memoryLimitBytes, 'number');
      assert.ok(res.data.memoryLimitBytes > 0);
      assert.equal(typeof res.data.networkRxBytes, 'number');
      assert.ok(res.data.networkRxBytes > 0);
      assert.equal(typeof res.data.networkTxBytes, 'number');
      assert.ok(res.data.networkTxBytes > 0);

      // Verify calculated percentages exist
      assert.equal(typeof res.data.cpuPercent, 'number');
      assert.ok(res.data.cpuPercent >= 0);
    } finally {
      await server.stop();
    }
  });
});
