#!/usr/bin/env node
/**
 * Autonomous Key Generator for Self-Hosted Supabase Stack
 * Usage: node generate-keys.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateRandomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

function generateRandomBase64(bytes) {
  return crypto.randomBytes(bytes).toString('base64');
}

// Generate HS256 JWT Token using basic crypto
function generateJWT(role, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      role,
      iss: 'supabase',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 315360000, // 10 years
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

const jwtSecret = generateRandomBase64(32);
const postgresPass = generateRandomHex(16);
const anonKey = generateJWT('anon', jwtSecret);
const serviceKey = generateJWT('service_role', jwtSecret);
const pgMetaCryptoKey = generateRandomBase64(24);
const secretKeyBase = generateRandomBase64(48);
const realtimeDbEncKey = generateRandomHex(8);
const vaultEncKey = generateRandomHex(16);
const logflarePublic = generateRandomBase64(24);
const logflarePrivate = generateRandomBase64(24);

const envContent = `# Self-Hosted Supabase Environment Keys
POSTGRES_PASSWORD=${postgresPass}
JWT_SECRET=${jwtSecret}
ANON_KEY=${anonKey}
SERVICE_ROLE_KEY=${serviceKey}
PG_META_CRYPTO_KEY=${pgMetaCryptoKey}
SECRET_KEY_BASE=${secretKeyBase}
REALTIME_DB_ENC_KEY=${realtimeDbEncKey}
VAULT_ENC_KEY=${vaultEncKey}
LOGFLARE_PUBLIC_ACCESS_TOKEN=${logflarePublic}
LOGFLARE_PRIVATE_ACCESS_TOKEN=${logflarePrivate}
ALLOWED_ADMIN_EMAILS=tiroshbrot123@gmail.com
SUPABASE_PUBLIC_URL=http://localhost:8001
KONG_HTTP_PORT=8001
KONG_HTTPS_PORT=8444
POSTGRES_PORT=5435
`;

const envPath = path.join(__dirname, '.env');
fs.writeFileSync(envPath, envContent, 'utf-8');

console.log('✅ Generated secure Supabase keys successfully in docker/supabase/.env');
console.log(`🔑 Anon Key: ${anonKey.substring(0, 20)}...`);
console.log(`🔑 Service Role Key: ${serviceKey.substring(0, 20)}...`);
