import { prisma } from './prisma';

const RESERVED = new Set([
  'www', 'api', 'app', 'admin', 'mail', 'smtp', 'ftp', 'cdn', 'status',
  'blog', 'docs', 'support', 'help', 'dashboard', 'grafana', 'prometheus', 'loki', 'traefik',
]);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/**
 * Validates a user-requested custom subdomain (e.g. chosen by a dev/customer).
 */
export async function validateCustomSubdomain(
  requestedSubdomain: string,
  currentDeploymentId?: string,
): Promise<{ valid: boolean; error?: string; formatted?: string }> {
  const formatted = slugify(requestedSubdomain);

  if (!formatted || formatted.length < 2) {
    return { valid: false, error: 'Subdomain must be at least 2 characters long' };
  }

  if (RESERVED.has(formatted)) {
    return { valid: false, error: `Subdomain '${formatted}' is reserved by the system` };
  }

  const existing = await prisma.deployment.findFirst({
    where: {
      subdomain: formatted,
      ...(currentDeploymentId ? { id: { not: currentDeploymentId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    return { valid: false, error: `Subdomain '${formatted}' is already taken by another deployment` };
  }

  return { valid: true, formatted };
}

/**
 * Derives a unique subdomain from the repo name (or a customer-chosen
 * alias), falling back to a numeric suffix on collision. Reserved names are
 * never handed out, even if requested explicitly.
 */
export async function generateSubdomain(
  preferredName: string,
  userRequestedSubdomain?: string,
): Promise<string> {
  if (userRequestedSubdomain) {
    const check = await validateCustomSubdomain(userRequestedSubdomain);
    if (check.valid && check.formatted) {
      return check.formatted;
    }
  }

  const base = slugify(preferredName) || 'app';
  let candidate = RESERVED.has(base) ? `${base}-app` : base;
  let suffix = 1;

  while (await isTaken(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

async function isTaken(subdomain: string): Promise<boolean> {
  const existing = await prisma.deployment.findFirst({
    where: { subdomain },
    select: { id: true },
  });
  return Boolean(existing);
}
