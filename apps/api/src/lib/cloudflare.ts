import { env } from '../env';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

export class CloudflareError extends Error {}

function headers() {
  return {
    Authorization: `Bearer ${env.cloudflareApiToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Points `<subdomain>.<rootDomain>` at the given node IP.
 *
 * Proxied (orange-clouded) through Cloudflare so the origin IP is hidden and
 * gets Cloudflare's edge protection — Traefik on the node still terminates
 * TLS itself via Let's Encrypt (HTTP-01 challenge still reaches the origin
 * through Cloudflare's proxy in "Full" mode), so SSL works at any subdomain
 * depth without needing Cloudflare's paid wildcard cert product.
 */
export async function createSubdomainRecord(subdomain: string, nodeIp: string, proxied: boolean = true) {
  const res = await fetch(`${CF_API_BASE}/zones/${env.cloudflareZoneId}/dns_records`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      type: 'A',
      name: `${subdomain}.${env.rootDomain}`,
      content: nodeIp,
      proxied,
      ttl: 1, // automatic when proxied=true, 300 when proxied=false
    }),
  });

  const data = (await res.json()) as {
    success: boolean;
    result: { id: string };
    errors: unknown;
  };
  if (!data.success) {
    throw new CloudflareError(
      `Failed to create DNS record: ${JSON.stringify(data.errors)}`
    );
  }

  return { recordId: data.result.id };
}

export async function deleteDnsRecord(recordId: string) {
  const res = await fetch(
    `${CF_API_BASE}/zones/${env.cloudflareZoneId}/dns_records/${recordId}`,
    { method: 'DELETE', headers: headers() }
  );

  const data = (await res.json()) as { success: boolean; errors: unknown };
  if (!data.success) {
    throw new CloudflareError(
      `Failed to delete DNS record: ${JSON.stringify(data.errors)}`
    );
  }
}

export async function deleteSubdomainRecord(subdomain: string) {
  try {
    const listRes = await fetch(
      `${CF_API_BASE}/zones/${env.cloudflareZoneId}/dns_records?name=${encodeURIComponent(`${subdomain}.${env.rootDomain}`)}`,
      { headers: headers() }
    );
    const listData = (await listRes.json()) as { success: boolean; result: Array<{ id: string }> };
    if (listData.success && listData.result.length > 0) {
      for (const rec of listData.result) {
        await deleteDnsRecord(rec.id).catch(() => {});
      }
    }
  } catch (_) {
    // best-effort
  }
}


/**
 * Deletes only the A records for `<subdomain>.<root>` that point at `ip`. Unlike deleteSubdomainRecord (which removes
 * every record with that name), this cannot delete another owner's record that happens to share the hostname.
 * Returns how many records were deleted; throws on API failure so callers can retry instead of assuming success.
 */
export async function deleteDnsRecordsByNameAndIp(subdomain: string, ip: string): Promise<number> {
  const url = `${CF_API_BASE}/zones/${env.cloudflareZoneId}/dns_records?name=${encodeURIComponent(`${subdomain}.${env.rootDomain}`)}&type=A&content=${encodeURIComponent(ip)}`;
  const res = await fetch(url, { headers: headers() });
  const data = (await res.json()) as { success: boolean; result?: Array<{ id: string }>; errors?: unknown };
  if (!data.success) throw new CloudflareError(`Failed to list DNS records: ${JSON.stringify(data.errors)}`);
  const records = data.result ?? [];
  for (const rec of records) await deleteDnsRecord(rec.id);
  return records.length;
}
