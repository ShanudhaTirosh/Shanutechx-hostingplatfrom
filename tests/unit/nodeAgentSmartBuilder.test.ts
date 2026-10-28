import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Require the node-agent build module
const { generateSmartDockerfile } = require('../../services/node-agent/src/build');

test('generateSmartDockerfile generates Node.js Dockerfile when package.json is present', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'builder-test-node-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'my-app', scripts: { start: 'node server.js' } }), 'utf8');

    const result = generateSmartDockerfile(tmpDir, { startCommand: undefined, entryFile: undefined });
    assert.equal(result.isGenerated, true);
    assert.equal(result.runtime, 'nodejs');

    const content = fs.readFileSync(path.join(tmpDir, 'Dockerfile'), 'utf8');
    assert.ok(content.includes('FROM node:20-alpine'));
    assert.ok(content.includes('EXPOSE 3000'));
    assert.ok(content.includes('CMD ["npm", "start"]'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('generateSmartDockerfile generates Python Dockerfile when requirements.txt is present', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'builder-test-py-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask==3.0.0\n', 'utf8');

    const result = generateSmartDockerfile(tmpDir, { startCommand: 'python app.py' });
    assert.equal(result.isGenerated, true);
    assert.equal(result.runtime, 'python');

    const content = fs.readFileSync(path.join(tmpDir, 'Dockerfile'), 'utf8');
    assert.ok(content.includes('FROM python:3.11-slim'));
    assert.ok(content.includes('RUN pip install'));
    assert.ok(content.includes('python app.py'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('generateSmartDockerfile skips generation when custom Dockerfile exists', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'builder-test-df-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), 'FROM ubuntu:latest\nCMD echo custom', 'utf8');

    const result = generateSmartDockerfile(tmpDir, {});
    assert.equal(result.isGenerated, false);
    assert.equal(result.runtime, 'custom-dockerfile');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('generateSmartDockerfile detects Next.js framework preset and generates optimized runner', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'builder-test-next-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'next-app', dependencies: { next: '^14.0.0', react: '^18.0.0' } }), 'utf8');

    const result = generateSmartDockerfile(tmpDir, { frameworkPreset: 'nextjs' });
    assert.equal(result.isGenerated, true);
    assert.equal(result.runtime, 'nodejs');

    const content = fs.readFileSync(path.join(tmpDir, 'Dockerfile'), 'utf8');
    assert.ok(content.includes('FROM node:20-alpine'));
    assert.ok(content.includes('npm run build'));
    assert.ok(content.includes('CMD ["npm", "start"]'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('generateSmartDockerfile detects Vite SPA and generates npx serve runner', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'builder-test-vite-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'vite-app', devDependencies: { vite: '^5.0.0' }, scripts: { build: 'vite build' } }), 'utf8');

    const result = generateSmartDockerfile(tmpDir, { frameworkPreset: 'react_vite' });
    assert.equal(result.isGenerated, true);
    assert.equal(result.runtime, 'nodejs');

    const content = fs.readFileSync(path.join(tmpDir, 'Dockerfile'), 'utf8');
    assert.ok(content.includes('npx serve -s dist'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('generateSmartDockerfile detects Lavalink Java jar configuration', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'builder-test-lava-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'Lavalink.jar'), 'dummy-jar', 'utf8');

    const result = generateSmartDockerfile(tmpDir, { frameworkPreset: 'lavalink_java' });
    assert.equal(result.isGenerated, true);
    assert.equal(result.runtime, 'java-lavalink');

    const content = fs.readFileSync(path.join(tmpDir, 'Dockerfile'), 'utf8');
    assert.ok(content.includes('FROM eclipse-temurin:17-jre-alpine'));
    assert.ok(content.includes('java", "-jar", "Lavalink.jar'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
