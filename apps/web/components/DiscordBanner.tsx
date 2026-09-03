'use client';

import React from 'react';
import DiscordIcon from './DiscordIcon';

interface DiscordBannerProps {
  className?: string;
}

export default function DiscordBanner({ className = '' }: DiscordBannerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="bg-[#090b1e]/90 border border-white/10 p-1 rounded-full inline-flex items-center gap-2.5 shadow-xl backdrop-blur-xl hover:border-indigo-500/40 transition-colors">
        <a
          href="https://discord.gg/shanutechx"
          target="_blank"
          rel="noreferrer"
          className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-3.5 py-1.5 rounded-full font-bold text-[11px] inline-flex items-center gap-2 transition-all shadow-[0_0_12px_rgba(88,101,242,0.35)] hover:scale-105"
        >
          <DiscordIcon className="h-3.5 w-3.5" />
          <span>Join our Discord</span>
        </a>
        <div className="h-3 w-[1px] bg-white/15" />
        <span className="text-[11px] font-mono text-slate-300 pr-3.5 flex items-center gap-1">
          Live support &amp; drops →
        </span>
      </div>
    </div>
  );
}
