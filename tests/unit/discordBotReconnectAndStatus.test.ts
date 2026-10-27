import test from 'node:test';
import assert from 'node:assert/strict';
import { agentUrl } from '../../apps/api/src/lib/nodeAgentClient';

test('agentUrl works when given an object with an ip field', () => {
  const url = agentUrl({ ip: '1.2.3.4' } as any, '/agent/stats');
  assert.match(url, /^http:\/\/1\.2\.3\.4:\d+\/agent\/stats$/);
});

test('agentUrl works when given a plain IP string', () => {
  const url = agentUrl('5.6.7.8', '/agent/fs/test/cleanup');
  assert.match(url, /^http:\/\/5\.6\.7\.8:\d+\/agent\/fs\/test\/cleanup$/);
});

test('agentUrl routes 127.0.0.1 to localhost/test environment host dynamically', () => {
  const url = agentUrl('127.0.0.1', '/agent/health');
  assert.match(url, /^http:\/\/(127\.0\.0\.1|localhost|node-agent):\d+\/agent\/health$/);
});
