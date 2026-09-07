import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getWebmailClusterConfig,
  updateWebmailClusterConfig,
} from '../../apps/api/src/lib/webmailS3Storage';
import { encryptSecret, decryptSecret } from '../../apps/api/src/lib/secretsVault';

test('Webmail Admin & Dev Control Center S3 Storage Unit Suite', async (t) => {
  const dummyMasterKey = '32byte_master_secret_key_1234567890'; // 35 chars > 32 bytes

  await t.test('returns default unconfigured cluster state initially', () => {
    const config = getWebmailClusterConfig();
    assert.equal(config.mailNodeId || null, null);
    assert.equal(typeof config.s3BucketName, 'string');
    assert.equal(config.s3Region, 'auto');
    assert.equal(config.autoSyncAttachments, true);
  });

  await t.test('updates mail node assignment and S3 storage credentials with encryption', () => {
    const updated = updateWebmailClusterConfig({
      mailNodeId: 'node-vps-1',
      s3Endpoint: 'https://123456789.r2.cloudflarestorage.com',
      s3BucketName: 'shanutechx-attachments',
      s3Region: 'us-east-1',
      s3AccessKeyId: 'AKIA_TEST_KEY',
      s3SecretAccessKey: 'super_secret_s3_key_99',
      autoSyncAttachments: true,
    });

    assert.equal(updated.mailNodeId, 'node-vps-1');
    assert.equal(updated.s3Endpoint, 'https://123456789.r2.cloudflarestorage.com');
    assert.equal(updated.s3BucketName, 'shanutechx-attachments');
    assert.equal(updated.s3Region, 'us-east-1');
    assert.equal(updated.s3AccessKeyId, 'AKIA_TEST_KEY');
    assert.notEqual(updated.s3SecretAccessKeyEncrypted, null);
    assert.notEqual(updated.s3SecretAccessKeyEncrypted, 'super_secret_s3_key_99');

    const decryptedSecret = decryptSecret(updated.s3SecretAccessKeyEncrypted!, process.env.SECRETS_ENCRYPTION_KEY || 'default-dev-encryption-key-32b');
    assert.equal(decryptedSecret, 'super_secret_s3_key_99');
  });

  await t.test('preserves existing encrypted secret when updated without providing a new secret key', () => {
    const updatedSecond = updateWebmailClusterConfig({
      s3BucketName: 'shanutechx-attachments-renamed',
    });

    assert.equal(updatedSecond.s3BucketName, 'shanutechx-attachments-renamed');
    assert.equal(updatedSecond.s3AccessKeyId, 'AKIA_TEST_KEY');
    assert.notEqual(updatedSecond.s3SecretAccessKeyEncrypted, null);

    const decryptedSecret = decryptSecret(updatedSecond.s3SecretAccessKeyEncrypted!, process.env.SECRETS_ENCRYPTION_KEY || 'default-dev-encryption-key-32b');
    assert.equal(decryptedSecret, 'super_secret_s3_key_99');
  });

  await t.test('encrypts and decrypts secrets vault values accurately', () => {
    const testSecret = 'r2_secret_token_abc_123';
    const encrypted = encryptSecret(testSecret, dummyMasterKey);
    assert.notEqual(encrypted, testSecret);
    assert.equal(encrypted.includes(':'), true); // AES-256-GCM iv:authTag:cipher format

    const decrypted = decryptSecret(encrypted, dummyMasterKey);
    assert.equal(decrypted, testSecret);
  });
});
