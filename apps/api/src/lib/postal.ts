export class PostalError extends Error {}

/**
 * @deprecated Postal has been replaced with WildDuck Mail Server (lib/wildduckClient.ts).
 */
export async function sendViaPostal(_params: unknown): Promise<void> {
  throw new PostalError('Postal has been replaced by WildDuck Mail Server. Use wildduckClient instead.');
}
