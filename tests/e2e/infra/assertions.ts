import assert from 'node:assert/strict';
import type { ApiResponse } from './client';

export function assertStatus(res: ApiResponse, expectedStatus: number | number[], context?: string) {
  const allowed = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  const msg = `${context ? `[${context}] ` : ''}Expected HTTP status in [${allowed.join(', ')}], got ${res.status}. Body: ${res.rawText.slice(0, 500)}`;
  assert.ok(allowed.includes(res.status), msg);
}

export function assertNoSecretLeak(payload: any, forbiddenSecrets: string[], context?: string) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const secret of forbiddenSecrets) {
    if (!secret || secret.length < 4) continue;
    assert.ok(
      !text.includes(secret),
      `${context ? `[${context}] ` : ''}Security violation: secret string "${secret.slice(0, 3)}***" leaked in response: ${text.slice(0, 300)}`
    );
  }
}

export function assertJsonSuccess(res: ApiResponse, context?: string) {
  assertStatus(res, [200, 201], context);
  assert.equal(typeof res.data, 'object', `${context || ''} Expected JSON object response`);
  assert.notEqual(res.data, null, `${context || ''} Expected non-null JSON response`);
}

export function assertJsonError(res: ApiResponse, expectedStatus: number, context?: string) {
  assertStatus(res, expectedStatus, context);
  assert.equal(typeof res.data, 'object', `${context || ''} Expected JSON error response`);
  assert.ok(
    res.data?.error !== undefined || res.data?.message !== undefined,
    `${context || ''} Expected 'error' or 'message' property in response, got: ${JSON.stringify(res.data)}`
  );
}
