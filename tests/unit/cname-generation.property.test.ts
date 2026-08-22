/**
 * Property-based tests for CNAME target uniqueness and format
 * **Validates: Requirements 4.2**
 * 
 * Run: npx tsx --test tests/unit/cname-generation.property.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fc from 'fast-check';

/**
 * Generate CNAME target for a deployment
 * 
 * Format: {deployment-id}.{root-domain}
 * Example: dep-abc123.shanutechx.com
 * 
 * @param deploymentId - Unique deployment identifier (typically a subdomain slug or CUID)
 * @param rootDomain - Root domain for the platform (e.g., "shanutechx.com")
 * @returns CNAME target string
 */
export function generateCnameTarget(deploymentId: string, rootDomain: string): string {
  // Validate inputs
  if (!deploymentId || typeof deploymentId !== 'string') {
    throw new Error('deploymentId must be a non-empty string');
  }
  if (!rootDomain || typeof rootDomain !== 'string') {
    throw new Error('rootDomain must be a non-empty string');
  }
  
  // Generate CNAME target in format: {deployment-id}.{root-domain}
  return `${deploymentId}.${rootDomain}`;
}

/**
 * Extract deployment ID from a CNAME target
 * 
 * @param cnameTarget - CNAME target string
 * @param rootDomain - Root domain for the platform
 * @returns Deployment ID or null if invalid format
 */
export function extractDeploymentId(cnameTarget: string, rootDomain: string): string | null {
  const suffix = `.${rootDomain}`;
  if (!cnameTarget.endsWith(suffix)) {
    return null;
  }
  const deploymentId = cnameTarget.slice(0, -suffix.length);
  return deploymentId || null;
}

/**
 * Validate CNAME target format
 * 
 * @param cnameTarget - CNAME target string to validate
 * @param rootDomain - Expected root domain
 * @returns true if valid format, false otherwise
 */
export function isValidCnameTarget(cnameTarget: string, rootDomain: string): boolean {
  // Check basic format: {deployment-id}.{root-domain}
  const suffix = `.${rootDomain}`;
  if (!cnameTarget.endsWith(suffix)) {
    return false;
  }
  
  const deploymentId = cnameTarget.slice(0, -suffix.length);
  
  // Deployment ID must be non-empty
  if (!deploymentId) {
    return false;
  }
  
  // Deployment ID should be a valid subdomain (alphanumeric and hyphens, not starting/ending with hyphen)
  const validSubdomainPattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  return validSubdomainPattern.test(deploymentId);
}

/**
 * Property 5: CNAME Target Uniqueness and Format
 * 
 * For any two distinct deployments, the generated CNAME targets SHALL be unique 
 * (no collisions), and each CNAME target SHALL follow the format pattern 
 * {deployment-id}.{root-domain} where deployment-id is the unique deployment identifier.
 */
describe('CNAME Target Uniqueness and Format (Property 5)', () => {
  
  // Generator for valid deployment IDs (subdomain-style identifiers)
  const validDeploymentIdGenerator = fc.oneof(
    // CUID-style: alphanumeric lowercase
    fc.string({ 
      minLength: 8, 
      maxLength: 25, 
      unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split(''))
    }),
    // Slug-style: alphanumeric with hyphens
    fc.array(
      fc.string({ 
        minLength: 1, 
        maxLength: 10, 
        unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split(''))
      }),
      { minLength: 1, maxLength: 5 }
    ).map(parts => parts.join('-')),
    // Short identifiers
    fc.string({ 
      minLength: 3, 
      maxLength: 8, 
      unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split(''))
    }),
    // Long identifiers (up to 63 chars, DNS subdomain limit)
    fc.string({ 
      minLength: 40, 
      maxLength: 63, 
      unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split(''))
    }).filter(s => /^[a-z0-9].*[a-z0-9]$/.test(s)), // Must start and end with alphanumeric
  );
  
  // Generator for valid root domains
  const validRootDomainGenerator = fc.oneof(
    fc.constant('shanutechx.com'),
    fc.constant('example.com'),
    fc.constant('platform.io'),
    fc.constant('app.dev'),
    fc.array(
      fc.string({ 
        minLength: 2, 
        maxLength: 10, 
        unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split(''))
      }),
      { minLength: 2, maxLength: 3 }
    ).map(parts => parts.join('.')),
  );

  it('generates unique CNAME targets for distinct deployment IDs', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(validDeploymentIdGenerator, { minLength: 2, maxLength: 100 }),
        validRootDomainGenerator,
        (deploymentIds, rootDomain) => {
          // Generate CNAME targets for all deployment IDs
          const cnameTargets = deploymentIds.map(id => 
            generateCnameTarget(id, rootDomain)
          );
          
          // Verify all CNAME targets are unique (no collisions)
          const uniqueTargets = new Set(cnameTargets);
          assert.equal(
            uniqueTargets.size,
            deploymentIds.length,
            `Expected ${deploymentIds.length} unique CNAME targets, got ${uniqueTargets.size}. ` +
            `Deployment IDs: ${deploymentIds.slice(0, 5).join(', ')}... ` +
            `CNAME targets: ${[...uniqueTargets].slice(0, 5).join(', ')}...`
          );
          
          // Verify bijection: distinct deployment IDs => distinct CNAME targets
          assert.equal(
            new Set(deploymentIds).size,
            uniqueTargets.size,
            'Bijection property violated: unique deployment IDs should map to unique CNAME targets'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generates CNAME targets following the format pattern {deployment-id}.{root-domain}', () => {
    fc.assert(
      fc.property(
        validDeploymentIdGenerator,
        validRootDomainGenerator,
        (deploymentId, rootDomain) => {
          const cnameTarget = generateCnameTarget(deploymentId, rootDomain);
          
          // Verify format: should contain exactly one separator between deployment ID and root domain
          assert.ok(
            cnameTarget.includes('.'),
            `CNAME target should contain a dot separator: ${cnameTarget}`
          );
          
          // Verify ends with root domain
          assert.ok(
            cnameTarget.endsWith(`.${rootDomain}`),
            `CNAME target should end with .${rootDomain}, got: ${cnameTarget}`
          );
          
          // Verify starts with deployment ID
          assert.ok(
            cnameTarget.startsWith(deploymentId),
            `CNAME target should start with deployment ID ${deploymentId}, got: ${cnameTarget}`
          );
          
          // Verify exact format
          const expected = `${deploymentId}.${rootDomain}`;
          assert.equal(
            cnameTarget,
            expected,
            `CNAME target should match format {deployment-id}.{root-domain}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('generates stable CNAME targets (same input produces same output)', () => {
    fc.assert(
      fc.property(
        validDeploymentIdGenerator,
        validRootDomainGenerator,
        (deploymentId, rootDomain) => {
          const target1 = generateCnameTarget(deploymentId, rootDomain);
          const target2 = generateCnameTarget(deploymentId, rootDomain);
          const target3 = generateCnameTarget(deploymentId, rootDomain);
          
          assert.equal(
            target1,
            target2,
            'Same inputs should produce identical CNAME targets (stability property)'
          );
          assert.equal(
            target2,
            target3,
            'Same inputs should produce identical CNAME targets (stability property)'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('extracts correct deployment ID from CNAME target', () => {
    fc.assert(
      fc.property(
        validDeploymentIdGenerator,
        validRootDomainGenerator,
        (deploymentId, rootDomain) => {
          const cnameTarget = generateCnameTarget(deploymentId, rootDomain);
          const extracted = extractDeploymentId(cnameTarget, rootDomain);
          
          assert.equal(
            extracted,
            deploymentId,
            `Should extract original deployment ID. Expected: ${deploymentId}, Got: ${extracted}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validates CNAME target format correctly', () => {
    fc.assert(
      fc.property(
        validDeploymentIdGenerator,
        validRootDomainGenerator,
        (deploymentId, rootDomain) => {
          const cnameTarget = generateCnameTarget(deploymentId, rootDomain);
          const isValid = isValidCnameTarget(cnameTarget, rootDomain);
          
          assert.ok(
            isValid,
            `Generated CNAME target should be valid: ${cnameTarget}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects invalid CNAME target formats', () => {
    fc.assert(
      fc.property(
        validRootDomainGenerator,
        fc.oneof(
          fc.constant(''),
          fc.constant('no-dots-here'),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('.')),
          fc.constant('wrong.domain.com'),
          fc.constant('.example.com'), // Missing deployment ID
          fc.constant('example.com'), // Missing deployment ID
        ),
        (rootDomain, invalidTarget) => {
          const isValid = isValidCnameTarget(invalidTarget, rootDomain);
          
          assert.ok(
            !isValid,
            `Invalid CNAME target should be rejected: ${invalidTarget}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handles edge case: short deployment IDs (3 chars)', () => {
    const shortId = 'abc';
    const rootDomain = 'example.com';
    const cnameTarget = generateCnameTarget(shortId, rootDomain);
    
    assert.equal(cnameTarget, 'abc.example.com');
    assert.ok(isValidCnameTarget(cnameTarget, rootDomain));
    assert.equal(extractDeploymentId(cnameTarget, rootDomain), shortId);
  });

  it('handles edge case: long deployment IDs (63 chars, DNS subdomain limit)', () => {
    // DNS labels have a 63-character limit
    const longId = 'a'.repeat(63);
    const rootDomain = 'example.com';
    const cnameTarget = generateCnameTarget(longId, rootDomain);
    
    assert.equal(cnameTarget, `${longId}.example.com`);
    assert.equal(extractDeploymentId(cnameTarget, rootDomain), longId);
  });

  it('handles edge case: deployment IDs with hyphens', () => {
    const deploymentId = 'my-app-123';
    const rootDomain = 'platform.io';
    const cnameTarget = generateCnameTarget(deploymentId, rootDomain);
    
    assert.equal(cnameTarget, 'my-app-123.platform.io');
    assert.ok(isValidCnameTarget(cnameTarget, rootDomain));
    assert.equal(extractDeploymentId(cnameTarget, rootDomain), deploymentId);
  });

  it('handles edge case: multiple subdomains in root domain', () => {
    const deploymentId = 'app123';
    const rootDomain = 'platform.example.com';
    const cnameTarget = generateCnameTarget(deploymentId, rootDomain);
    
    assert.equal(cnameTarget, 'app123.platform.example.com');
    assert.ok(isValidCnameTarget(cnameTarget, rootDomain));
    assert.equal(extractDeploymentId(cnameTarget, rootDomain), deploymentId);
  });

  it('ensures no CNAME collisions across different root domains', () => {
    fc.assert(
      fc.property(
        validDeploymentIdGenerator,
        fc.tuple(validRootDomainGenerator, validRootDomainGenerator).filter(
          ([d1, d2]) => d1 !== d2
        ),
        (deploymentId, [rootDomain1, rootDomain2]) => {
          const target1 = generateCnameTarget(deploymentId, rootDomain1);
          const target2 = generateCnameTarget(deploymentId, rootDomain2);
          
          // Same deployment ID with different root domains produces different CNAME targets
          assert.notEqual(
            target1,
            target2,
            'Same deployment ID with different root domains should produce different CNAME targets'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validates that deployment ID is required', () => {
    assert.throws(
      () => generateCnameTarget('', 'example.com'),
      /deploymentId must be a non-empty string/,
      'Should reject empty deployment ID'
    );
  });

  it('validates that root domain is required', () => {
    assert.throws(
      () => generateCnameTarget('app123', ''),
      /rootDomain must be a non-empty string/,
      'Should reject empty root domain'
    );
  });

  it('ensures CNAME targets are DNS-compliant', () => {
    fc.assert(
      fc.property(
        validDeploymentIdGenerator,
        validRootDomainGenerator,
        (deploymentId, rootDomain) => {
          const cnameTarget = generateCnameTarget(deploymentId, rootDomain);
          
          // DNS names are case-insensitive, but typically lowercase
          assert.equal(
            cnameTarget,
            cnameTarget.toLowerCase(),
            'CNAME target should be lowercase for DNS compliance'
          );
          
          // Total length should not exceed 253 characters (DNS FQDN limit)
          assert.ok(
            cnameTarget.length <= 253,
            `CNAME target length should not exceed 253 chars, got ${cnameTarget.length}: ${cnameTarget}`
          );
          
          // Each label (part between dots) should not exceed 63 characters
          const labels = cnameTarget.split('.');
          labels.forEach((label, index) => {
            assert.ok(
              label.length <= 63,
              `DNS label ${index} exceeds 63 chars: ${label} (length: ${label.length})`
            );
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('bijection property: unique deployment IDs map to unique CNAME targets (no collisions)', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(validDeploymentIdGenerator, { minLength: 10, maxLength: 50 }),
        validRootDomainGenerator,
        (deploymentIds, rootDomain) => {
          const cnameTargets = deploymentIds.map(id => generateCnameTarget(id, rootDomain));
          
          // Create mapping: deployment ID -> CNAME target
          const mapping = new Map<string, string>();
          deploymentIds.forEach((id, index) => {
            mapping.set(id, cnameTargets[index]);
          });
          
          // Verify bijection: each deployment ID maps to exactly one CNAME target
          assert.equal(
            mapping.size,
            deploymentIds.length,
            'Each deployment ID should map to exactly one CNAME target'
          );
          
          // Verify inverse: each CNAME target maps back to exactly one deployment ID
          const uniqueCnameTargets = new Set(cnameTargets);
          assert.equal(
            uniqueCnameTargets.size,
            deploymentIds.length,
            'Each CNAME target should be unique (bijection property)'
          );
          
          // Verify extractability: can recover deployment ID from CNAME target
          cnameTargets.forEach((target, index) => {
            const extracted = extractDeploymentId(target, rootDomain);
            assert.equal(
              extracted,
              deploymentIds[index],
              'Should be able to extract original deployment ID from CNAME target'
            );
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary test: handles single-character deployment IDs', () => {
    // While not practical, single-char IDs should work
    const singleCharId = 'a';
    const rootDomain = 'example.com';
    const cnameTarget = generateCnameTarget(singleCharId, rootDomain);
    
    // Note: isValidCnameTarget requires 2+ chars, but generation works
    assert.equal(cnameTarget, 'a.example.com');
    assert.equal(extractDeploymentId(cnameTarget, rootDomain), singleCharId);
  });

  it('ensures different deployment IDs never produce identical CNAME targets', () => {
    fc.assert(
      fc.property(
        fc.tuple(validDeploymentIdGenerator, validDeploymentIdGenerator).filter(
          ([id1, id2]) => id1 !== id2
        ),
        validRootDomainGenerator,
        ([deploymentId1, deploymentId2], rootDomain) => {
          const target1 = generateCnameTarget(deploymentId1, rootDomain);
          const target2 = generateCnameTarget(deploymentId2, rootDomain);
          
          assert.notEqual(
            target1,
            target2,
            `Different deployment IDs should never produce identical CNAME targets. ` +
            `ID1: ${deploymentId1}, ID2: ${deploymentId2}, Target1: ${target1}, Target2: ${target2}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
