'use client';

import React from 'react';
import DiscordIcon from './DiscordIcon';

interface DiscordBannerProps {
  className?: string;
}

export default function DiscordBanner({ className = '' }: DiscordBannerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="bg-[#080a1c] border border-white/10 p-1.5 rounded-full inline-flex items-center gap-3 shadow-2xl backdrop-blur-xl">
        <a
          href="https://discord.gg/shanutechx"
          target="_blank"
          rel="noreferrer"
          className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-5 py-2.5 rounded-full font-extrabold text-xs inline-flex items-center gap-2.5 transition-all shadow-[0_0_20px_rgba(88,101,242,0.4)] hover:scale-105"
        >
          <DiscordIcon className="h-4.5 w-4.5" />
          <span>Join our Discord</span>
        </a>
        <div className="h-4 w-[1px] bg-white/15" />
        <span className="text-xs font-mono text-slate-400 pr-4 flex items-center gap-1.5">
          Live support &amp; drops →
        </span>
      </div>
    </div>
  );
}
