import { env } from '../env';

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STX_LOGO_URI = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='837.67 3380 8324.64 3240'><polygon fill='%23ffffff' points='8500,6616.67 7576.67,6616.67 6763.33,5756.67 5910,6616.67 4290,6616.67 4660,4530 5390,4530 5030,6580 5030,6590 6333.33,5293.33 5603.33,4530 6526.67,4526.67 '/><polygon fill='%23ffffff' points='8166.67,3383.33 9160,3383.33 7320,5156.67 6873.33,4670 '/><polygon fill='%23ffffff' points='2140,4963.33 2006.67,4826.67 1963.33,4750 1943.33,4676.67 1940,4610 1946.67,4563.33 1963.33,4503.33 1996.67,4446.67 2040,4403.33 2086.67,4360 2136.67,4326.67 2193.33,4303.33 2243.33,4290 2286.67,4286.67 6346.67,4286.67 7043.33,3620 2290,3616.67 2183.33,3633.33 2096.67,3656.67 2003.33,3683.33 1900,3730 1813.33,3776.67 1723.33,3840 1666.67,3876.67 1590,3943.33 1520,4023.33 1470,4083.33 1413.33,4160 1353.33,4273.33 1313.33,4370 1280,4483.33 1260,4583.33 1256.67,4690 1263.33,4793.33 1283.33,4896.67 1320,5013.33 1350,5070 1393.33,5143.33 1450,5216.67 1496.67,5263.33 1556.67,5310 1640,5363.33 1716.67,5406.67 1790,5433.33 1850,5450 1910,5466.67 1963.33,5473.33 2003.33,5476.67 2083.33,5480 2640,5480 '/><polygon fill='%23ffffff' points='2213.33,4776.67 2873.33,5476.67 3373.33,5476.67 3396.67,5480 3426.67,5493.33 3456.67,5510 3476.67,5526.67 3496.67,5543.33 3516.67,5570 3533.33,5600 3540,5620 3546.67,5643.33 3546.67,5670 3546.67,5700 3540,5730 3526.67,5770 3513.33,5800 3493.33,5830 3473.33,5853.33 3440,5883.33 3406.67,5906.67 3363.33,5926.67 3330,5940 1526.67,5943.33 840,6613.33 3220,6610 3260,6610 3313.33,6606.67 3366.67,6596.67 3420,6580 3493.33,6560 3550,6536.67 3606.67,6513.33 3666.67,6476.67 3743.33,6430 3816.67,6383.33 3880,6326.67 3933.33,6276.67 3990,6213.33 4056.67,6130 4116.67,6030 4153.33,5960 4186.67,5873.33 4216.67,5780 4226.67,5716.67 4233.33,5663.33 4230,5496.67 4210,5390 4176.67,5286.67 4143.33,5206.67 4090,5116.67 4040,5056.67 3980,4993.33 3920,4943.33 3840,4890 3756.67,4846.67 3653.33,4810 3573.33,4793.33 3523.33,4786.67 3443.33,4783.33 '/></svg>";

function baseEmailLayout(title: string, contentHtml: string): string {
  const rootDomain = env.rootDomain || 'shanutechx.com';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; background-color: #eef1f4; font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #20242b; }
    .email-container { max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 4px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
    .email-band { background-color: #07060d; padding: 36px 40px 30px; position: relative; overflow: hidden; }
    .email-slash { position: absolute; right: 0; top: 0; bottom: 0; width: 120px; background: linear-gradient(135deg, transparent 46%, #20c6e0 46.6%, #7146eb 49%, transparent 49.6%); opacity: 0.9; }
    .brand-logo { display: inline-block; position: relative; z-index: 2; }
    .brand-logo img { height: 38px; width: auto; display: block; }
    .brand-logo .sub { color: #ffffff; border-top: 2px solid #20c6e0; font-family: 'Space Grotesk', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.38em; margin-top: 6px; padding-top: 4px; display: inline-block; }
    .email-body { padding: 40px 40px 20px; font-size: 14px; line-height: 1.8; color: #3a4048; }
    .email-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #146a8a; margin-bottom: 14px; }
    h1 { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; color: #07060d; margin: 0 0 18px 0; line-height: 1.3; }
    p { margin: 0 0 16px 0; }
    .status-badge { display: inline-block; padding: 5px 14px; border-radius: 999px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 18px; font-family: 'JetBrains Mono', monospace; }
    .status-success { background: #ecfdf5; color: #059669; border: 1.5px solid #10b981; }
    .status-danger { background: #fef2f2; color: #dc2626; border: 1.5px solid #ef4444; }
    .status-info { background: #f5f3ff; color: #6d28d9; border: 1.5px solid #8b5cf6; }
    .btn { display: inline-block; padding: 14px 28px; background: linear-gradient(115deg, #7146eb 0%, #4574e1 52%, #20c6e0 100%); color: #ffffff !important; text-decoration: none; border-radius: 2px; font-size: 13px; font-weight: 700; margin: 12px 0 26px; letter-spacing: 0.03em; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    .table th { text-align: left; font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #ffffff; background: #07060d; padding: 11px 14px; font-weight: 700; }
    .table td { padding: 13px 14px; border-bottom: 1px solid #eef1f4; color: #20242b; }
    .table tr:nth-child(even) { background-color: #f7f8fa; }
    .quote-box { background: #f7f8fa; border-left: 3px solid #7146eb; padding: 14px 16px; font-size: 13px; color: #3a4048; margin: 16px 0; }
    .email-divider { height: 1px; background-color: #eef1f4; margin: 8px 40px 0; }
    .email-sign { padding: 26px 40px 10px; font-size: 13px; color: #3a4048; line-height: 1.8; }
    .email-sign strong { display: block; color: #07060d; font-size: 14px; }
    .email-footer { background: #f7f8fa; padding: 26px 40px 30px; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #8b929c; line-height: 1.9; letter-spacing: 0.02em; border-top: 1px solid #eef1f4; }
    .email-footer a { color: #146a8a; text-decoration: none; }
    .email-social { margin-top: 10px; }
    .email-social span { margin-right: 14px; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-band">
      <div class="email-slash"></div>
      <div class="brand-logo">
        <img src="${STX_LOGO_URI}" alt="STX Enterprises Logo">
        <div class="sub">DIGITAL EMPIRE STUDIO</div>
      </div>
    </div>
    <div class="email-body">
      <div class="email-eyebrow">Enterprise Notification</div>
      ${contentHtml}
    </div>
    <div class="email-divider"></div>
    <div class="email-sign">
      <strong>Shanudha Tirosh</strong>
      Founder — STX Enterprises / Digital Empire Studio<br>
      hello@stxenterprises.com&nbsp; ·&nbsp; www.stxenterprises.com
    </div>
    <div class="email-footer">
      STX Enterprises — Digital Empire Studio, Negombo, Sri Lanka<br>
      Automated Enterprise Cloud &amp; Orchestration Infrastructure · <a href="https://${rootDomain}">https://${rootDomain}</a>
      <div class="email-social">
        <span><a href="https://${rootDomain}">Website</a></span>
        <span><a href="https://github.com/ShanudhaTirosh">GitHub</a></span>
        <span><a href="https://discord.gg/shanutechx">Discord</a></span>
      </div>
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
  const formattedTotal = (totalLkr / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const itemsHtml = items
    .map(
      (item) => `<tr>
      <td>${escapeHtml(item.name)}</td>
      <td style="text-align: center;">${item.quantity}</td>
      <td style="text-align: right;">Rs ${(item.price / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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

    <p style="text-align: right; font-size: 16px; font-weight: 700; color: #4ade80;">Total Paid: Rs ${formattedTotal}</p>

    <a href="https://${env.rootDomain}/dashboard" class="btn">Access Dashboard & Services →</a>
  `
  );

  const text = `Thank you for your order, ${customerName}!\nPayment for Order #${orderId} (Rs ${formattedTotal}) has been confirmed and provisioned.\nAccess your services at https://${env.rootDomain}/dashboard`;

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

export function renderPasswordResetEmail({
  customerName,
  resetLink,
}: {
  customerName: string;
  resetLink: string;
}): { subject: string; html: string; text: string } {
  const safeName = escapeHtml(customerName);
  const safeLink = escapeHtml(resetLink);
  const subject = `Reset Your ShanuTechX Account Password`;

  const html = baseEmailLayout(
    subject,
    `
    <div class="status-badge status-info">Password Reset Request</div>
    <h1>Hello, ${safeName}</h1>
    <p>We received a request to reset your password for your ShanuTechX Cloud Hosting account.</p>
    <p>Click the button below to set a new password. This link is valid for 1 hour.</p>

    <a href="${safeLink}" class="btn">Reset My Password →</a>

    <p style="margin-top: 20px; font-size: 12px; color: #64748b;">
      If you did not request a password reset, you can safely ignore this email — your account remains secure.
    </p>
  `
  );

  const text = `Hello ${customerName},\n\nReset your ShanuTechX password by visiting the following link:\n${resetLink}\n\nThis link expires in 1 hour.`;

  return { subject, html, text };
}

export function renderInvoiceDeliveryEmail({
  customerName,
  orderId,
  totalLkr,
  items,
  invoiceUrl,
}: {
  customerName: string;
  orderId: string;
  totalLkr: number;
  items: Array<{ name: string; quantity: number; price: number }>;
  invoiceUrl?: string;
}): { subject: string; html: string; text: string } {
  const safeName = escapeHtml(customerName);
  const subject = `Official Tax Invoice — Order #${orderId.slice(0, 8).toUpperCase()}`;
  const formattedTotal = (totalLkr / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const itemsHtml = items
    .map(
      (item) => `<tr>
      <td>${escapeHtml(item.name)}</td>
      <td style="text-align: center;">${item.quantity}</td>
      <td style="text-align: right;">Rs ${(item.price / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>`
    )
    .join('');

  const targetLink = invoiceUrl || `https://${env.rootDomain}/orders`;

  const html = baseEmailLayout(
    subject,
    `
    <div class="status-badge status-success">Invoice Delivered</div>
    <h1>Invoice for ${safeName}</h1>
    <p>Your invoice for Order <strong>#${orderId.slice(0, 8).toUpperCase()}</strong> is ready.</p>
    
    <table class="table">
      <thead>
        <tr>
          <th>Service / Description</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <p style="text-align: right; font-size: 16px; font-weight: 700; color: #4ade80;">Total Paid: Rs ${formattedTotal}</p>

    <a href="${targetLink}" class="btn">Download Official Invoice PDF →</a>
  `
  );

  const text = `Invoice for ${customerName} (Order #${orderId.slice(0, 8).toUpperCase()}):\nTotal: Rs ${formattedTotal}\nDownload PDF at ${targetLink}`;

  return { subject, html, text };
}

