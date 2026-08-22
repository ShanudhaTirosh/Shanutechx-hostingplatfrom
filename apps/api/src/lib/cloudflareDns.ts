const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

export class CloudflareDnsError extends Error {}

/**
 * Automates the "add a CNAME record" step for a customer's custom domain,
 * when they're willing to hand over a scoped Cloudflare API token (Zone:DNS
 * Edit permission on just their zone) — an alternative to the manual "copy
 * this CNAME into your registrar" flow in lib/customDomain.ts, for
 * customers whose domain also happens to be on Cloudflare.
 *
 * The token and zone ID are supplied per-request by the customer, not
 * stored — this is a one-time DNS record creation, not an ongoing
 * integration that needs a persisted credential.
 */
export async function createCnameViaCloudflare(params: {
  apiToken: string;
  zoneId: string;
  domain: string;
  target: string;
}): Promise<{ recordId: string }> {
  const res = await fetch(`${CF_API_BASE}/zones/${params.zoneId}/dns_records`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'CNAME',
      name: params.domain,
      content: params.target,
      // Not proxied — the platform's own Traefik handles TLS termination
      // and needs to see the real connecting client, and a customer's own
      // Cloudflare proxy in front of it would fight with Let's Encrypt's
      // HTTP-01 challenge unless they specifically configure Full/Strict
      // mode themselves, which isn't something to assume here.
      proxied: false,
      ttl: 300,
    }),
  });

  const data = (await res.json()) as {
    success: boolean;
    result?: { id: string };
    errors?: Array<{ message: string }>;
  };

  if (!data.success || !data.result) {
    const message = data.errors?.map((e) => e.message).join('; ') ?? 'Unknown Cloudflare API error';
    throw new CloudflareDnsError(message);
  }

  return { recordId: data.result.id };
}

export async function deleteCnameViaCloudflare(params: {
  apiToken: string;
  zoneId: string;
  recordId: string;
}): Promise<void> {
  const res = await fetch(`${CF_API_BASE}/zones/${params.zoneId}/dns_records/${params.recordId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${params.apiToken}` },
  });

  if (!res.ok) {
    throw new CloudflareDnsError(`Failed to delete Cloudflare DNS record (${res.status})`);
  }
}
