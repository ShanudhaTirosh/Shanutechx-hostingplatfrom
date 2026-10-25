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
  Receipt,
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
    subtitle?: string;
    address: string;
    taxId: string;
    email: string;
    website: string;
  };
  items: Array<{
    id: string;
    name: string;
    description?: string;
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
          description: item.plan?.name ? `STX Managed Cloud · ${item.plan.name}` : undefined,
          quantity: item.quantity,
          unitPrice: item.service ? item.service.price : item.plan ? item.plan.price : 0,
          total: orderItemLineTotal(item),
        }));

        const orderAny = order as any;
        setDetails({
          invoiceNumber: `STX-${new Date(order.createdAt).getFullYear()}-${order.id.slice(0, 8).toUpperCase()}`,
          orderId: order.id,
          issuedAt: String(order.createdAt),
          paidAt: String(orderAny.updatedAt || order.createdAt),
          status: order.status,
          customer: {
            id: order.userId,
            name: orderAny.user?.email ? orderAny.user.email.split('@')[0] : 'Valued Client',
            email: orderAny.user?.email || 'client@email.com',
          },
          company: {
            name: 'STX Enterprises',
            subtitle: 'DIGITAL EMPIRE STUDIO',
            address: 'Negombo, Western Province, Sri Lanka',
            taxId: 'LK-884920492-STX',
            email: 'hello@stxenterprises.com',
            website: 'www.stxenterprises.com',
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
  const issueDate = details?.issuedAt ? new Date(details.issuedAt) : new Date(order.createdAt);
  const dueDate = new Date(issueDate.getTime() + 14 * 24 * 60 * 60 * 1000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      {/* Modal Container */}
      <div className="bg-[#1b1e24] border border-[#2a2e37] rounded-2xl max-w-4xl w-full p-4 sm:p-7 space-y-5 shadow-2xl relative my-6 text-white overflow-hidden">
        {/* Top Header Controls Bar */}
        <div className="flex items-center justify-between border-b border-[#2a2e37] pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 flex items-center justify-center font-bold">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                STX Enterprises Invoice
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 font-bold uppercase">
                  {details?.invoiceNumber || `STX-${order.id.slice(0, 8).toUpperCase()}`}
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">Digital Empire Studio · Enterprise Document</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-full border border-teal-400/40 hover:bg-teal-400 hover:text-black text-teal-300 font-semibold text-xs tracking-wider uppercase transition-all flex items-center gap-1.5"
              title="Print / Save as PDF"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / PDF</span>
            </button>
            {isPaid && (
              <button
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-500 hover:to-teal-500 text-white font-semibold text-xs tracking-wider uppercase transition-all flex items-center gap-1.5 shadow-md"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{downloading ? 'Preparing...' : 'Download'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="h-8 w-8 rounded-full border-2 border-teal-400 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Loading STX invoice template...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* The Authentic STX Enterprises Document Card (White / Paper styling) */}
            <div className="bg-white text-[#07060d] rounded p-6 sm:p-10 shadow-2xl relative overflow-hidden font-sans">
              {/* 1. Header: Brand Logo + INVOICE tag */}
              <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
                <div className="inline-block">
                  <div className="flex items-center gap-2">
                    <img
                      src="/STKcdr.svg"
                      alt="STX Enterprises Logo"
                      className="h-11 w-auto object-contain block"
                    />
                  </div>
                  <div className="mt-1.5 text-[9.5px] font-bold tracking-[0.38em] text-[#07060d] border-t-[2.5px] border-[#07060d] pt-1 uppercase">
                    DIGITAL EMPIRE STUDIO
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-extrabold text-2xl sm:text-3xl tracking-wider text-[#07060d]">
                    INVOICE
                  </div>
                  <div className="font-mono text-xs sm:text-sm font-bold text-[#4a32a8] mt-1">
                    No. {details?.invoiceNumber || `STX-${order.id.slice(0, 8).toUpperCase()}`}
                  </div>
                </div>
              </div>

              {/* 2. Distinctive Teal / Purple Accent Bar */}
              <div className="h-[5px] bg-[#07060d] relative mb-8 w-full">
                <div className="absolute left-0 top-0 h-full w-[34%] bg-gradient-to-r from-[#7146eb] via-[#4574e1] to-[#20c6e0]" />
              </div>

              {/* 3. Three-Column Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 text-xs leading-relaxed">
                <div>
                  <div className="font-mono text-[10px] tracking-widest uppercase text-[#146a8a] font-bold mb-2">
                    Billed to
                  </div>
                  <div className="text-[#20242b] space-y-0.5">
                    <strong className="block text-sm text-[#07060d]">
                      {details?.customer.name || 'Valued Client'}
                    </strong>
                    <p>{details?.customer.email}</p>
                    {details?.customer.whatsapp && <p>WA: {details.customer.whatsapp}</p>}
                    <p className="text-slate-500">Sri Lanka / Global Client</p>
                  </div>
                </div>

                <div>
                  <div className="font-mono text-[10px] tracking-widest uppercase text-[#146a8a] font-bold mb-2">
                    Invoice details
                  </div>
                  <div className="text-[#20242b] space-y-0.5">
                    <p>Issue date: <strong className="text-[#07060d]">{issueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></p>
                    <p>Due date: <strong className="text-[#07060d]">{dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></p>
                    <p>Terms: <strong className="text-[#07060d]">Net 14 (Direct Verification)</strong></p>
                  </div>
                </div>

                <div>
                  <div className="font-mono text-[10px] tracking-widest uppercase text-[#146a8a] font-bold mb-2">
                    Pay to
                  </div>
                  <div className="text-[#20242b] space-y-0.5">
                    <strong className="block text-[#07060d]">STX Enterprises (Shanudha Tirosh)</strong>
                    <p>Bank: Commercial Bank · Negombo</p>
                    <p className="font-mono">Acc: 100012345678</p>
                    <p className="font-mono text-[#4a32a8]">eZCash / HelaPay: 077-123-4567</p>
                  </div>
                </div>
              </div>

              {/* 4. Items Table */}
              <div className="overflow-x-auto mb-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#07060d] text-white font-mono text-[10px] uppercase tracking-wider">
                      <th className="text-left p-3 w-[52%]">Description</th>
                      <th className="text-center p-3 w-[12%]">Qty</th>
                      <th className="text-center p-3 w-[18%]">Rate</th>
                      <th className="text-right p-3 w-[18%]">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef1f4] text-xs text-[#20242b]">
                    {details?.items.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 1 ? 'bg-[#f7f8fa]' : 'bg-white'}>
                        <td className="p-3">
                          <strong className="block text-[#07060d]">{item.name}</strong>
                          <span className="text-[11px] text-[#5b6472]">
                            {item.description || 'Enterprise Cloud Container & Edge Infrastructure Setup'}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono">{item.quantity}</td>
                        <td className="p-3 text-center font-mono">{formatMoney(item.unitPrice)}</td>
                        <td className="p-3 text-right font-mono font-bold text-[#07060d]">
                          {formatMoney(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 5. Totals Box */}
              <div className="flex justify-end mt-4">
                <div className="w-64 space-y-1.5 text-xs text-[#5b6472]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono font-semibold text-[#20242b]">
                      {formatMoney(details?.subtotal || order.total)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span className="font-mono">— LKR 0.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax (0%)</span>
                    <span className="font-mono">LKR 0.00</span>
                  </div>
                  <div className="flex justify-between items-center border-t-[2.5px] border-[#07060d] pt-3 text-[#07060d] font-bold text-base">
                    <span>Total Due</span>
                    <span className="font-mono text-[#146a8a] text-lg">
                      {formatMoney(details?.total || order.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 6. Bottom Notes and Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10 pt-5 border-t border-[#d8dce1] items-center">
                <div className="sm:col-span-2 text-xs text-[#3a4048] leading-relaxed">
                  <div className="font-mono text-[10px] tracking-widest uppercase text-[#146a8a] font-bold mb-1">
                    Notes
                  </div>
                  <p>
                    Thank you for working with STX Enterprises. Payment is due within 14 days of issue date. VPS setups are delivered within 24 to 72 hours upon manual verification. For questions, reply to hello@stxenterprises.com.
                  </p>
                </div>

                <div className="sm:text-right">
                  <div className="font-mono text-[10px] tracking-widest uppercase text-[#146a8a] font-bold mb-1.5">
                    Status
                  </div>
                  {isPaid ? (
                    <span className="inline-block font-mono text-[10px] font-bold tracking-wider uppercase px-3.5 py-1.5 rounded-full border border-emerald-600 text-emerald-700 bg-emerald-50">
                      PAID &amp; VERIFIED
                    </span>
                  ) : (
                    <span className="inline-block font-mono text-[10px] font-bold tracking-wider uppercase px-3.5 py-1.5 rounded-full border border-[#4a32a8] text-[#4a32a8] bg-[#f2eefd]">
                      AWAITING PAYMENT
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Dismiss */}
            <div className="flex justify-end pt-1">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
