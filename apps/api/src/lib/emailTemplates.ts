import { env } from '../env';

function baseEmailLayout(title: string, contentHtml: string): string {
  const rootDomain = env.rootDomain || 'shanutechx.com';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0c0a0f; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; color: #f3f0f7; }
    .container { max-width: 580px; margin: 0 auto; padding: 32px 20px; }
    .card { background: #14101f; border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .logo-badge { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; background: linear-gradient(135deg, #7c3aed, #06b6d4); border-radius: 12px; font-weight: 800; font-size: 22px; color: #ffffff; margin-bottom: 20px; }
    h1 { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 16px 0; letter-spacing: -0.3px; }
    p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 16px 0; }
    .status-badge { display: inline-block; padding: 6px 12px; border-radius: 99px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
    .status-success { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
    .status-danger { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
    .status-info { background: rgba(124,58,237,0.15); color: #cfbcff; border: 1px solid rgba(124,58,237,0.3); }
    .btn { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #7c3aed, #6366f1); color: #ffffff !important; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 600; margin-top: 16px; box-shadow: 0 4px 14px rgba(124,58,237,0.4); }
    .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 24px; }
    .table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .table th { text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
    .table td { padding: 10px 0; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.04); color: #e2e8f0; }
    .quote-box { background: rgba(255,255,255,0.03); border-left: 3px solid #7c3aed; padding: 14px; border-radius: 0 8px 8px 0; font-size: 13px; color: #cbd5e1; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo-badge">S</div>
      ${contentHtml}
    </div>
    <div class="footer">
      <p>© 2026 ShanuTechX Platform · <a href="https://${rootDomain}" style="color: #7c3aed; text-decoration: none;">https://${rootDomain}</a></p>
    </div>
  </div>
</body>
</html>`;
}

export function renderOrderPaidEmail({
  orderId,
  customerName,
  totalLkr,
  items,
}: {
  orderId: string;
  customerName: string;
  totalLkr: number;
  items: Array<{ name: string; quantity: number; price: number }>;
}): { subject: string; html: string; text: string } {
  const subject = `Order Confirmed & Provisioned (#${orderId.slice(0, 8).toUpperCase()})`;
  const itemsHtml = items
    .map(
      (item) => `<tr>
      <td>${item.name}</td>
      <td style="text-align: center;">${item.quantity}</td>
      <td style="text-align: right;">Rs ${item.price.toLocaleString('en-LK')}</td>
    </tr>`
    )
    .join('');

  const html = baseEmailLayout(
    subject,
    `
    <div class="status-badge status-success">Payment Confirmed</div>
    <h1>Thank you for your order, ${customerName}!</h1>
    <p>Your payment for Order <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> has been confirmed and your products have been automatically provisioned.</p>
    
    <table class="table">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <p style="text-align: right; font-size: 16px; font-weight: 700; color: #4ade80;">Total Paid: Rs ${totalLkr.toLocaleString('en-LK')}</p>

    <a href="https://${env.rootDomain}/dashboard" class="btn">Access Dashboard & Services →</a>
  `
  );

  const text = `Thank you for your order, ${customerName}!\nPayment for Order #${orderId} (Rs ${totalLkr}) has been confirmed and provisioned.\nAccess your services at https://${env.rootDomain}/dashboard`;

  return { subject, html, text };
}

export function renderPaymentReviewEmail({
  orderId,
  approved,
  reason,
}: {
  orderId: string;
  approved: boolean;
  reason?: string;
}): { subject: string; html: string; text: string } {
  const subject = approved
    ? `Payment Approved for Order #${orderId.slice(0, 8).toUpperCase()}`
    : `Payment Proof Update for Order #${orderId.slice(0, 8).toUpperCase()}`;

  const statusBadge = approved
    ? `<div class="status-badge status-success">Payment Approved</div>`
    : `<div class="status-badge status-danger">Review Update</div>`;

  const bodyHtml = approved
    ? `<p>Your payment proof for Order <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> has been verified and approved by our team!</p>`
    : `<p>Your payment proof for Order <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> could not be verified.</p>
       <div class="quote-box"><strong>Reason:</strong> ${reason || 'Proof details did not match order total.'}</div>
       <p>Please re-upload a clear payment slip or contact support if you need assistance.</p>`;

  const html = baseEmailLayout(
    subject,
    `
    ${statusBadge}
    <h1>${approved ? 'Payment Verification Successful 🎉' : 'Payment Proof Action Needed'}</h1>
    ${bodyHtml}
    <a href="https://${env.rootDomain}/orders" class="btn">View Order Status →</a>
  `
  );

  const text = approved
    ? `Your payment for Order #${orderId} was approved! View your services at https://${env.rootDomain}/orders`
    : `Your payment proof for Order #${orderId} could not be verified: ${reason || 'Details mismatched'}. Visit https://${env.rootDomain}/orders`;

  return { subject, html, text };
}

export function renderTicketReplyEmail({
  ticketSubject,
  senderName,
  messageBody,
  ticketId,
}: {
  ticketSubject: string;
  senderName: string;
  messageBody: string;
  ticketId: string;
}): { subject: string; html: string; text: string } {
  const subject = `[Ticket Update] ${ticketSubject}`;
  const html = baseEmailLayout(
    subject,
    `
    <div class="status-badge status-info">Support Reply</div>
    <h1>New reply from ${senderName}</h1>
    <p>There is a new reply on your support ticket <strong>"${ticketSubject}"</strong>:</p>
    <div class="quote-box">${messageBody.replace(/\n/g, '<br/>')}</div>
    <a href="https://${env.rootDomain}/tickets/${ticketId}" class="btn">Reply to Ticket →</a>
  `
  );

  const text = `New reply from ${senderName} on "${ticketSubject}":\n\n${messageBody}\n\nReply at https://${env.rootDomain}/tickets/${ticketId}`;

  return { subject, html, text };
}

export function renderNotificationEmail({
  title,
  message,
}: {
  title: string;
  message: string;
}): { subject: string; html: string; text: string } {
  const subject = `[ShanuTechX] ${title}`;
  const html = baseEmailLayout(
    subject,
    `
    <div class="status-badge status-info">Notification</div>
    <h1>${title}</h1>
    <p>${message.replace(/\n/g, '<br/>')}</p>
    <a href="https://${env.rootDomain}/dashboard" class="btn">Open Dashboard →</a>
  `
  );

  const text = `${title}\n\n${message}\n\nVisit https://${env.rootDomain}/dashboard`;

  return { subject, html, text };
}
