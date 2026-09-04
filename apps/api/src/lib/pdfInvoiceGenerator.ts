import { env } from '../env';

export interface InvoiceData {
  orderId: string;
  createdAt: Date;
  status: string;
  customerName: string;
  customerEmail: string;
  items: {
    name: string;
    category?: string;
    quantity: number;
    price: number;
    currency: string;
  }[];
  totalLkr: number;
  paymentMethod?: string;
  paymentDate?: Date | null;
}

/**
 * Generates printable HTML string for an order invoice.
 * Can be rendered in browser or converted to PDF by headless browser / print dialog.
 */
export function generateInvoiceHtml(invoice: InvoiceData): string {
  const rootDomain = env.rootDomain || 'shanutechx.com';
  const issueDateStr = new Date(invoice.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const paymentDateStr = invoice.paymentDate
    ? new Date(invoice.paymentDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Pending Approval';

  const itemsHtml = invoice.items
    .map(
      (item, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px; text-align: left; font-size: 13px; color: #1e293b;">
        <div style="font-weight: 600;">${escapeHtml(item.name)}</div>
        ${item.category ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">Category: ${escapeHtml(item.category)}</div>` : ''}
      </td>
      <td style="padding: 12px; text-align: center; font-size: 13px; color: #334155;">${item.quantity}</td>
      <td style="padding: 12px; text-align: right; font-size: 13px; color: #334155; font-family: monospace;">${item.currency} ${item.price.toLocaleString()}</td>
      <td style="padding: 12px; text-align: right; font-size: 13px; font-weight: 600; color: #0f172a; font-family: monospace;">${item.currency} ${(item.price * item.quantity).toLocaleString()}</td>
    </tr>
  `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice #${escapeHtml(invoice.orderId)} - ShanuTechX</title>
  <style>
    @media print {
      body { background: white !important; margin: 0; }
      .no-print { display: none !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background-color: #f8fafc;
      margin: 0;
      padding: 40px 20px;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
      border: 1px solid #e2e8f0;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #6366f1;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      border-radius: 12px;
      color: #ffffff;
      font-weight: 800;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .brand-name {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0f172a;
    }
    .invoice-title {
      text-align: right;
    }
    .invoice-title h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      color: #4f46e5;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .invoice-id {
      font-family: monospace;
      font-size: 13px;
      color: #64748b;
      margin-top: 4px;
    }
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 36px;
    }
    .info-block h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      margin: 0 0 8px 0;
    }
    .info-block p {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
      color: #334155;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 6px;
    }
    .status-paid { background: #dcfce7; color: #15803d; }
    .status-pending { background: #fef3c7; color: #b45309; }
    .table-container {
      margin-bottom: 32px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #f1f5f9;
      padding: 12px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #475569;
    }
    .summary-table {
      width: 280px;
      margin-left: auto;
      border-top: 2px solid #e2e8f0;
      padding-top: 16px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
      color: #475569;
    }
    .summary-total {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-top: 2px solid #4f46e5;
      margin-top: 8px;
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 24px;
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="brand">
        <div class="brand-logo">S</div>
        <div>
          <div class="brand-name">ShanuTechX</div>
          <div style="font-size: 12px; color: #64748b;">Autonomous Cloud Platform</div>
        </div>
      </div>
      <div class="invoice-title">
        <h1>INVOICE</h1>
        <div class="invoice-id">#${escapeHtml(invoice.orderId)}</div>
        <div class="status-badge ${invoice.status === 'paid' ? 'status-paid' : 'status-pending'}">
          ${escapeHtml(invoice.status.toUpperCase())}
        </div>
      </div>
    </div>

    <div class="details-grid">
      <div class="info-block">
        <h3>Billed To</h3>
        <p><strong>${escapeHtml(invoice.customerName)}</strong></p>
        <p>${escapeHtml(invoice.customerEmail)}</p>
      </div>
      <div class="info-block" style="text-align: right;">
        <h3>Invoice Details</h3>
        <p><strong>Date Issued:</strong> ${issueDateStr}</p>
        <p><strong>Payment Date:</strong> ${paymentDateStr}</p>
        ${invoice.paymentMethod ? `<p><strong>Method:</strong> ${escapeHtml(invoice.paymentMethod)}</p>` : ''}
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="text-align: left;">Item Description</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Price</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </div>

    <div class="summary-table">
      <div class="summary-total">
        <span>Total (LKR):</span>
        <span style="font-family: monospace; color: #4f46e5;">LKR ${invoice.totalLkr.toLocaleString()}</span>
      </div>
    </div>

    <div class="footer">
      <p>Thank you for choosing ShanuTechX Cloud Hosting & Compute Infrastructure!</p>
      <p style="font-size: 11px; margin-top: 4px;">https://${rootDomain} | Support: support@${rootDomain}</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
