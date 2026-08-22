/**
 * Property-based tests for template parser metadata extraction
 * **Validates: Requirements 1.4, 3.2, 14.4, 14.5**
 * 
 * Run: npx tsx --test tests/unit/template-parser.property.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fc from 'fast-check';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Import the parser functions we're testing
import { parseTemplateYaml } from '../../apps/api/src/lib/catalog/template-parser';

/**
 * Property 2: Template Metadata Extraction Completeness
 * 
 * For any template YAML file with comment header metadata (documentation, slogan, 
 * category, tags, logo, port), the Catalog Manager SHALL extract all present 
 * metadata fields correctly, and for any missing optional field, SHALL provide 
 * an appropriate default value.
 */
describe('Template Metadata Extraction Completeness (Property 2)', () => {
  
  it('extracts all present metadata fields correctly and provides defaults for missing fields', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary optional metadata fields
        fc.record({
          name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          documentation: fc.option(fc.webUrl(), { nil: undefined }),
          slogan: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
          category: fc.option(
            fc.constantFrom(
              'automation', 'database', 'monitoring', 'storage', 
              'collaboration', 'app', 'service', 'package', 'other'
            ),
            { nil: undefined }
          ),
          tags: fc.option(
            fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
            { nil: undefined }
          ),
          logo: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          port: fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined }),
        }),
        (metadata) => {
          // Create a temporary YAML file with the generated metadata
          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
          const tmpFile = path.join(tmpDir, 'test-template.yaml');
          
          try {
            // Build comment header based on which fields are present
            let commentHeader = '';
            if (metadata.name !== undefined) {
              commentHeader += `# name: ${metadata.name}\n`;
            }
            if (metadata.documentation !== undefined) {
              commentHeader += `# documentation: ${metadata.documentation}\n`;
            }
            if (metadata.slogan !== undefined) {
              commentHeader += `# slogan: ${metadata.slogan}\n`;
            }
            if (metadata.category !== undefined) {
              commentHeader += `# category: ${metadata.category}\n`;
            }
            if (metadata.tags !== undefined && metadata.tags.length > 0) {
              commentHeader += `# tags: ${metadata.tags.join(',')}\n`;
            }
            if (metadata.logo !== undefined) {
              commentHeader += `# logo: ${metadata.logo}\n`;
            }
            if (metadata.port !== undefined) {
              commentHeader += `# port: ${metadata.port}\n`;
            }
            
            // Create a minimal valid YAML template
            const yamlContent = `${commentHeader}
services:
  testservice:
    image: nginx:latest
    environment:
      - TEST_VAR=\${TEST_VAR:-default}
`;
            
            fs.writeFileSync(tmpFile, yamlContent, 'utf-8');
            
            // Parse the template
            const result = parseTemplateYaml(tmpFile);
            
            // Verify all present fields are extracted correctly
            if (metadata.name !== undefined) {
              // Parser trims whitespace from all metadata values
              const expectedName = metadata.name.trim();
              assert.equal(result.name, expectedName || 'test-template',
                `Expected name to be "${expectedName || 'test-template'}" but got "${result.name}"`);
            } else {
              // If name is not provided, should use slug (filename without extension)
              assert.equal(result.name, 'test-template',
                `Expected name to default to slug "test-template" but got "${result.name}"`);
            }
            
            if (metadata.documentation !== undefined) {
              const expectedDoc = metadata.documentation.trim();
              assert.equal(result.documentation, expectedDoc,
                `Expected documentation to be "${expectedDoc}" (trimmed) but got "${result.documentation}"`);
            } else {
              assert.equal(result.documentation, '',
                `Expected documentation to default to empty string but got "${result.documentation}"`);
            }
            
            if (metadata.slogan !== undefined) {
              // Parser trims whitespace from values (good data hygiene)
              const expectedSlogan = metadata.slogan.trim();
              assert.equal(result.slogan, expectedSlogan,
                `Expected slogan to be "${expectedSlogan}" (trimmed) but got "${result.slogan}"`);
            } else {
              assert.equal(result.slogan, '',
                `Expected slogan to default to empty string but got "${result.slogan}"`);
            }
            
            if (metadata.category !== undefined) {
              assert.equal(result.category, metadata.category,
                `Expected category to be "${metadata.category}" but got "${result.category}"`);
            } else {
              assert.equal(result.category, 'other',
                `Expected category to default to "other" but got "${result.category}"`);
            }
            
            if (metadata.tags !== undefined && metadata.tags.length > 0) {
              // Build the tags string as it would appear in YAML
              const tagsInYaml = metadata.tags.join(',');
              // Parse it the same way the parser does: split by comma, trim, filter empty
              const expectedTags = tagsInYaml
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);
              
              assert.deepEqual(result.tags, expectedTags,
                `Expected tags to be ${JSON.stringify(expectedTags)} (as parsed from "${tagsInYaml}") but got ${JSON.stringify(result.tags)}`);
            } else {
              assert.deepEqual(result.tags, [],
                `Expected tags to default to empty array but got ${JSON.stringify(result.tags)}`);
            }
            
            if (metadata.logo !== undefined) {
              const expectedLogo = metadata.logo.trim();
              assert.equal(result.logo, expectedLogo,
                `Expected logo to be "${expectedLogo}" (trimmed) but got "${result.logo}"`);
            } else {
              assert.equal(result.logo, '',
                `Expected logo to default to empty string but got "${result.logo}"`);
            }
            
            if (metadata.port !== undefined) {
              // Parser validates port range (1-65535), so only valid ports are preserved
              assert.equal(result.port, metadata.port,
                `Expected port to be ${metadata.port} but got ${result.port}`);
            } else {
              assert.equal(result.port, null,
                `Expected port to default to null but got ${result.port}`);
            }
            
            // Verify slug and filename are set correctly
            assert.equal(result.slug, 'test-template',
              `Expected slug to be "test-template" but got "${result.slug}"`);
            assert.equal(result.filename, 'test-template.yaml',
              `Expected filename to be "test-template.yaml" but got "${result.filename}"`);
            
          } finally {
            // Clean up temporary files
            try {
              fs.unlinkSync(tmpFile);
              fs.rmdirSync(tmpDir);
            } catch (err) {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 100 } // Run with minimum 100 iterations as specified
    );
  });
  
  it('handles edge cases: empty metadata, special characters, whitespace', () => {
    fc.assert(
      fc.property(
        fc.record({
          slogan: fc.option(
            fc.string({ minLength: 0, maxLength: 200 }).map(s => 
              // Add special characters and whitespace
              s.includes(':') ? s.replace(/:/g, '\\:') : s
            ),
            { nil: undefined }
          ),
          tags: fc.option(
            fc.array(
              fc.string({ minLength: 0, maxLength: 30 }).map(s => s.trim()),
              { minLength: 0, maxLength: 5 }
            ).map(arr => arr.filter(s => s.length > 0)), // Remove empty strings
            { nil: undefined }
          ),
        }),
        (metadata) => {
          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-edge-'));
          const tmpFile = path.join(tmpDir, 'edge-test.yaml');
          
          try {
            let commentHeader = '';
            
            if (metadata.slogan !== undefined) {
              // Escape the slogan for YAML comment
              const escapedSlogan = metadata.slogan.replace(/\n/g, ' ').trim();
              if (escapedSlogan.length > 0) {
                commentHeader += `# slogan: ${escapedSlogan}\n`;
              }
            }
            
            if (metadata.tags !== undefined && metadata.tags.length > 0) {
              const validTags = metadata.tags.filter(t => t.length > 0);
              if (validTags.length > 0) {
                commentHeader += `# tags: ${validTags.join(',')}\n`;
              }
            }
            
            const yamlContent = `${commentHeader}
services:
  edge:
    image: test:latest
`;
            
            fs.writeFileSync(tmpFile, yamlContent, 'utf-8');
            const result = parseTemplateYaml(tmpFile);
            
            // Should not throw and should provide defaults
            assert.ok(result, 'Parser should return a result');
            assert.equal(typeof result.slogan, 'string', 'Slogan should be a string');
            assert.ok(Array.isArray(result.tags), 'Tags should be an array');
            assert.equal(result.category, 'other', 'Category should default to "other"');
            
          } finally {
            try {
              fs.unlinkSync(tmpFile);
              fs.rmdirSync(tmpDir);
            } catch (err) {
              // Ignore
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('correctly parses comma-separated tags with varying whitespace', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 15 }), { minLength: 1, maxLength: 8 }),
        fc.constantFrom(0, 1, 2, 3), // Number of spaces after comma
        (tagList, spacesAfterComma) => {
          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tags-test-'));
          const tmpFile = path.join(tmpDir, 'tags.yaml');
          
          try {
            // Create tags string with varying whitespace
            const spaces = ' '.repeat(spacesAfterComma);
            const tagsString = tagList.join(`,${spaces}`);
            
            const yamlContent = `# tags: ${tagsString}

services:
  app:
    image: test:latest
`;
            
            fs.writeFileSync(tmpFile, yamlContent, 'utf-8');
            const result = parseTemplateYaml(tmpFile);
            
            // Tags should be trimmed and split correctly
            // Parser splits by comma, trims, and filters empty strings
            // So we need to apply the same logic to our expected value
            const expectedTags = tagsString
              .split(',')
              .map(t => t.trim())
              .filter(t => t.length > 0);
            
            assert.deepEqual(
              result.tags,
              expectedTags,
              `Expected tags ${JSON.stringify(expectedTags)} but got ${JSON.stringify(result.tags)}`
            );
            
          } finally {
            try {
              fs.unlinkSync(tmpFile);
              fs.rmdirSync(tmpDir);
            } catch (err) {
              // Ignore
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('handles invalid port values gracefully', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('not-a-number'),
          fc.constant(''),
          fc.constant('99999999999'),
          fc.constant('-100'),
          fc.constant('3.14'),
        ),
        (invalidPort) => {
          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'port-test-'));
          const tmpFile = path.join(tmpDir, 'port.yaml');
          
          try {
            const yamlContent = `# port: ${invalidPort}

services:
  app:
    image: test:latest
`;
            
            fs.writeFileSync(tmpFile, yamlContent, 'utf-8');
            const result = parseTemplateYaml(tmpFile);
            
            // Invalid ports should result in null
            assert.equal(
              result.port,
              null,
              `Expected null for invalid port "${invalidPort}" but got ${result.port}`
            );
            
          } finally {
            try {
              fs.unlinkSync(tmpFile);
              fs.rmdirSync(tmpDir);
            } catch (err) {
              // Ignore
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
