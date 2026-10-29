import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogHelper } from '../../packages/catalog/src/index';
import type { CatalogTemplate, CatalogDeployInput, Deployment } from '@shanutechx/types';

/**
 * Empirical Adversarial Test Suite for Catalog SDK (@shanutechx/catalog)
 *
 * Stress-tests input validation, boundary cases, error handling,
 * and diagnostic messaging in CatalogHelper.
 */

const samplePostgresTemplate: CatalogTemplate = {
  slug: 'postgresql',
  name: 'PostgreSQL Database',
  description: 'Production-ready PostgreSQL database with persistent storage',
  category: 'database',
  icon: 'postgresql',
  version: '16.0',
  envSchema: [
    {
      key: 'POSTGRES_PASSWORD',
      description: 'Superuser password for PostgreSQL',
      required: true,
      secret: true,
    },
    {
      key: 'POSTGRES_DB',
      description: 'Default database name',
      required: true,
    },
    {
      key: 'POSTGRES_USER',
      description: 'Superuser username',
      required: false,
      defaultValue: 'postgres',
    },
  ],
  ports: [5432],
  tags: ['database', 'sql'],
};

const sampleRedisTemplate: CatalogTemplate = {
  slug: 'redis',
  name: 'Redis In-Memory Store',
  description: 'Fast key-value cache',
  category: 'cache',
  icon: 'redis',
  version: '7.0',
  envSchema: [
    {
      key: 'REDIS_PASSWORD',
      description: 'Redis access password (optional)',
      required: false,
    },
  ],
  ports: [6379],
  tags: ['cache', 'nosql'],
};

const sampleEmptySchemaTemplate: CatalogTemplate = {
  slug: 'static-site',
  name: 'Static Web Site',
  description: 'Zero config static site',
  category: 'other',
  icon: 'web',
  version: '1.0',
  envSchema: [],
  ports: [80],
  tags: ['web'],
};

function createMockClient(
  templates: CatalogTemplate[] = [samplePostgresTemplate, sampleRedisTemplate, sampleEmptySchemaTemplate],
  deployHandler?: (input: CatalogDeployInput) => Promise<Deployment>
) {
  const map = new Map(templates.map((t) => [t.slug, t]));
  return {
    catalog: {
      list: async () => templates,
      get: async (slug: string) => {
        const found = map.get(slug);
        if (!found) {
          throw new Error(`Template not found: ${slug}`);
        }
        return found;
      },
      deploy: deployHandler || (async (input: CatalogDeployInput): Promise<Deployment> => {
        return {
          id: 'dep-mock-001',
          name: input.projectName || input.preferredName || 'mock-app',
          status: 'running',
          templateSlug: input.templateSlug || input.slug,
          envVars: input.envVars || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as unknown as Deployment;
      }),
    },
  } as any;
}

test('CatalogHelper Adversarial Testing — validateEnv static method', async (t) => {
  await t.test('Case 1: envVars is undefined or omitted', () => {
    // When omitted, defaults to {}
    const res1 = CatalogHelper.validateEnv(samplePostgresTemplate);
    assert.equal(res1.valid, false);
    assert.deepEqual(res1.missingKeys, ['POSTGRES_PASSWORD', 'POSTGRES_DB']);

    // Explicit undefined
    const res2 = CatalogHelper.validateEnv(samplePostgresTemplate, undefined as any);
    assert.equal(res2.valid, false);
    assert.deepEqual(res2.missingKeys, ['POSTGRES_PASSWORD', 'POSTGRES_DB']);
  });

  await t.test('Case 2: envVars is empty object {}', () => {
    const res = CatalogHelper.validateEnv(samplePostgresTemplate, {});
    assert.equal(res.valid, false);
    assert.deepEqual(res.missingKeys, ['POSTGRES_PASSWORD', 'POSTGRES_DB']);
  });

  await t.test('Case 3: envVars is null (defensive coalescing test)', () => {
    const res = CatalogHelper.validateEnv(samplePostgresTemplate, null as any);
    assert.equal(res.valid, false);
    assert.deepEqual(res.missingKeys, ['POSTGRES_PASSWORD', 'POSTGRES_DB']);
  });

  await t.test('Case 4: missing some required envVars', () => {
    const res = CatalogHelper.validateEnv(samplePostgresTemplate, {
      POSTGRES_PASSWORD: 'supersecretpass',
      // POSTGRES_DB is omitted
    });
    assert.equal(res.valid, false);
    assert.deepEqual(res.missingKeys, ['POSTGRES_DB']);
  });

  await t.test('Case 5: required envVar present but empty string or whitespace-only', () => {
    const resEmpty = CatalogHelper.validateEnv(samplePostgresTemplate, {
      POSTGRES_PASSWORD: '',
      POSTGRES_DB: 'mydb',
    });
    assert.equal(resEmpty.valid, false);
    assert.deepEqual(resEmpty.missingKeys, ['POSTGRES_PASSWORD']);

    const resWhitespace = CatalogHelper.validateEnv(samplePostgresTemplate, {
      POSTGRES_PASSWORD: '   \t  \n ',
      POSTGRES_DB: 'mydb',
    });
    assert.equal(resWhitespace.valid, false);
    assert.deepEqual(resWhitespace.missingKeys, ['POSTGRES_PASSWORD']);
  });

  await t.test('Case 6: extra unrecognized envVars are safely tolerated during validation', () => {
    const res = CatalogHelper.validateEnv(samplePostgresTemplate, {
      POSTGRES_PASSWORD: 'secretpassword',
      POSTGRES_DB: 'production_db',
      UNRECOGNIZED_CUSTOM_KEY: 'some_value',
      ANOTHER_RANDOM_VAR: '12345',
      'SPECIAL_CHAR_KEY_$%': 'val',
    });
    assert.equal(res.valid, true);
    assert.deepEqual(res.missingKeys, []);
  });

  await t.test('Case 7: template with empty envSchema requires no envVars', () => {
    const resEmpty = CatalogHelper.validateEnv(sampleEmptySchemaTemplate, {});
    assert.equal(resEmpty.valid, true);
    assert.deepEqual(resEmpty.missingKeys, []);

    const resWithExtras = CatalogHelper.validateEnv(sampleEmptySchemaTemplate, { ANY_VAR: 'val' });
    assert.equal(resWithExtras.valid, true);
    assert.deepEqual(resWithExtras.missingKeys, []);
  });

  await t.test('Case 8: optional envVar omitted does not trigger validation failure', () => {
    const res = CatalogHelper.validateEnv(sampleRedisTemplate, {});
    assert.equal(res.valid, true);
    assert.deepEqual(res.missingKeys, []);
  });
});

test('CatalogHelper Adversarial Testing — deployTemplate method', async (t) => {
  const client = createMockClient();
  const helper = new CatalogHelper(client);

  await t.test('Boundary 1: Empty input object {} throws descriptive error', async () => {
    await assert.rejects(
      async () => {
        await helper.deployTemplate({});
      },
      {
        name: 'Error',
        message: "Cannot deploy template: 'templateSlug' or 'slug' is required",
      }
    );
  });

  await t.test('Boundary 2: Empty templateSlug ("") and missing slug throws descriptive error', async () => {
    await assert.rejects(
      async () => {
        await helper.deployTemplate({ templateSlug: '' });
      },
      {
        name: 'Error',
        message: "Cannot deploy template: 'templateSlug' or 'slug' is required",
      }
    );
  });

  await t.test('Boundary 3: Empty slug ("") and missing templateSlug throws descriptive error', async () => {
    await assert.rejects(
      async () => {
        await helper.deployTemplate({ slug: '' });
      },
      {
        name: 'Error',
        message: "Cannot deploy template: 'templateSlug' or 'slug' is required",
      }
    );
  });

  await t.test('Boundary 4: Both templateSlug and slug empty string throws descriptive error', async () => {
    await assert.rejects(
      async () => {
        await helper.deployTemplate({ templateSlug: '', slug: '' });
      },
      {
        name: 'Error',
        message: "Cannot deploy template: 'templateSlug' or 'slug' is required",
      }
    );
  });

  await t.test('Boundary 5: envVars undefined with template requiring envVars throws clear diagnostic', async () => {
    await assert.rejects(
      async () => {
        await helper.deployTemplate({ templateSlug: 'postgresql', envVars: undefined });
      },
      {
        name: 'Error',
        message: "Cannot deploy template 'postgresql': Missing required environment variables: POSTGRES_PASSWORD, POSTGRES_DB",
      }
    );
  });

  await t.test('Boundary 6: Missing required envVars lists exact missing keys in error', async () => {
    await assert.rejects(
      async () => {
        await helper.deployTemplate({
          templateSlug: 'postgresql',
          envVars: {
            POSTGRES_PASSWORD: 'secure_password_123',
            // POSTGRES_DB is missing
          },
        });
      },
      {
        name: 'Error',
        message: "Cannot deploy template 'postgresql': Missing required environment variables: POSTGRES_DB",
      }
    );
  });

  await t.test('Resolution 1: Valid input using templateSlug resolves and deploys properly', async () => {
    let capturedInput: CatalogDeployInput | null = null;
    const testClient = createMockClient(undefined, async (inp) => {
      capturedInput = inp;
      return { id: 'dep-pg-1', status: 'running' } as any;
    });
    const testHelper = new CatalogHelper(testClient);

    const dep = await testHelper.deployTemplate({
      templateSlug: 'postgresql',
      projectName: 'my-postgres-app',
      envVars: {
        POSTGRES_PASSWORD: 'pw1',
        POSTGRES_DB: 'db1',
      },
    });

    assert.equal(dep.id, 'dep-pg-1');
    assert.ok(capturedInput);
    assert.equal((capturedInput as any).templateSlug, 'postgresql');
    assert.equal((capturedInput as any).envVars.POSTGRES_PASSWORD, 'pw1');
  });

  await t.test('Resolution 2: Valid input using slug fallback resolves and deploys properly', async () => {
    let capturedInput: CatalogDeployInput | null = null;
    const testClient = createMockClient(undefined, async (inp) => {
      capturedInput = inp;
      return { id: 'dep-redis-1', status: 'running' } as any;
    });
    const testHelper = new CatalogHelper(testClient);

    const dep = await testHelper.deployTemplate({
      slug: 'redis',
      projectName: 'my-redis-cache',
    });

    assert.equal(dep.id, 'dep-redis-1');
    assert.ok(capturedInput);
    assert.equal((capturedInput as any).slug, 'redis');
  });

  await t.test('Resolution 3: Extra unrecognized envVars pass through to deploy successfully', async () => {
    let capturedInput: CatalogDeployInput | null = null;
    const testClient = createMockClient(undefined, async (inp) => {
      capturedInput = inp;
      return { id: 'dep-extra-1', status: 'running' } as any;
    });
    const testHelper = new CatalogHelper(testClient);

    const dep = await testHelper.deployTemplate({
      templateSlug: 'redis',
      envVars: {
        EXTRA_CUSTOM_FLAG: 'true',
        ANOTHER_CONFIG: 'xyz',
      },
    });

    assert.equal(dep.id, 'dep-extra-1');
    assert.equal((capturedInput as any).envVars.EXTRA_CUSTOM_FLAG, 'true');
    assert.equal((capturedInput as any).envVars.ANOTHER_CONFIG, 'xyz');
  });

  await t.test('Resolution 4: Non-existent template slug propagates client error gracefully', async () => {
    await assert.rejects(
      async () => {
        await helper.deployTemplate({ templateSlug: 'non-existent-template-slug-999' });
      },
      {
        name: 'Error',
        message: 'Template not found: non-existent-template-slug-999',
      }
    );
  });
});

test('CatalogHelper Adversarial Testing — listing and category filtering', async (t) => {
  const client = createMockClient();
  const helper = new CatalogHelper(client);

  await t.test('listTemplates returns all templates', async () => {
    const list = await helper.listTemplates();
    assert.equal(list.length, 3);
  });

  await t.test('listByCategory returns matched category and filters non-matching', async () => {
    const dbTemplates = await helper.listByCategory('database');
    assert.equal(dbTemplates.length, 1);
    assert.equal(dbTemplates[0].slug, 'postgresql');

    const aiTemplates = await helper.listByCategory('ai');
    assert.equal(aiTemplates.length, 0);
  });

  await t.test('getTemplate returns requested template or rejects', async () => {
    const tpl = await helper.getTemplate('postgresql');
    assert.equal(tpl.slug, 'postgresql');

    await assert.rejects(
      async () => {
        await helper.getTemplate('unknown');
      },
      /Template not found: unknown/
    );
  });
});
