import { test, describe } from 'node:test';
import assert from 'node:assert';
import { sanitizeHtml } from '../../apps/dashboard/lib/sanitize';
import { renderOrderPaidEmail, renderTicketReplyEmail } from '../../apps/api/src/lib/emailTemplates';

describe('Audit Fixes Verification Tests', () => {
  test('HTML Sanitizer removes dangerous script tags and inline event handlers', () => {
    const maliciousHtml = '<p>Hello</p><script>alert("XSS")</script><img src=x onerror=alert(1)><a href="javascript:alert(2)">click</a>';
    const sanitized = sanitizeHtml(maliciousHtml);

    assert.strictEqual(sanitized.includes('<script>'), false);
    assert.strictEqual(sanitized.includes('onerror'), false);
    assert.strictEqual(sanitized.includes('javascript:'), false);
    assert.strictEqual(sanitized.includes('Hello'), true);
  });

  test('Email templates HTML-escape user controlled variables', () => {
    const maliciousName = '<script>alert("hacked")</script>';
    const email = renderOrderPaidEmail({
      orderId: 'order123456789',
      customerName: maliciousName,
      totalLkr: 1000,
      items: [{ name: '<img src=x onerror=alert(1)>', quantity: 1, price: 1000 }],
    });

    assert.strictEqual(email.html.includes('<script>'), false);
    assert.strictEqual(email.html.includes('&lt;script&gt;alert(&quot;hacked&quot;)&lt;/script&gt;'), true);
    assert.strictEqual(email.html.includes('<img src=x onerror=alert(1)>'), false);
    assert.strictEqual(email.html.includes('&lt;img src=x onerror=alert(1)&gt;'), true);
  });

  test('Ticket reply email escapes subject and senderName', () => {
    const email = renderTicketReplyEmail({
      ticketSubject: '<b onmouseover=alert(1)>Subject</b>',
      senderName: '<script>attacker</script>',
      messageBody: 'Line1\nLine2',
      ticketId: 't123',
    });

    assert.strictEqual(email.html.includes('<script>'), false);
    assert.strictEqual(email.html.includes('&lt;script&gt;attacker&lt;/script&gt;'), true);
    assert.strictEqual(email.html.includes('<b onmouseover=alert(1)>'), false);
  });
});
