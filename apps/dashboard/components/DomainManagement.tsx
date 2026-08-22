'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { CustomDomain, Deployment } from '@/lib/types';
import {
  Button,
  Badge,
  Input,
  useToast,
  Card,
  Spinner,
  ConfirmDialog,
} from '@/components/ui';

/**
 * DomainManagement Component
 * 
 * Comprehensive domain attachment UI for deployments. Provides:
 * - Add custom domain form with validation
 * - CNAME instructions with copy-to-clipboard
 * - Domain list view with status badges
 * - Verify domain functionality
 * - Remove domain with confirmation
 * 
 * **Validates: Requirements 4, 8**
 */
export function DomainManagement({
  deployment,
  deploymentId,
  onChanged,
}: {
  deployment?: any;
  deploymentId?: string;
  onChanged?: () => void;
}) {

  const [domains, setDomains] = useState<CustomDomain[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();

  // Load domains for this deployment
  async function loadDomains() {
    try {
      const data = await api.domains.list(deployment.id);
      setDomains(data.domains);
    } catch (err: any) {
      toast(`Failed to load domains: ${err.message}`, 'error');
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDomains();
  }, [deployment.id]);

  function handleDomainAdded() {
    setShowAddForm(false);
    loadDomains();
    onChanged?.();
  }

  function handleDomainChanged() {
    loadDomains();
    onChanged?.();
  }


  if (!deployment.subdomain) {
    return null; // Only show domain management for deployments with subdomains
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Custom Domains</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Attach your own domain names to this deployment
          </p>
        </div>
        {!showAddForm && (
          <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)}>
            + Add Domain
          </Button>
        )}
      </div>

      {showAddForm && (
        <AddDomainForm
          deploymentId={deployment.id}
          onAdded={handleDomainAdded}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {loading ? (
        <div className="py-4">
          <Spinner label="Loading domains..." />
        </div>
      ) : domains && domains.length > 0 ? (
        <div className="space-y-3">
          {domains.map((domain) => (
            <DomainItem
              key={domain.id}
              domain={domain}
              onChanged={handleDomainChanged}
            />
          ))}
        </div>
      ) : (
        !showAddForm && (
          <p className="text-xs text-text-faint py-3">
            No custom domains attached. Click "Add Domain" to get started.
          </p>
        )
      )}
    </div>
  );
}

/**
 * AddDomainForm Component
 * 
 * Form for attaching a new custom domain to a deployment.
 * Shows CNAME configuration instructions after successful attachment.
 */
function AddDomainForm({
  deploymentId,
  onAdded,
  onCancel,
}: {
  deploymentId: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [domain, setDomain] = useState('');
  const [useCloudflare, setUseCloudflare] = useState(false);
  const [cfToken, setCfToken] = useState('');
  const [cfZoneId, setCfZoneId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cnameInstructions, setCnameInstructions] = useState<{
    domain: string;
    cnameTarget: string;
    instructions: string;
    autoCreated?: boolean;
  } | null>(null);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await api.domains.attach(
        deploymentId,
        domain,
        useCloudflare ? cfToken : undefined,
        useCloudflare ? cfZoneId : undefined
      );
      setCnameInstructions({
        domain: result.customDomain?.domain || domain,
        cnameTarget: result.cnameTarget,
        instructions: result.instructions,
        autoCreated: result.autoCreated,
      });
      toast('Domain attached successfully', 'success');
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to attach domain';
      setError(errorMsg);
      toast(errorMsg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyCname() {
    if (cnameInstructions) {
      navigator.clipboard.writeText(cnameInstructions.cnameTarget);
      toast('CNAME target copied to clipboard', 'success');
    }
  }

  if (cnameInstructions) {
    return (
      <Card className="border border-accent-teal/20 bg-accent-teal/5">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-accent-teal/20 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-text-primary mb-1">
                Domain Attached Successfully!
              </h4>
              <p className="text-xs text-text-muted">
                {cnameInstructions.instructions}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold text-text-primary">
              Step-by-Step Setup Guide:
            </p>
            <ol className="text-xs text-text-muted space-y-2 list-decimal list-inside">
              <li>
                Log in to your DNS provider (e.g. Cloudflare, Namecheap, GoDaddy).
              </li>
              <li>
                Create a new <strong className="text-text-primary">CNAME</strong> record with the parameters below.
              </li>
              <li>
                Wait for DNS propagation (1–5 minutes for Cloudflare, up to 24h for traditional registrars).
              </li>
              <li>
                Click <strong className="text-text-primary">Verify Domain</strong> below to complete routing & Let's Encrypt SSL certificate provisioning.
              </li>
            </ol>

            <div className="bg-black/40 rounded-lg p-3 space-y-2 border border-white/[0.04] mt-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-faint">Record Type</span>
                <span className="text-text-primary font-mono bg-white/5 px-2 py-0.5 rounded">CNAME</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-faint">Host / Name</span>
                <span className="text-text-primary font-mono select-all">
                  {cnameInstructions.domain}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-white/[0.04] pt-2">
                <span className="text-text-faint">Target / Points to</span>
                <div className="flex items-center gap-2">
                  <span className="text-accent-teal-bright font-mono select-all">
                    {cnameInstructions.cnameTarget}
                  </span>
                  <button
                    onClick={handleCopyCname}
                    className="text-text-muted hover:text-accent-teal-bright transition-colors"
                    title="Copy CNAME target"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="primary" size="sm" onClick={onAdded}>
              Done & View Domain Status
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border border-white/[0.06]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            required
            label="Custom Domain Name"
            placeholder="app.example.com or sub.yourdomain.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            error={error || undefined}
            hint="Enter your fully qualified domain name"
          />
        </div>

        {/* Cloudflare Auto-DNS Integration toggle */}
        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-text-primary">
            <input
              type="checkbox"
              checked={useCloudflare}
              onChange={(e) => setUseCloudflare(e.target.checked)}
              className="rounded bg-white/5 border-white/10 text-accent-violet focus:ring-0"
            />
            Automate DNS CNAME creation using Cloudflare API
          </label>

          {useCloudflare && (
            <div className="space-y-3 pt-1 border-t border-white/[0.04]">
              <Input
                label="Cloudflare API Token"
                type="password"
                placeholder="Scoped API token (Zone.DNS Edit)"
                value={cfToken}
                onChange={(e) => setCfToken(e.target.value)}
                required={useCloudflare}
                hint="Token with Zone:DNS Edit permission on your domain"
              />
              <Input
                label="Cloudflare Zone ID"
                placeholder="32-character Zone ID from domain overview"
                value={cfZoneId}
                onChange={(e) => setCfZoneId(e.target.value)}
                required={useCloudflare}
                hint="Found on your domain overview sidebar in Cloudflare"
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={submitting}>
            {submitting ? 'Attaching...' : 'Attach Domain'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/**
 * DomainItem Component
 * 
 * Displays a single custom domain with status, verification, and removal controls.
 */
function DomainItem({
  domain,
  onChanged,
}: {
  domain: CustomDomain;
  onChanged: () => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [showCname, setShowCname] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { toast } = useToast();

  async function handleVerify() {
    setVerifying(true);
    setVerifyMessage(null);

    try {
      const result = await api.domains.verify(domain.id);
      
      if (result.verified) {
        toast(result.message || 'Domain verified successfully!', 'success');
        setVerifyMessage(result.message);
        onChanged();
      } else {
        toast('Domain verification failed', 'error');
        setVerifyMessage(result.message || 'Verification failed - check your DNS configuration');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to verify domain';
      toast(errorMsg, 'error');
      setVerifyMessage(errorMsg);
    } finally {
      setVerifying(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await api.domains.remove(domain.id);
      toast('Domain removed successfully', 'success');
      onChanged();
    } catch (err: any) {
      toast(err.message || 'Failed to remove domain', 'error');
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  }

  function handleCopyCname() {
    navigator.clipboard.writeText(domain.cnameTarget);
    toast('CNAME target copied to clipboard', 'success');
  }

  const isVerified = domain.status === 'verified' || domain.status === 'active';
  const canVerify = domain.status === 'pending' || domain.status === 'failed';

  return (
    <>
      <Card className="border border-white/[0.06]">
        <div className="space-y-3">
          {/* Domain Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm font-mono text-text-primary truncate">
                {domain.domain}
              </span>
              <Badge status={domain.status} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canVerify && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleVerify}
                  disabled={verifying}
                >
                  {verifying ? 'Verifying...' : 'Verify'}
                </Button>
              )}
              <button
                onClick={() => setShowCname(!showCname)}
                className="text-text-muted hover:text-text-primary text-xs transition-colors"
              >
                {showCname ? 'Hide' : 'Show'} CNAME
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmRemove(true)}
                disabled={removing}
              >
                Remove
              </Button>
            </div>
          </div>

          {/* Status Messages */}
          {verifyMessage && (
            <div className={`text-xs p-2 rounded-lg ${
              isVerified
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                : 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20'
            }`}>
              {verifyMessage}
            </div>
          )}

          {/* CNAME Instructions */}
          {showCname && (
            <div className="bg-black/40 rounded-lg p-3 space-y-2 border border-white/[0.04]">
              <p className="text-[10px] text-text-faint uppercase tracking-wide font-semibold">
                CNAME Configuration
              </p>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-faint">Name / Host</span>
                <span className="text-text-primary font-mono select-all">{domain.domain}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-white/[0.04] pt-2">
                <span className="text-text-faint">Value / Points to</span>
                <div className="flex items-center gap-2">
                  <span className="text-accent-teal-bright font-mono select-all">
                    {domain.cnameTarget}
                  </span>
                  <button
                    onClick={handleCopyCname}
                    className="text-text-muted hover:text-accent-teal-bright transition-colors"
                    title="Copy CNAME target"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
              </div>
              {!isVerified && (
                <p className="text-[10px] text-text-faint pt-2 border-t border-white/[0.04]">
                  DNS records can take up to a few hours to propagate globally. Click "Verify" once you've added the CNAME record.
                </p>
              )}
            </div>
          )}

          {/* Verification Status Info */}
          {domain.verifiedAt && (
            <p className="text-[10px] text-text-faint">
              Verified on {new Date(domain.verifiedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </Card>

      {/* Remove Confirmation Dialog */}
      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={handleRemove}
        title="Remove Custom Domain"
        message={`Are you sure you want to remove "${domain.domain}"? This will stop routing traffic from this domain to your deployment.`}
        confirmLabel="Remove Domain"
        danger
      />
    </>
  );
}
