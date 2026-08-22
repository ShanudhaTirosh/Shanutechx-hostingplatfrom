import { env } from '../env';

export class PostalError extends Error {}

interface SendMailParams {
  to: string[];
  from: string;
  subject: string;
  html?: string;
  plainBody?: string;
}

interface PostalSendResponse {
  status: 'success' | 'error' | 'parameter-error';
  data: unknown;
}

/**
 * Sends mail through Postal's HTTP Message API. This is the one part of
 * Postal that DOES have a stable, automatable public API — organization and
 * mail-server creation is an admin step done in Postal's own web UI (see
 * the SMTP route's docstring for why), but once a server + API key exist,
 * sending through it is just this one call.
 */
export async function sendViaPostal(params: SendMailParams): Promise<void> {
  if (!env.postalApiUrl || !env.postalApiKey) {
    throw new PostalError('Postal is not configured (POSTAL_API_URL / POSTAL_API_KEY)');
  }

  const res = await fetch(`${env.postalApiUrl}/api/v1/send/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Server-API-Key': env.postalApiKey,
    },
    body: JSON.stringify({
      to: params.to,
      from: params.from,
      subject: params.subject,
      html_body: params.html,
      plain_body: params.plainBody,
    }),
  });

  const data = (await res.json()) as PostalSendResponse;

  if (data.status !== 'success') {
    throw new PostalError(`Postal send failed: ${JSON.stringify(data.data)}`);
  }
}
