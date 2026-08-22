#!/usr/bin/env node
/**
 * Generates a matching JWT_SECRET + ANON_KEY + SERVICE_ROLE_KEY triple
 * for the self-hosted Supabase stack (docker/supabase/docker-compose.yml,
 * included by docker/docker-compose.shanutechx.yml's unified orchestrator
 * alongside docker-compose.local.yml and docker/infisical).
 *
 * Kong, GoTrue, and PostgREST all trust JWTs signed with the same
 * JWT_SECRET; ANON_KEY and SERVICE_ROLE_KEY are just long-lived JWTs
 * signed with that secret, carrying `role: "anon"` / `role: "service_role"`
 * respectively. Docker Compose can't generate these itself (they need
 * real HMAC-SHA256 signing), so run this once during first-time setup:
 *
 *   node infra/supabase/generate-keys.js
 *
 * The script prints the SAME three values under two different naming
 * conventions — copy the first block into the repo-root .env (used by
 * apps/api and infra/control-plane, which expect SUPABASE_-prefixed
 * names), and the second block into docker/supabase/.env (that stack's
 * own, unprefixed names). Both must hold the same underlying values.
 *
 * Uses the `jsonwebtoken` package already vendored for apps/api — run
 * this from the repo root with that dependency installed
 * (`cd apps/api && npm install` first if you haven't).
 */
const crypto = require('crypto');
const jwt = require('../../apps/api/node_modules/jsonwebtoken');

const jwtSecret = crypto.randomBytes(32).toString('base64');

const issuedAt = Math.floor(Date.now() / 1000);
const expiresAt = issuedAt + 60 * 60 * 24 * 365 * 10; // 10 years — these are long-lived service credentials, rotate by re-running this script

const anonKey = jwt.sign({ role: 'anon', iss: 'supabase', iat: issuedAt, exp: expiresAt }, jwtSecret);
const serviceRoleKey = jwt.sign({ role: 'service_role', iss: 'supabase', iat: issuedAt, exp: expiresAt }, jwtSecret);

console.log('# Paste into the repo-root .env (docker-compose.local.yml / infra/control-plane/.env):');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`SUPABASE_ANON_KEY=${anonKey}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`);
console.log('');
console.log('# ALSO paste into docker/supabase/.env (same values, this stack\'s own var names):');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`ANON_KEY=${anonKey}`);
console.log(`SERVICE_ROLE_KEY=${serviceRoleKey}`);
