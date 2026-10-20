import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Production images must install exactly what CI tested. These Dockerfiles used to copy only
 * package.json and run `npm install`, which re-resolves the latest in-range versions of every
 * dependency on each build (and ignores the lockfile entirely).
 */
const ROOT = path.join(__dirname, '../..');
const dockerfiles = ['apps', 'services']
  .flatMap((dir) => fs.readdirSync(path.join(ROOT, dir)).map((name) => path.join(dir, name, 'Dockerfile')))
  .filter((f) => fs.existsSync(path.join(ROOT, f)));

test('found the app Dockerfiles (sanity)', () => {
  assert.ok(dockerfiles.length >= 6, `expected >= 6 Dockerfiles, found ${dockerfiles.join(', ')}`);
});

for (const file of dockerfiles) {
  test(`${file} installs from the lockfile with npm ci`, () => {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.match(src, /COPY package\.json package-lock\.json \.\//, 'must copy package-lock.json');
    assert.match(src, /^RUN npm ci /m, 'must install with npm ci');
    assert.doesNotMatch(src, /^RUN npm install /m, 'must not use npm install (ignores the lockfile)');
  });
}
