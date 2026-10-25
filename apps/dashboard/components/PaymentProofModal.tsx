'use client';

import React, { useEffect, useState } from 'react';
import { Order } from '@/lib/types';
import { api } from '@/lib/api';
import { formatMoney } from '@/components/ui';
import {
  X,
  Upload,
  Check,
  Copy,
  Building2,
  Smartphone,
  Coins,
  FileText,
  AlertCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface PaymentProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess: () => void;
}

interface PaymentChannel {
  id: string;
  name: string;
  category: 'bank' | 'mobile_wallet' | 'crypto';
  enabled: boolean;
  badge?: string;
  details: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    branch?: string;
    swiftCode?: string;
    mobileNumber?: string;
    helaPayId?: string;
    currency?: string;
    network?: string;
    walletAddress?: string;
    bybitUid?: string;
    memo?: string;
    note?: string;
  };
}

export default function PaymentProofModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}: PaymentProofModalProps) {
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreviewUrl(null);
      setReference('');
      setNotes('');
      setError(null);
      return;
    }

    setLoadingChannels(true);
    api.payments
      .getPaymentMethods()
      .then((data: any) => {
        if (data.channels && data.channels.length > 0) {
          setChannels(data.channels);
          setSelectedMethod(data.channels[0].id);
        }
      })
      .catch(() => {
        // Fallback default channels
        setChannels([
          {
            id: 'bank_transfer',
            name: 'Bank Transfer (Commercial Bank / Local Banks)',
            category: 'bank',
            enabled: true,
            badge: 'Popular',
            details: {
              bankName: 'Commercial Bank of Ceylon',
              branch: 'Negombo Branch',
              accountName: 'STX Enterprises (Shanudha Tirosh)',
              accountNumber: '100012345678',
              swiftCode: 'CCEYLKJA',
              note: 'Please enter your Order ID in the transfer remarks/reference field.',
            },
          },
          {
            id: 'helapay',
            name: 'Helakuru HelaPay',
            category: 'mobile_wallet',
            enabled: true,
            badge: 'Instant',
            details: {
              mobileNumber: '071-234-5678',
              helaPayId: 'shanudha@helapay',
              accountName: 'STX Enterprises / Shanudha Tirosh',
              note: 'Pay via Helakuru app / HelaPay transfer and capture the completed payment screenshot.',
            },
          },
          {
            id: 'ezcash',
            name: 'Dialog eZ Cash',
            category: 'mobile_wallet',
            enabled: true,
            badge: 'Fast',
            details: {
              mobileNumber: '077-123-4567',
              accountName: 'STX Enterprises',
              note: 'Transfer to eZ Cash wallet (Dial #111# or use the eZ Cash app) and upload the receipt.',
            },
          },
          {
            id: 'bybit_crypto',
            name: 'Bybit Crypto Transfer (USDT)',
            category: 'crypto',
            enabled: true,
            badge: 'Crypto / USDT',
            details: {
              currency: 'USDT',
              network: 'TRC20 (Tron Network) / Bybit Internal UID',
              walletAddress: 'TYxShanuTechXUSDTDepositWalletAddress9988',
              bybitUid: '88291041',
              note: 'Zero-fee internal UID transfer via Bybit (UID: 88291041) or direct TRC20 USDT deposit.',
            },
          },
        ]);
      })
      .finally(() => setLoadingChannels(false));
  }, [isOpen]);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setError(null);
    if (selected && selected.type.startsWith('image/')) {
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    if (!file) {
      setError('Please select or upload your payment slip (image or PDF).');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      await api.orders.uploadProof(
        order.id,
        file,
        {
          paymentMethod: selectedMethod,
          reference: reference.trim(),
          notes: notes.trim(),
        },
        idempotencyKey
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit payment proof. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !order) return null;

  const activeChannel = channels.find((c) => c.id === selectedMethod) || channels[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-[#0e1117] border border-white/10 rounded-2xl max-w-2xl w-full p-5 sm:p-7 space-y-6 shadow-2xl relative my-6 text-white overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Select Payment Method &amp; Upload Proof
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Order #{order.id.slice(0, 8).toUpperCase()} · Total Due:{' '}
              <strong className="text-teal-300 font-sans">{formatMoney(order.total)}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 1: Select Payment Method */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block">
              1. Choose Payment Method
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {channels.map((ch) => {
                const isSelected = selectedMethod === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedMethod(ch.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between h-24 ${
                      isSelected
                        ? 'bg-teal-500/10 border-teal-400 text-white shadow-sm ring-1 ring-teal-400/30'
                        : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {ch.category === 'bank' && <Building2 className={`h-4 w-4 ${isSelected ? 'text-teal-300' : 'text-slate-400'}`} />}
                      {ch.category === 'mobile_wallet' && <Smartphone className={`h-4 w-4 ${isSelected ? 'text-teal-300' : 'text-slate-400'}`} />}
                      {ch.category === 'crypto' && <Coins className={`h-4 w-4 ${isSelected ? 'text-teal-300' : 'text-slate-400'}`} />}
                      {ch.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                          {ch.badge}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight line-clamp-1">{ch.name.split('(')[0]}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5 capitalize">
                        {ch.category.replace('_', ' ')}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Payment Information & Transfer Details */}
          {activeChannel && (
            <div className="bg-[#151922] border border-white/10 rounded-xl p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="text-xs font-bold text-teal-300 uppercase tracking-wider font-mono">
                  Official Transfer Details — {activeChannel.name}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              </div>

              {activeChannel.category === 'bank' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-mono">Bank &amp; Branch:</span>
                    <strong className="text-white block mt-0.5">
                      {activeChannel.details.bankName || 'Commercial Bank'} · {activeChannel.details.branch || 'Negombo'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-mono">Account Name:</span>
                    <strong className="text-white block mt-0.5">
                      {activeChannel.details.accountName || 'STX Enterprises (Shanudha Tirosh)'}
                    </strong>
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between bg-black/40 border border-white/10 rounded-lg p-2.5">
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono block">Account Number:</span>
                      <span className="text-sm font-mono font-bold text-teal-300">
                        {activeChannel.details.accountNumber || '100012345678'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeChannel.details.accountNumber || '100012345678', 'accNum')}
                      className="px-2.5 py-1 text-[11px] font-mono rounded bg-white/10 hover:bg-white/20 text-slate-200 transition-colors flex items-center gap-1"
                    >
                      {copiedKey === 'accNum' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === 'accNum' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              )}

              {activeChannel.category === 'mobile_wallet' && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-lg p-2.5">
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {activeChannel.id === 'helapay' ? 'Helakuru Mobile / HelaPay ID:' : 'Dialog eZ Cash Number:'}
                      </span>
                      <span className="text-sm font-mono font-bold text-teal-300">
                        {activeChannel.details.mobileNumber || '077-123-4567'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeChannel.details.mobileNumber || '077-123-4567', 'mobileNum')}
                      className="px-2.5 py-1 text-[11px] font-mono rounded bg-white/10 hover:bg-white/20 text-slate-200 transition-colors flex items-center gap-1"
                    >
                      {copiedKey === 'mobileNum' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === 'mobileNum' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  {activeChannel.details.accountName && (
                    <p className="text-[11px] text-slate-400">
                      Beneficiary: <strong className="text-white">{activeChannel.details.accountName}</strong>
                    </p>
                  )}
                </div>
              )}

              {activeChannel.category === 'crypto' && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 font-mono">Currency:</span>{' '}
                      <strong className="text-white">USDT</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-mono">Network:</span>{' '}
                      <strong className="text-teal-300">TRC20 (Tron)</strong>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-lg p-2.5">
                    <div className="truncate pr-2">
                      <span className="text-[10px] text-slate-400 font-mono block">USDT Deposit Address (TRC20):</span>
                      <span className="text-xs font-mono font-bold text-teal-300 truncate block">
                        {activeChannel.details.walletAddress || 'TYxShanuTechXUSDTDepositWalletAddress9988'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeChannel.details.walletAddress || 'TYxShanuTechXUSDTDepositWalletAddress9988', 'cryptoWallet')}
                      className="px-2.5 py-1 text-[11px] font-mono rounded bg-white/10 hover:bg-white/20 text-slate-200 transition-colors flex items-center gap-1 shrink-0"
                    >
                      {copiedKey === 'cryptoWallet' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === 'cryptoWallet' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  {activeChannel.details.bybitUid && (
                    <div className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg p-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-mono block">Bybit Internal Transfer UID:</span>
                        <span className="font-mono font-bold text-purple-300">{activeChannel.details.bybitUid}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(activeChannel.details.bybitUid!, 'bybitUid')}
                        className="px-2 py-0.5 text-[10px] font-mono rounded bg-white/10 hover:bg-white/20 text-slate-200"
                      >
                        {copiedKey === 'bybitUid' ? 'Copied' : 'Copy UID'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeChannel.details.note && (
                <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-white/5">
                  💡 <span className="text-slate-300">{activeChannel.details.note}</span>
                </p>
              )}
            </div>
          )}

          {/* Step 3: Transaction Reference (Optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              2. Transaction / Transfer Reference (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Bank Reference #, HelaPay Ref, or Bybit TxID"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-400"
            />
          </div>

          {/* Step 4: Upload Proof File (Image or PDF) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 block">
                3. Upload Payment Slip (Image or PDF)
              </label>
              <span className="text-[10px] font-mono text-teal-400/90 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Auto-converts to WebP
              </span>
            </div>

            <label className="block border-2 border-dashed border-white/15 hover:border-teal-400/60 rounded-xl p-5 text-center cursor-pointer transition-colors bg-white/[0.02] hover:bg-white/[0.04]">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                required
              />
              {file ? (
                <div className="space-y-2">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Proof Preview"
                      className="max-h-36 mx-auto rounded-lg border border-white/20 object-contain shadow-md"
                    />
                  ) : (
                    <div className="h-16 w-16 mx-auto rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
                      <FileText className="h-8 w-8" />
                    </div>
                  )}
                  <p className="text-xs font-bold text-white truncate max-w-sm mx-auto">{file.name}</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {(file.size / 1024).toFixed(1)} KB · Click to change file
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="h-10 w-10 mx-auto rounded-xl bg-white/5 text-slate-400 flex items-center justify-center">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-white">Click to browse or drop transfer slip here</p>
                  <p className="text-[11px] text-slate-400">
                    Supports JPEG, PNG, WebP image screenshots &amp; PDF payment receipts.
                  </p>
                </div>
              )}
            </label>
          </div>

          {/* Submission Notice & Buttons */}
          <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400 leading-tight">
              🔒 Proofs are securely stored in WebP format and manually reviewed by staff. VPS setups deliver within 24 to 72 hours.
            </p>
            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 transition-colors w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !file}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-black font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                    <span>Processing &amp; Converting to WebP...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Submit Payment Proof</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
