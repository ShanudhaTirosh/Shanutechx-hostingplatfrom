import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | STX HOSTING',
  description: 'Privacy policy for the SHANUTECHX hosting platform.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold mb-2 text-white">{title}</h2>
      <div className="text-xs text-text-muted leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

export default function DashboardPrivacyPage() {
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

        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        <p className="text-text-muted text-xs">Last updated: September 3, 2026</p>

        <div className="glass rounded-2xl p-6 border border-white/[0.08] space-y-6 bg-white/[0.02]">
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
            <p className="pt-2">Each of these has its own privacy practices governing the data that passes through it.</p>
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
      </div>
    </main>
  );
}
