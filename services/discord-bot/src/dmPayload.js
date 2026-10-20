/**
 * Builds the payload for a Discord DM from the API's request. Kept pure (no discord.js) so it can be
 * unit-tested. `document` is `{ fileName, base64 }`, e.g. an invoice PDF; the text message is optional
 * when there is a document.
 */
const MAX_DM_DOCUMENT_BYTES = 8 * 1024 * 1024; // comfortably under Discord's attachment limit

function sanitizeFileName(name) {
  const base = String(name || '').split(/[\\/]/).pop() || '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, '').replace(/^\.+/, '').trim();
  return cleaned || 'document.pdf';
}

function buildDmPayload(message, document) {
  const text = typeof message === 'string' ? message : '';

  if (document === null || document === undefined) {
    return text ? { ok: true, payload: { content: text } } : { ok: false, error: 'message is required' };
  }

  if (typeof document !== 'object' || typeof document.base64 !== 'string' || document.base64.length === 0) {
    return { ok: false, error: 'document must be an object with a non-empty base64 string' };
  }
  const buffer = Buffer.from(document.base64, 'base64');
  if (buffer.length === 0) return { ok: false, error: 'document is empty' };
  if (buffer.length > MAX_DM_DOCUMENT_BYTES) {
    return { ok: false, error: `document is larger than ${MAX_DM_DOCUMENT_BYTES} bytes` };
  }

  const payload = { files: [{ attachment: buffer, name: sanitizeFileName(document.fileName) }] };
  if (text) payload.content = text;
  return { ok: true, payload };
}

module.exports = { buildDmPayload, sanitizeFileName, MAX_DM_DOCUMENT_BYTES };
