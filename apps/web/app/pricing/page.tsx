import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Pricing & Specifications | SHANUTECHX',
  description: 'Detailed resource specifications, build pipelines, auto-routing, and security features for all SHANUTECHX products.',
};

const BILLING_LABEL: Record<string, string> = {
  one_time: 'one-time',
  monthly: '/month',
  quarterly: '/3 months',
  semiannual: '/6 months',
  yearly: '/year',
};

interface Plan { id: string; name: string; price: number; billingType: string; }
interface Product { id: string; name: string; category: string; description: string | null; plans: Plan[]; }

function formatPrice(cents: number) {
  return `LKR ${(cents / 100).toLocaleString('en-LK', { minimumFractionDigits: 0 })}`;
}

async function getProducts(): Promise<Product[]> {
  const apiBase = process.env.API_BASE_URL;
  if (!apiBase) return [];
  try {
    const res = await fetch(`${apiBase}/api/products`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.products ?? [];
  } catch {
    return [];
  }
}

export default async function PricingPage() {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';
  const loginUrl = `${dashboardUrl}/login`;
  const products = await getProducts();

  return (
    <main className="min-h-screen flex flex-col justify-between">
      <Navbar />

      <div className="flex-1 pt-32 pb-20 px-4 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Detailed <span className="text-gradient">Specifications</span>
          </h1>
          <p className="text-text-muted mt-4 max-w-xl mx-auto leading-relaxed">
            See the exact hardware resources, runtime environment features, and networking configurations allocated for every single product we offer.
          </p>
        </div>

        {/* Platform overview */}
        <div className="glass rounded-2xl p-6 md:p-8 mb-16 border-white/[0.08] relative overflow-hidden animate-slide-up">
          <div className="absolute inset-0 bg-brand-gradient opacity-[0.03] -z-10" />
          <h2 className="text-lg md:text-xl font-bold text-text-primary mb-4 flex items-center gap-2">
            <span>⚡</span> Automated Cloud Platform
          </h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-semibold text-text-primary mb-1">1. Automated Build Pipeline</h3>
              <p className="text-text-muted text-xs leading-relaxed">
                Automatically analyzes your code repositories upon push. Builds lightweight, production-ready images for Node.js, Python, or static web applications with zero manual setup.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">2. Instant Auto-Routing</h3>
              <p className="text-text-muted text-xs leading-relaxed">
                When your service finishes building, traffic is instantly routed to your deployment, automatically linking your custom subdomains with free SSL certificates.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">3. High-Speed Edge &amp; Protection</h3>
              <p className="text-text-muted text-xs leading-relaxed">
                All external traffic is processed through our global edge network, ensuring high-performance caching for static files, automatic DDoS mitigation, and low latency.
              </p>
            </div>
          </div>
        </div>

        {/* Products & Plans from DB */}
        {products.length === 0 ? (
          <div className="text-center py-16 glass rounded-2xl border border-white/[0.06]">
            <p className="text-text-muted text-sm">No products are currently listed. Check back soon or contact support.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8 animate-slide-up delay-100">
            {products.map((product) => (
              <div key={product.id} className="glass rounded-2xl p-6 border-white/[0.08] flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between border-b border-white/[0.06] pb-4 mb-4 gap-3">
                    <h3 className="font-bold text-lg text-text-primary">{product.name}</h3>
                    {product.plans.length > 0 && (
                      <span className="text-xs font-semibold text-accent-teal-bright bg-accent-teal/10 px-2.5 py-1 rounded-full shrink-0">
                        from {formatPrice(Math.min(...product.plans.map((p) => p.price)))}
                      </span>
                    )}
                  </div>

                  {product.description && (
                    <p className="text-text-muted text-xs leading-relaxed mb-4">{product.description}</p>
                  )}

                  {/* Plans list */}
                  {product.plans.length > 0 && (
                    <dl className="space-y-2.5">
                      {product.plans.map((plan) => (
                        <div key={plan.id} className="flex justify-between items-center text-xs bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04]">
                          <dt className="text-text-primary font-medium">{plan.name}</dt>
                          <dd className="text-accent-teal-bright font-semibold">
                            {formatPrice(plan.price)}{' '}
                            <span className="text-text-faint font-normal">{BILLING_LABEL[plan.billingType] ?? plan.billingType}</span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {product.plans.length === 0 && (
                    <p className="text-text-faint text-xs italic">No plans listed yet.</p>
                  )}
                </div>

                <div className="mt-8">
                  <a
                    href={loginUrl}
                    className="block w-full text-center rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold py-2.5 transition-all text-text-primary border border-white/10 hover:border-white/15"
                  >
                    Order {product.name}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FAQs inside specs */}
        <div className="mt-20 border-t border-white/[0.06] pt-16">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-text-primary mb-4">Pricing Questions</h2>
            <p className="text-text-muted text-sm leading-relaxed mb-6">
              Need custom resource specs or want custom core/RAM allocation for your enterprise clusters? We can customize any parameters.
            </p>
            <a
              href="/#contact"
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 font-semibold text-sm text-white hover:opacity-90 transition-opacity shadow-glow-violet"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
