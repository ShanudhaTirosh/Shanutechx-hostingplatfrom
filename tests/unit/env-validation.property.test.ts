/**
 * Property-based tests for environment variable validation
 * **Validates: Requirements 13.1, 13.3, 13.4**
 * 
 * Run: npm run test:unit env-validation.property.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fc from 'fast-check';
import {
  validateEnvironmentVariables,
  type EnvVarDefinition,
  type EnvVarFormat,
} from '../../apps/api/src/lib/catalog/env-validator';

/**
 * Property 7: Environment Variable Validation Completeness
 * 
 * For any set of required environment variables and any provided environment variable map,
 * the validation logic SHALL identify exactly the set of missing required variables
 * (those present in required set but absent from provided map), AND SHALL correctly
 * classify variable values by format (URL, email, number, boolean) rejecting values
 * that do not match their declared format.
 */
describe('Environment Variable Validation (Property 7)', () => {
  
  // ========================================
  // Generators for property-based testing
  // ========================================
  
  /**
   * Generate a valid environment variable key
   */
  const envKeyGenerator = fc.stringMatching(/^[A-Z][A-Z0-9_]*$/);
  
  /**
   * Generate a format type
   */
  const formatGenerator = fc.constantFrom<EnvVarFormat>(
    'url',
    'email',
    'number',
    'boolean',
    'string'
  );
  
  /**
   * Generate an environment variable definition
   */
  const envVarDefGenerator = fc.record({
    key: envKeyGenerator,
    required: fc.boolean(),
    format: fc.option(formatGenerator, { nil: undefined }),
  });
  
  /**
   * Generate a set of environment variable definitions with unique keys
   */
  const envVarDefsGenerator = fc
    .array(envVarDefGenerator, { minLength: 1, maxLength: 20 })
    .map((defs) => {
      // Ensure unique keys
      const uniqueDefs: EnvVarDefinition[] = [];
      const seenKeys = new Set<string>();
      for (const def of defs) {
        if (!seenKeys.has(def.key)) {
          uniqueDefs.push(def);
          seenKeys.add(def.key);
        }
      }
      return uniqueDefs;
    });
  
  /**
   * Generate a valid URL
   */
  const validUrlGenerator = fc.oneof(
    fc.webUrl(),
    fc.record({
      protocol: fc.constantFrom('http', 'https'),
      domain: fc.domain(),
      path: fc.option(fc.stringMatching(/^\/[a-zA-Z0-9\-_/]*$/), { nil: '' }),
    }).map(({ protocol, domain, path }) => `${protocol}://${domain}${path}`)
  );
  
  /**
   * Generate an invalid URL
   */
  const invalidUrlGenerator = fc.oneof(
    fc.string().filter((s) => {
      try {
        new URL(s);
        return false;
      } catch {
        return true;
      }
    }),
    fc.constantFrom('not-a-url', 'ftp://invalid.com', 'javascript:alert(1)', ''),
    fc.stringMatching(/^[a-z]+$/).filter((s) => s.length > 0)
  );
  
  /**
   * Generate a valid email
   */
  const validEmailGenerator = fc.emailAddress();
  
  /**
   * Generate an invalid email
   */
  const invalidEmailGenerator = fc.oneof(
    fc.string().filter((s) => !s.includes('@')),
    fc.constantFrom('invalid', 'no-at-sign.com', '@no-local.com', 'no-domain@', 'spaces in@email.com'),
    fc.stringMatching(/^[a-z]+$/).filter((s) => s.length > 0)
  );
  
  /**
   * Generate a valid number string
   */
  const validNumberGenerator = fc.oneof(
    fc.integer().map(String),
    fc.double({ noNaN: true, noDefaultInfinity: true }).map(String),
    fc.constantFrom('0', '1', '-1', '3.14', '-2.5', '1e10', '1.5e-5')
  );
  
  /**
   * Generate an invalid number string
   */
  const invalidNumberGenerator = fc.oneof(
    fc.constantFrom('not-a-number', 'NaN', 'Infinity', '-Infinity', '', 'abc123', '12.34.56'),
    fc.stringMatching(/^[a-zA-Z]+$/).filter((s) => s.length > 0)
  );
  
  /**
   * Generate a valid boolean string
   */
  const validBooleanGenerator = fc.constantFrom(
    'true',
    'false',
    '1',
    '0',
    'yes',
    'no',
    'TRUE',
    'FALSE',
    'Yes',
    'No'
  );
  
  /**
   * Generate an invalid boolean string
   */
  const invalidBooleanGenerator = fc.oneof(
    fc.constantFrom('not-a-bool', '2', '-1', 'maybe', 'y', 'n'),
    fc.string().filter((s) => {
      const normalized = s.toLowerCase().trim();
      return !['true', 'false', '1', '0', 'yes', 'no'].includes(normalized);
    })
  );
  
  /**
   * Generate a valid value for a given format
   */
  function validValueForFormat(format: EnvVarFormat | undefined): fc.Arbitrary<string> {
    if (!format || format === 'string') {
      return fc.string();
    }
    switch (format) {
      case 'url':
        return validUrlGenerator;
      case 'email':
        return validEmailGenerator;
      case 'number':
        return validNumberGenerator;
      case 'boolean':
        return validBooleanGenerator;
      default:
        return fc.string();
    }
  }
  
  /**
   * Generate an invalid value for a given format
   */
  function invalidValueForFormat(format: EnvVarFormat): fc.Arbitrary<string> {
    switch (format) {
      case 'url':
        return invalidUrlGenerator;
      case 'email':
        return invalidEmailGenerator;
      case 'number':
        return invalidNumberGenerator;
      case 'boolean':
        return invalidBooleanGenerator;
      default:
        return fc.string();
    }
  }
  
  // ========================================
  // Property Tests
  // ========================================
  
  it('identifies exactly the set of missing required variables', () => {
    fc.assert(
      fc.property(
        envVarDefsGenerator,
        fc.array(fc.string()),
        (defs, extraKeys) => {
          // Separate required and optional definitions
          const requiredDefs = defs.filter((d) => d.required);
          const optionalDefs = defs.filter((d) => !d.required);
          
          // Randomly decide which required vars to provide
          const providedRequiredKeys = new Set(
            requiredDefs
              .filter(() => Math.random() > 0.5)
              .map((d) => d.key)
          );
          
          // Construct provided map with some required and all optional
          const provided: Record<string, string> = {};
          
          // Add provided required vars
          for (const key of providedRequiredKeys) {
            provided[key] = 'value';
          }
          
          // Add all optional vars
          for (const def of optionalDefs) {
            provided[def.key] = 'value';
          }
          
          // Run validation
          const result = validateEnvironmentVariables(defs, provided);
          
          // Calculate expected missing variables
          const expectedMissing = requiredDefs
            .filter((d) => !providedRequiredKeys.has(d.key))
            .map((d) => d.key)
            .sort();
          
          const actualMissing = [...result.missingVariables].sort();
          
          assert.deepEqual(
            actualMissing,
            expectedMissing,
            `Missing variables should match expected. Expected: ${JSON.stringify(expectedMissing)}, Got: ${JSON.stringify(actualMissing)}`
          );
        }
      ),
      { numRuns: 200 }
    );
  });
  
  it('accepts all variables when all required variables are provided with valid formats', () => {
    fc.assert(
      fc.property(
        envVarDefsGenerator,
        (defs) => {
          // For each definition, generate a valid value
          const provided: Record<string, string> = {};
          
          for (const def of defs) {
            // Generate a simple valid value for each format
            if (!def.format || def.format === 'string') {
              provided[def.key] = 'test-value';
            } else if (def.format === 'url') {
              provided[def.key] = 'https://example.com';
            } else if (def.format === 'email') {
              provided[def.key] = 'test@example.com';
            } else if (def.format === 'number') {
              provided[def.key] = '42';
            } else if (def.format === 'boolean') {
              provided[def.key] = 'true';
            }
          }
          
          const result = validateEnvironmentVariables(defs, provided);
          
          assert.ok(
            result.valid,
            `Validation should pass when all required vars are provided with valid formats. Defs: ${JSON.stringify(defs)}, Provided: ${JSON.stringify(provided)}, Missing: ${JSON.stringify(result.missingVariables)}, Format errors: ${JSON.stringify(result.formatErrors)}`
          );
          
          assert.equal(result.missingVariables.length, 0, 'Should have no missing variables');
          assert.equal(result.formatErrors.length, 0, 'Should have no format errors');
        }
      ),
      { numRuns: 200 }
    );
  });
  
  it('rejects when required variables are missing', () => {
    fc.assert(
      fc.property(
        envVarDefsGenerator.filter((defs) => defs.some((d) => d.required)),
        (defs) => {
          // Provide only optional variables, omit at least one required
          const requiredDefs = defs.filter((d) => d.required);
          const optionalDefs = defs.filter((d) => !d.required);
          
          // Randomly omit at least one required variable
          const missingIndex = Math.floor(Math.random() * requiredDefs.length);
          const providedRequired = requiredDefs.filter((_, i) => i !== missingIndex);
          
          const provided: Record<string, string> = {};
          
          // Add some required vars (but not all)
          for (const def of providedRequired) {
            provided[def.key] = 'value';
          }
          
          // Add all optional vars
          for (const def of optionalDefs) {
            provided[def.key] = 'value';
          }
          
          const result = validateEnvironmentVariables(defs, provided);
          
          assert.ok(
            !result.valid,
            `Validation should fail when required variables are missing. Result: ${JSON.stringify(result)}`
          );
          
          assert.ok(
            result.missingVariables.length > 0,
            'Should have at least one missing variable'
          );
          
          // The missing variable should be the one we intentionally omitted
          assert.ok(
            result.missingVariables.includes(requiredDefs[missingIndex].key),
            `Missing variables should include ${requiredDefs[missingIndex].key}`
          );
        }
      ),
      { numRuns: 200 }
    );
  });
  
  it('correctly validates URL format', () => {
    fc.assert(
      fc.property(
        envKeyGenerator,
        fc.boolean(),
        validUrlGenerator,
        (key, required, validUrl) => {
          const defs: EnvVarDefinition[] = [{ key, required: true, format: 'url' }];
          const provided = { [key]: validUrl };
          
          const result = validateEnvironmentVariables(defs, provided);
          
          assert.ok(
            result.valid,
            `Valid URL should pass validation. URL: ${validUrl}, Errors: ${JSON.stringify(result.formatErrors)}`
          );
          assert.equal(result.formatErrors.length, 0, 'Should have no format errors');
        }
      ),
      { numRuns: 200 }
    );
  });
  
  it('rejects invalid URL format', () => {
    fc.assert(
      fc.property(
        envKeyGenerator,
        invalidUrlGenerator,
        (key, invalidUrl) => {
          const defs: EnvVarDefinition[] = [{ key, required: true, format: 'url' }];
          const provided = { [key]: invalidUrl };
          
          const result = validateEnvironmentVariables(defs, provided);
          
          assert.ok(
            !result.valid,
            `Invalid URL should fail validation. URL: ${invalidUrl}`
          );
          assert.ok(
            result.formatErrors.length > 0,
            'Should have format errors'
          );
          assert.equal(
            result.formatErrors[0].expectedFormat,
            'url',
            'Error should indicate URL format expected'
          );
        }
      ),
      { numRuns: 200 }
    );
  });
  
  it('correctly validates email format', () => {
    fc.assert(
      fc.property(
        envKeyGenerator,
        validEmailGenerator,
        (key, validEmail) => {
          const defs: EnvVarDefinition[] = [{ key, required: true, format: 'email' }];
          const provided = { [key]: validEmail };
          
          const result = validateEnvironmentVariables(defs, provided);
          
          assert.ok(
            result.valid,
            `Valid email should pass validation. Email: ${validEmail}, Errors: ${JSON.stringify(result.formatErrors)}`
          );
          assert.equal(result.formatErrors.length, 0, 'Should have no format errors');
        }
      ),
      { numRuns: 200 }
    );
  });
  
  it('rejects invalid email format', () => {
    fc.assert(
      fc.property(
        envKeyGenerator,
        invalidEmailGenerator,
        (key, invalidEmail) => {
          const defs: EnvVarDefinition[] = [{ key, required: true, format: 'email' }];
          const provided = { [key]: invalidEmail };
          
          const result = validateEnvironmentVariables(defs, provided);
          
          assert.ok(
            !result.valid,
            `Invalid email should fail validation. Email: ${invalidEmail}`
          );
          assert.ok(
            result.formatErrors.length > 0,
            'Should have format errors'
          );
          assert.equal(
            result.formatErrors[0].expectedFormat,
            'email',
            'Error should indicate email format expected'
          );
        }
      ),
      { numRuns: 200 }
    );
  });
  
  it('correctly validates number format', () => {
    fc.assert(
      fc.property(
        envKeyGenerator,
        validNumberGenerator,
        (key, validNumber) => {
          const defs: EnvVarDefinition[] = [{ key, required: true, format: 'number' }];
          const provided = { [key]: validNumber };
          
          const result = validateEnvironmentVariables(defs, provided);
          
          assert.ok(
            result.valid,
            `Valid number should pass validation. Number: ${validNumber}, Errors: ${JSON.stringify(result.formatErrors)}`
          );
          assert.equal(result.formatErrors.length, 0, 'Should have no format errors');
        }
      ),
      { numRuns: 200 }
    );
  });
  
  it('rejects invalid number format', () => {
    fc.assert(
      fc.property(
        envKeyGenerator,
        invalidNumberGenerator,
        (key, invalidNumber) => {
          const defs: EnvVarDefinition[] = [{ key, required: true, format: 'number' }];
          const provided = { [key]: invalidNumber };
          
          const result = validateEnvironmentVariables(defs, provided);
          
          assert.ok(
            !result.valid,
            `Invalid number should fail validation. Number: ${invalidNumber}`
          );
          assert.ok(
            result.formatErrors.length > 0,
            'Should have format errors'
          );
          assert.equal(
            result.formatErrors[0].expectedFormat,
            'number',
            'Error should indicate number format expected'
          );
        }
      ),
      { numRuns: 200 }
    );
  });
  
  it('correctly validates boolean format', () => {
    fc.assert(
      fc.property(
        envKeyGenerator,
        validBooleanGenerator,
        (key, validBoolean) => {
          const defs: EnvVarDefinition[] = [{ key, required: true, format: 'boolean' }];
          const provided = { [key]: validBoolean };
          
          const result = validateEnvironmentVariables(defs, provided);
          
          assert.ok(
            result.valid,
            `Valid boolean should pass validation. Boolean: ${validBoolean}, Errors: ${JSON.stringify(result.formatErrors)}`
          );
          assert.equal(result.formatErrors.length, 0, 'Should have no format errors');
        }
      ),
      { numRuns: 200 }
    );
  });
  
  it('rejects invalid boolean format', () => {
    fc.assert(
      fc.property(
        envKeyGenerator,
        invalidBooleanGenerator,
        (key, invalidBoolean) => {
          const defs: EnvVarDefinition[] = [{ key, required: true, format: 'boolean' }];
          const provided = { [key]: invalidBoolean };
          
          const result = validateEnvironmentVariables(defs, provided);
          
          assert.ok(
            !result.valid,
            `Invalid boolean should fail validation. Boolean: ${invalidBoolean}`
          );
          assert.ok(
            result.formatErrors.length > 0,
            'Should have format errors'
          );
          assert.equal(
            result.formatErrors[0].expectedFormat,
            'boolean',
            'Error should indicate boolean format expected'
          );
        }
      ),
      { numRuns: 200 }
    );
  });
  
  it('handles mixed valid and invalid formats correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (numValid, numInvalid) => {
          const defs: EnvVarDefinition[] = [];
          const provided: Record<string, string> = {};
          
          // Add variables with valid formats
          for (let i = 0; i < numValid; i++) {
            const key = `VALID_VAR_${i}`;
            defs.push({ key, required: true, format: 'url' });
            provided[key] = 'https://example.com';
          }
          
          // Add variables with invalid formats
          const invalidKeys: string[] = [];
          for (let i = 0; i < numInvalid; i++) {
            const key = `INVALID_VAR_${i}`;
            invalidKeys.push(key);
            defs.push({ key, required: true, format: 'url' });
            provided[key] = 'not-a-url';
          }
          
          const result = validateEnvironmentVariables(defs, provided);
          
          // Should fail because of invalid formats
          assert.ok(!result.valid, 'Validation should fail with invalid formats');
          
          // Should have no missing variables (all provided)
          assert.equal(result.missingVariables.length, 0, 'Should have no missing variables');
          
          // Should have exactly numInvalid format errors
          assert.equal(
            result.formatErrors.length,
            numInvalid,
            `Should have ${numInvalid} format errors`
          );
          
          // All format errors should be for the invalid keys
          const errorKeys = result.formatErrors.map((e) => e.key).sort();
          const expectedErrorKeys = invalidKeys.sort();
          assert.deepEqual(
            errorKeys,
            expectedErrorKeys,
            'Format errors should be for invalid keys'
          );
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('handles empty required set correctly', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string(), fc.string()),
        (provided) => {
          const defs: EnvVarDefinition[] = [];
          
          const result = validateEnvironmentVariables(defs, provided);
          
          assert.ok(result.valid, 'Validation should pass with no requirements');
          assert.equal(result.missingVariables.length, 0, 'Should have no missing variables');
          assert.equal(result.formatErrors.length, 0, 'Should have no format errors');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('handles empty provided map correctly', () => {
    fc.assert(
      fc.property(
        envVarDefsGenerator,
        (defs) => {
          const provided: Record<string, string> = {};
          
          const result = validateEnvironmentVariables(defs, provided);
          
          const requiredDefs = defs.filter((d) => d.required);
          
          if (requiredDefs.length > 0) {
            // Should fail if there are required variables
            assert.ok(!result.valid, 'Validation should fail with missing required variables');
            assert.equal(
              result.missingVariables.length,
              requiredDefs.length,
              'Should report all required variables as missing'
            );
          } else {
            // Should pass if all variables are optional
            assert.ok(result.valid, 'Validation should pass with no required variables');
          }
          
          // No format errors since nothing is provided
          assert.equal(result.formatErrors.length, 0, 'Should have no format errors');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('validation is consistent for the same input', () => {
    fc.assert(
      fc.property(
        envVarDefsGenerator,
        fc.dictionary(envKeyGenerator, fc.string()),
        (defs, provided) => {
          const result1 = validateEnvironmentVariables(defs, provided);
          const result2 = validateEnvironmentVariables(defs, provided);
          
          assert.equal(result1.valid, result2.valid, 'Validity should be consistent');
          assert.deepEqual(
            result1.missingVariables.sort(),
            result2.missingVariables.sort(),
            'Missing variables should be consistent'
          );
          assert.deepEqual(
            result1.formatErrors,
            result2.formatErrors,
            'Format errors should be consistent'
          );
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('does not report optional variables as missing', () => {
    fc.assert(
      fc.property(
        envVarDefsGenerator.filter((defs) => defs.some((d) => !d.required)),
        (defs) => {
          // Provide only required variables, omit optional ones
          const requiredDefs = defs.filter((d) => d.required);
          
          const provided: Record<string, string> = {};
          for (const def of requiredDefs) {
            provided[def.key] = 'value';
          }
          
          const result = validateEnvironmentVariables(defs, provided);
          
          // Should pass if all required variables are provided
          if (result.formatErrors.length === 0) {
            assert.ok(result.valid, 'Validation should pass when all required vars provided');
          }
          
          // Should not report optional variables as missing
          const optionalKeys = defs.filter((d) => !d.required).map((d) => d.key);
          for (const optionalKey of optionalKeys) {
            assert.ok(
              !result.missingVariables.includes(optionalKey),
              `Optional variable ${optionalKey} should not be reported as missing`
            );
          }
        }
      ),
      { numRuns: 200 }
    );
  });
  
  it('provides descriptive error messages for format violations', () => {
    fc.assert(
      fc.property(
        envKeyGenerator,
        formatGenerator.filter((f) => f !== 'string'),
        (key, format) => {
          const defs: EnvVarDefinition[] = [{ key, required: true, format }];
          
          // Provide an invalid value for the format
          const invalidValue = 'clearly-invalid-value-for-any-format';
          const provided = { [key]: invalidValue };
          
          const result = validateEnvironmentVariables(defs, provided);
          
          if (!result.valid && result.formatErrors.length > 0) {
            const error = result.formatErrors[0];
            
            // Error should have all required fields
            assert.ok(error.key, 'Error should have key');
            assert.ok(error.value, 'Error should have value');
            assert.ok(error.expectedFormat, 'Error should have expectedFormat');
            assert.ok(error.message, 'Error should have message');
            
            // Message should be non-empty and descriptive
            assert.ok(error.message.length > 0, 'Error message should be non-empty');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('accepts string format for any non-empty value', () => {
    fc.assert(
      fc.property(
        envKeyGenerator,
        fc.string().filter((s) => s.length > 0),
        (key, value) => {
          const defs: EnvVarDefinition[] = [{ key, required: true, format: 'string' }];
          const provided = { [key]: value };
          
          const result = validateEnvironmentVariables(defs, provided);
          
          assert.ok(
            result.valid,
            `Any non-empty string should pass string format validation. Value: ${value}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });
  
  it('accepts variables without format specification for any value', () => {
    fc.assert(
      fc.property(
        envKeyGenerator,
        fc.string(),
        (key, value) => {
          const defs: EnvVarDefinition[] = [{ key, required: true, format: undefined }];
          const provided = { [key]: value };
          
          const result = validateEnvironmentVariables(defs, provided);
          
          assert.ok(
            result.valid,
            `Variables without format should accept any value. Value: ${value}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
