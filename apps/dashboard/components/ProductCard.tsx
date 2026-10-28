'use client';

import React from 'react';
import {
  Check,
  Truck,
  Clock,
  Package,
  ShieldCheck,
  Info,
  ShoppingCart,
  Sparkles,
  Zap,
  HardDrive,
  Mail,
  Globe,
  Cpu,
  Layers,
  Database,
  Bot,
  Server,
  Lock,
  LucideIcon,
} from 'lucide-react';

export interface ProductFeature {
  icon?: string;
  iconName?: string;
  iconComponent?: LucideIcon;
  emoji?: string;
  label?: string;
  text: string;
}

export interface ProductCardProps {
  id: string;
  name?: string;
  title?: string;
  category?: string;
  categoryLabel?: string;
  customIcon?: LucideIcon;
  billingType?: string;
  billingCycle?: string;
  price: number | string;
  currency?: string;
  retailPrice?: number | string;
  discountBadge?: string;
  tierChips?: Array<{ label: string; priceText: string } | string>;
  features: ProductFeature[];
  logistics?: Array<{ icon: 'truck' | 'clock' | 'box' | 'shield'; text: string }>;
  termsNote?: string;
  inStock?: boolean;
  stockLabel?: string;
  stockText?: string;
  detailsLabel?: string;
  isCurrent?: boolean;
  onDetails?: () => void;
  onBuy?: () => void;
  buyLabel?: string;
  buyLoading?: boolean;
  disabled?: boolean;
}

function getCategoryConfig(category?: string, name?: string) {
  const cat = (category || '').toLowerCase();
  const n = (name || '').toLowerCase();

  if (cat === 'smtp' || cat === 'email' || n.includes('smtp') || n.includes('email') || n.includes('mailbox')) {
    return {
      Icon: Mail,
      gradient: 'from-sky-500/25 via-blue-500/20 to-indigo-500/25',
      textColor: 'text-sky-300',
      dropShadow: 'drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]',
    };
  }
  if (cat === 'vps' || n.includes('vps') || n.includes('server') || n.includes('compute')) {
    return {
      Icon: Server,
      gradient: 'from-purple-500/25 via-indigo-500/20 to-violet-500/25',
      textColor: 'text-purple-300',
      dropShadow: 'drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]',
    };
  }
  if (cat === 'database' || cat === 'db' || n.includes('database') || n.includes('postgres') || n.includes('redis') || n.includes('mysql') || n.includes('mongo')) {
    return {
      Icon: Database,
      gradient: 'from-emerald-500/25 via-teal-500/20 to-cyan-500/25',
      textColor: 'text-emerald-300',
      dropShadow: 'drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]',
    };
  }
  if (cat === 'bot_hosting' || cat === 'bot' || n.includes('bot') || n.includes('discord') || n.includes('whatsapp')) {
    return {
      Icon: Bot,
      gradient: 'from-amber-500/25 via-orange-500/20 to-rose-500/25',
      textColor: 'text-amber-300',
      dropShadow: 'drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]',
    };
  }
  if (cat === 'app_deployment' || cat === 'deployment' || n.includes('deployment') || n.includes('app') || n.includes('node') || n.includes('python')) {
    return {
      Icon: Layers,
      gradient: 'from-rose-500/25 via-pink-500/20 to-purple-500/25',
      textColor: 'text-rose-300',
      dropShadow: 'drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]',
    };
  }
  if (cat === 'web_hosting' || n.includes('web')) {
    return {
      Icon: Globe,
      gradient: 'from-cyan-500/25 via-sky-500/20 to-blue-500/25',
      textColor: 'text-cyan-300',
      dropShadow: 'drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]',
    };
  }
  if (cat === 'app_catalog' || cat === 'catalog') {
    return {
      Icon: Package,
      gradient: 'from-violet-500/25 via-purple-500/20 to-fuchsia-500/25',
      textColor: 'text-violet-300',
      dropShadow: 'drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]',
    };
  }
  return {
    Icon: Sparkles,
    gradient: 'from-indigo-500/25 via-purple-500/20 to-pink-500/25',
    textColor: 'text-purple-300',
    dropShadow: 'drop-shadow-[0_0_8px_rgba(216,180,254,0.6)]',
  };
}

function resolveFeatureIcon(feat: ProductFeature): LucideIcon {
  if (feat.iconComponent) return feat.iconComponent;
  const name = (feat.iconName || feat.icon || feat.emoji || '').toLowerCase();
  if (name.includes('cpu') || name.includes('core')) return Cpu;
  if (name.includes('hard-drive') || name.includes('storage') || name.includes('ram') || name.includes('disk') || name.includes('ssd') || name.includes('nvme') || name.includes('💾')) return HardDrive;
  if (name.includes('mail') || name.includes('smtp') || name.includes('email') || name.includes('send') || name.includes('inbox') || name.includes('⚡')) return Mail;
  if (name.includes('globe') || name.includes('domain') || name.includes('network') || name.includes('routing') || name.includes('🌐')) return Globe;
  if (name.includes('database') || name.includes('postgres') || name.includes('redis') || name.includes('mysql') || name.includes('sql') || name.includes('🐘')) return Database;
  if (name.includes('shield') || name.includes('security') || name.includes('spam') || name.includes('dkim') || name.includes('spf') || name.includes('🛡')) return ShieldCheck;
  if (name.includes('lock') || name.includes('ssl') || name.includes('tls') || name.includes('encrypt') || name.includes('🔒')) return Lock;
  if (name.includes('bot') || name.includes('discord') || name.includes('whatsapp') || name.includes('🤖')) return Bot;
  if (name.includes('layers') || name.includes('app') || name.includes('git') || name.includes('🐙')) return Layers;
  if (name.includes('server') || name.includes('vps') || name.includes('node') || name.includes('engine') || name.includes('🧠')) return Server;
  return Zap;
}

export function ProductCard({
  id,
  name,
  title,
  category,
  categoryLabel,
  customIcon,
  billingType,
  billingCycle,
  price,
  currency = 'Rs',
  retailPrice,
  discountBadge,
  tierChips,
  features,
  logistics = [
    { icon: 'truck', text: 'Held for you; delivered when you ask' },
    { icon: 'clock', text: '24 hours high-availability SLA' },
    { icon: 'box', text: 'Ask for it within 7 days of buying' },
  ],
  termsNote = 'Minimum 2 per order',
  inStock = true,
  stockLabel,
  stockText,
  detailsLabel = 'Details',
  isCurrent = false,
  onDetails,
  onBuy,
  buyLabel = 'Buy',
  buyLoading = false,
  disabled = false,
}: ProductCardProps) {
  const displayName = name || title || 'Product Plan';
  const numPrice = typeof price === 'number' ? price : (parseFloat(String(price).replace(/[^0-9.]/g, '')) || 0);
  const numRetail = retailPrice !== undefined
    ? (typeof retailPrice === 'number' ? retailPrice : (parseFloat(String(retailPrice).replace(/[^0-9.]/g, '')) || 0))
    : Math.round(numPrice * 1.28);

  const percentUnder =
    discountBadge ||
    `${Math.round(((numRetail - numPrice) / (numRetail || 1)) * 100)}% under retail`;

  // Compute default tier chips if not explicitly passed
  const displayChips: Array<{ label: string; priceText: string }> =
    tierChips && tierChips.length > 0
      ? tierChips.map((c) => (typeof c === 'string' ? { label: 'Feature', priceText: c } : c))
      : [
          { label: '10+', priceText: `${currency} ${Math.round(numPrice * 0.92).toLocaleString()}` },
          { label: '25+', priceText: `${currency} ${Math.round(numPrice * 0.86).toLocaleString()}` },
          { label: '50+', priceText: `${currency} ${Math.round(numPrice * 0.81).toLocaleString()}` },
        ];

  const catConfig = getCategoryConfig(category, displayName);
  const HeaderIcon = customIcon || catConfig.Icon;

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl p-5 bg-[#141416] border ${
        isCurrent
          ? 'border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.12)]'
          : 'border-white/10 hover:border-white/20'
      } text-white shadow-2xl transition-all duration-300 group`}
    >
      {/* Current Plan Indicator Banner */}
      {isCurrent && (
        <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-extrabold tracking-wider uppercase font-mono shadow-md">
          Current Active Plan
        </div>
      )}

      <div>
        {/* Top Header: Squircle Gradient Icon + Title & Price */}
        <div className="flex items-start gap-3.5 mb-3.5">
          {/* Glowing Squircle Icon tailored to category */}
          <div
            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${catConfig.gradient} border border-white/15 flex items-center justify-center shrink-0 shadow-inner relative overflow-hidden group-hover:scale-105 transition-transform`}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-50" />
            <HeaderIcon className={`w-6 h-6 ${catConfig.textColor} filter ${catConfig.dropShadow}`} />
          </div>

          {/* Title & Price Rows */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-base sm:text-[17px] leading-tight tracking-tight line-clamp-2">
              {displayName}
            </h3>

            {/* Price Line */}
            <div className="flex flex-wrap items-baseline gap-2 mt-1.5">
              <span className="font-extrabold text-white text-lg sm:text-xl font-mono tracking-tight">
                {currency} {numPrice.toLocaleString()}
              </span>
              <span className="text-xs text-neutral-400 line-through font-mono">
                retail {currency} {numRetail.toLocaleString()}
              </span>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                {percentUnder}
              </span>
            </div>
          </div>
        </div>

        {/* Volume / Tier Pills */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {displayChips.map((chip, idx) => (
            <div
              key={idx}
              className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-1.5"
            >
              <span className="text-emerald-300 font-bold">{chip.label}</span>
              <span className="text-emerald-500/60">•</span>
              <span>{chip.priceText}</span>
            </div>
          ))}
        </div>

        {/* Feature Checkmark List with SVG Icons (No Emojis) */}
        <div className="space-y-2.5 mb-4">
          {features.map((feat, idx) => {
            const FeatureIcon = resolveFeatureIcon(feat);
            return (
              <div key={idx} className="flex items-start gap-2.5 text-sm text-neutral-200">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" strokeWidth={2.5} />
                <span className="flex items-center gap-2 leading-snug">
                  <FeatureIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                  <span className="font-medium text-[13px] text-neutral-200">{feat.text}</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Logistics / SLA Terms List */}
        <div className="space-y-1.5 pt-2 border-t border-white/5 text-xs text-neutral-400">
          {logistics.map((log, idx) => (
            <div key={idx} className="flex items-center gap-2.5">
              {log.icon === 'truck' && <Truck className="w-4 h-4 text-neutral-400 shrink-0" />}
              {log.icon === 'clock' && <Clock className="w-4 h-4 text-neutral-400 shrink-0" />}
              {log.icon === 'box' && <Package className="w-4 h-4 text-neutral-400 shrink-0" />}
              {log.icon === 'shield' && <ShieldCheck className="w-4 h-4 text-neutral-400 shrink-0" />}
              <span className="text-[12px]">{log.text}</span>
            </div>
          ))}

          {termsNote && (
            <p className="text-[12px] text-neutral-400 pt-1 font-medium">
              {termsNote}
            </p>
          )}
        </div>
      </div>

      {/* Footer Action Bar */}
      <div className="border-t border-white/10 pt-4 mt-4 flex items-center justify-between gap-3">
        {/* Left: Stock Status */}
        <div className="flex items-center gap-2">
          {inStock ? (
            <span className="text-emerald-400 font-semibold text-xs sm:text-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {stockLabel}
            </span>
          ) : (
            <span className="text-neutral-500 font-medium text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neutral-600" />
              Out of stock
            </span>
          )}
        </div>

        {/* Right: Dual Buttons (Details + Buy) */}
        <div className="flex items-center gap-2">
          {onDetails && (
            <button
              type="button"
              onClick={onDetails}
              className="px-3.5 py-1.5 rounded-xl bg-[#1d1d21] hover:bg-[#27272c] border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-neutral-300" />
              <span>Details</span>
            </button>
          )}

          {onBuy && (
            <button
              type="button"
              onClick={onBuy}
              disabled={disabled || buyLoading}
              className="px-4 py-1.5 rounded-xl bg-white hover:bg-neutral-200 active:scale-95 text-black text-xs font-bold flex items-center gap-1.5 shadow-md shadow-white/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {buyLoading ? (
                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <ShoppingCart className="w-3.5 h-3.5 text-black" />
              )}
              <span>{buyLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
