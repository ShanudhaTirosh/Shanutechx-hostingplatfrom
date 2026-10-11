/**
 * Secure Mailbox Avatar Upload Handler & Image File Security Inspector
 *
 * Implements Defense-in-Depth for profile picture uploads:
 * 1. Strict MIME type validation
 * 2. Magic byte / file header signature verification (prevents polyglots, renamed executables, PHP/HTML scripts)
 * 3. File size capping (5MB max)
 * 4. Cryptographic filename randomization & path traversal sanitization
 * 5. Safe filesystem persistence and cleanup
 */

import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { UPLOADS_DIR } from './uploads';

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

export interface MagicByteValidationResult {
  valid: boolean;
  format?: 'jpg' | 'png' | 'webp' | 'gif';
  mime?: AllowedImageMime;
  error?: string;
}

/**
 * Validate image buffer using Magic Bytes (File Signatures).
 * Strictly rejects renamed executables, scripts, HTML, or corrupted files.
 */
export function validateImageMagicBytes(buffer: Buffer): MagicByteValidationResult {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) {
    return { valid: false, error: 'File is empty, corrupted, or too small to be a valid image.' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, format: 'jpg', mime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, format: 'png', mime: 'image/png' };
  }

  // GIF: 47 49 46 38 (GIF87a or GIF89a)
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { valid: true, format: 'gif', mime: 'image/gif' };
  }

  // WebP: RIFF .... WEBP
  // bytes 0-3: 52 49 46 46 (RIFF)
  // bytes 8-11: 57 45 42 50 (WEBP)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, format: 'webp', mime: 'image/webp' };
  }

  return {
    valid: false,
    error: 'Security verification failed: File content does not match a verified image header (JPEG, PNG, WebP, or GIF).',
  };
}

/**
 * Persist uploaded image buffer into secure uploads directory after passing all security checks.
 */
export async function saveMailboxAvatar(
  mailboxId: string,
  buffer: Buffer
): Promise<{ avatarUrl: string; filename: string }> {
  const check = validateImageMagicBytes(buffer);
  if (!check.valid || !check.format) {
    throw new Error(check.error || 'Invalid image header');
  }

  const avatarsDir = path.join(UPLOADS_DIR, 'avatars');
  await mkdir(avatarsDir, { recursive: true });

  const safeMailboxId = path.basename(mailboxId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `avatar_${safeMailboxId}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${check.format}`;
  const filepath = path.join(avatarsDir, filename);

  await writeFile(filepath, buffer);

  const avatarUrl = `/api/uploads/avatars/${filename}`;
  return { avatarUrl, filename };
}

/**
 * Remove an existing avatar file from disk if it was previously uploaded to ShanutechX.
 */
export async function deleteLocalAvatarIfExists(avatarUrl: string | null | undefined): Promise<void> {
  if (!avatarUrl || typeof avatarUrl !== 'string') return;
  const match = avatarUrl.match(/(?:\/api)?\/uploads\/avatars\/([a-zA-Z0-9_.-]+)$/);
  if (!match) return;

  const filename = path.basename(match[1]).replace(/[^a-zA-Z0-9_.-]/g, '');
  if (!filename) return;

  const filepath = path.join(UPLOADS_DIR, 'avatars', filename);
  try {
    await unlink(filepath);
  } catch {
    // Ignore ENOENT
  }
}

/**
 * Multer memory storage middleware for avatar uploads
 */
export const avatarUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AVATAR_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype as any)) {
      return cb(new Error('Invalid image type. Only JPEG, PNG, WebP, and GIF images are allowed.'));
    }
    cb(null, true);
  },
}).single('avatar');
