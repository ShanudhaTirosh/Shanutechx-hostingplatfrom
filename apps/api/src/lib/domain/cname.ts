/**
 * CNAME Target Generation Utilities
 * 
 * Utilities for generating and validating CNAME targets for custom domains.
 * 
 * **Validates: Requirements 4.2**
 */

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
