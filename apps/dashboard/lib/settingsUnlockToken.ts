/**
 * Server-issued proof that the settings PIN was entered (returned by POST /api/settings/verify-password).
 * Kept in sessionStorage next to the UI "unlocked until" timestamp and sent in the BODY of the sensitive
 * settings requests (a body field avoids new CORS headers and is ignored by an API that predates it).
 */
export const SETTINGS_UNLOCK_TOKEN_KEY = 'shanutechx_settings_unlock_token';

export function getSettingsUnlockToken(): string | undefined {
  try {
    if (typeof window === 'undefined') return undefined;
    return window.sessionStorage.getItem(SETTINGS_UNLOCK_TOKEN_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function setSettingsUnlockToken(token: string | undefined): void {
  try {
    if (typeof window === 'undefined') return;
    if (token) window.sessionStorage.setItem(SETTINGS_UNLOCK_TOKEN_KEY, token);
    else window.sessionStorage.removeItem(SETTINGS_UNLOCK_TOKEN_KEY);
  } catch {
    /* storage unavailable: the server will answer SETTINGS_LOCKED and the guard asks for the PIN again */
  }
}
