'use client';

import React, { useState } from 'react';

interface EnvImporterProps {
  onImport: (parsed: Array<{ key: string; value: string }>) => void;
}

export function EnvImporter({ onImport }: EnvImporterProps) {
  const [text, setText] = useState('');

  const parseEnvText = (raw: string) => {
    const lines = raw.split('\n');
    const result: Array<{ key: string; value: string }> = [];

    for (const line of lines) {
      let trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('export ')) {
        trimmed = trimmed.slice(7).trim();
      }
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        result.push({ key, value });
      }
    }
    return result;
  };

  const handleApply = () => {
    const parsed = parseEnvText(text);
    if (parsed.length === 0) {
      alert('No valid KEY=VALUE pairs found in text.');
      return;
    }
    onImport(parsed);
    setText('');
  };

  return (
    <div className="glass rounded-xl p-4 border border-white/[0.06] space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        Bulk .env Importer
      </h3>
      <textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Paste contents of .env file here...\nDATABASE_URL=postgres://...\nJWT_SECRET=supersecret`}
        className="w-full rounded-lg bg-black/40 border border-white/[0.08] p-3 font-mono text-xs text-text-primary placeholder:text-text-faint focus:outline-none focus:border-accent-violet/50"
      />
      <div className="flex justify-end">
        <button
          onClick={handleApply}
          disabled={!text.trim()}
          className="px-4 py-2 rounded-lg bg-accent-violet text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-glow-violet"
        >
          Import Variables
        </button>
      </div>
    </div>
  );
}
