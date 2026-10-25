import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import sharp from 'sharp';
import { getDocumentProxy, renderPageAsImage } from 'unpdf';
import { logger } from './logger';

export const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/lib/shanutechx/uploads';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024; // 12MB limit

// In-memory buffer upload so we can convert any incoming image or PDF directly to WebP
const memoryStorage = multer.memoryStorage();

export const uploadPaymentProof = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Unsupported file type. Please upload an image (JPEG, PNG, WebP) or PDF.'));
    }
    cb(null, true);
  },
}).single('proof');

/**
 * Converts an uploaded proof buffer (image or PDF) directly to high-quality WebP.
 * For PDFs, the first page is rendered at high resolution and encoded to WebP.
 * For all images, Sharp converts them to WebP format.
 */
export async function convertProofBufferToWebp(buffer: Buffer, mimetype: string): Promise<Buffer> {
  if (mimetype === 'application/pdf') {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      // Render first page with napi-rs canvas at scale 2.0 for crisp text readability
      const pageImage = await renderPageAsImage(pdf, 1, {
        scale: 2.0,
        canvasImport: () => import('@napi-rs/canvas'),
      });
      return await sharp(Buffer.from(pageImage))
        .webp({ quality: 85, effort: 4 })
        .toBuffer();
    } catch (pdfErr) {
      logger.error({ pdfErr }, 'Failed converting PDF proof to WebP, attempting fallback');
      throw new Error('Failed to process PDF document. Please upload a clear image screenshot of your payment slip.');
    }
  }

  // All image types (JPEG, PNG, BMP, TIFF, WebP) converted to optimized WebP
  return await sharp(buffer)
    .webp({ quality: 85, effort: 4 })
    .toBuffer();
}

/**
 * Processes an uploaded file in memory, converts it to WebP format, and writes it to disk.
 * Returns the final filename and public relative URL path.
 */
export async function processAndSavePaymentProof(
  orderId: string,
  file: Express.Multer.File
): Promise<{ filename: string; relativeUrl: string; webpBytes: number }> {
  const safeOrderId = path.basename(orderId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetDir = path.join(UPLOADS_DIR, 'payments', safeOrderId);
  await mkdir(targetDir, { recursive: true });

  const webpBuffer = await convertProofBufferToWebp(file.buffer, file.mimetype);
  const filename = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}.webp`;
  const filePath = path.join(targetDir, filename);

  await writeFile(filePath, webpBuffer);

  const relativeUrl = `/uploads/payments/${safeOrderId}/${filename}`;
  return {
    filename,
    relativeUrl,
    webpBytes: webpBuffer.length,
  };
}

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
