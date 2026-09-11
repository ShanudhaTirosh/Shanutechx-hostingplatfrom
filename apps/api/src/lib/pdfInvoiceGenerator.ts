/**
 * @deprecated Use `apps/api/src/lib/invoicePdf.ts` (`generateInvoicePdf`) instead.
 * This file is retained for backward compatibility.
 */
export { generateInvoicePdf, type InvoiceData } from './invoicePdf';

import { env } from '../env';

export function generateInvoiceHtml(invoice: any): string {
  const rootDomain = env.rootDomain || 'shanutechx.com';
  const issueDateStr = new Date(invoice?.createdAt || Date.now()).toLocaleDateString('en-US');
  return `<!DOCTYPE html><html><body><h1>Invoice #${invoice?.orderId || invoice?.id || 'N/A'}</h1><p>Date: ${issueDateStr}</p><p>Domain: ${rootDomain}</p></body></html>`;
}
