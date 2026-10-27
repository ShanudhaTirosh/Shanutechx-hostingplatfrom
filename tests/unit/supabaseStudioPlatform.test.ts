import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKongConfigYaml, buildSupabaseComposeYaml } from '../../apps/api/src/routes/supabase';
import { getCentralStudioUrl } from '../../apps/dashboard/lib/supabaseAdmin';

test('buildKongConfigYaml creates meta-v1 /pg/ route for platform introspection', () => {
  const yaml = buildKongConfigYaml('anon-jwt', 'service-jwt');
  assert.ok(yaml.includes('name: meta-v1'), 'Kong config must define meta-v1 service');
  assert.ok(yaml.includes('url: http://supabase-meta:8080'), 'Kong config must route to supabase-meta:8080');
  assert.ok(yaml.includes('/pg/'), 'Kong config must register /pg/ path');
});

test('buildSupabaseComposeYaml omits per-project studio container by default', () => {
  const compose = buildSupabaseComposeYaml({
    cleanSlug: 'test-app',
    projectName: 'Test App',
    dbPassword: 'secretpassword',
    dbPort: 5432,
    studioPort: 3000,
    studioUrl: 'http://localhost:3000',
    anonKey: 'anon-key',
    serviceKey: 'service-key',
  });

  assert.ok(!compose.includes('supabase-studio:'), 'Per-project compose should NOT start a studio container by default');
  assert.ok(compose.includes('supabase-meta:'), 'Must include supabase-meta service');
  assert.ok(compose.includes('supabase-kong:'), 'Must include supabase-kong service');
});

test('buildSupabaseComposeYaml includes studio container only when legacy studio is explicitly requested', () => {
  const compose = buildSupabaseComposeYaml({
    cleanSlug: 'legacy-app',
    projectName: 'Legacy App',
    dbPassword: 'secretpassword',
    dbPort: 5432,
    studioPort: 3000,
    studioUrl: 'http://localhost:3000',
    anonKey: 'anon-key',
    serviceKey: 'service-key',
    enableLegacyStudio: true,
  });

  assert.ok(compose.includes('supabase-studio:'), 'Must include supabase-studio when enableLegacyStudio is true');
  assert.ok(compose.includes('container_name: supa-legacy-app-studio'));
});

test('getCentralStudioUrl routes to centralized platform studio project paths and subviews', () => {
  // Test with null project
  const baseUrl = getCentralStudioUrl(null);
  assert.ok(baseUrl.includes('studio.shanutechx.com') || baseUrl.includes('localhost:8000'));

  // Test with active project
  const mockProject: any = {
    id: 'proj_abcdef123456',
    name: 'Production Core',
    status: 'ACTIVE',
  };

  const projectUrl = getCentralStudioUrl(mockProject);
  assert.ok(projectUrl.endsWith('/project/proj_abcdef123456'), `Expected url to end with /project/proj_abcdef123456, got: ${projectUrl}`);

  const editorUrl = getCentralStudioUrl(mockProject, '/editor');
  assert.ok(editorUrl.endsWith('/project/proj_abcdef123456/editor'), `Expected url to end with /project/proj_abcdef123456/editor, got: ${editorUrl}`);

  const storageUrl = getCentralStudioUrl(mockProject, 'storage/buckets');
  assert.ok(storageUrl.endsWith('/project/proj_abcdef123456/storage/buckets'), `Expected url to end with /project/proj_abcdef123456/storage/buckets, got: ${storageUrl}`);

  // Test with custom studioUrl override
  const customProject: any = {
    id: 'proj_custom',
    studioUrl: 'https://my-custom-studio.internal.net',
  };

  const customUrl = getCentralStudioUrl(customProject);
  assert.equal(customUrl, 'https://my-custom-studio.internal.net');

  const customSubpath = getCentralStudioUrl(customProject, '/database/tables');
  assert.equal(customSubpath, 'https://my-custom-studio.internal.net/database/tables');
});
