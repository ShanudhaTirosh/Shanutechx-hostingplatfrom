import { env } from '../env';

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function baseEmailLayout(title: string, contentHtml: string): string {
  const rootDomain = env.rootDomain || 'shanutechx.com';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
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
  const safeName = escapeHtml(customerName);
  const subject = `Order Confirmed & Provisioned (#${orderId.slice(0, 8).toUpperCase()})`;
  const itemsHtml = items
    .map(
      (item) => `<tr>
      <td>${escapeHtml(item.name)}</td>
      <td style="text-align: center;">${item.quantity}</td>
      <td style="text-align: right;">Rs ${item.price.toLocaleString('en-LK')}</td>
    </tr>`
    )
    .join('');

  const html = baseEmailLayout(
    subject,
    `
    <div class="status-badge status-success">Payment Confirmed</div>
    <h1>Thank you for your order, ${safeName}!</h1>
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

  const safeReason = escapeHtml(reason || 'Proof details did not match order total.');

  const bodyHtml = approved
    ? `<p>Your payment proof for Order <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> has been verified and approved by our team!</p>`
    : `<p>Your payment proof for Order <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> could not be verified.</p>
       <div class="quote-box"><strong>Reason:</strong> ${safeReason}</div>
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
  const safeSender = escapeHtml(senderName);
  const safeSubject = escapeHtml(ticketSubject);
  const safeBody = escapeHtml(messageBody).replace(/\n/g, '<br/>');

  const subject = `[Ticket Update] ${ticketSubject}`;
  const html = baseEmailLayout(
    subject,
    `
    <div class="status-badge status-info">Support Reply</div>
    <h1>New reply from ${safeSender}</h1>
    <p>There is a new reply on your support ticket <strong>"${safeSubject}"</strong>:</p>
    <div class="quote-box">${safeBody}</div>
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
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br/>');

  const subject = `[ShanuTechX] ${title}`;
  const html = baseEmailLayout(
    subject,
    `
    <div class="status-badge status-info">Notification</div>
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    <a href="https://${env.rootDomain}/dashboard" class="btn">Open Dashboard →</a>
  `
  );

  const text = `${title}\n\n${message}\n\nVisit https://${env.rootDomain}/dashboard`;

  return { subject, html, text };
}

export function renderTeamInviteEmail({
  teamName,
  inviterName,
  role,
  inviteLink,
}: {
  teamName: string;
  inviterName: string;
  role: string;
  inviteLink: string;
}): { subject: string; html: string; text: string } {
  const safeTeam = escapeHtml(teamName);
  const safeInviter = escapeHtml(inviterName);
  const safeRole = escapeHtml(role.toUpperCase());
  const safeLink = escapeHtml(inviteLink);

  const subject = `You've been invited to join ${teamName} on ShanuTechX`;

  const html = baseEmailLayout(
    subject,
    `
    <div class="status-badge status-info">Team Invitation</div>
    <h1>You're invited to join ${safeTeam}!</h1>
    <p><strong>${safeInviter}</strong> has invited you to join the <strong>${safeTeam}</strong> workspace on ShanuTechX with the role of <strong>${safeRole}</strong>.</p>
    
    <div class="quote-box">
      <strong>Assigned Role:</strong> ${safeRole}<br/>
      <strong>Access Granted:</strong> Granular workspace &amp; resource permissions managed by ${safeTeam}.
    </div>

    <p>Click the button below to accept the invitation. If you don't have a ShanuTechX account yet, you can sign in directly with Google or Email to claim your spot.</p>

    <a href="${safeLink}" class="btn">Accept Team Invitation →</a>
  `
  );

  const text = `${inviterName} has invited you to join ${teamName} on ShanuTechX as ${role}.\n\nAccept your invitation here:\n${inviteLink}`;

  return { subject, html, text };
}

export function renderWelcomeEmail({
  customerName,
}: {
  customerName: string;
}): { subject: string; html: string; text: string } {
  const safeName = escapeHtml(customerName);
  const subject = `Welcome to ShanuTechX Cloud Hosting! 🎉`;

  const html = baseEmailLayout(
    subject,
    `
    <div class="status-badge status-success">Account Active</div>
    <h1>Welcome to ShanuTechX, ${safeName}!</h1>
    <p>We are excited to have you on board. ShanuTechX gives you full power over high-performance cloud deployments, managed databases, VPS servers, and custom bot hosting.</p>
    
    <div class="quote-box">
      <strong>🚀 What you can do right now:</strong><br/>
      • Connect your GitHub or GitLab account &amp; deploy in seconds.<br/>
      • Host WhatsApp Baileys MD bots &amp; Discord bots with persistent state.<br/>
      • Run Lavalink audio nodes with direct TCP port mapping.<br/>
      • Provision high-speed NVMe VPS nodes &amp; PostgreSQL/Redis databases.
    </div>

    <a href="https://${env.rootDomain}/dashboard" class="btn">Launch Client Dashboard →</a>
  `
  );

  const text = `Welcome to ShanuTechX, ${customerName}!\nYour account is active. Deploy applications, bots, databases, and VPS nodes at https://${env.rootDomain}/dashboard`;

  return { subject, html, text };
}

export function renderSubscriptionGracePeriodEmail({
  serviceName,
  gracePeriodEndsAt,
}: {
  serviceName: string;
  gracePeriodEndsAt: string;
}): { subject: string; html: string; text: string } {
  const safeService = escapeHtml(serviceName);
  const safeEnds = escapeHtml(gracePeriodEndsAt);
  const subject = `[Action Required] Grace Period Warning for ${serviceName}`;

  const html = baseEmailLayout(
    subject,
    `
    <div class="status-badge status-danger">Grace Period Active</div>
    <h1>Subscription Expiry Notice</h1>
    <p>Your subscription for <strong>${safeService}</strong> has entered its grace period due to an unpaid balance.</p>
    
    <div class="quote-box" style="border-left-color: #ef4444;">
      <strong>Service:</strong> ${safeService}<br/>
      <strong>Suspension Date:</strong> ${safeEnds}<br/>
      <strong>Status:</strong> Active (Grace Period)
    </div>

    <p>Please renew your subscription before ${safeEnds} to avoid service interruption or container teardown.</p>

    <a href="https://${env.rootDomain}/billing" class="btn" style="background: linear-gradient(135deg, #ef4444, #dc2626);">Renew Subscription Now →</a>
  `
  );

  const text = `Subscription Warning: Your service "${serviceName}" is in its grace period and will be suspended on ${gracePeriodEndsAt} if unpaid.\nRenew at https://${env.rootDomain}/billing`;

  return { subject, html, text };
}

export function renderDeploymentStatusEmail({
  deploymentName,
  subdomain,
  status,
  errorMessage,
}: {
  deploymentName: string;
  subdomain?: string | null;
  status: 'running' | 'failed' | 'stopped';
  errorMessage?: string;
}): { subject: string; html: string; text: string } {
  const safeName = escapeHtml(deploymentName);
  const isSuccess = status === 'running';
  const subject = isSuccess
    ? `Deployment Live: ${deploymentName}`
    : `Deployment Alert: ${deploymentName} is ${status.toUpperCase()}`;

  const statusBadge = isSuccess
    ? `<div class="status-badge status-success">Deployment Live</div>`
    : `<div class="status-badge status-danger">Deployment ${status.toUpperCase()}</div>`;

  const safeMsg = errorMessage ? escapeHtml(errorMessage) : null;
  const targetUrl = subdomain ? `https://${subdomain}.${env.rootDomain}` : `https://${env.rootDomain}/deployments`;

  const html = baseEmailLayout(
    subject,
    `
    ${statusBadge}
    <h1>${isSuccess ? `${safeName} is Live! 🚀` : `Issue detected with ${safeName}`}</h1>
    <p>${isSuccess ? `Your application container has been successfully deployed and is running.` : `Your deployment status changed to <strong>${status}</strong>.`}</p>
    
    ${safeMsg ? `<div class="quote-box"><strong>Log / Error Output:</strong><br/>${safeMsg}</div>` : ''}

    <a href="${targetUrl}" class="btn">${isSuccess ? 'Open Live Application →' : 'Inspect Build Logs →'}</a>
  `
  );

  const text = isSuccess
    ? `${deploymentName} is live at ${targetUrl}`
    : `Alert: ${deploymentName} status is ${status}. Log: ${errorMessage || 'N/A'}.\nInspect at https://${env.rootDomain}/deployments`;

  return { subject, html, text };
}
