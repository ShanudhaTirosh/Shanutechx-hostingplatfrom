-- Adds a per-user hashed "Settings Protection" PIN column.
-- Replaces the old in-memory Map + weak default-fallback bypass in
-- routes/settings.ts (see audit finding C4) with a real, persisted,
-- bcrypt-hashed value. No default value / backfill: existing users get
-- NULL, meaning "no PIN configured yet" -- the API now fails closed for
-- that case rather than accepting '123456'/'admin'/any 4+ char string.
ALTER TABLE "User" ADD COLUMN "settingsPinHash" TEXT;
