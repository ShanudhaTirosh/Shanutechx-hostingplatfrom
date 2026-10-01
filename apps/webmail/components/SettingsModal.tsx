'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  FileSignature,
  Palmtree,
  FolderPlus,
  Tag,
  Filter,
  Ban,
  FileText,
  Check,
  Trash2,
  Plus,
  Save,
  AlertCircle,
  Shield,
  Palette,
} from 'lucide-react';
import { api } from '../lib/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mailboxes: any[];
  activeMailboxId: string | null;
  onRefreshData?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  mailboxes,
  activeMailboxId,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'signatures' | 'autoreply' | 'folders' | 'filters' | 'templates' | 'blocked'>('signatures');

  // Signatures State
  const [signatures, setSignatures] = useState<any[]>([]);
  const [sigName, setSigName] = useState('');
  const [sigContent, setSigContent] = useState('');
  const [sigIsDefault, setSigIsDefault] = useState(false);

  // Auto Reply State
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [autoReplySubject, setAutoReplySubject] = useState('Out of Office');
  const [autoReplyBody, setAutoReplyBody] = useState('I am away from my inbox and will respond when back.');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Folders & Labels State
  const [folders, setFolders] = useState<any[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#6366f1');

  const [labels, setLabels] = useState<any[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#ec4899');

  // Filters State
  const [filters, setFilters] = useState<any[]>([]);
  const [filterName, setFilterName] = useState('');
  const [filterCondField, setFilterCondField] = useState<'sender' | 'subject' | 'body'>('sender');
  const [filterCondValue, setFilterCondValue] = useState('');
  const [filterAction, setFilterAction] = useState<'move' | 'label' | 'delete'>('move');
  const [filterActionValue, setFilterActionValue] = useState('archive');

  // Templates State
  const [templates, setTemplates] = useState<any[]>([]);
  const [tplName, setTplName] = useState('');
  const [tplSubject, setTplSubject] = useState('');
  const [tplBody, setTplBody] = useState('');

  // Blocked Senders State
  const [blocked, setBlocked] = useState<any[]>([]);
  const [blockEmail, setBlockEmail] = useState('');

  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAllSettings();
    }
  }, [isOpen]);

  const loadAllSettings = async () => {
    try {
      const [sigRes, autoRes, fldRes, lblRes, fltRes, tplRes, blkRes] = await Promise.all([
        api.webmail.getSignatures().catch(() => ({ signatures: [] })),
        api.webmail.getAutoReply().catch(() => ({ autoReply: null })),
        api.webmail.listFolders().catch(() => ({ folders: [] })),
        api.webmail.listLabels().catch(() => ({ labels: [] })),
        api.webmail.listFilters().catch(() => ({ filters: [] })),
        api.webmail.getTemplates().catch(() => ({ templates: [] })),
        api.webmail.getBlockedSenders().catch(() => ({ blockedSenders: [] })),
      ]);

      setSignatures(sigRes.signatures || []);
      if (autoRes.autoReply) {
        setAutoReplyEnabled(autoRes.autoReply.enabled);
        setAutoReplySubject(autoRes.autoReply.subject || '');
        setAutoReplyBody(autoRes.autoReply.body || '');
      }
      setFolders(fldRes.folders || []);
      setLabels(lblRes.labels || []);
      setFilters(fltRes.filters || []);
      setTemplates(tplRes.templates || []);
      setBlocked(blkRes.blockedSenders || []);
    } catch {
      // Ignore
    }
  };

  if (!isOpen) return null;

  // Signature handlers
  const handleSaveSignature = async () => {
    if (!sigName.trim() || !sigContent.trim()) return;
    try {
      await api.webmail.createSignature({
        name: sigName.trim(),
        htmlContent: sigContent.trim(),
        isDefault: sigIsDefault,
      });
      setSigName('');
      setSigContent('');
      setSigIsDefault(false);
      setStatusMsg('Signature saved successfully');
      setTimeout(() => setStatusMsg(null), 3000);
      loadAllSettings();
    } catch (err: any) {
      setStatusMsg('Failed: ' + err.message);
    }
  };

  const handleDeleteSignature = async (id: string) => {
    await api.webmail.deleteSignature(id);
    loadAllSettings();
  };

  // Auto reply handler
  const handleSaveAutoReply = async () => {
    try {
      await api.webmail.setAutoReply({
        enabled: autoReplyEnabled,
        subject: autoReplySubject,
        body: autoReplyBody,
        startDate,
        endDate,
      });
      setStatusMsg('Vacation responder updated');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg('Failed: ' + err.message);
    }
  };

  // Folder & Label handlers
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await api.webmail.createFolder({ name: newFolderName.trim(), color: newFolderColor });
    setNewFolderName('');
    loadAllSettings();
    if (onRefreshData) onRefreshData();
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    await api.webmail.createLabel({ name: newLabelName.trim(), color: newLabelColor });
    setNewLabelName('');
    loadAllSettings();
    if (onRefreshData) onRefreshData();
  };

  // Filter handlers
  const handleCreateFilter = async () => {
    if (!filterName.trim() || !filterCondValue.trim()) return;
    await api.webmail.createFilter({
      name: filterName.trim(),
      conditionsJson: { field: filterCondField, value: filterCondValue.trim() },
      actionsJson: { action: filterAction, target: filterActionValue },
    });
    setFilterName('');
    setFilterCondValue('');
    loadAllSettings();
  };

  // Template handlers
  const handleCreateTemplate = async () => {
    if (!tplName.trim() || !tplBody.trim()) return;
    await api.webmail.createTemplate({ name: tplName.trim(), subject: tplSubject.trim(), body: tplBody.trim() });
    setTplName('');
    setTplSubject('');
    setTplBody('');
    loadAllSettings();
  };

  // Blocked Senders handler
  const handleAddBlocked = async () => {
    if (!blockEmail.trim()) return;
    await api.webmail.addBlockedSender({ emailOrDomain: blockEmail.trim() });
    setBlockEmail('');
    loadAllSettings();
  };

  const tabs = [
    { id: 'signatures', label: 'Signatures', icon: FileSignature },
    { id: 'autoreply', label: 'Vacation Auto-Reply', icon: Palmtree },
    { id: 'folders', label: 'Folders & Labels', icon: FolderPlus },
    { id: 'filters', label: 'Filter Rules', icon: Filter },
    { id: 'templates', label: 'Canned Templates', icon: FileText },
    { id: 'blocked', label: 'Blocked Senders', icon: Ban },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl h-[640px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex overflow-hidden">
        {/* Left Settings Sidebar */}
        <div className="w-64 bg-slate-950 border-r border-slate-800 p-4 flex flex-col justify-between shrink-0">
          <div>
            <div className="px-2 pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-slate-100">Webmail Preferences</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Customize email client settings</p>
            </div>
            <nav className="mt-4 space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500">
            ShanuTechX Webmail v2.4 Enterprise
          </div>
        </div>

        {/* Right Settings Content */}
        <div className="flex-1 flex flex-col h-full bg-slate-900 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 capitalize">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {statusMsg && (
            <div className="bg-indigo-500/10 border-b border-indigo-500/20 px-6 py-2 text-xs text-indigo-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> {statusMsg}</span>
            </div>
          )}

          {/* Body content based on tab */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 1. Signatures */}
            {activeTab === 'signatures' && (
              <div className="space-y-6">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-200">Add New Email Signature</h4>
                  <input
                    type="text"
                    value={sigName}
                    onChange={(e) => setSigName(e.target.value)}
                    placeholder="Signature Name (e.g. Work Signature)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <textarea
                    value={sigContent}
                    onChange={(e) => setSigContent(e.target.value)}
                    placeholder="HTML / Plain text signature..."
                    className="w-full h-24 bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none font-mono"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sigIsDefault}
                        onChange={(e) => setSigIsDefault(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                      />
                      Set as default signature
                    </label>
                    <button
                      onClick={handleSaveSignature}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                    >
                      Save Signature
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300">Existing Signatures</h4>
                  {signatures.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No signatures created yet.</p>
                  ) : (
                    signatures.map((sig) => (
                      <div key={sig.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs">
                        <div>
                          <p className="font-semibold text-slate-200 flex items-center gap-2">
                            {sig.name}
                            {sig.isDefault && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">Default</span>}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{sig.htmlContent}</p>
                        </div>
                        <button onClick={() => handleDeleteSignature(sig.id)} className="p-1.5 text-slate-500 hover:text-rose-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 2. Vacation Auto-Reply */}
            {activeTab === 'autoreply' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-4 rounded-xl">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Out of Office Auto-Responder</h4>
                    <p className="text-[11px] text-slate-400">Automatically reply to incoming emails while on leave</p>
                  </div>
                  <button
                    onClick={() => setAutoReplyEnabled(!autoReplyEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoReplyEnabled ? 'bg-indigo-600' : 'bg-slate-800'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoReplyEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Subject</label>
                    <input
                      type="text"
                      value={autoReplySubject}
                      onChange={(e) => setAutoReplySubject(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Response Message</label>
                    <textarea
                      value={autoReplyBody}
                      onChange={(e) => setAutoReplyBody(e.target.value)}
                      className="w-full h-28 bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>
                  <button
                    onClick={handleSaveAutoReply}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md"
                  >
                    Save Auto-Responder Settings
                  </button>
                </div>
              </div>
            )}

            {/* 3. Folders & Labels */}
            {activeTab === 'folders' && (
              <div className="space-y-6">
                {/* Custom Folders */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-200">Create Custom Folder</h4>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Folder name (e.g. Clients)"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                    />
                    <input
                      type="color"
                      value={newFolderColor}
                      onChange={(e) => setNewFolderColor(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-800 bg-transparent cursor-pointer"
                    />
                    <button onClick={handleCreateFolder} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold">
                      Add Folder
                    </button>
                  </div>
                </div>

                {/* Custom Labels */}
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-bold text-slate-200">Create Color Tag Label</h4>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder="Label name (e.g. Urgent)"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                    />
                    <input
                      type="color"
                      value={newLabelColor}
                      onChange={(e) => setNewLabelColor(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-800 bg-transparent cursor-pointer"
                    />
                    <button onClick={handleCreateLabel} className="px-3 py-1.5 bg-pink-600 text-white rounded-lg text-xs font-semibold">
                      Add Label
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Filters */}
            {activeTab === 'filters' && (
              <div className="space-y-4">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-200">Create Filter Rule</h4>
                  <input
                    type="text"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    placeholder="Rule Name (e.g. Archive Newsletters)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">If Field</label>
                      <select
                        value={filterCondField}
                        onChange={(e) => setFilterCondField(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200"
                      >
                        <option value="sender">Sender Email</option>
                        <option value="subject">Subject Line</option>
                        <option value="body">Body Contains</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Contains Value</label>
                      <input
                        type="text"
                        value={filterCondValue}
                        onChange={(e) => setFilterCondValue(e.target.value)}
                        placeholder="e.g. newsletter.com"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                  <button onClick={handleCreateFilter} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold">
                    Create Filter Rule
                  </button>
                </div>
              </div>
            )}

            {/* 5. Canned Templates */}
            {activeTab === 'templates' && (
              <div className="space-y-4">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-slate-200">Create Quick Response Snippet</h4>
                  <input
                    type="text"
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    placeholder="Template Title"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                  />
                  <textarea
                    value={tplBody}
                    onChange={(e) => setTplBody(e.target.value)}
                    placeholder="Canned body text..."
                    className="w-full h-20 bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 resize-none"
                  />
                  <button onClick={handleCreateTemplate} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold">
                    Save Snippet
                  </button>
                </div>
              </div>
            )}

            {/* 6. Blocked Senders */}
            {activeTab === 'blocked' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={blockEmail}
                    onChange={(e) => setBlockEmail(e.target.value)}
                    placeholder="Email or domain to block (e.g. spammer@bad.com)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  />
                  <button onClick={handleAddBlocked} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold">
                    Block Sender
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
