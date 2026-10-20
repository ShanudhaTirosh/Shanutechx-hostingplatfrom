import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFakePrisma, mountRouter } from './helpers/routeStubs';

const provision = () => ({
  id: 'v1',
  userId: 'u1',
  label: 'my-vps',
  host: '203.0.113.9',
  credentialRef: 'ENC-PASSWORD-CIPHERTEXT',
  sshPrivateKey: 'ENC-SSH-KEY-CIPHERTEXT',
  sshPublicKey: 'ssh-ed25519 AAAA-public',
  status: 'active',
});

test('VPS list/detail responses never include stored secret material (password or SSH key ciphertext)', async () => {
  const f = makeFakePrisma({
    'vpsProvision.findMany': () => [provision()],
    'vpsProvision.findUnique': provision,
    'vpsProvision.findFirst': provision,
  });
  const s = await mountRouter('vps', 'vpsRouter', f.prisma);
  try {
    for (const path of ['/vps-provisions', '/vps-provisions/v1']) {
      const r = await s.call('GET', path);
      assert.equal(r.status, 200, path);
      const body = JSON.stringify(r.json);
      assert.equal(body.includes('ENC-PASSWORD-CIPHERTEXT'), false, `${path} leaks credentialRef`);
      assert.equal(body.includes('ENC-SSH-KEY-CIPHERTEXT'), false, `${path} leaks sshPrivateKey`);
      assert.equal(body.includes('sshPrivateKey'), false, `${path} exposes the sshPrivateKey field`);
    }
  } finally { s.close(); }
});

test('VPS responses tell the client whether an SSH key is stored (hasSshKey) without revealing it', async () => {
  const f = makeFakePrisma({ 'vpsProvision.findMany': () => [provision(), { ...provision(), id: 'v2', sshPrivateKey: null }] });
  const s = await mountRouter('vps', 'vpsRouter', f.prisma);
  try {
    const r = await s.call('GET', '/vps-provisions');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.provisions.map((p: any) => p.hasSshKey), [true, false]);
  } finally { s.close(); }
});
