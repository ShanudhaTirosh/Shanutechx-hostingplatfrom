'use client';

import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface WebmailKeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    category: 'Actions & Navigation',
    shortcuts: [
      { key: 'c', description: 'Compose new message' },
      { key: 'r', description: 'Reply to sender' },
      { key: 'a', description: 'Reply to all' },
      { key: 'f', description: 'Forward message' },
      { key: 'e', description: 'Archive message' },
      { key: '#', description: 'Delete message' },
      { key: 's', description: 'Star / Unstar message' },
    ],
  },
  {
    category: 'List & Search',
    shortcuts: [
      { key: '/', description: 'Focus search bar' },
      { key: 'j', description: 'Move to next message' },
      { key: 'k', description: 'Move to previous message' },
      { key: 'Enter', description: 'Open selected thread' },
      { key: 'u', description: 'Mark as read / unread' },
      { key: '?', description: 'Open keyboard shortcuts' },
    ],
  },
];

export function WebmailKeyboardShortcutsModal({ isOpen, onClose }: WebmailKeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#0f0f13] border border-slate-800 rounded-xl max-w-xl w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Keyboard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
            <p className="text-xs text-slate-400">Boost your mail productivity with hotkeys</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.category} className="space-y-3">
              <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">{group.category}</h4>
              <div className="space-y-2">
                {group.shortcuts.map((sc) => (
                  <div key={sc.key} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 text-sm">
                    <span className="text-slate-300 text-xs">{sc.description}</span>
                    <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-xs text-indigo-300 font-semibold shadow-sm">
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-xs text-slate-500">
          Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Esc</kbd> or click X to close
        </div>
      </div>
    </div>
  );
}
