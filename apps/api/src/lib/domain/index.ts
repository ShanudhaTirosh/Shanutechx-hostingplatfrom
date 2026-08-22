/**
 * Domain Management Module Exports
 */

export {
  DomainManager,
  domainManager,
  DomainManagerError,
  type AttachDomainResult,
  type VerifyDomainResult,
  type ProvisionSSLResult,
  type ConfigureRouteResult,
  type RemoveDomainResult,
  type CertificateExpirationCheck,
  type RenewCertificateResult,
} from './manager';

export {
  generateCnameTarget,
  extractDeploymentId,
  isValidCnameTarget,
} from './cname';
