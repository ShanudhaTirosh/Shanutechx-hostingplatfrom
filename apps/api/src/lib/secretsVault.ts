import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Encrypts a secret (SMTP password, LiveKit API secret, VPS panel password)
 * into a single self-contained string: base64(iv):base64(authTag):base64(ciphertext).
 * Decryptable only with SECRETS_ENCRYPTION_KEY, which never touches the
 * database — it lives in the API's environment only.
 *
 * This is what every "credentialRef" / "apiSecretRef" column in the schema
 * actually stores: not a vault lookup key (a real deployment might use
 * HashiCorp Vault or AWS Secrets Manager instead), just this encrypted blob.
 * Swapping in a real vault later means changing this one module, not every
 * caller.
 */
function getCipherKey(masterKey: string): Buffer {
  if (typeof masterKey === 'string' && /^[0-9a-fA-F]{64}$/.test(masterKey)) {
    return Buffer.from(masterKey, 'hex');
  }
  return crypto.createHash('sha256').update(String(masterKey)).digest();
}

export function encryptSecret(plaintext: string, masterKeyHex: string): string {
  const key = getCipherKey(masterKeyHex);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    ':'
  );
}

export function decryptSecret(encrypted: string, masterKeyHex: string): string {
  const key = getCipherKey(masterKeyHex);
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(':');

  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Malformed encrypted secret');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf-8');
}
