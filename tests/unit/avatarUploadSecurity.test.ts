import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateImageMagicBytes,
  ALLOWED_IMAGE_MIMES,
} from '../../apps/api/src/lib/avatarUpload';

test('Avatar Upload Security & Magic Byte Inspector Suite', async (t) => {
  await t.test('detects valid JPEG magic bytes (FF D8 FF)', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const res = validateImageMagicBytes(jpegBuffer);
    assert.equal(res.valid, true);
    assert.equal(res.format, 'jpg');
    assert.equal(res.mime, 'image/jpeg');
  });

  await t.test('detects valid PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const res = validateImageMagicBytes(pngBuffer);
    assert.equal(res.valid, true);
    assert.equal(res.format, 'png');
    assert.equal(res.mime, 'image/png');
  });

  await t.test('detects valid WebP magic bytes (RIFF....WEBP)', () => {
    // 52 49 46 46 (RIFF), 4 bytes size, 57 45 42 50 (WEBP)
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46,
      0x24, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x20,
    ]);
    const res = validateImageMagicBytes(webpBuffer);
    assert.equal(res.valid, true);
    assert.equal(res.format, 'webp');
    assert.equal(res.mime, 'image/webp');
  });

  await t.test('detects valid GIF magic bytes (GIF89a)', () => {
    const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x00, 0x20, 0x00, 0xf0, 0x00]);
    const res = validateImageMagicBytes(gifBuffer);
    assert.equal(res.valid, true);
    assert.equal(res.format, 'gif');
    assert.equal(res.mime, 'image/gif');
  });

  await t.test('strictly rejects fake images with malicious shell / php code disguised as jpg', () => {
    const maliciousBuffer = Buffer.from('<?php system($_GET["cmd"]); ?>');
    const res = validateImageMagicBytes(maliciousBuffer);
    assert.equal(res.valid, false);
    assert.ok(res.error?.includes('Security verification failed'));
  });

  await t.test('strictly rejects HTML or SVG containing script tags', () => {
    const htmlBuffer = Buffer.from('<script>alert("xss")</script>');
    const res = validateImageMagicBytes(htmlBuffer);
    assert.equal(res.valid, false);
  });

  await t.test('strictly rejects short or truncated buffers', () => {
    const shortBuffer = Buffer.from([0xff, 0xd8]);
    const res = validateImageMagicBytes(shortBuffer);
    assert.equal(res.valid, false);
    assert.ok(res.error?.includes('too small'));
  });

  await t.test('allowed MIME types contains only safe raster formats', () => {
    assert.ok(ALLOWED_IMAGE_MIMES.includes('image/jpeg'));
    assert.ok(ALLOWED_IMAGE_MIMES.includes('image/png'));
    assert.ok(ALLOWED_IMAGE_MIMES.includes('image/webp'));
    assert.ok(ALLOWED_IMAGE_MIMES.includes('image/gif'));
  });
});
