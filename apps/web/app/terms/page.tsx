import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for the SHANUTECHX hosting platform.',
  robots: { index: false },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-2 text-text-primary">{title}</h2>
      <div className="text-sm text-text-muted leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <main>
      <Navbar />
      <section className="px-4 pt-44 pb-24 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-text-muted text-sm mb-8">Last updated: September 3, 2026</p>

        <div className="glass rounded-2xl p-6 mb-8 text-xs text-yellow-300/90 border border-yellow-500/20">
          This is a starting draft covering the platform's actual features (hosting, VPS
          reselling, SMTP, LiveKit, payment verification, SMS-based payment matching). It is not
          legal advice. Have a qualified lawyer in your jurisdiction review and adapt this before
          relying on it — requirements around consumer protection, refunds, and data handling vary
          by country and by what payment methods you accept.
        </div>

        <div className="glass rounded-2xl p-6">
          <Section title="1. Acceptance of terms">
            <p>
              By creating an account or using SHANUTECHX ("the Service"), you agree to these
              Terms. If you don't agree, don't use the Service.
            </p>
          </Section>

          <Section title="2. What the Service includes">
            <p>
              SHANUTECHX provides web, Node.js, Python, and Discord bot hosting; VPS reselling
              (capacity from upstream providers, managed through their own control panel — not
              ours); SMTP mail hosting; LiveKit real-time audio/video infrastructure; and related
              tools (invoicing, support tickets, deployment logs).
            </p>
          </Section>

          <Section title="3. Accounts">
            <p>
              You're responsible for keeping your login credentials secure and for all activity
              under your account. Tell us immediately if you suspect unauthorized access.
            </p>
          </Section>

          <Section title="4. Acceptable use">
            <p>You may not use the Service to host, transmit, or facilitate:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Malware, ransomware, or anything designed to damage or gain unauthorized access to systems</li>
              <li>Spam, phishing, or unsolicited bulk messaging (including via the SMTP or SMS features)</li>
              <li>Content that's illegal in Sri Lanka or in the jurisdiction your customers are located in</li>
              <li>Cryptocurrency mining or other activity designed to consume shared resources disproportionately</li>
              <li>Denial-of-service attacks, port scanning, or other network abuse directed at third parties</li>
            </ul>
            <p>
              We reserve the right to suspend or terminate any deployment, mailbox, or account that
              violates this policy, with or without notice depending on severity.
            </p>
          </Section>

          <Section title="5. Payment and billing">
            <p>
              One-time services are billed once at purchase. Recurring services (monthly/yearly
              plans) renew on the billing cycle shown at purchase; we'll notify you before a
              renewal is due and again if a payment is missed. Accounts past due beyond the grace
              period stated in your plan may have the associated service suspended.
            </p>
            <p>
              Payment proofs (screenshots, SMS confirmations) are checked automatically and, where
              automatic verification isn't confident enough, reviewed by a person before a service
              activates. Refund eligibility depends on the service type — contact support before
              assuming a refund applies.
            </p>
          </Section>

          <Section title="6. VPS reselling">
            <p>
              VPS plans are capacity resold from an upstream provider. Your VPS is managed through
              that provider's own control panel, not ours — their acceptable-use policy and terms
              apply to your VPS in addition to these Terms. We are not responsible for the
              upstream provider's uptime, support response times, or policies.
            </p>
          </Section>

          <Section title="7. Custom domains">
            <p>
              If you point your own domain at a deployment, you remain responsible for that
              domain's registration and DNS configuration. We verify domain ownership via DNS
              record before routing traffic to it, but we don't manage your domain registration.
            </p>
          </Section>

          <Section title="8. Backups and data loss">
            <p>
              You are responsible for maintaining your own backups of code, data, and content
              hosted through the Service. While we take reasonable measures to protect data, we
              don't guarantee against loss and recommend not treating any single copy — including
              one on our infrastructure — as your only copy.
            </p>
          </Section>

          <Section title="9. Suspension and termination">
            <p>
              We may suspend or terminate access for Terms violations, non-payment past the grace
              period, or if required by law. You may close your account at any time; this doesn't
              entitle you to a refund for unused time except where required by law or stated
              otherwise in your plan.
            </p>
          </Section>

          <Section title="10. Limitation of liability">
            <p>
              The Service is provided "as is." To the extent permitted by law, we aren't liable
              for indirect, incidental, or consequential damages arising from your use of the
              Service, including data loss or service interruption.
            </p>
          </Section>

          <Section title="11. Changes to these terms">
            <p>
              We may update these Terms from time to time. Continued use of the Service after an
              update means you accept the revised Terms.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>Questions about these Terms: support@shanutechx.com.</p>
          </Section>
        </div>
      </section>
      <Footer />
    </main>
  );
}
