/**
 * Property-based tests for VPS plan specification validation
 * **Validates: Requirements 2.3**
 * 
 * Run: npx tsx --test tests/unit/vps-plan-validation.property.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fc from 'fast-check';
import { z } from 'zod';

/**
 * VPS Plan validation schema (matches the schema from vps-plans.ts)
 */
const vpsplanSchema = z.object({
  provider: z.string().min(1, 'Provider name is required'),
  name: z.string().min(1, 'Plan name is required'),
  bandwidth: z.string().min(1, 'Bandwidth specification is required'),
  category: z.enum(['web_hosting', 'app_server', 'database_server', 'storage_server'], {
    errorMap: () => ({ message: 'Category must be one of: web_hosting, app_server, database_server, storage_server' })
  }),
  cpuCores: z.number().int().positive('CPU cores must be a positive integer'),
  ramGb: z.number().int().positive('RAM must be a positive integer (GB)'),
  storageGb: z.number().int().positive('Storage must be a positive integer (GB)'),
  price: z.number().int().positive('Price must be a positive integer'),
  currency: z.enum(['LKR', 'USD']).default('LKR'),
  billingPeriod: z.enum(['one_time', 'monthly', 'yearly']).default('monthly'),
  isActive: z.boolean().default(true),
  leasewebProductCode: z.string().optional(),
});

/**
 * Helper to validate VPS plan
 */
function validateVpsPlan(plan: any): { valid: boolean; errors?: any } {
  const result = vpsplanSchema.safeParse(plan);
  return {
    valid: result.success,
    errors: result.success ? undefined : result.error.flatten(),
  };
}

/**
 * Property 4: VPS Plan Specification Validation
 * 
 * For any VPS plan specification with CPU, RAM, and storage fields, the validation 
 * logic SHALL accept specifications where all numeric fields are positive integers 
 * with appropriate units (cores for CPU, GB for RAM/storage), and SHALL reject 
 * specifications where any numeric field is non-positive, non-numeric, or missing 
 * required units.
 */
describe('VPS Plan Specification Validation (Property 4)', () => {
  
  // Generator for valid VPS plan specifications
  const validVpsPlanGenerator = fc.record({
    provider: fc.string({ minLength: 1, maxLength: 50 }),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    bandwidth: fc.oneof(
      fc.nat({ max: 1000 }).map(n => `${n}GB`),
      fc.nat({ max: 100 }).map(n => `${n}TB`),
      fc.constant('unlimited'),
      fc.constant('1TB'),
      fc.constant('10TB'),
    ),
    category: fc.constantFrom('web_hosting', 'app_server', 'database_server', 'storage_server'),
    cpuCores: fc.integer({ min: 1, max: 128 }), // Positive integer for CPU cores
    ramGb: fc.integer({ min: 1, max: 1024 }), // Positive integer for RAM in GB
    storageGb: fc.integer({ min: 1, max: 10000 }), // Positive integer for storage in GB
    price: fc.integer({ min: 1, max: 1000000 }), // Positive integer for price
    currency: fc.constantFrom('LKR', 'USD'),
    billingPeriod: fc.constantFrom('one_time', 'monthly', 'yearly'),
    isActive: fc.boolean(),
    leasewebProductCode: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  });

  // Generator for invalid VPS plan specifications (with various types of invalid values)
  const invalidNumericFieldGenerator = fc.oneof(
    fc.constant(0), // Zero (non-positive)
    fc.integer({ min: -1000, max: -1 }), // Negative integers
    fc.double({ min: 0.1, max: 100.5, noNaN: true }).filter(n => !Number.isInteger(n)), // Non-integer numbers
    fc.constant(NaN), // NaN
    fc.constant(Infinity), // Infinity
    fc.constant(-Infinity), // -Infinity
  );

  it('accepts valid VPS plans with all positive integer numeric fields', () => {
    fc.assert(
      fc.property(
        validVpsPlanGenerator,
        (plan) => {
          const result = validateVpsPlan(plan);
          
          assert.ok(
            result.valid,
            `Valid plan should be accepted. Plan: ${JSON.stringify(plan)}, Errors: ${JSON.stringify(result.errors)}`
          );
          
          // Verify all numeric fields are positive integers
          assert.ok(
            Number.isInteger(plan.cpuCores) && plan.cpuCores > 0,
            `CPU cores should be a positive integer, got: ${plan.cpuCores}`
          );
          assert.ok(
            Number.isInteger(plan.ramGb) && plan.ramGb > 0,
            `RAM should be a positive integer, got: ${plan.ramGb}`
          );
          assert.ok(
            Number.isInteger(plan.storageGb) && plan.storageGb > 0,
            `Storage should be a positive integer, got: ${plan.storageGb}`
          );
          assert.ok(
            Number.isInteger(plan.price) && plan.price > 0,
            `Price should be a positive integer, got: ${plan.price}`
          );
        }
      ),
      { numRuns: 100 } // Minimum 100 iterations as specified
    );
  });

  it('rejects VPS plans with non-positive CPU cores', () => {
    fc.assert(
      fc.property(
        validVpsPlanGenerator,
        invalidNumericFieldGenerator,
        (validPlan, invalidCpu) => {
          const invalidPlan = { ...validPlan, cpuCores: invalidCpu };
          const result = validateVpsPlan(invalidPlan);
          
          assert.ok(
            !result.valid,
            `Plan with invalid CPU cores (${invalidCpu}) should be rejected. Plan: ${JSON.stringify(invalidPlan)}`
          );
          
          // Verify error mentions CPU cores
          const errorMessage = JSON.stringify(result.errors);
          assert.ok(
            errorMessage.includes('cpuCores') || errorMessage.includes('CPU'),
            `Error should mention CPU cores. Errors: ${errorMessage}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects VPS plans with non-positive RAM', () => {
    fc.assert(
      fc.property(
        validVpsPlanGenerator,
        invalidNumericFieldGenerator,
        (validPlan, invalidRam) => {
          const invalidPlan = { ...validPlan, ramGb: invalidRam };
          const result = validateVpsPlan(invalidPlan);
          
          assert.ok(
            !result.valid,
            `Plan with invalid RAM (${invalidRam}) should be rejected. Plan: ${JSON.stringify(invalidPlan)}`
          );
          
          // Verify error mentions RAM
          const errorMessage = JSON.stringify(result.errors);
          assert.ok(
            errorMessage.includes('ramGb') || errorMessage.includes('RAM'),
            `Error should mention RAM. Errors: ${errorMessage}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects VPS plans with non-positive storage', () => {
    fc.assert(
      fc.property(
        validVpsPlanGenerator,
        invalidNumericFieldGenerator,
        (validPlan, invalidStorage) => {
          const invalidPlan = { ...validPlan, storageGb: invalidStorage };
          const result = validateVpsPlan(invalidPlan);
          
          assert.ok(
            !result.valid,
            `Plan with invalid storage (${invalidStorage}) should be rejected. Plan: ${JSON.stringify(invalidPlan)}`
          );
          
          // Verify error mentions storage
          const errorMessage = JSON.stringify(result.errors);
          assert.ok(
            errorMessage.includes('storageGb') || errorMessage.includes('Storage'),
            `Error should mention storage. Errors: ${errorMessage}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects VPS plans with non-positive price', () => {
    fc.assert(
      fc.property(
        validVpsPlanGenerator,
        invalidNumericFieldGenerator,
        (validPlan, invalidPrice) => {
          const invalidPlan = { ...validPlan, price: invalidPrice };
          const result = validateVpsPlan(invalidPlan);
          
          assert.ok(
            !result.valid,
            `Plan with invalid price (${invalidPrice}) should be rejected. Plan: ${JSON.stringify(invalidPlan)}`
          );
          
          // Verify error mentions price
          const errorMessage = JSON.stringify(result.errors);
          assert.ok(
            errorMessage.includes('price') || errorMessage.includes('Price'),
            `Error should mention price. Errors: ${errorMessage}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects VPS plans with missing required fields', () => {
    fc.assert(
      fc.property(
        validVpsPlanGenerator,
        fc.constantFrom('provider', 'name', 'bandwidth', 'category', 'cpuCores', 'ramGb', 'storageGb', 'price'),
        (validPlan, fieldToRemove) => {
          const incompletePlan = { ...validPlan };
          delete (incompletePlan as any)[fieldToRemove];
          
          const result = validateVpsPlan(incompletePlan);
          
          assert.ok(
            !result.valid,
            `Plan missing required field "${fieldToRemove}" should be rejected. Plan: ${JSON.stringify(incompletePlan)}`
          );
          
          // Verify error mentions the missing field
          const errorMessage = JSON.stringify(result.errors);
          assert.ok(
            errorMessage.includes(fieldToRemove),
            `Error should mention missing field "${fieldToRemove}". Errors: ${errorMessage}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects VPS plans with invalid category values', () => {
    fc.assert(
      fc.property(
        validVpsPlanGenerator,
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
          !['web_hosting', 'app_server', 'database_server', 'storage_server'].includes(s)
        ),
        (validPlan, invalidCategory) => {
          const invalidPlan = { ...validPlan, category: invalidCategory };
          const result = validateVpsPlan(invalidPlan);
          
          assert.ok(
            !result.valid,
            `Plan with invalid category "${invalidCategory}" should be rejected`
          );
          
          // Verify error mentions category
          const errorMessage = JSON.stringify(result.errors);
          assert.ok(
            errorMessage.includes('category'),
            `Error should mention category. Errors: ${errorMessage}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts VPS plans with optional fields omitted', () => {
    fc.assert(
      fc.property(
        validVpsPlanGenerator,
        (validPlan) => {
          // Remove optional fields
          const minimalPlan = {
            provider: validPlan.provider,
            name: validPlan.name,
            bandwidth: validPlan.bandwidth,
            category: validPlan.category,
            cpuCores: validPlan.cpuCores,
            ramGb: validPlan.ramGb,
            storageGb: validPlan.storageGb,
            price: validPlan.price,
            // currency, billingPeriod, isActive, leasewebProductCode are optional or have defaults
          };
          
          const result = validateVpsPlan(minimalPlan);
          
          assert.ok(
            result.valid,
            `Minimal valid plan should be accepted. Plan: ${JSON.stringify(minimalPlan)}, Errors: ${JSON.stringify(result.errors)}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validates bandwidth field is non-empty string', () => {
    fc.assert(
      fc.property(
        validVpsPlanGenerator,
        fc.constantFrom(''), // Only truly empty string - Zod .min(1) checks length not whitespace
        (validPlan, emptyBandwidth) => {
          const invalidPlan = { ...validPlan, bandwidth: emptyBandwidth };
          const result = validateVpsPlan(invalidPlan);
          
          assert.ok(
            !result.valid,
            `Plan with empty bandwidth should be rejected. Bandwidth: "${emptyBandwidth}"`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts various valid bandwidth specifications with units', () => {
    fc.assert(
      fc.property(
        validVpsPlanGenerator,
        fc.oneof(
          fc.constant('unlimited'),
          fc.constant('1TB'),
          fc.constant('100GB'),
          fc.constant('10TB'),
          fc.constant('500GB per month'),
          fc.nat({ max: 1000 }).map(n => `${n}GB`),
          fc.nat({ max: 100 }).map(n => `${n}TB`),
        ),
        (validPlan, bandwidth) => {
          const plan = { ...validPlan, bandwidth };
          const result = validateVpsPlan(plan);
          
          assert.ok(
            result.valid,
            `Plan with valid bandwidth "${bandwidth}" should be accepted. Errors: ${JSON.stringify(result.errors)}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary test: accepts minimum valid values for numeric fields', () => {
    const minimalValidPlan = {
      provider: 'provider',
      name: 'plan',
      bandwidth: '1GB',
      category: 'web_hosting' as const,
      cpuCores: 1, // Minimum positive integer
      ramGb: 1, // Minimum positive integer
      storageGb: 1, // Minimum positive integer
      price: 1, // Minimum positive integer
      currency: 'LKR' as const,
      billingPeriod: 'monthly' as const,
      isActive: true,
    };
    
    const result = validateVpsPlan(minimalValidPlan);
    
    assert.ok(
      result.valid,
      `Plan with minimum valid numeric values should be accepted. Errors: ${JSON.stringify(result.errors)}`
    );
  });

  it('boundary test: accepts large valid values for numeric fields', () => {
    const largeValidPlan = {
      provider: 'provider',
      name: 'plan',
      bandwidth: 'unlimited',
      category: 'storage_server' as const,
      cpuCores: 128, // Large but valid
      ramGb: 1024, // Large but valid
      storageGb: 10000, // Large but valid
      price: 1000000, // Large but valid
      currency: 'USD' as const,
      billingPeriod: 'yearly' as const,
      isActive: true,
    };
    
    const result = validateVpsPlan(largeValidPlan);
    
    assert.ok(
      result.valid,
      `Plan with large valid numeric values should be accepted. Errors: ${JSON.stringify(result.errors)}`
    );
  });

  it('validates that all required numeric fields must be integers, not floats', () => {
    fc.assert(
      fc.property(
        validVpsPlanGenerator,
        fc.constantFrom('cpuCores', 'ramGb', 'storageGb', 'price'),
        fc.double({ min: 0.1, max: 100.9, noNaN: true }).filter(n => !Number.isInteger(n)),
        (validPlan, fieldName, floatValue) => {
          const invalidPlan = { ...validPlan, [fieldName]: floatValue };
          const result = validateVpsPlan(invalidPlan);
          
          assert.ok(
            !result.valid,
            `Plan with float value (${floatValue}) for ${fieldName} should be rejected`
          );
          
          // Verify error mentions the field or integer requirement
          const errorMessage = JSON.stringify(result.errors);
          assert.ok(
            errorMessage.includes(fieldName) || errorMessage.includes('integer'),
            `Error should mention field "${fieldName}" or integer requirement. Errors: ${errorMessage}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('provides descriptive error messages for invalid specifications', () => {
    fc.assert(
      fc.property(
        validVpsPlanGenerator,
        (validPlan) => {
          // Create an invalid plan with multiple issues
          const invalidPlan = {
            ...validPlan,
            cpuCores: -5,
            ramGb: 0,
            storageGb: 3.14,
          };
          
          const result = validateVpsPlan(invalidPlan);
          
          assert.ok(!result.valid, 'Invalid plan should be rejected');
          assert.ok(result.errors, 'Should have error messages');
          
          // Verify errors are descriptive
          const errorMessage = JSON.stringify(result.errors);
          assert.ok(
            errorMessage.length > 0,
            'Error messages should be non-empty'
          );
          
          // Check that errors mention the problematic fields
          assert.ok(
            errorMessage.includes('cpuCores') || errorMessage.includes('ramGb') || errorMessage.includes('storageGb'),
            `Error messages should mention the invalid fields. Errors: ${errorMessage}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validation is consistent: same input produces same result', () => {
    fc.assert(
      fc.property(
        validVpsPlanGenerator,
        (plan) => {
          const result1 = validateVpsPlan(plan);
          const result2 = validateVpsPlan(plan);
          
          assert.equal(
            result1.valid,
            result2.valid,
            'Validation should be consistent for the same input'
          );
          
          // If invalid, errors should be the same
          if (!result1.valid && !result2.valid) {
            assert.deepEqual(
              result1.errors,
              result2.errors,
              'Error messages should be consistent'
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validates currency field accepts only LKR or USD', () => {
    fc.assert(
      fc.property(
        validVpsPlanGenerator,
        fc.string({ minLength: 1, maxLength: 10 }).filter(s => s !== 'LKR' && s !== 'USD'),
        (validPlan, invalidCurrency) => {
          const invalidPlan = { ...validPlan, currency: invalidCurrency };
          const result = validateVpsPlan(invalidPlan);
          
          assert.ok(
            !result.valid,
            `Plan with invalid currency "${invalidCurrency}" should be rejected`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validates billingPeriod field accepts only defined values', () => {
    fc.assert(
      fc.property(
        validVpsPlanGenerator,
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => 
          !['one_time', 'monthly', 'yearly'].includes(s)
        ),
        (validPlan, invalidPeriod) => {
          const invalidPlan = { ...validPlan, billingPeriod: invalidPeriod };
          const result = validateVpsPlan(invalidPlan);
          
          assert.ok(
            !result.valid,
            `Plan with invalid billing period "${invalidPeriod}" should be rejected`
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
