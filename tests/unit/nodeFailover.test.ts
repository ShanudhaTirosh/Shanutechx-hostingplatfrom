import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isNodeOffline,
  calculateNodeCapacityScore,
  selectBestTargetNode,
  NodeCandidateInput,
} from '../../apps/api/src/lib/failoverRules';

const MINUTE = 60 * 1000;

describe('isNodeOffline', () => {
  it('returns true if node has never reported lastSeenAt', () => {
    assert.equal(isNodeOffline(null), true);
  });

  it('returns false if heartbeat is recent (1 minute ago)', () => {
    const now = new Date('2026-09-06T12:00:00Z').getTime();
    const lastSeen = new Date(now - 1 * MINUTE);
    assert.equal(isNodeOffline(lastSeen, now), false);
  });

  it('returns true if heartbeat exceeds 2.5 minute threshold (3 minutes ago)', () => {
    const now = new Date('2026-09-06T12:00:00Z').getTime();
    const lastSeen = new Date(now - 3 * MINUTE);
    assert.equal(isNodeOffline(lastSeen, now), true);
  });
});

describe('calculateNodeCapacityScore', () => {
  it('returns -Infinity if node is inactive', () => {
    const node: NodeCandidateInput = {
      id: 'node-1',
      label: 'Node 1',
      isActive: false,
      cpuUsedPct: 10,
      ramUsedMb: 500,
      ramMb: 4096,
      lastSeenAt: new Date(),
      roleTags: ['web-hosting'],
    };
    assert.equal(calculateNodeCapacityScore(node), -Infinity);
  });

  it('scores node higher when CPU and RAM utilization are low', () => {
    const now = Date.now();
    const nodeA: NodeCandidateInput = {
      id: 'node-a',
      label: 'Node A',
      isActive: true,
      cpuUsedPct: 20,
      ramUsedMb: 1024,
      ramMb: 4096,
      lastSeenAt: new Date(now),
      roleTags: ['web-hosting'],
    };
    const nodeB: NodeCandidateInput = {
      id: 'node-b',
      label: 'Node B',
      isActive: true,
      cpuUsedPct: 80,
      ramUsedMb: 3500,
      ramMb: 4096,
      lastSeenAt: new Date(now),
      roleTags: ['web-hosting'],
    };

    const scoreA = calculateNodeCapacityScore(nodeA, now);
    const scoreB = calculateNodeCapacityScore(nodeB, now);
    assert.ok(scoreA > scoreB, 'Node A with more headroom should score higher than Node B');
  });
});

describe('selectBestTargetNode', () => {
  it('excludes dead node and picks best healthy candidate matching required tag', () => {
    const now = Date.now();
    const candidates: NodeCandidateInput[] = [
      {
        id: 'dead-node',
        label: 'Dead Node',
        isActive: false,
        cpuUsedPct: 10,
        ramUsedMb: 500,
        ramMb: 4096,
        lastSeenAt: new Date(now - 10 * MINUTE),
        roleTags: ['web-hosting'],
      },
      {
        id: 'target-node-1',
        label: 'Target Node 1',
        isActive: true,
        cpuUsedPct: 50,
        ramUsedMb: 2048,
        ramMb: 4096,
        lastSeenAt: new Date(now),
        roleTags: ['web-hosting'],
      },
      {
        id: 'target-node-2',
        label: 'Target Node 2',
        isActive: true,
        cpuUsedPct: 10,
        ramUsedMb: 512,
        ramMb: 4096,
        lastSeenAt: new Date(now),
        roleTags: ['web-hosting'],
      },
    ];

    const selected = selectBestTargetNode(candidates, 'web-hosting', 'dead-node', now);
    assert.ok(selected !== null);
    assert.equal(selected.id, 'target-node-2', 'Should pick target-node-2 with highest available headroom');
  });

  it('returns null if no active node carries required tag', () => {
    const now = Date.now();
    const candidates: NodeCandidateInput[] = [
      {
        id: 'node-1',
        label: 'Node 1',
        isActive: true,
        cpuUsedPct: 10,
        ramUsedMb: 500,
        ramMb: 4096,
        lastSeenAt: new Date(now),
        roleTags: ['web-hosting'],
      },
    ];

    const selected = selectBestTargetNode(candidates, 'database-hosting', 'node-1', now);
    assert.equal(selected, null);
  });
});
