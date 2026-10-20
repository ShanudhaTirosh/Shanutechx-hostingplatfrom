import test from 'node:test';
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';

/**
 * Loads the REAL apps/mobile-admin/src/lib/api.ts against in-memory fakes of AsyncStorage (unencrypted)
 * and SecureStore (keychain), so we can assert where the admin API key and server URL end up.
 */
const LEGACY_KEY = '@shanutechx_admin_key';
const BASE_KEY = '@shanutechx_api_base';
const SECURE_KEY = 'shanutechx_admin_key';

function load(opts: { secureFails?: boolean } = {}) {
  const async = new Map<string, string>();
  const secure = new Map<string, string>();
  const asyncStorage = {
    getItem: async (k: string) => (async.has(k) ? async.get(k)! : null),
    setItem: async (k: string, v: string) => { async.set(k, v); },
    removeItem: async (k: string) => { async.delete(k); },
  };
  const secureStore = {
    getItemAsync: async (k: string) => { if (opts.secureFails) throw new Error('keychain unavailable'); return secure.has(k) ? secure.get(k)! : null; },
    setItemAsync: async (k: string, v: string) => { if (opts.secureFails) throw new Error('keychain unavailable'); secure.set(k, v); },
    deleteItemAsync: async (k: string) => { if (opts.secureFails) throw new Error('keychain unavailable'); secure.delete(k); },
  };

  const M: any = Module;
  const orig = M._load;
  M._load = function (request: string, parent: any, ...rest: any[]) {
    if (request === 'expo-constants') return { __esModule: true, default: { expoConfig: { extra: {} } } };
    if (request === '@react-native-async-storage/async-storage') return { __esModule: true, default: asyncStorage };
    if (request === 'expo-secure-store') return { __esModule: true, ...secureStore };
    if (/apps\/mobile-admin/.test(parent?.filename || '') && /(^|\/)firebase$/.test(request)) return { auth: { currentUser: null } };
    return orig.call(this, request, parent, ...rest);
  };
  const req = createRequire(import.meta.url);
  const file = req.resolve('../../apps/mobile-admin/src/lib/api.ts');
  delete req.cache[file];
  let api: any;
  try { api = req(file); } finally { M._load = orig; }
  return { api, async, secure };
}

test('a legacy plaintext admin key is migrated into SecureStore and removed from AsyncStorage', async () => {
  const { api, async, secure } = load();
  async.set(LEGACY_KEY, 'shx_legacy_key');
  await api.initApiConfig();
  assert.equal(secure.get(SECURE_KEY), 'shx_legacy_key');
  assert.equal(async.has(LEGACY_KEY), false, 'plaintext copy must be deleted');
  assert.equal(await api.getStoredApiKey(), 'shx_legacy_key');
});

test('setStoredApiKey writes to SecureStore only and never to AsyncStorage; null clears both', async () => {
  const { api, async, secure } = load();
  await api.setStoredApiKey('shx_new_key');
  assert.equal(secure.get(SECURE_KEY), 'shx_new_key');
  assert.deepEqual([...async.keys()].filter((k) => k.includes('admin_key')), []);
  await api.setStoredApiKey(null);
  assert.equal(secure.has(SECURE_KEY), false);
  assert.equal(await api.getStoredApiKey(), null);
});

test('if the keychain is unavailable the key is kept in memory only, never falling back to AsyncStorage', async () => {
  const { api, async } = load({ secureFails: true });
  await api.setStoredApiKey('shx_memory_only');
  assert.equal(async.size, 0, 'nothing may be written to AsyncStorage');
  assert.equal(await api.getStoredApiKey(), 'shx_memory_only');
});

test('a legacy key is not left in plaintext even when the migration into SecureStore fails', async () => {
  const { api, async } = load({ secureFails: true });
  async.set(LEGACY_KEY, 'shx_legacy_key');
  await api.initApiConfig();
  assert.equal(async.has(LEGACY_KEY), false);
  assert.equal(await api.getStoredApiKey(), 'shx_legacy_key');
});

test('the server URL setting rejects insecure and credential-bearing URLs and keeps the previous value', async () => {
  const { api } = load();
  await api.setApiBaseUrl('https://api.example.com/');
  assert.equal(api.getEffectiveApiBase(), 'https://api.example.com');
  for (const bad of ['http://evil.example', 'https://user:pw@evil.example', 'javascript:alert(1)', 'https://x.com?a=1']) {
    await assert.rejects(() => api.setApiBaseUrl(bad), `${bad} must be rejected`);
    assert.equal(api.getEffectiveApiBase(), 'https://api.example.com', 'previous value must be kept');
  }
  await api.setApiBaseUrl('   ');
  assert.equal(api.getEffectiveApiBase(), api.DEFAULT_API_BASE);
});

test('a previously stored insecure server URL is ignored and forgotten at startup', async () => {
  const { api, async } = load();
  async.set(BASE_KEY, 'http://evil.example');
  await api.initApiConfig();
  assert.equal(api.getEffectiveApiBase(), api.DEFAULT_API_BASE);
  assert.equal(async.has(BASE_KEY), false);
  async.set(BASE_KEY, 'https://staging.example.com/');
  const again = load();
  again.async.set(BASE_KEY, 'https://staging.example.com/');
  await again.api.initApiConfig();
  assert.equal(again.api.getEffectiveApiBase(), 'https://staging.example.com');
});
