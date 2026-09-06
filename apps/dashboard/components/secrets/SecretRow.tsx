'use client';

import React, { useState } from 'react';
import { Check, Copy, Eye, EyeOff, Trash2 } from 'lucide-react';


interface SecretRowProps {
  secretKey: string;
  value: string;
  comment?: string;
  onDelete: (key: string) => void;
}

export function SecretRow({ secretKey, value, comment, onDelete }: SecretRowProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass rounded-xl p-3 border border-white/[0.06] flex items-center justify-between gap-3 text-xs transition-all hover:bg-white/[0.04]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-text-primary text-xs">{secretKey}</span>
          {comment && (
            <span className="text-[10px] text-text-faint bg-white/[0.04] px-2 py-0.5 rounded truncate">
              {comment}
            </span>
          )}
        </div>
        <p className="font-mono text-text-muted text-[11px] truncate mt-1">
          {revealed ? value : '••••••••••••••••••••••••••••••••'}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setRevealed(!revealed)}
          className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-text-muted hover:text-text-primary transition-all text-[11px] flex items-center gap-1"
        >
          {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          <span>{revealed ? 'Hide' : 'Reveal'}</span>
        </button>

        <button
          onClick={handleCopy}
          className="px-2.5 py-1 rounded-lg bg-accent-violet/20 hover:bg-accent-violet/30 text-accent-violet-light border border-accent-violet/30 transition-all text-[11px] flex items-center gap-1"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>

        <button
          onClick={() => onDelete(secretKey)}
          className="px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all text-[11px] flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          <span>Delete</span>
        </button>

      </div>
    </div>
  );
}
