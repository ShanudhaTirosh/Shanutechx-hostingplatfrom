import crypto from 'crypto';

/**
 * Server IP used to build SPF `ip4:` terms. Read strictly from env with NO
 * hardcoded fallback — if SERVER_IP is not configured we omit the ip4 term
 * (SPF can still validate via `mx` + include) rather than publishing a stale
 * third-party IP that would wrongly authorise mail for a server we no longer
 * own.
 */
export function getServerIp(): string {
  return (process.env.SERVER_IP || '').trim();
}

/**
 * Builds an SPF TXT value. Includes an `ip4:` term only when SERVER_IP is
 * configured; otherwise relies on `mx` + the platform include.
 */
export function buildSpfRecord(rootDomain: string): string {
  const ip = getServerIp();
  const ip4 = ip ? ` ip4:${ip}` : '';
  return `v=spf1 mx${ip4} include:_spf.${rootDomain} ~all`;
}

export interface DkimKeypair {
  publicKeyBase64: string; // ASN.1 DER (SPKI) base64, ready for the DNS 'p=' field
  privateKeyPem: string;   // PKCS#8 PEM, for the mail server to sign with
  selector: string;
}

/**
 * Generates a real RSA-2048 keypair for DKIM signing. The base64 public-key
 * form is exactly what the DKIM TXT record (`v=DKIM1; k=rsa; p=...`) expects.
 */
export function generateDkimKeypair(selector = 'default'): DkimKeypair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const der = Buffer.from(
    publicKey
      .replace(/-----BEGIN PUBLIC KEY-----/g, '')
      .replace(/-----END PUBLIC KEY-----/g, '')
      .replace(/\s/g, ''),
    'base64'
  );
  return {
    publicKeyBase64: der.toString('base64').replace(/=+$/g, ''),
    privateKeyPem: privateKey,
    selector,
  };
}

export function buildDkimRecord(pubBase64: string, selector = 'default'): string {
  return `v=DKIM1; k=rsa; p=${pubBase64}`;
}
