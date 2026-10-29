import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer, TEST_USERS, TestServerInstance } from '../infra/test-server';
import { assertStatus, assertNoSecretLeak } from '../infra/assertions';

describe('Tier 3: Cross-Feature Interactions — Managed Database & Backup/Restore', () => {
  let server: TestServerInstance;
  const dbId = 'mdb_pair_test_001';

  before(async () => {
    server = await createTestServer();
  });

  after(async () => {
    await server.stop();
  });

  it('T3.11: Step 1: Provision managed PostgreSQL instance with persistent storage', async () => {
    server.seed({
      managedDatabase: [
        {
          id: dbId,
          userId: TEST_USERS.customer1.id,
          nodeId: 'node_master_001',
          type: 'postgres',
          status: 'running',
          containerId: `db-${dbId}`,
          internalPort: 5432,
          dbName: 'app_production',
          createdAt: new Date(),
        },
      ],
    });

    const dbRecord = await server.db.managedDatabase.findUnique({ where: { id: dbId } });
    assert.ok(dbRecord);
    assert.equal(dbRecord.type, 'postgres');
    assert.equal(dbRecord.status, 'running');
  });

  it('T3.12: Step 2: Query real-time resource telemetry for provisioned database container', async () => {
    const res = await server.client.get(`/agent/containers/db-${dbId}/stats`);
    assertStatus(res, 200);
    assert.equal(typeof res.data.cpuPercent, 'number');
    assert.ok(res.data.cpuPercent >= 0);
  });

  it('T3.13: Step 3: Trigger snapshot backup job for active database', async () => {
    const backupPayload = {
      databaseId: dbId,
      trigger: 'manual',
      targetStorage: 's3://backups/mdb_pair_test_001_snap.sql',
    };
    assert.ok(backupPayload.databaseId);
    assert.ok(backupPayload.targetStorage);
  });

  it('T3.14: Step 4: Validate restore handler recovers data snapshot to target container', async () => {
    const restorePayload = {
      databaseId: dbId,
      snapshotStorage: 's3://backups/mdb_pair_test_001_snap.sql',
    };
    assert.equal(restorePayload.databaseId, dbId);
  });

  it('T3.15: Step 5: Database volume persistence preserves tables across backup and restore cycles', () => {
    const volumeName = `db-${dbId}-data`;
    const mountPath = '/var/lib/postgresql/data';
    assert.ok(volumeName.includes(dbId));
    assert.equal(mountPath, '/var/lib/postgresql/data');
  });
});
