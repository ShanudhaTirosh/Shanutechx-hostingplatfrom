/**
 * Granular Mailbox Access Control (ACL) & Mailbox Profile Manager
 *
 * Provides granular permissions ('read', 'write', 'manage') for system mailboxes
 * and customer mailboxes granted to admin and support staff by dev superusers.
 * Also manages per-mailbox branding and profiles (avatarUrl, displayName, jobTitle, etc.).
 */

export type MailboxPermission = 'read' | 'write' | 'manage';

export interface MailboxAclEntry {
  userId: string;
  userEmail: string;
  userName?: string;
  role: 'admin' | 'support';
  permissions: MailboxPermission[];
  grantedAt: string; // ISO string
  grantedBy: string; // Dev user ID / email
}

export interface MailboxProfile {
  avatarUrl?: string | null;
  displayName?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  phone?: string | null;
  bio?: string | null;
  website?: string | null;
}

const VALID_PERMISSIONS: MailboxPermission[] = ['read', 'write', 'manage'];

/**
 * Safely parse and normalize raw mailboxAcl JSON from database
 */
export function normalizeMailboxAcl(raw: unknown): MailboxAclEntry[] {
  if (!Array.isArray(raw)) return [];

  const validEntries: MailboxAclEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, any>;
    if (typeof entry.userId !== 'string' || !entry.userId.trim()) continue;

    const rawPermissions = Array.isArray(entry.permissions) ? entry.permissions : [];
    const permissions: MailboxPermission[] = rawPermissions.filter((p: any): p is MailboxPermission =>
      VALID_PERMISSIONS.includes(p)
    );

    // If permissions array is empty but entry exists, default to 'read'
    const safePermissions = permissions.length > 0 ? permissions : (['read'] as MailboxPermission[]);

    validEntries.push({
      userId: entry.userId.trim(),
      userEmail: typeof entry.userEmail === 'string' ? entry.userEmail.trim() : '',
      userName: typeof entry.userName === 'string' ? entry.userName.trim() : undefined,
      role: entry.role === 'admin' ? 'admin' : 'support',
      permissions: Array.from(new Set(safePermissions)),
      grantedAt: typeof entry.grantedAt === 'string' ? entry.grantedAt : new Date().toISOString(),
      grantedBy: typeof entry.grantedBy === 'string' ? entry.grantedBy : 'system',
    });
  }

  return validEntries;
}

/**
 * Calculate the set of active permissions a user has on a specific mailbox account.
 */
export function getUserMailboxPermissions(
  account: { userId: string; mailboxAcl?: unknown; allowedAdminIds?: string[] } | null | undefined,
  userId: string,
  userRole?: string
): Set<MailboxPermission> {
  if (!account || !userId) return new Set();

  // Dev superusers always possess full, unrestricted permissions across all mailboxes
  if (userRole === 'dev') {
    return new Set(['read', 'write', 'manage']);
  }

  // Account owners always have full permissions on their own mailboxes
  if (account.userId === userId) {
    return new Set(['read', 'write', 'manage']);
  }

  const acl = normalizeMailboxAcl(account.mailboxAcl);
  const entry = acl.find((item) => item.userId === userId);

  if (entry) {
    return new Set(entry.permissions);
  }

  // Backward compatibility: If no ACL is defined for this user but user is present in legacy allowedAdminIds
  if (Array.isArray(account.allowedAdminIds) && account.allowedAdminIds.includes(userId)) {
    return new Set(['read', 'write']);
  }

  return new Set();
}

/**
 * Check whether a user is authorized for a specific mailbox operation.
 */
export function canAccessMailbox(
  account: { userId: string; mailboxAcl?: unknown; allowedAdminIds?: string[] } | null | undefined,
  userId: string,
  userRole?: string,
  requiredPermission: MailboxPermission = 'read'
): { allowed: boolean; reason?: string; permissions: MailboxPermission[] } {
  const permissionsSet = getUserMailboxPermissions(account, userId, userRole);
  const permissionsList = Array.from(permissionsSet);

  if (permissionsSet.has(requiredPermission)) {
    return { allowed: true, permissions: permissionsList };
  }

  if (permissionsSet.size === 0) {
    return {
      allowed: false,
      reason: 'Access denied: You do not have permission to access this mailbox. Please contact an administrator.',
      permissions: [],
    };
  }

  const permName = requiredPermission === 'write' ? 'Sending / Write' : requiredPermission === 'manage' ? 'Management' : 'Read';
  return {
    allowed: false,
    reason: `Forbidden: ${permName} permission is required for this mailbox. You currently have [${permissionsList.join(', ')}] access.`,
    permissions: permissionsList,
  };
}

/**
 * Add or update a user's granular permissions in mailboxAcl, keeping allowedAdminIds in sync.
 */
export function updateMailboxAcl(
  existingAclRaw: unknown,
  newEntry: {
    userId: string;
    userEmail: string;
    userName?: string;
    role: 'admin' | 'support';
    permissions: MailboxPermission[];
    grantedBy: string;
  }
): { mailboxAcl: MailboxAclEntry[]; allowedAdminIds: string[] } {
  const currentAcl = normalizeMailboxAcl(existingAclRaw);
  const safePermissions = Array.from(
    new Set(newEntry.permissions.filter((p): p is MailboxPermission => VALID_PERMISSIONS.includes(p)))
  );

  const finalPermissions = safePermissions.length > 0 ? safePermissions : (['read'] as MailboxPermission[]);

  const filtered = currentAcl.filter((item) => item.userId !== newEntry.userId);
  filtered.push({
    userId: newEntry.userId,
    userEmail: newEntry.userEmail,
    userName: newEntry.userName,
    role: newEntry.role === 'admin' ? 'admin' : 'support',
    permissions: finalPermissions,
    grantedAt: new Date().toISOString(),
    grantedBy: newEntry.grantedBy,
  });

  const allowedAdminIds = filtered.map((item) => item.userId);
  return {
    mailboxAcl: filtered,
    allowedAdminIds,
  };
}

/**
 * Revoke a user's access from mailboxAcl and sync allowedAdminIds.
 */
export function revokeMailboxAcl(
  existingAclRaw: unknown,
  userIdToRemove: string
): { mailboxAcl: MailboxAclEntry[]; allowedAdminIds: string[] } {
  const currentAcl = normalizeMailboxAcl(existingAclRaw);
  const updatedAcl = currentAcl.filter((item) => item.userId !== userIdToRemove);
  const allowedAdminIds = updatedAcl.map((item) => item.userId);

  return {
    mailboxAcl: updatedAcl,
    allowedAdminIds,
  };
}

/**
 * Normalize and parse mailbox profile JSON
 */
export function normalizeMailboxProfile(
  raw: unknown,
  fallbackDisplayName?: string | null,
  fallbackEmail?: string | null
): MailboxProfile {
  if (!raw || typeof raw !== 'object') {
    return {
      avatarUrl: null,
      displayName: (typeof fallbackDisplayName === 'string' && fallbackDisplayName.trim()) || (fallbackEmail ? fallbackEmail.split('@')[0] : null),
      jobTitle: null,
      company: null,
      phone: null,
      bio: null,
      website: null,
    };
  }

  const obj = raw as Record<string, any>;
  return {
    avatarUrl: typeof obj.avatarUrl === 'string' && obj.avatarUrl.trim() ? obj.avatarUrl.trim() : null,
    displayName:
      typeof obj.displayName === 'string' && obj.displayName.trim()
        ? obj.displayName.trim()
        : fallbackDisplayName || null,
    jobTitle: typeof obj.jobTitle === 'string' && obj.jobTitle.trim() ? obj.jobTitle.trim() : null,
    company: typeof obj.company === 'string' && obj.company.trim() ? obj.company.trim() : null,
    phone: typeof obj.phone === 'string' && obj.phone.trim() ? obj.phone.trim() : null,
    bio: typeof obj.bio === 'string' && obj.bio.trim() ? obj.bio.trim() : null,
    website: typeof obj.website === 'string' && obj.website.trim() ? obj.website.trim() : null,
  };
}
