import { promises as dns } from 'dns';

export type DomainVerificationResult =
  | { verified: true }
  | { verified: false; reason: string };

/**
 * Checks whether `domain` has a CNAME pointing at `expectedTarget`. This is
 * the actual ownership proof before we add a Traefik route + attempt a
 * Let's Encrypt cert for a domain we don't own — without it, anyone could
 * claim any domain by just typing it in.
 *
 * Normalizes case and the optional trailing dot DNS responses sometimes
 * include, since "alice-blog.shanutechx.com." and "alice-blog.shanutechx.com"
 * are the same target but would fail a naive string comparison.
 */
export async function verifyCnameTarget(
  domain: string,
  expectedTarget: string
): Promise<DomainVerificationResult> {
  let records: string[];
  try {
    records = await dns.resolveCname(domain);
  } catch (err: any) {
    if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') {
      return { verified: false, reason: 'No CNAME record found yet — DNS may still be propagating' };
    }
    return { verified: false, reason: `DNS lookup failed: ${err.code ?? err.message}` };
  }

  const normalize = (s: string) => s.toLowerCase().replace(/\.$/, '');
  const target = normalize(expectedTarget);
  const matched = records.some((r) => normalize(r) === target);

  return matched
    ? { verified: true }
    : {
        verified: false,
        reason: `CNAME found but points to ${records.map(normalize).join(', ')}, expected ${target}`,
      };
}
