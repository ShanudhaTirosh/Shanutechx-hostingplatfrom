'use client';

import React, { useState } from 'react';
import { FileText, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface BulkEnvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (envVars: Record<string, string>) => void;
}

export function parseDotEnvText(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split('\n');
  
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    
    // Ignore export prefix if present (e.g., export KEY=VAL)
    if (line.startsWith('export ')) {
      line = line.substring(7).trim();
    }
    
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    
    const key = line.substring(0, eqIdx).trim();
    let val = line.substring(eqIdx + 1).trim();
    
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    
    // Handle unescaped newlines in quotes if any
    val = val.replace(/\\n/g, '\n');
    
    if (key) {
      result[key] = val;
    }
  }
  return result;
}

export default function BulkEnvImportModal({ isOpen, onClose, onImport }: BulkEnvImportModalProps) {
  const [rawContent, setRawContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImport = () => {
    setError(null);
    if (!rawContent.trim()) {
      setError('Please paste .env content to import.');
      return;
    }

    const parsed = parseDotEnvText(rawContent);
    const count = Object.keys(parsed).length;

    if (count === 0) {
      setError('No valid KEY=VALUE pairs found in the pasted content.');
      return;
    }

    onImport(parsed);
    setRawContent('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Bulk .env File Import</h3>
              <p className="text-xs text-slate-400">Paste your raw .env contents below</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center space-x-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Raw .env Content
            </label>
            <textarea
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              placeholder={`# Paste your .env file here\nBOT_TOKEN="secret_token_123"\nPORT=3000\nDATABASE_URL="postgresql://user:pass@localhost:5432/db"\nNODE_ENV=production`}
              rows={10}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">💡 Import Guide:</p>
            <ul className="list-disc list-inside space-y-0.5 text-slate-400">
              <li>Lines starting with <code className="text-slate-300">#</code> are automatically ignored.</li>
              <li>Values wrapped in single or double quotes are unquoted automatically.</li>
              <li>Secret values are automatically masked in the UI editor.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-slate-800 bg-slate-950/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm shadow-lg shadow-blue-600/20 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Import Variables</span>
          </button>
        </div>
      </div>
    </div>
  );
}
