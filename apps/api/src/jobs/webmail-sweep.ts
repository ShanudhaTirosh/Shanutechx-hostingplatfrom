import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { env } from '../env';
import { decryptSecret } from '../lib/secretsVault';
import { sendSmtpEmail } from '../lib/smtpDispatcher';
import { wildduckClient } from '../lib/wildduckClient';
import { runWebmailSweep, type Deliver, type WebmailSweepResult } from '../lib/webmailSweep';

/** Same delivery as POST /webmail/send: WildDuck API when the mailbox has one, otherwise plain SMTP. */
export const deliverViaAccount: Deliver = async (account, mail) => {
  const from = `"${mail.senderName}" <${mail.senderEmail}>`;
  if (account.wildduckUserId) {
    await wildduckClient.submitMessage(account.wildduckUserId, {
      from,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.html.replace(/<[^>]+>/g, ''),
    });
    return;
  }
  const password = decryptSecret(account.credentialRef, env.secretsEncryptionKey);
  await sendSmtpEmail(
    { host: account.smtpHost, port: account.smtpPort, user: account.smtpUsername, pass: password },
    { from, to: mail.to, subject: mail.subject, html: mail.html, attachments: mail.attachments as any }
  );
};

export async function executeWebmailSweepJob(): Promise<WebmailSweepResult> {
  const result = await runWebmailSweep(prisma, deliverViaAccount);
  const touched = result.snoozed + result.drafts.sent + result.drafts.failed + result.scheduled.sent + result.scheduled.failed;
  if (touched > 0) logger.info({ result }, 'Webmail sweep processed snoozed / scheduled mail');
  return result;
}
