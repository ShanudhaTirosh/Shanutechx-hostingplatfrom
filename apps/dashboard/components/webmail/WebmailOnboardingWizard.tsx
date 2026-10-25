'use client';

import React, { useState } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import {
  Mail, Check, ChevronRight, ChevronLeft, X, Plus, Trash2, Globe,
  Zap, Signature, ArrowRight, AlertCircle, Loader2,
} from 'lucide-react';

interface WebmailOnboardingWizardProps {
  isOpen: boolean;
  smtpAccountId?: string;
  onComplete: () => void;
}

interface WizardStep {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const STEPS: WizardStep[] = [
  { id: 'welcome',    label: 'Welcome',    description: 'Get started with your mailbox', icon: Mail },
  { id: 'aliases',   label: 'Aliases',    description: 'Set up email aliases',           icon: Plus },
  { id: 'dns',       label: 'DNS',        description: 'Configure DNS records',          icon: Globe },
  { id: 'forwarding',label: 'Forwarding', description: 'Set forwarding rules',           icon: Zap },
  { id: 'signature', label: 'Signature',  description: 'Create your signature',         icon: Signature },
  { id: 'done',      label: 'Complete',   description: 'You\'re all set!',              icon: Check },
];

export function WebmailOnboardingWizard({ isOpen, smtpAccountId, onComplete }: WebmailOnboardingWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step data
  const [aliases, setAliases] = useState<string[]>(['']);
  const [forwardTo, setForwardTo] = useState('');
  const [forwardEnabled, setForwardEnabled] = useState(false);
  const [signatureName, setSignatureName] = useState('My Signature');
  const [signatureContent, setSignatureContent] = useState('<p>Best regards,<br/><strong>Your Name</strong></p>');

  const dnsRecords = [
    { type: 'MX',  name: '@',           value: `mail.${typeof window !== 'undefined' ? window.location.hostname.replace('dashboard.', '') : 'example.com'}`, priority: 10, description: 'Mail routing' },
    { type: 'TXT', name: '@',           value: 'v=spf1 include:mail.shanutechx.com ~all', priority: null, description: 'SPF anti-spam' },
    { type: 'TXT', name: '_dmarc',      value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@shanutechx.com', priority: null, description: 'DMARC policy' },
    { type: 'TXT', name: 'mail._domainkey', value: 'v=DKIM1; k=rsa; p=<Your_DKIM_Public_Key>', priority: null, description: 'DKIM signing' },
  ];

  const totalSteps = STEPS.length;
  const isFirst = step === 0;
  const isLast = step === totalSteps - 1;
  const progress = Math.round(((step) / (totalSteps - 1)) * 100);

  const handleAddAlias = () => setAliases((prev) => [...prev, '']);
  const handleRemoveAlias = (i: number) => setAliases((prev) => prev.filter((_, idx) => idx !== i));
  const handleAliasChange = (i: number, val: string) => {
    setAliases((prev) => prev.map((a, idx) => (idx === i ? val : a)));
  };

  const handleSaveStep = async () => {
    setSaving(true);
    try {
      if (step === STEPS.findIndex(s => s.id === 'forwarding') && forwardEnabled && forwardTo) {
        await api.webmail.filters.create({
          name: 'Auto-Forward All',
          conditionsJson: { field: 'all' },
          actionsJson: { forward: forwardTo },
        });
        toast('Forwarding rule created!', 'success');
      }

      if (step === STEPS.findIndex(s => s.id === 'signature') && signatureContent) {
        await api.webmail.signatures.create({
          name: signatureName,
          htmlContent: signatureContent,
          isDefault: true,
          smtpAccountId,
        });
        toast('Signature saved!', 'success');
      }
    } catch {
      toast('Save failed — you can configure this later in settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (step > 0 && step < totalSteps - 1) {
      await handleSaveStep();
    }
    if (step < totalSteps - 1) setStep(step + 1);
    else onComplete();
  };

  const handleSkip = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else onComplete();
  };

  if (!isOpen) return null;

  const currentStepData = STEPS[step];
  const Icon = currentStepData.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#16161f] border border-white/10 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-md">
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{currentStepData.label}</h2>
                <p className="text-sm text-slate-400">{currentStepData.description}</p>
              </div>
            </div>
            <button onClick={onComplete} className="text-slate-500 hover:text-slate-200 transition-all p-2">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="relative">
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Step dots */}
            <div className="flex items-center justify-between mt-2">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => i < step ? setStep(i) : undefined}
                  className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                    i === step ? 'text-white' : i < step ? 'text-emerald-400 cursor-pointer' : 'text-slate-600'
                  }`}
                >
                  {i < step ? (
                    <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </span>
                  ) : (
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] ${
                      i === step ? 'border-white/30 text-white' : 'border-slate-700 text-slate-600'
                    }`}>
                      {i + 1}
                    </span>
                  )}
                  <span className="hidden sm:block">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 px-8 py-6 overflow-y-auto min-h-[280px]">

          {/* Welcome */}
          {step === 0 && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600/20 to-indigo-600/20 border border-white/15 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Welcome to your mailbox!</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                Let's set up your professional email experience. This wizard will help you configure aliases, DNS records, forwarding rules, and your email signature in just a few steps.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {['Aliases', 'DNS Setup', 'Forwarding', 'AI Features', 'Signature'].map((f) => (
                  <span key={f} className="flex items-center gap-1 text-xs bg-white/5 text-neutral-300 border border-white/15 px-3 py-1.5 rounded-full">
                    <Check className="h-3 w-3" />
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Aliases */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400 mb-4">
                Aliases are additional email addresses that deliver to this mailbox. For example, <span className="text-neutral-300 font-mono">support@yourdomain.com</span>.
              </p>
              {aliases.map((alias, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-white/15 transition-all">
                    <Mail className="h-4 w-4 text-slate-500 shrink-0" />
                    <input
                      type="email"
                      value={alias}
                      onChange={(e) => handleAliasChange(i, e.target.value)}
                      placeholder="alias@yourdomain.com"
                      className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none"
                    />
                  </div>
                  {aliases.length > 1 && (
                    <button onClick={() => handleRemoveAlias(i)} className="text-slate-500 hover:text-rose-400 transition-all p-2">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={handleAddAlias}
                className="flex items-center gap-2 text-xs text-white hover:text-neutral-300 transition-all mt-2"
              >
                <Plus className="h-3.5 w-3.5" />
                Add another alias
              </button>
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">Aliases require DNS ownership. Ensure your domain is configured before adding aliases.</p>
              </div>
            </div>
          )}

          {/* DNS */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400 mb-4">
                Add these DNS records to your domain registrar (e.g., Cloudflare, GoDaddy) to enable email delivery, SPF, DKIM, and DMARC.
              </p>
              <div className="space-y-2">
                {dnsRecords.map((rec, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        rec.type === 'MX' ? 'bg-blue-500/20 text-blue-300' :
                        rec.type === 'TXT' ? 'bg-emerald-500/20 text-emerald-300' :
                        'bg-purple-500/20 text-neutral-300'
                      }`}>
                        {rec.type}
                      </span>
                      <span className="text-xs font-medium text-white">{rec.description}</span>
                      {rec.priority && (
                        <span className="text-[10px] text-slate-500">Priority: {rec.priority}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-2 text-xs">
                      <span className="text-slate-500 w-12">Name:</span>
                      <code className="font-mono text-neutral-300 bg-white/5 px-2 py-0.5 rounded">{rec.name}</code>
                      <span className="text-slate-500 w-12">Value:</span>
                      <code className="font-mono text-slate-300 bg-white/5 px-2 py-0.5 rounded break-all">{rec.value}</code>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">DNS propagation can take up to 48 hours. You can verify DNS status anytime from Settings.</p>
            </div>
          )}

          {/* Forwarding */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Optionally forward all incoming emails to another address. You can configure advanced rules later.
              </p>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForwardEnabled(!forwardEnabled)}
                  className={`w-10 h-5.5 rounded-full transition-all relative ${forwardEnabled ? 'bg-white text-black' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${forwardEnabled ? 'left-5.5' : 'left-0.5'}`} />
                </div>
                <span className="text-sm font-medium text-white">Enable Email Forwarding</span>
              </label>

              {forwardEnabled && (
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-white/15 transition-all">
                  <Zap className="h-4 w-4 text-slate-500 shrink-0" />
                  <input
                    type="email"
                    value={forwardTo}
                    onChange={(e) => setForwardTo(e.target.value)}
                    placeholder="forward@otherdomain.com"
                    className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none"
                  />
                </div>
              )}

              <div className="p-3 bg-white/5 border border-white/15 rounded-xl text-xs text-neutral-300">
                <strong>Tip:</strong> Advanced forwarding rules (by sender, subject, or label) can be configured in the Filter Rules section.
              </div>
            </div>
          )}

          {/* Signature */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Create a default signature that will be appended to your outgoing emails.</p>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-white/15 transition-all">
                <input
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="Signature name"
                  className="w-full bg-transparent text-sm font-semibold text-white placeholder-slate-600 outline-none"
                />
              </div>
              <textarea
                value={signatureContent}
                onChange={(e) => setSignatureContent(e.target.value)}
                rows={5}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 placeholder-slate-600 outline-none resize-none focus:border-white/15 transition-all font-mono"
                placeholder="<p>Best regards,<br/><strong>Your Name</strong></p>"
              />
              <p className="text-xs text-slate-500">HTML formatting is supported. Use &lt;strong&gt;, &lt;em&gt;, &lt;a&gt;, etc.</p>
              {signatureContent && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Preview</p>
                  <div
                    className="bg-white/5 rounded-xl px-4 py-3 text-sm text-slate-300"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(signatureContent) }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Done */}
          {step === 5 && (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/10">
                <Check className="h-8 w-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">You're all set! 🎉</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                Your mailbox is configured and ready to use. You can always update settings, add more aliases, or configure advanced rules from the Settings panel.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 max-w-sm mx-auto text-xs">
                {['AI Email Drafting', 'Threat Detection', 'Smart Filters', 'Calendar Sync'].map((f) => (
                  <div key={f} className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl p-3">
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="text-slate-300 font-medium">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Nav */}
        <div className="flex items-center gap-3 px-8 py-4 bg-[#13131a] border-t border-white/5">
          {!isFirst && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          )}

          <div className="flex-1" />

          {!isLast && step > 0 && (
            <button
              onClick={handleSkip}
              className="text-sm text-slate-500 hover:text-slate-300 transition-all px-3 py-2.5"
            >
              Skip
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-neutral-800 to-black hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-md disabled:opacity-50 transition-all"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
            ) : isLast ? (
              <>Go to Inbox <ArrowRight className="h-4 w-4" /></>
            ) : (
              <>Next <ChevronRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
