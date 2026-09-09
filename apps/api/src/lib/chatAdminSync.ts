import { firebaseDb } from './firebaseAdmin';
import { logger } from './logger';

/**
 * Realtime DB security rules (database.rules.json) need some way to know
 * whether the requesting Firebase UID is staff, but role lives in Postgres,
 * not Firebase — RTDB rules can't query our database directly. The fix:
 * mirror a minimal /staff/{firebaseUid}: true node that rules check
 * against for the live-chat feature. This is called once per request from
 * requireAuth whenever it resolves a user with role "admin" or "support",
 * so it self-heals without needing a separate "promote to staff" flow to
 * remember to call it.
 *
 * Named /staff rather than /admins because support agents — who shouldn't
 * have full admin access anywhere else — do need this specific permission,
 * since answering live chat is exactly their job.
 *
 * Cheap and idempotent — `set` on an already-correct value is a no-op
 * write as far as RTDB clients observing it are concerned, and this is far
 * too low-volume (one staff login) to worry about write costs.
 */
export async function ensureStaffMarkedInRealtimeDb(firebaseUid: string): Promise<void> {
  if (!firebaseDb) return; // FIREBASE_DATABASE_URL not configured — chat/staff sync just isn't active

  try {
    await firebaseDb.ref(`staff/${firebaseUid}`).set(true);
  } catch (err) {
    // Never let this block a request — it's a sync nicety, not a critical path.
    logger.error({ firebaseUid, err }, 'Failed to sync staff marker to Realtime DB');
  }
}

export async function removeStaffFromRealtimeDb(firebaseUid: string): Promise<void> {
  if (!firebaseDb || !firebaseUid) return;

  try {
    await firebaseDb.ref(`staff/${firebaseUid}`).remove();
  } catch (err) {
    logger.error({ firebaseUid, err }, 'Failed to remove staff marker from Realtime DB');
  }
}

