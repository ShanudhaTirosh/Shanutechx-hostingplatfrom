import { prisma } from './prisma';
import { env } from '../env';

const LEASEWEB_BASE = 'https://api.leaseweb.com';

export class LeasewebApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
  }
}

/**
 * Every method here corresponds to a *management* endpoint on a VPS the
 * admin/dev already owns (bought manually through Leaseweb's own portal).
 * There is deliberately no `orderVps()` — this platform never places an
 * order automatically.
 *
 * Every call is logged to LeasewebApiLog (request/response minus secrets)
 * so the dev dashboard's raw log viewer has something real to show when
 * debugging a failed management call.
 * 
 * ⚠️ SECURITY WARNING: Never log the X-LSW-Auth header value. It contains the API key.
 * Passwords in responses are already redacted via options.redactResponseField.
 * Do not add debug logging that includes the raw headers object.
 */
async function call<T>(
  method: string,
  path: string,
  options: { body?: unknown; redactResponseField?: string } = {}
): Promise<T> {
  if (!env.leasewebApiKey) {
    throw new LeasewebApiError('LEASEWEB_API_KEY is not configured');
  }

  const url = `${LEASEWEB_BASE}${path}`;
  let statusCode: number | undefined;
  let responseBody: unknown;
  let errorMessage: string | undefined;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'X-LSW-Auth': env.leasewebApiKey,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    statusCode = res.status;
    const text = await res.text();
    responseBody = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const errBody = responseBody as { errorMessage?: string } | null;
      errorMessage = errBody?.errorMessage ?? `Leaseweb API returned HTTP ${res.status}`;
      throw new LeasewebApiError(errorMessage, res.status);
    }

    return responseBody as T;
  } catch (err) {
    if (!errorMessage) errorMessage = (err as Error).message;
    throw err;
  } finally {
    const sanitizedResponse =
      options.redactResponseField && responseBody && typeof responseBody === 'object'
        ? { ...(responseBody as Record<string, unknown>), [options.redactResponseField]: '[REDACTED]' }
        : responseBody;

    await prisma.leasewebApiLog
      .create({
        data: {
          method,
          path,
          statusCode,
          requestBody: (options.body as object) ?? undefined,
          responseBody: (sanitizedResponse as object) ?? undefined,
          errorMessage,
        },
      })
      .catch(() => {}); // logging failure must never mask the original error/result
  }
}

export interface LeasewebVpsProduct {
  id: string;
  name: string;
  vCpu: string;
  vRam: string;
  nvmeStorage: string;
  traffic: string;
  price: { currency: string; basePrice: number; discount: number; total: number };
}

/** Read-only — used to show the admin Leaseweb's real cost when setting a customer-facing price. Never orders anything. */
export async function listVpsProducts(location?: string): Promise<LeasewebVpsProduct[]> {
  const query = location ? `?location=${encodeURIComponent(location)}` : '';
  const data = await call<{ vpss: LeasewebVpsProduct[] }>('GET', `/ordering/v1/products/vps${query}`);
  return data.vpss;
}

export interface LeasewebVpsInstance {
  id: string;
  reference?: string;
  state: string;
  ips: Array<{ ip: string; version: number }>;
  contract?: { startsAt: string; endsAt: string; state: string };
}

export async function listVps(): Promise<LeasewebVpsInstance[]> {
  const data = await call<{ vpss: LeasewebVpsInstance[] }>('GET', '/publicCloud/v1/vps');
  return data.vpss ?? (data as unknown as LeasewebVpsInstance[]);
}

export async function getVps(vpsId: string): Promise<LeasewebVpsInstance> {
  return call<LeasewebVpsInstance>('GET', `/publicCloud/v1/vps/${vpsId}`);
}

export async function setVpsReference(vpsId: string, reference: string): Promise<void> {
  await call('PUT', `/publicCloud/v1/vps/${vpsId}`, { body: { reference } });
}

export async function startVps(vpsId: string): Promise<void> {
  await call('POST', `/publicCloud/v1/vps/${vpsId}/start`);
}

export async function stopVps(vpsId: string): Promise<void> {
  await call('POST', `/publicCloud/v1/vps/${vpsId}/stop`);
}

export async function rebootVps(vpsId: string): Promise<void> {
  await call('POST', `/publicCloud/v1/vps/${vpsId}/reboot`);
}

/**
 * Leaseweb assigns a new random root/Administrator password and returns it.
 * Per Leaseweb's own docs, the VPS should be stopped first for this to take
 * effect reliably — the route calling this warns the caller if the instance
 * is currently running, but does not block the call (Leaseweb's API itself
 * enforces whatever precondition it actually needs).
 */
export async function resetVpsPassword(vpsId: string): Promise<{ username: string; password: string }> {
  return call('POST', `/publicCloud/v1/vps/${vpsId}/resetPassword`, { redactResponseField: 'password' });
}

/**
 * Cancels/terminates the instance at the provider. This is destructive and
 * irreversible — only ever called from an admin/dev-only route, never
 * exposed to a customer action (see routes/leaseweb.ts).
 */
export async function cancelVps(vpsId: string): Promise<void> {
  await call('POST', `/publicCloud/v1/vps/${vpsId}/cancel`);
}

export async function getConsoleUrl(vpsId: string): Promise<string> {
  const data = await call<{ url: string }>('GET', `/publicCloud/v1/vps/${vpsId}/console`);
  return data.url;
}

/** Credentials are redacted (password field) before being written to the log — never logged in plaintext. */
export async function getCredentials(
  vpsId: string,
  type: 'OPERATING_SYSTEM' | 'CONTROL_PANEL'
): Promise<{ username: string; password: string }> {
  return call('GET', `/publicCloud/v1/vps/${vpsId}/credentials/${type}`, { redactResponseField: 'password' });
}

export async function listSnapshots(vpsId: string): Promise<Array<{ id: string; createdAt: string }>> {
  const data = await call<{ snapshots: Array<{ id: string; createdAt: string }> }>(
    'GET',
    `/publicCloud/v1/vps/${vpsId}/snapshots`
  );
  return data.snapshots;
}

export async function createSnapshot(vpsId: string, name: string): Promise<{ id: string }> {
  return call('POST', `/publicCloud/v1/vps/${vpsId}/snapshots`, { body: { name } });
}

export async function getMonitoringStatus(vpsId: string): Promise<{ status: string; description: string }> {
  return call('GET', `/publicCloud/v1/vps/${vpsId}/monitoring/status`);
}

export async function getDataTraffic(vpsId: string): Promise<unknown> {
  return call('GET', `/publicCloud/v1/vps/${vpsId}/metrics/datatraffic`);
}

export async function reinstallVps(vpsId: string, osCode: string): Promise<void> {
  await call('POST', `/publicCloud/v1/vps/${vpsId}/reinstall`, { body: { osCode } });
}

export async function restoreSnapshot(vpsId: string, snapshotId: string): Promise<void> {
  await call('POST', `/publicCloud/v1/vps/${vpsId}/snapshots/${snapshotId}/revert`);
}

export async function deleteSnapshot(vpsId: string, snapshotId: string): Promise<void> {
  await call('DELETE', `/publicCloud/v1/vps/${vpsId}/snapshots/${snapshotId}`);
}

export interface OperatingSystemOption {
  code: string;
  name: string;
}

export async function listOperatingSystems(): Promise<OperatingSystemOption[]> {
  return [
    { code: 'UBUNTU_22_04_64BIT', name: 'Ubuntu 22.04 LTS (64-bit)' },
    { code: 'UBUNTU_24_04_64BIT', name: 'Ubuntu 24.04 LTS (64-bit)' },
    { code: 'DEBIAN_12_64BIT', name: 'Debian 12 Bookworm (64-bit)' },
    { code: 'ALMALINUX_9_64BIT', name: 'AlmaLinux 9 (64-bit)' },
    { code: 'WINDOWS_SERVER_2022_64BIT', name: 'Windows Server 2022 Standard (64-bit)' },
  ];
}
