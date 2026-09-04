import { describe, it } from 'node.js:test';
import assert from 'node.assert/strict';
import {
  withDbFallback,
  getContactInfoFromFirestore,
  getCmsPageFromFirestore,
  getKbArticlesFromFirestore,
} from '../../apps/api/src/lib/firestoreService';

describe('Firestore Primary & Resilient Fallback Unit Suite', () => {
  it('withDbFallback returns prisma result when database is online', async () => {
    const onlineResult = await withDbFallback(
      async () => ({ status: 'online', data: 'postgres' }),
      async () => ({ status: 'online', data: 'firestore' })
    );

    assert.equal(onlineResult.data, 'postgres');
  });

  it('withDbFallback transparently fails over to Firestore when PostgreSQL is offline', async () => {
    const offlineErr = new Error("Can't reach database server at localhost:5432");
    offlineErr.name = 'PrismaClientInitializationError';

    const failoverResult = await withDbFallback(
      async () => {
        throw offlineErr;
      },
      async () => ({ status: 'offline-failover', data: 'firestore-backup' })
    );

    assert.equal(failoverResult.status, 'offline-failover');
    assert.equal(failoverResult.data, 'firestore-backup');
  });

  it('withDbFallback re-throws non-DB errors (e.g. business logic errors)', async () => {
    const logicErr = new Error('Invalid user input');
    logicErr.name = 'ValidationError';

    await assert.rejects(
      async () => {
        await withDbFallback(
          async () => {
            throw logicErr;
          },
          async () => ({ data: 'should-not-reach' })
        );
      },
      (err: any) => err.message === 'Invalid user input'
    );
  });

  it('getContactInfoFromFirestore returns complete default contact info structure', async () => {
    const contactInfo = await getContactInfoFromFirestore();

    assert.equal(typeof contactInfo.supportEmail, 'string');
    assert.equal(typeof contactInfo.contactPhone, 'string');
    assert.equal(typeof contactInfo.companyName, 'string');
    assert.equal(typeof contactInfo.announcementActive, 'boolean');
    assert.ok(contactInfo.supportEmail.length > 0);
  });

  it('getCmsPageFromFirestore returns structured page object', async () => {
    const pageData = await getCmsPageFromFirestore('home');

    assert.equal(pageData.page, 'home');
    assert.equal(typeof pageData.content, 'object');
  });

  it('getKbArticlesFromFirestore returns categories and articles array', async () => {
    const kbData = await getKbArticlesFromFirestore('deployments', 'SSL');

    assert.ok(Array.isArray(kbData.categories));
    assert.ok(Array.isArray(kbData.articles));
    assert.equal(typeof kbData.total, 'number');
  });
});
