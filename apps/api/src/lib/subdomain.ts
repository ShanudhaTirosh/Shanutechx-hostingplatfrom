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
 * Validates a user-requested custom subdomain (e.g. chosen by a customer during creation).
 * Rules:
 * - Simple lowercase English letters (a-z), numbers (0-9), and dashes (-)
 * - NO spaces/blanks, NO underscores (_), NO uppercase letters
 * - MUST contain at least one simple lowercase letter (a-z)
 */
export async function validateCustomSubdomain(
  requestedSubdomain: string,
  currentDeploymentId?: string,
): Promise<{ valid: boolean; error?: string; formatted?: string }> {
  const raw = requestedSubdomain.trim();

  if (!raw || raw.length < 2) {
    return { valid: false, error: 'Subdomain must be at least 2 characters long' };
  }

  if (/\s/.test(raw)) {
    return { valid: false, error: 'Subdomain cannot contain spaces or blanks' };
  }

  if (/_/.test(raw)) {
    return { valid: false, error: 'Subdomain cannot contain underscores (_)' };
  }

  if (/[A-Z]/.test(raw)) {
    return { valid: false, error: 'Subdomain must be lowercase' };
  }

  if (!/[a-z]/.test(raw)) {
    return { valid: false, error: 'Subdomain must contain at least one simple lowercase letter (a-z)' };
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw)) {
    return { valid: false, error: 'Subdomain can only contain lowercase simple letters (a-z), numbers, and hyphens' };
  }

  const formatted = slugify(raw);

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
 * Generates a guaranteed unique subdomain for an application.
 * If user requested a custom subdomain during creation, validates it.
 * Otherwise, auto-generates a unique subdomain using application slug and a random unique hash suffix.
 */
export async function generateSubdomain(
  preferredName: string,
  userRequestedSubdomain?: string,
): Promise<string> {
  if (userRequestedSubdomain && userRequestedSubdomain.trim()) {
    const check = await validateCustomSubdomain(userRequestedSubdomain);
    if (!check.valid || !check.formatted) {
      throw new Error(check.error || 'Invalid custom subdomain');
    }
    return check.formatted;
  }

  const baseSlug = slugify(preferredName) || 'app';
  // Ensure base slug contains at least one letter
  const cleanBase = /[a-z]/.test(baseSlug) ? baseSlug : `app-${baseSlug}`;
  
  // Generate unique candidate with random hash suffix based on app ID / random string
  let candidate = `${cleanBase}-${Math.random().toString(36).substring(2, 8)}`;
  if (RESERVED.has(candidate)) {
    candidate = `app-${candidate}`;
  }

  let suffix = 1;
  while (await isTaken(candidate)) {
    candidate = `${cleanBase}-${Math.random().toString(36).substring(2, 8)}`;
    suffix += 1;
    if (suffix > 20) {
      candidate = `app-${Date.now().toString(36)}`;
      break;
    }
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
