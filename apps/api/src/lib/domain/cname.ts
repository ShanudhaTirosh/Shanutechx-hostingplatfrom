/**
 * CNAME Target Generation Utilities
 * 
 * Utilities for generating and validating CNAME targets for custom domains.
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
/**
 * Generate CNAME target for a deployment
 * 
 * Format: {deployment-id}.app.{root-domain} (or {deployment-id}.{domain} if domain already includes sub-zone)
 * Example: dep-abc123.app.shanutechx.com
 * 
 * @param deploymentId - Unique deployment identifier (typically a subdomain slug or CUID)
 * @param rootDomain - Root domain for the platform (e.g., "shanutechx.com" or "app.shanutechx.com")
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
  
  const zone = rootDomain.startsWith('app.') ? rootDomain : `app.${rootDomain}`;
  return `${deploymentId}.${zone}`;
}

/**
 * Extract deployment ID from a CNAME target
 * 
 * @param cnameTarget - CNAME target string
 * @param rootDomain - Root domain for the platform
 * @returns Deployment ID or null if invalid format
 */
export function extractDeploymentId(cnameTarget: string, rootDomain: string): string | null {
  const zone = rootDomain.startsWith('app.') ? rootDomain : `app.${rootDomain}`;
  const suffix = `.${zone}`;
  if (cnameTarget.endsWith(suffix)) {
    return cnameTarget.slice(0, -suffix.length) || null;
  }
  // Fallback for legacy target format: {deploymentId}.{rootDomain}
  const legacySuffix = `.${rootDomain}`;
  if (cnameTarget.endsWith(legacySuffix)) {
    return cnameTarget.slice(0, -legacySuffix.length) || null;
  }
  return null;
}

/**
 * Validate CNAME target format
 * 
 * @param cnameTarget - CNAME target string to validate
 * @param rootDomain - Expected root domain
 * @returns true if valid format, false otherwise
 */
export function isValidCnameTarget(cnameTarget: string, rootDomain: string): boolean {
  const zone = rootDomain.startsWith('app.') ? rootDomain : `app.${rootDomain}`;
  let suffix = `.${zone}`;
  if (!cnameTarget.endsWith(suffix)) {
    suffix = `.${rootDomain}`;
    if (!cnameTarget.endsWith(suffix)) {
      return false;
    }
  }
  
  const deploymentId = cnameTarget.slice(0, -suffix.length);
  if (!deploymentId) {
    return false;
  }
  
  const validSubdomainPattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  return validSubdomainPattern.test(deploymentId);
}
