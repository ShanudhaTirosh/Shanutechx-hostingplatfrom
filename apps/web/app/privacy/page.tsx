import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for the SHANUTECHX hosting platform.',
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

export default function PrivacyPage() {
  return (
    <main>
      <Navbar />
      <section className="px-4 pt-44 pb-24 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-text-muted text-sm mb-8">Last updated: September 3, 2026</p>

        <div className="glass rounded-2xl p-6 mb-8 text-xs text-yellow-300/90 border border-yellow-500/20">
          This draft accurately lists the third-party services this platform actually sends data
          to, based on its real architecture. It is not legal advice — data protection
          requirements (consent, retention limits, cross-border transfer rules) vary by
          jurisdiction. Have this reviewed before relying on it, especially if you have customers
          in the EU/UK (GDPR) or other regions with specific data protection law.
        </div>

        <div className="glass rounded-2xl p-6">
          <Section title="1. Information we collect">
            <ul className="list-disc pl-5 space-y-1">
              <li>Account info: email, display name, and (if you choose to link them) WhatsApp number and Discord user ID</li>
              <li>Payment data: proof-of-payment screenshots you upload, and the amount/reference extracted from them — never full card numbers, since we don't process card payments directly</li>
              <li>SMS payment data: when a payment SMS is forwarded by our matching system, the message content and sender are used to match it against your order, then retained for that purpose</li>
              <li>Server/deployment logs: build and runtime logs for apps you deploy, repository URLs, and configuration you provide</li>
              <li>Support data: ticket messages and live chat messages</li>
              <li>Usage data: login timestamps, IP address at time of request, basic device/browser info</li>
            </ul>
          </Section>

          <Section title="2. How we use it">
            <p>
              To provide the Service (provisioning, billing, support), to verify payments, to send
              you service notifications (by email always, and by WhatsApp/Discord if you've linked
              them), and to detect abuse of shared infrastructure.
            </p>
          </Section>

          <Section title="3. Third-party services we use">
            <p>Data passes through the following services as part of how the platform works:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Firebase (Google)</strong> — account authentication, and live chat messages (Realtime Database)</li>
              <li><strong>Edge Network &amp; DNS</strong> — DNS and network-level protection for your subdomain/domain</li>
              <li><strong>Google Gemini</strong> — reads payment proof screenshots to extract the amount/reference automatically</li>
              <li><strong>Postal (self-hosted)</strong> — sends account/order email notifications and powers SMTP hosting plans</li>
              <li><strong>WhatsApp / Discord</strong> — if you link these, order and deployment notifications are sent through them</li>
              <li><strong>Upstream VPS providers</strong> — if you purchase a VPS plan, your VPS itself is hosted with that provider, under their own privacy practices</li>
            </ul>
            <p>Each of these has its own privacy practices governing the data that passes through it.</p>
          </Section>

          <Section title="4. Data retention">
            <p>
              Account and billing data is kept for as long as your account is active and as
              needed afterward for legal/accounting requirements. Payment proof images and
              extracted data are kept for dispute-resolution purposes. Deployment logs are
              retained on a rolling basis (not indefinitely) and may be cleared on redeploy.
            </p>
          </Section>

          <Section title="5. Your rights">
            <p>
              You can request a copy of your account data or request deletion by contacting
              support. Deleting your account will deprovision active services — make sure you've
              backed up anything you need first.
            </p>
          </Section>

          <Section title="6. Security">
            <p>
              Passwords for SMTP accounts, LiveKit projects, and VPS panels are encrypted at rest.
              We don't store your Firebase Auth password — that's handled entirely by Firebase.
            </p>
          </Section>

          <Section title="7. Children's privacy">
            <p>The Service isn't directed at children and isn't intended for use by anyone under 18.</p>
          </Section>

          <Section title="8. Changes to this policy">
            <p>We may update this policy from time to time; continued use of the Service means you accept the update.</p>
          </Section>

          <Section title="9. Contact">
            <p>Questions about this policy, or to make a data request: support@shanutechx.com.</p>
          </Section>
        </div>
      </section>
      <Footer />
    </main>
  );
}
