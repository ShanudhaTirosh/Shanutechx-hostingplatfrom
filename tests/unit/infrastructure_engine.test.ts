import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFakePrisma, mountRouter } from './helpers/routeStubs';

test('Infrastructure Engine: Cordon prevents scheduling, Uncordon restores node', async () => {
  const fakeNode = {
    id: 'node-test-1',
    label: 'vps-frankfurt-1',
    ip: '192.168.1.100',
    status: 'online',
    isDraining: false,
    maintenanceReason: null,
  };

  const f = makeFakePrisma({
    'node.findUnique': () => fakeNode,
    'node.update': (args: any) => ({ ...fakeNode, ...args.data }),
    'auditLog.create': () => ({}),
  });

  const s = await mountRouter('nodes', 'nodesRouter', f.prisma);
  try {
    // 1. Cordon the node
    const cordonRes = await s.call('POST', '/nodes/node-test-1/cordon', {
      user: 'admin1',
      role: 'admin',
      body: { reason: 'Upgrading kernel packages' },
    });

    assert.equal(cordonRes.status, 200);
    assert.equal(cordonRes.json.ok, true);
    assert.equal(cordonRes.json.node.isDraining, true);
    assert.equal(cordonRes.json.node.status, 'maintenance');

    // 2. Uncordon the node
    const uncordonRes = await s.call('POST', '/nodes/node-test-1/uncordon', {
      user: 'admin1',
      role: 'admin',
    });

    assert.equal(uncordonRes.status, 200);
    assert.equal(uncordonRes.json.ok, true);
    assert.equal(uncordonRes.json.node.isDraining, false);
    assert.equal(uncordonRes.json.node.status, 'online');
  } finally {
    s.close();
  }
});

test('Infrastructure Engine: Node deletion is blocked when active customer deployments exist', async () => {
  const fakeNode = {
    id: 'node-with-workloads',
    label: 'vps-singapore-1',
    ip: '192.168.1.101',
    status: 'online',
  };

  const f = makeFakePrisma({
    'node.findUnique': () => fakeNode,
    'deployment.count': () => 2,
    'managedDatabase.count': () => 1,
    'supabaseClientProject.count': () => 0,
    'auditLog.create': () => ({}),
  });

  const s = await mountRouter('nodes', 'nodesRouter', f.prisma);
  try {
    const delRes = await s.call('DELETE', '/nodes/node-with-workloads', {
      user: 'admin1',
      role: 'admin',
    });

    assert.equal(delRes.status, 409);
    assert.equal(delRes.json.error.includes('Cannot delete node with 3 active customer services'), true);
    assert.equal(f.count('node.delete'), 0);
  } finally {
    s.close();
  }
});

test('Infrastructure Engine: Node with zero workloads can be deleted safely', async () => {
  const emptyNode = {
    id: 'node-empty-1',
    label: 'vps-empty',
    ip: '192.168.1.102',
    status: 'offline',
  };

  const f = makeFakePrisma({
    'node.findUnique': () => emptyNode,
    'deployment.count': () => 0,
    'managedDatabase.count': () => 0,
    'supabaseClientProject.count': () => 0,
    'node.delete': () => emptyNode,
    'auditLog.create': () => ({}),
  });

  const s = await mountRouter('nodes', 'nodesRouter', f.prisma);
  try {
    const delRes = await s.call('DELETE', '/nodes/node-empty-1', {
      user: 'admin1',
      role: 'admin',
    });

    assert.equal(delRes.status, 200);
    assert.equal(delRes.json.ok, true);
    assert.equal(f.count('node.delete'), 1);
  } finally {
    s.close();
  }
});

test('Infrastructure Engine: Customers are forbidden from cordoning nodes', async () => {
  const fakeNode = {
    id: 'node-test-1',
    label: 'vps-frankfurt-1',
    ip: '192.168.1.100',
    status: 'online',
    isDraining: false,
  };

  const f = makeFakePrisma({
    'node.findUnique': () => fakeNode,
  });

  const s = await mountRouter('nodes', 'nodesRouter', f.prisma);
  try {
    const cordonRes = await s.call('POST', '/nodes/node-test-1/cordon', {
      user: 'customer123',
      role: 'customer',
      body: { reason: 'Unauthorized attempt' },
    });

    assert.equal(cordonRes.status, 403);
    assert.equal(cordonRes.json.error, 'Forbidden');
  } finally {
    s.close();
  }
});

test('Infrastructure Engine: Customers are forbidden from deleting nodes', async () => {
  const f = makeFakePrisma({});
  const s = await mountRouter('nodes', 'nodesRouter', f.prisma);
  try {
    const delRes = await s.call('DELETE', '/nodes/node-test-1', {
      user: 'customer123',
      role: 'customer',
    });

    assert.equal(delRes.status, 403);
    assert.equal(delRes.json.error.includes('Only administrators'), true);
  } finally {
    s.close();
  }
});

test('Infrastructure Engine: Jobs API scopes customer queries to their own user ID', async () => {
  const f = makeFakePrisma({
    'infrastructureJob.findMany': (args: any) => {
      // Validate customer scoping
      assert.equal(args.where.userId, 'customer123');
      return [];
    },
    'infrastructureJob.count': (args: any) => {
      assert.equal(args.where.userId, 'customer123');
      return 0;
    },
  });

  const s = await mountRouter('jobs', 'jobsRouter', f.prisma);
  try {
    const res = await s.call('GET', '/jobs', {
      user: 'customer123',
      role: 'customer',
    });

    assert.equal(res.status, 200);
    assert.deepEqual(res.json.jobs, []);
  } finally {
    s.close();
  }
});

test('Infrastructure Engine: Staff queries are not restricted to a single user ID', async () => {
  const f = makeFakePrisma({
    'infrastructureJob.findMany': (args: any) => {
      assert.equal(args.where.userId, undefined);
      return [{ id: 'job-cluster-1', type: 'node_enroll', status: 'completed' }];
    },
    'infrastructureJob.count': () => 1,
  });

  const s = await mountRouter('jobs', 'jobsRouter', f.prisma);
  try {
    const res = await s.call('GET', '/jobs', {
      user: 'admin1',
      role: 'admin',
    });

    assert.equal(res.status, 200);
    assert.equal(res.json.total, 1);
    assert.equal(res.json.jobs[0].id, 'job-cluster-1');
  } finally {
    s.close();
  }
});
