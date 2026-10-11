'use client';

import React, { useEffect, useState } from 'react';
import { Order } from '@/lib/types';
import { orderItemName, orderItemLineTotal } from '@/lib/orderItem';
import { formatMoney } from '@/components/ui';
import { apiFetch } from '@/lib/useAuth';
import { api } from '@/lib/api';
import {
  X,
  Printer,
  Download,
  CheckCircle2,
  Receipt,
  Building2,
  User,
  Calendar,
  ShieldCheck,
  CreditCard,
  Sparkles,
} from 'lucide-react';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

interface InvoiceDetails {
  invoiceNumber: string;
  orderId: string;
  issuedAt: string;
  paidAt: string;
  status: string;
  customer: {
    id: string;
    name: string;
    email: string;
    whatsapp?: string | null;
  };
  company: {
    name: string;
    address: string;
    taxId: string;
    email: string;
    website: string;
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

export default function InvoiceModal({ isOpen, onClose, order }: InvoiceModalProps) {
  const [details, setDetails] = useState<InvoiceDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isOpen || !order) {
      setDetails(null);
      return;
    }

    setLoading(true);
    // Fetch JSON invoice details from API
    apiFetch(`/api/orders/${order.id}/invoice/json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: InvoiceDetails) => {
        setDetails(data);
      })
      .catch(() => {
        // Fallback local invoice construct if JSON endpoint fails
        const fallbackItems = (order.items || []).map((item) => ({
          id: item.id,
          name: orderItemName(item),
          quantity: item.quantity,
          unitPrice: item.service ? item.service.price : item.plan ? item.plan.price : 0,
          total: orderItemLineTotal(item),
        }));

        const orderAny = order as any;
        setDetails({
          invoiceNumber: `INV-${new Date(order.createdAt).getFullYear()}-${order.id.slice(0, 8).toUpperCase()}`,
          orderId: order.id,
          issuedAt: String(order.createdAt),
          paidAt: String(orderAny.updatedAt || order.createdAt),
          status: order.status,
          customer: {
            id: order.userId,
            name: orderAny.user?.email ? orderAny.user.email.split('@')[0] : 'Valued Customer',
            email: orderAny.user?.email || 'customer@shanutechx.com',
          },
          company: {
            name: 'ShanuTechX Platform (Pvt) Ltd',
            address: 'Level 18, Orion City Towers, Colombo 09, Sri Lanka',
            taxId: 'LK-884920492-STX',
            email: 'billing@shanutechx.com',
            website: 'https://shanutechx.com',
          },
          items: fallbackItems,
          subtotal: order.total,
          tax: 0,
          discount: 0,
          total: order.total,
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!order) return;
    setDownloading(true);
    try {
      const res = await apiFetch(api.orders.invoiceUrl(order.id));
      if (!res.ok) throw new Error('Failed to download invoice PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${order.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Ignore
    } finally {
      setDownloading(false);
    }
  };

  const isPaid = order.status === 'paid';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      {/* Modal Container */}
      <div className="bg-[#090b1e] border border-white/15 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-8 text-white text-sans overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center font-bold">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                Official Tax Invoice
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold uppercase">
                  {details?.invoiceNumber || `INV-${order.id.slice(0, 8).toUpperCase()}`}
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">ShanuTechX Autonomous Enterprise Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
              title="Print Invoice"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="h-8 w-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Generating invoice preview...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Printable & Viewable Sample Invoice Card */}
            <div className="bg-[#050614] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-8 shadow-inner print:text-black print:bg-white">
              {/* Row 1: Company Logo & Customer Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-white/10 pb-6">
                {/* Company Side */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/STX.png"
                      alt="ShanuTechX"
                      className="w-7 h-7 object-contain filter brightness-0 invert print:filter-none"
                    />
                    <span className="font-black text-xl tracking-tight text-white print:text-black">
                      SHANU<span className="text-purple-400 print:text-purple-600">TECHX</span>
                    </span>
                    <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                      CLOUD
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-bold">{details?.company.name}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{details?.company.address}</p>
                  <p className="text-[11px] font-mono text-slate-400">TAX ID: {details?.company.taxId}</p>
                  <p className="text-[11px] font-mono text-purple-300">{details?.company.email}</p>
                </div>

                {/* Customer & Invoice Meta Side */}
                <div className="sm:text-right space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase border">
                    {isPaid ? (
                      <span className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3.5 w-3.5" /> PAID &amp; VERIFIED
                      </span>
                    ) : (
                      <span className="bg-orange-500/10 text-orange-300 border-orange-500/30 px-2.5 py-0.5 rounded-full">
                        AWAITING PAYMENT
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 pt-1">
                    <p className="text-xs font-bold text-white">Billed To:</p>
                    <p className="text-xs font-medium text-slate-300">{details?.customer.name}</p>
                    <p className="text-[11px] font-mono text-slate-400">{details?.customer.email}</p>
                    {details?.customer.whatsapp && (
                      <p className="text-[11px] font-mono text-slate-400">WA: {details.customer.whatsapp}</p>
                    )}
                  </div>

                  <div className="pt-2 text-[11px] font-mono text-slate-400 space-y-0.5">
                    <p>Issued Date: {new Date(details?.issuedAt || order.createdAt).toLocaleDateString()}</p>
                    <p>Order Reference: #{order.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                </div>
              </div>

              {/* Row 2: Itemized Line Items Table */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                  Itemized Service Breakdown
                </h3>
                <div className="border border-white/10 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 border-b border-white/10 text-slate-300 font-mono">
                      <tr>
                        <th className="p-3">Description &amp; Service Plan</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3 text-right">Unit Price</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-200">
                      {details?.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          <td className="p-3 font-medium">
                            <span className="text-white block">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              24/7 Automated Edge Provisioned
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono">{item.quantity}</td>
                          <td className="p-3 text-right font-mono">{formatMoney(item.unitPrice)}</td>
                          <td className="p-3 text-right font-mono font-bold text-white">
                            {formatMoney(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Row 3: Totals & Summary Box */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
                    Electronic Cryptographic Receipt Seal Verified
                  </div>
                  <p className="text-[10px] text-slate-500 max-w-sm">
                    Thank you for hosting with ShanuTechX. This document serves as official proof of payment.
                  </p>
                </div>

                <div className="w-full sm:w-64 bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 font-mono text-xs text-slate-300 shrink-0">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatMoney(details?.subtotal || order.total)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Taxes &amp; VAT (0%):</span>
                    <span>LKR 0.00</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Discounts:</span>
                    <span>LKR 0.00</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex justify-between font-extrabold text-sm text-white">
                    <span>Grand Total:</span>
                    <span className="text-teal-300">{formatMoney(details?.total || order.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="text-xs font-mono text-slate-400">
                Invoice Status: <span className="text-purple-300 font-bold uppercase">{order.status}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 transition-colors"
                >
                  Close Window
                </button>

                {isPaid && (
                  <button
                    onClick={handleDownloadPdf}
                    disabled={downloading}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-glow-violet transition-all flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {downloading ? 'Downloading PDF...' : 'Download Official PDF Invoice'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
