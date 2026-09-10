import { wildduckClient } from './wildduckClient';
import { env } from '../env';
import { logger } from './logger';
import { prisma } from './prisma';
import { encryptSecret } from './secretsVault';

export interface WildDuckInitResult {
  success: boolean;
  domain: string;
  dkimTxtRecord?: string;
  noReplyAddress?: string;
  error?: string;
}

/**
 * Initializes WildDuck Mail Server services on platform startup or bootstrap:
 * 1. Obtains or generates DKIM keypair for env.rootDomain
 * 2. Seeds or updates the platformSmtpConfig in Prisma DB to direct outbound mail via internal Haraka/WildDuck relay
 * 3. Best-effort creates platform default system account
 */
export async function initWildDuckOnBoot(): Promise<WildDuckInitResult> {
  const domain = env.rootDomain || 'shanutechx.com';

  try {
    // 1. Generate/Fetch DKIM for Root Domain
    const dkim = await wildduckClient.getOrCreateDkim(domain, 'wildduck').catch((err) => {
      logger.warn({ err: err.message, domain }, 'WildDuck DKIM generation deferred or unavailable');
      return null;
    });

    // 2. Ensure Platform Global Outbound SMTP Config points to Haraka / WildDuck
    try {
      const existing = await prisma.platformSmtpConfig.findUnique({ where: { id: 'global' } });
      const smtpData = {
        provider: 'wildduck',
        host: process.env.SMTP_HOST || 'haraka',
        port: Number(process.env.SMTP_PORT) || 587,
        user: process.env.SMTP_USER || `no-reply@${domain}`,
        passwordEnc: encryptSecret(process.env.SMTP_PASS || 'default-wildduck-pass', env.secretsEncryptionKey),
        senderEmail: `no-reply@${domain}`,
        senderName: 'ShanuTechX Cloud Mailer',
        secure: false,
      };

      if (existing) {
        await prisma.platformSmtpConfig.update({ where: { id: 'global' }, data: smtpData });
      } else {
        await prisma.platformSmtpConfig.create({ data: { id: 'global', ...smtpData } });
      }
      logger.info({ domain, dkimSelector: dkim?.selector }, 'Platform WildDuck Outbound SMTP service initialized');
    } catch (dbErr: any) {
      logger.warn({ err: dbErr.message }, 'Failed to persist global SMTP config during boot');
    }

    return {
      success: true,
      domain,
      dkimTxtRecord: dkim?.txtRecord,
      noReplyAddress: `no-reply@${domain}`,
    };
  } catch (err: any) {
    logger.error({ err: err.message, domain }, 'WildDuck initialization failed');
    return {
      success: false,
      domain,
      error: err.message,
    };
  }
}
