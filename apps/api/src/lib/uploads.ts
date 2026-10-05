import { mkdir } from 'fs/promises';
import path from 'path';
import multer from 'multer';

// Stored on the API server's own disk — no Cloudflare/Firebase storage
// product is used here, consistent with keeping Firebase scoped to just
// Auth + the Realtime DB chat. Mount this directory as a persistent Docker
// volume in production so proofs survive container restarts/redeploys.
export const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/lib/shanutechx/uploads';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB — plenty for a screenshot

import crypto from 'crypto';

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    const rawOrderId = req.params.orderId || 'default';
    const safeOrderId = path.basename(rawOrderId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const dir = path.join(UPLOADS_DIR, 'payments', safeOrderId);
    await mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = MIME_EXTENSION_MAP[file.mimetype] || '.bin';
    cb(null, `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

export const uploadPaymentProof = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Unsupported file type. Upload a JPEG, PNG, WebP, or PDF.'));
    }
    cb(null, true);
  },
}).single('proof');

/**
 * Returns a web-accessible relative URL path for an uploaded payment proof file.
 */
export function getPublicProofUrl(orderId: string, filename: string): string {
  const safeOrderId = path.basename(orderId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `/uploads/payments/${safeOrderId}/${filename}`;
}

/**
 * Normalizes any proof URL path (legacy absolute disk path or relative URL) to a clean web-accessible relative path.
 */
export function normalizeProofUrl(proofUrl: string | null | undefined): string | null {
  if (!proofUrl) return null;
  if (proofUrl.startsWith('http://') || proofUrl.startsWith('https://')) return proofUrl;
  const match = proofUrl.match(/uploads[/\\]payments[/\\]([^/\\]+)[/\\]([^/\\]+)$/);
  if (match) {
    return `/uploads/payments/${match[1]}/${match[2]}`;
  }
  return proofUrl;
}

