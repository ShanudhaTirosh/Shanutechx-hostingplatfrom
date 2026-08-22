/**
 * Environment variable validation utilities
 * Validates environment variables for deployments
 * 
 * Requirements 13.1, 13.3, 13.4
 */

export type EnvVarFormat = 'url' | 'email' | 'number' | 'boolean' | 'string';

export interface EnvVarDefinition {
  key: string;
  required: boolean;
  format?: EnvVarFormat;
}

export interface ValidationResult {
  valid: boolean;
  missingVariables: string[];
  formatErrors: Array<{
    key: string;
    value: string;
    expectedFormat: EnvVarFormat;
    message: string;
  }>;
}

/**
 * Validate environment variables against requirements
 * 
 * @param required - Set of required environment variable definitions
 * @param provided - Map of provided environment variable values
 * @returns ValidationResult with missing variables and format errors
 */
export function validateEnvironmentVariables(
  required: EnvVarDefinition[],
  provided: Record<string, string>
): ValidationResult {
  const missingVariables: string[] = [];
  const formatErrors: ValidationResult['formatErrors'] = [];

  // Check for missing required variables
  for (const def of required) {
    if (def.required && !(def.key in provided)) {
      missingVariables.push(def.key);
    }
  }

  // Validate format of provided variables
  for (const def of required) {
    if (def.key in provided && def.format) {
      const value = provided[def.key];
      const formatValid = validateFormat(value, def.format);
      
      if (!formatValid.valid) {
        formatErrors.push({
          key: def.key,
          value,
          expectedFormat: def.format,
          message: formatValid.message,
        });
      }
    }
  }

  return {
    valid: missingVariables.length === 0 && formatErrors.length === 0,
    missingVariables,
    formatErrors,
  };
}

/**
 * Validate a value against a specific format
 */
function validateFormat(
  value: string,
  format: EnvVarFormat
): { valid: boolean; message: string } {
  switch (format) {
    case 'url':
      return validateUrl(value);
    case 'email':
      return validateEmail(value);
    case 'number':
      return validateNumber(value);
    case 'boolean':
      return validateBoolean(value);
    case 'string':
      return { valid: true, message: '' };
    default:
      return { valid: true, message: '' };
  }
}

/**
 * Validate URL format
 * Must be a valid HTTP or HTTPS URL
 */
function validateUrl(value: string): { valid: boolean; message: string } {
  try {
    const url = new URL(value);
    // Only allow http and https protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        valid: false,
        message: 'URL must use http:// or https:// protocol',
      };
    }
    return { valid: true, message: '' };
  } catch {
    return {
      valid: false,
      message: 'Invalid URL format',
    };
  }
}

/**
 * Validate email format
 * Must contain @ symbol with valid local and domain parts
 */
function validateEmail(value: string): { valid: boolean; message: string } {
  // Basic email validation regex
  // Allows: alphanumeric, dots, hyphens, underscores, plus, and other special chars in local part
  // Requires @ symbol
  // Allows: alphanumeric, dots, hyphens in domain
  // Requires at least one dot in domain
  // RFC 5322 compliant simplified pattern
  const emailRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(value)) {
    return {
      valid: false,
      message: 'Invalid email format',
    };
  }
  
  return { valid: true, message: '' };
}

/**
 * Validate number format
 * Must be a valid number (integer or float)
 */
function validateNumber(value: string): { valid: boolean; message: string } {
  // Allow integers and floats, including negative numbers and scientific notation
  const trimmed = value.trim();
  
  if (trimmed === '') {
    return {
      valid: false,
      message: 'Number cannot be empty',
    };
  }
  
  const num = Number(trimmed);
  
  if (isNaN(num)) {
    return {
      valid: false,
      message: 'Invalid number format',
    };
  }
  
  if (!isFinite(num)) {
    return {
      valid: false,
      message: 'Number must be finite',
    };
  }
  
  return { valid: true, message: '' };
}

/**
 * Validate boolean format
 * Accepts: true, false, 1, 0, yes, no (case-insensitive)
 */
function validateBoolean(value: string): { valid: boolean; message: string } {
  const normalized = value.toLowerCase().trim();
  const validValues = ['true', 'false', '1', '0', 'yes', 'no'];
  
  if (!validValues.includes(normalized)) {
    return {
      valid: false,
      message: 'Boolean must be one of: true, false, 1, 0, yes, no',
    };
  }
  
  return { valid: true, message: '' };
}
