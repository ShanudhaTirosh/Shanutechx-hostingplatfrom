const crypto = require('crypto');

/**
 * Simple sliding-window in-memory rate limiter per user ID or IP
 */
class RateLimiter {
  constructor(limit = 5, windowMs = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map();
  }

  isRateLimited(key) {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];
    const validTimestamps = timestamps.filter((t) => now - t < this.windowMs);

    if (validTimestamps.length >= this.limit) {
      this.hits.set(key, validTimestamps);
      return true;
    }

    validTimestamps.push(now);
    this.hits.set(key, validTimestamps);
    return false;
  }

  reset(key) {
    this.hits.delete(key);
  }
}

/**
 * Timing-safe secret token verification
 */
function verifyInternalSecret(providedSecret, expectedSecret) {
  if (!providedSecret || !expectedSecret) return false;
  const key = 'shanutechx-bot-gate';
  try {
    return crypto.timingSafeEqual(
      crypto.createHmac('sha256', key).update(providedSecret).digest(),
      crypto.createHmac('sha256', key).update(expectedSecret).digest()
    );
  } catch {
    return false;
  }
}

module.exports = {
  RateLimiter,
  verifyInternalSecret,
};
