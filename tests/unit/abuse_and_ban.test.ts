import test from 'node:test';
import assert from 'node:assert/strict';
import { scanTextForAbuse } from '../../apps/api/src/lib/abuseDetector';

test('Automated Abuse Scanner Unit Suite', async (t) => {
  await t.test('flags crypto miner scripts and stratum protocols', () => {
    const res1 = scanTextForAbuse('npm start -- --url stratum+tcp://xmr.pool.com');
    assert.equal(res1.flagged, true);
    assert.equal(res1.reason, 'Unauthorized Cryptocurrency Mining Activity');

    const res2 = scanTextForAbuse('RUN ./xmrig -o pool.supportxmr.com:3333');
    assert.equal(res2.flagged, true);
    assert.equal(res2.reason, 'Unauthorized Cryptocurrency Mining Activity');
  });

  await t.test('flags DDoS tools and network attack scripts', () => {
    const res = scanTextForAbuse('python3 slowloris.py target.com');
    assert.equal(res.flagged, true);
    assert.equal(res.reason, 'Malicious DDoS / Network Scanning Tool');
  });

  await t.test('flags credential theft and malware scripts', () => {
    const res = scanTextForAbuse('git clone https://github.com/hacker/discord-token-grabber.git');
    assert.equal(res.flagged, true);
    assert.equal(res.reason, 'Malicious Credential Theft / Malware');
  });

  await t.test('allows legitimate hosting code and env vars', () => {
    const clean1 = scanTextForAbuse('NODE_ENV=production\nPORT=3000\nDATABASE_URL=postgresql://user:pass@localhost:5432/db');
    assert.equal(clean1.flagged, false);

    const clean2 = scanTextForAbuse('java -jar Lavalink.jar');
    assert.equal(clean2.flagged, false);
  });
});
