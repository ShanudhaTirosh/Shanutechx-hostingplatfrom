import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | STX HOSTING',
  description: 'Terms of service for the SHANUTECHX hosting platform.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold mb-2 text-white">{title}</h2>
      <div className="text-xs text-text-muted leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

export default function DashboardTermsPage() {
  return (
    <main className="min-h-screen bg-[#060719] text-white py-12 px-4 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <span className="h-8 w-8 rounded-xl bg-gradient-to-tr from-emerald-500 via-cyan-500 to-indigo-500 flex items-center justify-center text-white font-black text-xs">
              STX
            </span>
            <span className="font-extrabold text-lg tracking-tight">
              SHANUTECHX <span className="text-emerald-400 font-bold">.CLOUD</span>
            </span>
          </div>
          <Link
            href="/login"
            className="text-xs font-semibold text-accent-teal hover:underline flex items-center gap-1"
          >
            ← Back to Login
          </Link>
        </div>

        <h1 className="text-2xl font-bold">Terms of Service</h1>
        <p className="text-text-muted text-xs">Last updated: September 3, 2026</p>

        <div className="glass rounded-2xl p-6 border border-white/[0.08] space-y-6 bg-white/[0.02]">
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
            <p className="pt-2">
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
            <p className="pt-2">
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
      </div>
    </main>
  );
}
