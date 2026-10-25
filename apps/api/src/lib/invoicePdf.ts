import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { PDFDocument, StandardFonts, rgb, grayscale } from 'pdf-lib';
import { logger } from './logger';

export interface InvoiceLineItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number; // smallest currency unit (e.g. cents / cents of LKR)
}

export interface InvoiceData {
  invoiceId: string;
  invoiceNumber?: string;
  issuedAt: Date;
  dueDate?: Date;
  customerName?: string;
  customerEmail: string;
  customerAddress?: string;
  items: InvoiceLineItem[];
  total: number; // smallest currency unit
  currencyLabel?: string; // defaults to "LKR"
  isPaid?: boolean;
  statusLabel?: string;
  paymentDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    branch?: string;
    eZCashNumber?: string;
    helaPayNumber?: string;
    cryptoAddress?: string;
  };
}

function formatMoney(amountInSmallestUnit: number, currencyLabel: string): string {
  const value = (amountInSmallestUnit / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currencyLabel} ${value}`;
}

/**
 * Loads and rasterizes the STKcdr.svg logo to high-resolution PNG for embedding in the PDF.
 */
let cachedLogoPng: Uint8Array | null = null;
async function getLogoPng(): Promise<Uint8Array | null> {
  if (cachedLogoPng) return cachedLogoPng;

  const candidatePaths = [
    path.resolve(process.cwd(), 'STKcdr.svg'),
    path.resolve(process.cwd(), 'apps/dashboard/public/STKcdr.svg'),
    path.resolve(__dirname, '../../../../STKcdr.svg'),
    path.resolve(__dirname, '../../../dashboard/public/STKcdr.svg'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const svgContent = fs.readFileSync(p);
        const pngBuf = await sharp(svgContent)
          .resize({ height: 140 })
          .png()
          .toBuffer();
        cachedLogoPng = new Uint8Array(pngBuf);
        return cachedLogoPng;
      } catch (err) {
        logger.warn({ err, path: p }, 'Failed rasterizing STKcdr.svg');
      }
    }
  }

  return null;
}

/**
 * Renders an official STX Enterprises — Digital Empire Studio invoice PDF.
 * Follows the design specifications from stx-enterprises-templates.html and STKcdr.svg.
 */
export async function generateInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const currencyLabel = data.currencyLabel ?? 'LKR';
  const doc = await PDFDocument.create();
  let page = doc.addPage([595, 842]); // A4 (595 x 842 pt)
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const monoBold = await doc.embedFont(StandardFonts.CourierBold);

  const logoPngBytes = await getLogoPng();
  let logoImage = null;
  if (logoPngBytes) {
    try {
      logoImage = await doc.embedPng(logoPngBytes);
    } catch {
      // Ignore if embedding fails
    }
  }

  const margin = 45;
  const pageWidth = 595;
  const contentWidth = pageWidth - margin * 2; // 505 pt
  let y = 780;

  // 1. TOP BRAND HEADER: STX Enterprises Logo + INVOICE tag
  if (logoImage) {
    const logoW = 105;
    const logoH = 40;
    page.drawImage(logoImage, {
      x: margin,
      y: y - logoH + 10,
      width: logoW,
      height: logoH,
    });

    // Subtitle below logo: "DIGITAL EMPIRE STUDIO"
    page.drawLine({
      start: { x: margin, y: y - logoH + 6 },
      end: { x: margin + logoW, y: y - logoH + 6 },
      thickness: 1.5,
      color: rgb(0.03, 0.02, 0.05),
    });
    page.drawText('DIGITAL EMPIRE STUDIO', {
      x: margin,
      y: y - logoH - 4,
      size: 7,
      font: bold,
      color: rgb(0.03, 0.02, 0.05),
    });
  } else {
    page.drawText('STX ENTERPRISES', {
      x: margin,
      y: y - 5,
      size: 18,
      font: bold,
      color: rgb(0.03, 0.02, 0.05),
    });
    page.drawText('DIGITAL EMPIRE STUDIO', {
      x: margin,
      y: y - 20,
      size: 8,
      font: bold,
      color: rgb(0.08, 0.42, 0.54),
    });
  }

  // Right-aligned Invoice Title & Number
  const issuedDate = data.issuedAt ? new Date(data.issuedAt) : new Date();
  const invoiceIdStr = data.invoiceId || 'INV-0000';
  const invoiceNum = data.invoiceNumber || `STX-${issuedDate.getFullYear()}-${invoiceIdStr.slice(0, 8).toUpperCase()}`;
  page.drawText('INVOICE', {
    x: 440,
    y: y - 5,
    size: 24,
    font: bold,
    color: rgb(0.03, 0.02, 0.05),
  });
  page.drawText(`No. ${invoiceNum}`, {
    x: 410,
    y: y - 24,
    size: 9.5,
    font: monoBold,
    color: rgb(0.29, 0.20, 0.66), // purple-deep
  });

  // 2. TEAL / PURPLE ACCENT BAR
  y -= 52;
  page.drawRectangle({
    x: margin,
    y: y,
    width: contentWidth,
    height: 3.5,
    color: rgb(0.07, 0.06, 0.13), // dark ink
  });
  page.drawRectangle({
    x: margin,
    y: y,
    width: contentWidth * 0.35,
    height: 3.5,
    color: rgb(0.13, 0.78, 0.88), // teal accent
  });

  // 3. THREE-COLUMN METADATA GRID (Billed To, Invoice Details, Pay To)
  y -= 24;
  const col1X = margin;
  const col2X = margin + 175;
  const col3X = margin + 340;

  // Header titles
  page.drawText('BILLED TO', { x: col1X, y, size: 8, font: monoBold, color: rgb(0.08, 0.42, 0.54) });
  page.drawText('INVOICE DETAILS', { x: col2X, y, size: 8, font: monoBold, color: rgb(0.08, 0.42, 0.54) });
  page.drawText('PAY TO', { x: col3X, y, size: 8, font: monoBold, color: rgb(0.08, 0.42, 0.54) });

  y -= 14;
  // Col 1: Billed To Content
  const customerName = data.customerName || (data.customerEmail ? data.customerEmail.split('@')[0] : 'Client');
  page.drawText(customerName, { x: col1X, y, size: 9.5, font: bold, color: rgb(0.12, 0.14, 0.17) });
  y -= 12;
  page.drawText(data.customerEmail || 'client@stxenterprises.com', { x: col1X, y, size: 8.5, font, color: rgb(0.36, 0.39, 0.45) });
  if (data.customerAddress) {
    y -= 11;
    page.drawText(data.customerAddress.slice(0, 35), { x: col1X, y, size: 8, font, color: rgb(0.36, 0.39, 0.45) });
  }

  // Col 2: Invoice Details Content
  let yCol2 = y + 12;
  const issueDateStr = issuedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const dueDateObj = data.dueDate ? new Date(data.dueDate) : new Date(issuedDate.getTime() + 14 * 24 * 60 * 60 * 1000);
  const dueDateStr = dueDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  page.drawText(`Issue date: `, { x: col2X, y: yCol2, size: 8.5, font, color: rgb(0.36, 0.39, 0.45) });
  page.drawText(issueDateStr, { x: col2X + 50, y: yCol2, size: 8.5, font: bold, color: rgb(0.12, 0.14, 0.17) });
  yCol2 -= 12;
  page.drawText(`Due date: `, { x: col2X, y: yCol2, size: 8.5, font, color: rgb(0.36, 0.39, 0.45) });
  page.drawText(dueDateStr, { x: col2X + 50, y: yCol2, size: 8.5, font: bold, color: rgb(0.12, 0.14, 0.17) });
  yCol2 -= 12;
  page.drawText(`Terms: `, { x: col2X, y: yCol2, size: 8.5, font, color: rgb(0.36, 0.39, 0.45) });
  page.drawText('Net 14 (Manual Upload)', { x: col2X + 50, y: yCol2, size: 8.5, font: bold, color: rgb(0.12, 0.14, 0.17) });

  // Col 3: Pay To Content (STX Enterprises + Commercial Bank / eZ Cash / HelaPay)
  let yCol3 = y + 12;
  page.drawText('STX Enterprises (Shanudha Tirosh)', { x: col3X, y: yCol3, size: 8.5, font: bold, color: rgb(0.12, 0.14, 0.17) });
  yCol3 -= 12;
  page.drawText(data.paymentDetails?.bankName || 'Commercial Bank · Negombo Branch', { x: col3X, y: yCol3, size: 8, font, color: rgb(0.36, 0.39, 0.45) });
  yCol3 -= 11;
  page.drawText(`Acc: ${data.paymentDetails?.accountNumber || '100012345678'}`, { x: col3X, y: yCol3, size: 8, font: mono, color: rgb(0.12, 0.14, 0.17) });
  yCol3 -= 11;
  page.drawText(`eZ Cash / HelaPay: ${data.paymentDetails?.eZCashNumber || '077-123-4567'}`, { x: col3X, y: yCol3, size: 7.5, font: mono, color: rgb(0.29, 0.20, 0.66) });

  // 4. ITEMS TABLE
  y = Math.min(y, yCol2, yCol3) - 30;

  // Header row bar
  const headerHeight = 22;
  page.drawRectangle({
    x: margin,
    y: y - headerHeight + 5,
    width: contentWidth,
    height: headerHeight,
    color: rgb(0.04, 0.03, 0.08), // dark ink #07060d
  });

  const colItem = margin + 12;
  const colQty = margin + 295;
  const colPrice = margin + 365;
  const colSubtotal = margin + 445;

  page.drawText('DESCRIPTION', { x: colItem, y: y - 8, size: 7.5, font: monoBold, color: rgb(1, 1, 1) });
  page.drawText('QTY', { x: colQty, y: y - 8, size: 7.5, font: monoBold, color: rgb(1, 1, 1) });
  page.drawText('RATE', { x: colPrice, y: y - 8, size: 7.5, font: monoBold, color: rgb(1, 1, 1) });
  page.drawText('AMOUNT', { x: colSubtotal, y: y - 8, size: 7.5, font: monoBold, color: rgb(1, 1, 1) });

  y -= headerHeight + 6;

  // Rows
  let isEven = false;
  for (const item of data.items) {
    if (y < 120) {
      page = doc.addPage([595, 842]);
      y = 780;
    }

    const rowHeight = item.description ? 32 : 24;
    if (isEven) {
      page.drawRectangle({
        x: margin,
        y: y - rowHeight + 10,
        width: contentWidth,
        height: rowHeight,
        color: rgb(0.97, 0.97, 0.98), // card faint
      });
    }

    const itemName = String(item.name || (item as any).plan?.name || (item as any).service?.name || 'Cloud Hosting Service');
    page.drawText(itemName.slice(0, 48), { x: colItem, y: y - 2, size: 9, font: bold, color: rgb(0.12, 0.14, 0.17) });
    if (item.description) {
      page.drawText(String(item.description).slice(0, 60), { x: colItem, y: y - 13, size: 7.5, font, color: rgb(0.45, 0.48, 0.54) });
    }

    page.drawText(String(item.quantity), { x: colQty + 5, y: y - 2, size: 9, font, color: rgb(0.2, 0.22, 0.26) });
    page.drawText(formatMoney(item.unitPrice, currencyLabel), { x: colPrice, y: y - 2, size: 8.5, font, color: rgb(0.2, 0.22, 0.26) });
    page.drawText(formatMoney(item.unitPrice * item.quantity, currencyLabel), { x: colSubtotal, y: y - 2, size: 8.5, font: bold, color: rgb(0.12, 0.14, 0.17) });

    page.drawLine({
      start: { x: margin, y: y - rowHeight + 10 },
      end: { x: margin + contentWidth, y: y - rowHeight + 10 },
      thickness: 0.5,
      color: rgb(0.92, 0.93, 0.95),
    });

    y -= rowHeight;
    isEven = !isEven;
  }

  // 5. TOTALS BOX
  y -= 14;
  const totalsBoxX = margin + 280;
  const totalsBoxW = contentWidth - 280;

  page.drawText('Subtotal', { x: totalsBoxX, y, size: 8.5, font, color: rgb(0.36, 0.39, 0.45) });
  page.drawText(formatMoney(data.total, currencyLabel), { x: totalsBoxX + totalsBoxW - 80, y, size: 8.5, font, color: rgb(0.36, 0.39, 0.45) });

  y -= 14;
  page.drawText('Discount', { x: totalsBoxX, y, size: 8.5, font, color: rgb(0.36, 0.39, 0.45) });
  page.drawText('— LKR 0.00', { x: totalsBoxX + totalsBoxW - 80, y, size: 8.5, font, color: rgb(0.36, 0.39, 0.45) });

  y -= 14;
  page.drawText('Tax (0%)', { x: totalsBoxX, y, size: 8.5, font, color: rgb(0.36, 0.39, 0.45) });
  page.drawText('LKR 0.00', { x: totalsBoxX + totalsBoxW - 80, y, size: 8.5, font, color: rgb(0.36, 0.39, 0.45) });

  y -= 8;
  page.drawLine({
    start: { x: totalsBoxX, y },
    end: { x: totalsBoxX + totalsBoxW, y },
    thickness: 1.5,
    color: rgb(0.07, 0.06, 0.13),
  });

  y -= 18;
  page.drawText('Total Due', { x: totalsBoxX, y, size: 12, font: bold, color: rgb(0.07, 0.06, 0.13) });
  page.drawText(formatMoney(data.total, currencyLabel), {
    x: totalsBoxX + totalsBoxW - 95,
    y,
    size: 12,
    font: monoBold,
    color: rgb(0.08, 0.42, 0.54), // teal-deep
  });

  // 6. BOTTOM NOTES & STATUS BADGE
  y = Math.max(y - 50, 75);
  page.drawLine({
    start: { x: margin, y: y + 20 },
    end: { x: margin + contentWidth, y: y + 20 },
    thickness: 0.5,
    color: rgb(0.85, 0.86, 0.88),
  });

  // Notes
  page.drawText('NOTES', { x: margin, y: y + 6, size: 7.5, font: monoBold, color: rgb(0.08, 0.42, 0.54) });
  page.drawText('Thank you for working with STX Enterprises. Payment is due within 14 days of issue.', {
    x: margin,
    y: y - 8,
    size: 7.5,
    font,
    color: rgb(0.36, 0.39, 0.45),
  });
  page.drawText('VPS setups deliver within 24 to 72 hours upon verification. For inquiries: hello@stxenterprises.com', {
    x: margin,
    y: y - 18,
    size: 7.5,
    font,
    color: rgb(0.36, 0.39, 0.45),
  });

  // Status Badge
  const isPaid = data.isPaid ?? false;
  const statusBadgeX = 415;
  const statusBadgeW = 95;
  const statusBadgeH = 20;

  if (isPaid) {
    page.drawRectangle({
      x: statusBadgeX,
      y: y - 12,
      width: statusBadgeW,
      height: statusBadgeH,
      borderColor: rgb(0.08, 0.65, 0.42), // green
      borderWidth: 1.2,
      color: rgb(0.92, 0.98, 0.94),
    });
    page.drawText('PAID & VERIFIED', {
      x: statusBadgeX + 11,
      y: y - 6,
      size: 7.5,
      font: monoBold,
      color: rgb(0.08, 0.55, 0.35),
    });
  } else {
    page.drawRectangle({
      x: statusBadgeX,
      y: y - 12,
      width: statusBadgeW,
      height: statusBadgeH,
      borderColor: rgb(0.29, 0.20, 0.66), // purple
      borderWidth: 1.2,
      color: rgb(0.97, 0.95, 1.0),
    });
    page.drawText('AWAITING PAYMENT', {
      x: statusBadgeX + 8,
      y: y - 6,
      size: 7,
      font: monoBold,
      color: rgb(0.29, 0.20, 0.66),
    });
  }

  return doc.save();
}
