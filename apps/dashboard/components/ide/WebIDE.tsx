'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Save,
  GitCommit,
  Play,
  RotateCw,
  FileCode,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { getAuthToken } from '@/lib/useAuth';

interface FileItem {
  name: string;
  isDir: boolean;
  size?: number;
  path: string;
}

interface OpenTab {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
}

interface WebIDEProps {
  deploymentId: string;
  repoUrl?: string | null;
  subdomain?: string | null;
  apiBaseUrl?: string;
  authToken?: string;
}

export default function WebIDE({
  deploymentId,
  repoUrl,
  subdomain,
  apiBaseUrl = 'http://localhost:4000',
  authToken,
}: WebIDEProps) {
  const [fileTree, setFileTree] = useState<FileItem[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const [dirChildren, setDirChildren] = useState<Record<string, FileItem[]>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [pushing, setPushing] = useState<boolean>(false);
  const [commitMessage, setCommitMessage] = useState<string>('Update code via ShanuTechX Web IDE');
  const [showCommitModal, setShowCommitModal] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const activeTab = openTabs.find((t) => t.path === activeTabPath);

  const getAuthHeaders = useCallback(async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = authToken || (await getAuthToken().catch(() => null));
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [authToken]);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch directory list
  const fetchDir = useCallback(async (dirPath: string = ''): Promise<FileItem[]> => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBaseUrl}/api/fs/${deploymentId}/list?path=${encodeURIComponent(dirPath)}`, {
        headers,
      });
      if (!res.ok) throw new Error('Failed to load files');
      const data = await res.json();
      return (data.items || []).map((item: any) => ({
        ...item,
        path: dirPath ? `${dirPath}/${item.name}` : item.name,
      }));
    } catch (err: any) {
      showToast('error', err.message || 'Error fetching directory');
      return [];
    }
  }, [apiBaseUrl, deploymentId, getAuthHeaders]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const rootItems = await fetchDir('');
      setFileTree(rootItems);
      setLoading(false);
    }
    init();
  }, [fetchDir]);

  const toggleExpandDir = async (dirPath: string) => {
    const isExpanded = !!expandedDirs[dirPath];
    if (!isExpanded && !dirChildren[dirPath]) {
      const children = await fetchDir(dirPath);
      setDirChildren((prev) => ({ ...prev, [dirPath]: children }));
    }
    setExpandedDirs((prev) => ({ ...prev, [dirPath]: !isExpanded }));
  };

  const openFile = async (filePath: string, fileName: string) => {
    const existing = openTabs.find((t) => t.path === filePath);
    if (existing) {
      setActiveTabPath(filePath);
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBaseUrl}/api/fs/${deploymentId}/read?path=${encodeURIComponent(filePath)}`, {
        headers,
      });
      if (!res.ok) throw new Error('Failed to read file content');
      const data = await res.json();
      const content = data.content ?? '';

      const newTab: OpenTab = {
        path: filePath,
        name: fileName,
        content,
        originalContent: content,
        isDirty: false,
      };

      setOpenTabs((prev) => [...prev, newTab]);
      setActiveTabPath(filePath);
    } catch (err: any) {
      showToast('error', err.message || 'Could not open file');
    }
  };

  const closeTab = (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tabToClose = openTabs.find((t) => t.path === filePath);
    if (tabToClose?.isDirty) {
      if (!confirm(`Discard unsaved changes in ${tabToClose.name}?`)) return;
    }

    const filtered = openTabs.filter((t) => t.path !== filePath);
    setOpenTabs(filtered);

    if (activeTabPath === filePath) {
      setActiveTabPath(filtered.length > 0 ? filtered[filtered.length - 1].path : null);
    }
  };

  const updateTabContent = (newContent: string | undefined) => {
    if (!activeTabPath || newContent === undefined) return;
    setOpenTabs((prev) =>
      prev.map((t) => {
        if (t.path === activeTabPath) {
          return {
            ...t,
            content: newContent,
            isDirty: newContent !== t.originalContent,
          };
        }
        return t;
      })
    );
  };

  const saveCurrentFile = async () => {
    if (!activeTab) return;
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBaseUrl}/api/fs/${deploymentId}/write`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ path: activeTab.path, content: activeTab.content }),
      });

      if (!res.ok) throw new Error('Failed to save file');

      setOpenTabs((prev) =>
        prev.map((t) =>
          t.path === activeTab.path
            ? { ...t, originalContent: t.content, isDirty: false }
            : t
        )
      );

      showToast('success', `Saved ${activeTab.name}`);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const commitAndPush = async () => {
    if (!activeTab) return;
    setPushing(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBaseUrl}/api/fs/${deploymentId}/git-commit-push`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filePath: activeTab.path,
          content: activeTab.content,
          commitMessage,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Push failed');

      setOpenTabs((prev) =>
        prev.map((t) =>
          t.path === activeTab.path
            ? { ...t, originalContent: t.content, isDirty: false }
            : t
        )
      );

      setShowCommitModal(false);
      showToast('success', `Pushed changes to Git (${data.provider || 'repo'})`);
    } catch (err: any) {
      showToast('error', err.message || 'Git push failed');
    } finally {
      setPushing(false);
    }
  };

  const detectLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'json':
        return 'json';
      case 'py':
        return 'python';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'md':
        return 'markdown';
      case 'yml':
      case 'yaml':
        return 'yaml';
      case 'sh':
        return 'shell';
      case 'sql':
        return 'sql';
      default:
        return 'plaintext';
    }
  };

  const renderFileTreeItem = (item: FileItem) => {
    if (item.isDir) {
      const isExpanded = !!expandedDirs[item.path];
      const children = dirChildren[item.path] || [];
      return (
        <div key={item.path} className="select-none">
          <div
            onClick={() => toggleExpandDir(item.path)}
            className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-800/60 rounded text-slate-300 cursor-pointer text-xs transition-colors"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Folder size={14} className="text-indigo-400" />
            <span className="truncate">{item.name}</span>
          </div>
          {isExpanded && (
            <div className="pl-3 border-l border-slate-800 ml-2">
              {children.map(renderFileTreeItem)}
            </div>
          )}
        </div>
      );
    }

    const isActive = activeTabPath === item.path;
    return (
      <div
        key={item.path}
        onClick={() => openFile(item.path, item.name)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-xs transition-colors ${
          isActive
            ? 'bg-indigo-600/30 text-indigo-300 font-medium'
            : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
        }`}
      >
        <FileCode size={14} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
        <span className="truncate">{item.name}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] w-full bg-slate-950 text-slate-100 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Web IDE — {subdomain || deploymentId}
          </span>
          {repoUrl && (
            <span className="text-slate-500 truncate max-w-xs font-mono text-[11px]">
              {repoUrl.replace(/https:\/\/[^@]+@/, 'https://')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={saveCurrentFile}
            disabled={!activeTab || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-md font-medium transition-all"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            <span>Save (Ctrl+S)</span>
          </button>

          <button
            onClick={() => setShowCommitModal(true)}
            disabled={!activeTab || pushing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md font-medium shadow-sm transition-all"
          >
            {pushing ? <Loader2 size={13} className="animate-spin" /> : <GitCommit size={13} />}
            <span>Commit & Push</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left File Tree Sidebar */}
        <div className="w-64 bg-slate-900/70 border-r border-slate-800 p-2 overflow-y-auto flex flex-col gap-1">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
            <span>Explorer</span>
            <button
              onClick={async () => setFileTree(await fetchDir(''))}
              title="Refresh tree"
              className="hover:text-slate-200"
            >
              <RotateCw size={12} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-6 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">{fileTree.map(renderFileTreeItem)}</div>
          )}
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
          {/* Tab Bar */}
          <div className="flex items-center bg-slate-900 border-b border-slate-800 overflow-x-auto">
            {openTabs.map((tab) => {
              const isActive = activeTabPath === tab.path;
              return (
                <div
                  key={tab.path}
                  onClick={() => setActiveTabPath(tab.path)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs border-r border-slate-800 cursor-pointer select-none transition-colors ${
                    isActive
                      ? 'bg-slate-950 text-slate-100 font-medium border-t-2 border-t-indigo-500'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <File size={13} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
                  <span>{tab.name}</span>
                  {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>}
                  <button
                    onClick={(e) => closeTab(tab.path, e)}
                    className="p-0.5 rounded hover:bg-slate-700/60 text-slate-500 hover:text-slate-300"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Monaco Code Editor */}
          {activeTab ? (
            <div className="flex-1 relative">
              <Editor
                height="100%"
                path={activeTab.path}
                defaultLanguage={detectLanguage(activeTab.name)}
                language={detectLanguage(activeTab.name)}
                value={activeTab.content}
                theme="vs-dark"
                onChange={updateTabContent}
                options={{
                  fontSize: 13,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
              <FileCode size={48} className="text-slate-700" />
              <p className="text-sm">Select a file from the explorer to edit code in-browser</p>
            </div>
          )}
        </div>
      </div>

      {/* Notifications Toast */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2 border transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950 border-emerald-800 text-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-950 border-rose-800 text-rose-200'
              : 'bg-slate-900 border-slate-700 text-slate-200'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Git Commit & Push Modal */}
      {showCommitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <GitCommit className="text-indigo-400" size={18} />
                Commit & Push Changes
              </h3>
              <button onClick={() => setShowCommitModal(false)} className="text-slate-400 hover:text-slate-200">
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">File to commit:</label>
              <div className="p-2 bg-slate-950 rounded border border-slate-800 text-xs font-mono text-indigo-300">
                {activeTab?.path}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Commit Message:</label>
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowCommitModal(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={commitAndPush}
                disabled={pushing}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-md flex items-center gap-1.5 shadow-sm"
              >
                {pushing ? <Loader2 size={13} className="animate-spin" /> : <GitCommit size={13} />}
                <span>Push to Repository</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
