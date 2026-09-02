'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';
import { Folder, Tag, Plus, Trash2, X } from 'lucide-react';

interface WebmailFoldersAndLabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebmailFoldersAndLabelsModal({ isOpen, onClose }: WebmailFoldersAndLabelsModalProps) {
  const [folders, setFolders] = useState<any[]>([]);
  const [labels, setLabels] = useState<any[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6366f1');

  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = () => {
    api.webmail.folders.list().then((r) => setFolders(r.folders || [])).catch(() => {});
    api.webmail.labels.list().then((r) => setLabels(r.labels || [])).catch(() => {});
  };

  if (!isOpen) return null;

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.webmail.folders.create({ name: newFolderName.trim() });
      toast(`Folder "${newFolderName}" created!`, 'success');
      setNewFolderName('');
      fetchData();
    } catch {
      toast('Failed to create folder', 'error');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await api.webmail.folders.delete(id);
      toast('Folder removed', 'info');
      fetchData();
    } catch {
      toast('Failed to delete folder', 'error');
    }
  };

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    try {
      await api.webmail.labels.create({ name: newLabelName.trim(), color: newLabelColor });
      toast(`Label "${newLabelName}" created!`, 'success');
      setNewLabelName('');
      fetchData();
    } catch {
      toast('Failed to create label', 'error');
    }
  };

  const handleDeleteLabel = async (id: string) => {
    try {
      await api.webmail.labels.delete(id);
      toast('Label removed', 'info');
      fetchData();
    } catch {
      toast('Failed to delete label', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full space-y-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Folder className="h-4 w-4 text-indigo-400" />
            <span>Manage Custom Folders & Labels</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* FOLDERS SECTION */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
            <Folder className="h-3.5 w-3.5" />
            <span>Custom Subfolders</span>
          </h4>
          <form onSubmit={handleCreateFolder} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Folder Name (e.g. Clients, Accounting)"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none"
            />
            <button type="submit" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" />
              <span>Add Folder</span>
            </button>
          </form>

          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {folders.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                <span className="flex items-center gap-2 text-slate-200 font-semibold">
                  <Folder className="h-3.5 w-3.5 text-indigo-400" />
                  <span>{f.name}</span>
                </span>
                <button onClick={() => handleDeleteFolder(f.id)} className="text-slate-500 hover:text-rose-400 p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* LABELS SECTION */}
        <div className="space-y-3 border-t border-slate-800 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            <span>Color-Coded Tags / Labels</span>
          </h4>
          <form onSubmit={handleCreateLabel} className="flex items-center gap-2">
            <input
              type="color"
              value={newLabelColor}
              onChange={(e) => setNewLabelColor(e.target.value)}
              className="h-9 w-10 bg-transparent cursor-pointer rounded"
            />
            <input
              type="text"
              placeholder="Label Name (e.g. Urgent, Tax, Personal)"
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none"
            />
            <button type="submit" className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" />
              <span>Add Label</span>
            </button>
          </form>

          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {labels.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                <span className="flex items-center gap-2.5 text-slate-200 font-semibold">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: l.color }} />
                  <span>{l.name}</span>
                </span>
                <button onClick={() => handleDeleteLabel(l.id)} className="text-slate-500 hover:text-rose-400 p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
