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
