/**
 * Who may act as (impersonate) whom. Kept pure so the auth middleware (x-impersonate-user-id)
 * and POST /admin/impersonate/:userId apply exactly the same rule.
 *
 *  - Only CUSTOMER accounts can be impersonated (never admin/dev/support).
 *  - Banned accounts cannot be impersonated.
 *  - `dev` is unrestricted; `admin` only for customers ASSIGNED to them - the same scoping
 *    canAccessResource applies to every other admin action. (Impersonating makes the request run as
 *    the customer, so an unrestricted admin could otherwise read/modify any customer's resources.)
 */
export type ImpersonationActor = { id: string; role: string };
export type ImpersonationTarget = { role: string; isBanned?: boolean | null; assignedAdminId?: string | null };

export function canImpersonate(actor: ImpersonationActor, target: ImpersonationTarget): boolean {
  if (target.isBanned) return false;
  if (target.role !== 'customer') return false;
  if (actor.role === 'dev') return true;
  if (actor.role === 'admin') return Boolean(target.assignedAdminId) && target.assignedAdminId === actor.id;
  return false;
}
