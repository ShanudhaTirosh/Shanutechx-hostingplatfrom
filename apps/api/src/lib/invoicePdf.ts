import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface InvoiceLineItem {
  name: string;
  quantity: number;
  unitPrice: number; // smallest currency unit
}

export interface InvoiceData {
  invoiceId: string;
  issuedAt: Date;
  customerEmail: string;
  items: InvoiceLineItem[];
  total: number; // smallest currency unit
  currencyLabel?: string; // defaults to "LKR"
}

function formatMoney(amountInSmallestUnit: number, currencyLabel: string): string {
  return `${currencyLabel} ${(amountInSmallestUnit / 100).toFixed(2)}`;
}

/** Renders a simple, clean one-page invoice PDF and returns the raw bytes. */
export async function generateInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const currencyLabel = data.currencyLabel ?? 'LKR';
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = 800;

  page.drawText('SHANUTECHX', { x: margin, y, size: 20, font: bold, color: rgb(0.13, 0.13, 0.13) });
  y -= 18;
  page.drawText('Invoice', { x: margin, y, size: 12, font, color: rgb(0.4, 0.4, 0.45) });

  y -= 40;
  page.drawText(`Invoice #: ${data.invoiceId}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`Date: ${data.issuedAt.toISOString().slice(0, 10)}`, { x: margin, y, size: 11, font });
  y -= 16;
  page.drawText(`Billed to: ${data.customerEmail}`, { x: margin, y, size: 11, font });

  y -= 40;
  const colItem = margin;
  const colQty = 360;
  const colPrice = 430;
  const colSubtotal = 500;

  page.drawText('Item', { x: colItem, y, size: 11, font: bold });
  page.drawText('Qty', { x: colQty, y, size: 11, font: bold });
  page.drawText('Price', { x: colPrice, y, size: 11, font: bold });
  page.drawText('Subtotal', { x: colSubtotal, y, size: 11, font: bold });

  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });

  y -= 20;
  for (const item of data.items) {
    const subtotal = item.unitPrice * item.quantity;
    page.drawText(item.name, { x: colItem, y, size: 10, font });
    page.drawText(String(item.quantity), { x: colQty, y, size: 10, font });
    page.drawText(formatMoney(item.unitPrice, currencyLabel), { x: colPrice, y, size: 10, font });
    page.drawText(formatMoney(subtotal, currencyLabel), { x: colSubtotal, y, size: 10, font });
    y -= 18;
  }

  y -= 12;
  page.drawLine({
    start: { x: margin, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });

  y -= 24;
  page.drawText('Total', { x: colPrice, y, size: 12, font: bold });
  page.drawText(formatMoney(data.total, currencyLabel), { x: colSubtotal, y, size: 12, font: bold });

  return doc.save();
}
