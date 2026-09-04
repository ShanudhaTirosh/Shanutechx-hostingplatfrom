'use client';

import { useEffect, useState } from 'react';
import { useAppUser } from '@/lib/AppUserContext';
import { api } from '@/lib/api';
import { Subscription } from '@/lib/types';
import {
  Card,
  Button,
  Badge,
  Spinner,
  EmptyState,
  ErrorBanner,
  PageHeader,
  formatMoney,
  useToast,
  Modal,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

// ── Icons ──────────────────────────────────────────────────────────────────
function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function SweepIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}

export default function BillingPage() {
  const { apiUser } = useAppUser();
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runningCheck, setRunningCheck] = useState(false);
  const { toast } = useToast();

  // Renewal Modal State
  const [renewSub, setRenewSub] = useState<Subscription | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submittingRenew, setSubmittingRenew] = useState(false);

  function load() {
    api.billing
      .subscriptions()
      .then((data) => setSubscriptions(data.subscriptions))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleRunChecks() {
    setRunningCheck(true);
    try {
      const result = await api.billing.runChecks();
      toast(
        `Renewal sweep complete — marked ${result.markedPastDue} past due, cancelled ${result.cancelled}.`,
        'success'
      );
      load();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setRunningCheck(false);
    }
  }

  async function handleRenewalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!renewSub) return;
    setSubmittingRenew(true);
    try {
      const res = await api.billing.renew(renewSub.id);
      if (proofFile) {
        await api.billing.uploadRenewalProof(res.renewalOrderId, proofFile);
      }
      toast('Renewal payment proof submitted! An admin will review and extend your subscription shortly.', 'success');
      setRenewSub(null);
      setProofFile(null);
      load();
    } catch (err: any) {
      toast(err.message || 'Failed to submit renewal request', 'error');
    } finally {
      setSubmittingRenew(false);
    }
  }

  const active = subscriptions?.filter((s) => s.status === 'active').length ?? 0;
  const cancelled = subscriptions?.filter((s) => s.status === 'cancelled').length ?? 0;
  const totalMonthly = subscriptions
    ?.filter((s) => s.status === 'active')
    .reduce((acc, s) => acc + (s.orderItem?.plan?.price ?? s.orderItem?.service?.price ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={apiUser?.role === 'admin' ? 'All Subscriptions' : 'My Subscriptions'}
        description={
          apiUser?.role === 'admin'
            ? 'View and manage all customer subscriptions across the platform.'
            : 'Track your active services and renewal dates.'
        }
      />

      {error && <ErrorBanner message={error} />}

      {/* Summary strip */}
      {subscriptions && subscriptions.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Active', value: active, color: 'text-emerald-400' },
            { label: 'Cancelled', value: cancelled, color: 'text-red-400' },
            { label: 'Monthly Spend', value: formatMoney(totalMonthly), color: 'text-accent-violet-light' },
          ].map((s) => (
            <div key={s.label} className="glass rounded-2xl p-4 border border-white/[0.06]">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Admin: Renewal sweep */}
      {apiUser?.role === 'admin' && (
        <Card className="border border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-orange-500/10 text-orange-300 flex items-center justify-center">
                <SweepIcon />
              </div>
              <div>
                <p className="font-semibold text-text-primary text-sm">Renewal Sweep</p>
                <p className="text-text-muted text-xs mt-0.5">
                  Normally runs daily via scheduled job. Trigger manually if needed.
                </p>
              </div>
            </div>
            <Button
              onClick={handleRunChecks}
              loading={runningCheck}
              variant="secondary"
              size="sm"
            >
              <SweepIcon />
              {runningCheck ? 'Running...' : 'Run Now'}
            </Button>
          </div>
        </Card>
      )}

      {subscriptions === null && <Spinner />}
      {subscriptions?.length === 0 && (
        <EmptyState message="No subscriptions yet. Purchase a service from the catalog to get started." />
      )}

      <div className="space-y-3">
        {subscriptions?.map((sub) => {
          const daysLeft = Math.ceil(
            (new Date(sub.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          const isExpiringSoon = daysLeft <= 7 && sub.status === 'active';
          const canRenew = sub.status === 'active' || sub.status === 'past_due';

          return (
            <Card
              key={sub.id}
              className={`border transition-all ${
                isExpiringSoon
                  ? 'border-orange-500/30 bg-orange-500/[0.03]'
                  : 'border-white/[0.06] hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-accent-violet/10 text-accent-violet-light flex items-center justify-center shrink-0">
                    <CalendarIcon />
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary text-sm">
                      {sub.orderItem?.plan?.name ?? sub.orderItem?.service?.name ?? 'Subscription'}
                    </p>
                    {apiUser?.role === 'admin' && (
                      <p className="text-text-muted text-xs">{sub.user?.email}</p>
                    )}
                    <p className="text-text-muted text-xs mt-0.5 flex items-center gap-1.5">
                      <CalendarIcon />
                      {sub.status === 'cancelled' ? 'Ended' : 'Renews'}{' '}
                      {new Date(sub.currentPeriodEnd).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                      {sub.orderItem && (
                        <span className="text-text-faint">
                          · {formatMoney(sub.orderItem.plan?.price ?? sub.orderItem.service?.price ?? 0)}/mo
                        </span>
                      )}
                    </p>
                    {isExpiringSoon && (
                      <p className="text-orange-300 text-xs mt-0.5 font-medium flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-orange-400 shrink-0 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge status={sub.status} />
                  {canRenew && apiUser?.role !== 'admin' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setRenewSub(sub)}
                    >
                      Renew
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Renewal & Payment Proof Modal */}
      <Modal
        open={!!renewSub}
        onClose={() => setRenewSub(null)}
        title="Renew Subscription"
      >
        {renewSub && (
          <form onSubmit={handleRenewalSubmit} className="space-y-4">
            <div className="glass rounded-xl p-4 border border-white/[0.08] space-y-1">
              <p className="text-xs text-text-muted uppercase tracking-wider">Renewing Service</p>
              <p className="text-base font-bold text-text-primary">
                {renewSub.orderItem?.plan?.name ?? renewSub.orderItem?.service?.name}
              </p>
              <p className="text-sm text-accent-violet-light font-semibold">
                Amount Due: {formatMoney(renewSub.orderItem?.plan?.price ?? renewSub.orderItem?.service?.price ?? 0)}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-text-muted block">
                Upload Payment Proof (Bank Transfer / Receipt Screenshot)
              </label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50"
                required
              />
              <p className="text-[11px] text-text-faint">
                Upload your payment slip or transfer confirmation image. An admin will review and approve your renewal.
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setRenewSub(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={submittingRenew}>
                Submit Renewal Proof
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

