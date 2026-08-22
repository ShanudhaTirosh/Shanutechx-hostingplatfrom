/**
 * SSL Certificate Renewal Background Job
 * 
 * This job runs daily to check SSL certificate expiration dates and
 * automatically renew certificates that are expiring within 7 days.
 * 
 * Job Execution Flow:
 * 1. Check all certificates using domainManager.checkCertificateExpiration()
 * 2. Filter certificates requiring renewal (expiring within 7 days or expired)
 * 3. For each certificate, attempt renewal with domainManager.renewCertificate()
 * 4. Log successful renewals
 * 5. Log failed renewals and continue processing remaining certificates
 * 
 * Error Handling:
 * - Each certificate renewal is wrapped in try-catch to prevent one failure
 *   from stopping the entire job
 * - Failed renewals are logged with detailed error information
 * - Job continues processing remaining certificates after a failure
 * - BullMQ will automatically retry the entire job in 24 hours
 * 
 * **Validates: Requirements 16.4, 16.5**
 */

import { logger } from '../lib/logger';
import { domainManager } from '../lib/domain/manager';

/**
 * SSL Renewal Job Data
 * Empty interface since this job doesn't require input data
 */
export interface SSLRenewalJobData {
  // No input data required - job checks all certificates
}

/**
 * Execute SSL certificate renewal check and renewal process
 * 
 * This function is designed to be called by the BullMQ worker.
 * It checks all certificates and renews those requiring renewal.
 * 
 * @returns Promise that resolves when all renewals are attempted
 */
export async function executeSSLRenewalJob(): Promise<void> {
  logger.info({
    msg: 'Starting SSL certificate renewal job',
    timestamp: new Date().toISOString(),
  });

  try {
    // Step 1: Check all certificates for expiration
    const expirationChecks = await domainManager.checkCertificateExpiration();

    logger.info({
      msg: 'Certificate expiration check completed',
      totalCertificates: expirationChecks.length,
      requiresRenewal: expirationChecks.filter(c => c.requiresRenewal).length,
    });

    // Step 2: Filter certificates requiring renewal (expiring within 7 days)
    const certificatesToRenew = expirationChecks.filter(c => c.requiresRenewal);

    if (certificatesToRenew.length === 0) {
      logger.info({
        msg: 'No certificates require renewal',
        totalChecked: expirationChecks.length,
      });
      return;
    }

    // Track renewal results
    const renewalResults = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ domain: string; error: string }>,
    };

    // Step 3: Attempt renewal for each certificate
    for (const cert of certificatesToRenew) {
      try {
        logger.info({
          msg: 'Attempting SSL certificate renewal',
          customDomainId: cert.customDomainId,
          domain: cert.domain,
          currentStatus: cert.status,
        });

        // Call renewCertificate method
        const renewalResult = await domainManager.renewCertificate(cert.customDomainId);

        // Log successful renewal
        logger.info({
          msg: 'SSL certificate renewed successfully',
          customDomainId: renewalResult.customDomainId,
          domain: renewalResult.domain,
          oldCertificateId: renewalResult.oldCertificateId,
          newCertificateId: renewalResult.newCertificateId,
          status: renewalResult.status,
          expiresOn: renewalResult.expiresOn,
        });

        renewalResults.successful++;
      } catch (error) {
        // Log failed renewal but continue processing remaining certificates
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error({
          msg: 'SSL certificate renewal failed',
          customDomainId: cert.customDomainId,
          domain: cert.domain,
          certificateId: cert.certificateId,
          error: errorMessage,
          errorStack: error instanceof Error ? error.stack : undefined,
        });

        renewalResults.failed++;
        renewalResults.errors.push({
          domain: cert.domain,
          error: errorMessage,
        });

        // Continue to next certificate
        continue;
      }
    }

    // Step 4: Log final results
    logger.info({
      msg: 'SSL certificate renewal job completed',
      totalCertificates: expirationChecks.length,
      attemptedRenewals: certificatesToRenew.length,
      successful: renewalResults.successful,
      failed: renewalResults.failed,
      timestamp: new Date().toISOString(),
    });

    // Log details of failed renewals
    if (renewalResults.failed > 0) {
      logger.warn({
        msg: 'Some SSL certificate renewals failed - will retry in 24 hours',
        failedDomains: renewalResults.errors,
        nextRetry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  } catch (error) {
    // Log job-level error (e.g., failure to check expiration)
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error({
      msg: 'SSL certificate renewal job failed',
      error: errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Re-throw to let BullMQ handle retry
    throw error;
  }
}
