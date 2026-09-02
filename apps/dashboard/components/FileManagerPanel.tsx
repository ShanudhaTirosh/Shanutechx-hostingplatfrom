'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Button, Spinner, useToast } from './ui';
import {
  Folder,
  Archive,
  Code,
  FileJson,
  FileText,
  Lock,
  Box,
  Palette,
  Terminal,
  FileCode,
  UploadCloud,
  Save,
  Pencil,
  Trash2,
  X,
  File,
  RotateCw,
  Plus,
  ArrowUp,
  GitCommit,
} from 'lucide-react';

interface FsEntry {
  name: string;
  type: 'file' | 'dir';
  size?: number | null;
}

interface OpenTab {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
}

interface Props {
  deploymentId: string;
  repoUrl?: string | null;
  connectedAccounts?: Array<{ id: string; provider: 'github' | 'gitlab'; username: string }>;
}

const EDITABLE_EXTENSIONS = [
  '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs',
  '.json', '.yaml', '.yml', '.toml', '.env', '.env.local', '.env.production',
  '.md', '.mdx', '.txt', '.sh', '.bash', '.zsh',
  '.html', '.css', '.scss', '.sass', '.less',
  '.py', '.rb', '.php', '.go', '.rs',
  '.prisma', '.graphql', '.sql',
  '.gitignore', '.dockerignore', 'Dockerfile', 'Makefile', 'Procfile',
];

const ARCHIVE_EXTENSIONS = ['.zip', '.tar.gz', '.tgz', '.tar'];

function isEditable(name: string): boolean {
  if (!name.includes('.')) {
    return ['Dockerfile', 'Makefile', 'Procfile', 'Jenkinsfile', 'README'].includes(name);
  }
  return EDITABLE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function isArchive(name: string): boolean {
  return ARCHIVE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

function renderFileIcon(entry: FsEntry) {
  if (entry.type === 'dir') return <Folder className="h-4 w-4 text-amber-400" />;
  const n = entry.name.toLowerCase();
  if (isArchive(n)) return <Archive className="h-4 w-4 text-purple-400" />;
  if (n.endsWith('.ts') || n.endsWith('.tsx')) return <FileCode className="h-4 w-4 text-blue-400" />;
  if (n.endsWith('.js') || n.endsWith('.jsx') || n.endsWith('.mjs')) return <Code className="h-4 w-4 text-yellow-400" />;
  if (n.endsWith('.json')) return <FileJson className="h-4 w-4 text-emerald-400" />;
  if (n.endsWith('.md') || n.endsWith('.mdx')) return <FileText className="h-4 w-4 text-sky-400" />;
  if (n.startsWith('.env') || n.includes('.env.')) return <Lock className="h-4 w-4 text-rose-400" />;
  if (n === 'dockerfile') return <Box className="h-4 w-4 text-cyan-400" />;
  if (n.endsWith('.css') || n.endsWith('.scss')) return <Palette className="h-4 w-4 text-pink-400" />;
  if (n.endsWith('.py')) return <Terminal className="h-4 w-4 text-emerald-400" />;
  if (n.endsWith('.sh') || n.endsWith('.bash')) return <Terminal className="h-4 w-4 text-amber-400" />;
  if (n.endsWith('.yaml') || n.endsWith('.yml')) return <FileText className="h-4 w-4 text-orange-400" />;
  return <File className="h-4 w-4 text-slate-400" />;
}

export function FileManagerPanel({ deploymentId, repoUrl, connectedAccounts = [] }: Props) {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<FsEntry[] | null>(null);
  const [loadingDir, setLoadingDir] = useState(false);
  const [dirError, setDirError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-tab IDE state
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [savingFile, setSavingFile] = useState(false);

  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');

  const [showGitPushModal, setShowGitPushModal] = useState(false);
  const [gitCommitMsg, setGitCommitMsg] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [pushing, setPushing] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const activeTab = tabs.find((t) => t.path === activeTabPath) || null;

  const loadDir = useCallback(async (path: string) => {
    setLoadingDir(true);
    setDirError(null);
    try {
      const data = await api.fs.list(deploymentId, path);
      const sorted = [...(data.items || [])].sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
      });
      setEntries(sorted);
      setCurrentPath(path);
    } catch (err: any) {
      setDirError(err.message);
      setEntries([]);
    } finally {
      setLoadingDir(false);
    }
  }, [deploymentId]);

  useEffect(() => { loadDir(''); }, [loadDir]);

  async function openFileForEdit(entryName: string) {
    const filePath = currentPath ? `${currentPath}/${entryName}` : entryName;
    if (!isEditable(entryName)) {
      toast('Binary or non-text file — cannot be edited in the browser.', 'info');
      return;
    }

    // Check if already open in tabs
    const existing = tabs.find((t) => t.path === filePath);
    if (existing) {
      setActiveTabPath(filePath);
      return;
    }

    setLoadingFile(true);
    try {
      const data = await api.fs.read(deploymentId, filePath);
      const newTab: OpenTab = {
        path: filePath,
        name: entryName,
        content: data.content,
        originalContent: data.content,
        isDirty: false,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabPath(filePath);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoadingFile(false);
    }
  }

  function closeTab(path: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    const tabToClose = tabs.find((t) => t.path === path);
    if (tabToClose?.isDirty) {
      if (!window.confirm(`File "${tabToClose.name}" has unsaved changes. Close anyway?`)) return;
    }

    const remaining = tabs.filter((t) => t.path !== path);
    setTabs(remaining);
    if (activeTabPath === path) {
      setActiveTabPath(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
    }
  }

  function updateActiveTabContent(newContent: string) {
    if (!activeTabPath) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.path === activeTabPath
          ? { ...t, content: newContent, isDirty: newContent !== t.originalContent }
          : t
      )
    );
  }

  async function handleSaveFile() {
    if (!activeTab) return;
    setSavingFile(true);
    try {
      await api.fs.write(deploymentId, activeTab.path, activeTab.content);
      setTabs((prev) =>
        prev.map((t) =>
          t.path === activeTab.path
            ? { ...t, originalContent: t.content, isDirty: false }
            : t
        )
      );
      toast(`Saved "${activeTab.name}" to workspace!`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSavingFile(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        await api.fs.uploadBinary(deploymentId, filePath, base64);
      }
      toast(`Uploaded ${files.length} file(s) successfully!`, 'success');
      loadDir(currentPath);
    } catch (err: any) {
      toast(err.message || 'File upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleExtractArchive(entryName: string) {
    const archivePath = currentPath ? `${currentPath}/${entryName}` : entryName;
    setExtracting(entryName);
    try {
      await api.fs.extractArchive(deploymentId, archivePath);
      toast(`Extracted "${entryName}" successfully!`, 'success');
      loadDir(currentPath);
    } catch (err: any) {
      toast(err.message || 'Failed to extract archive', 'error');
    } finally {
      setExtracting(null);
    }
  }

  async function handleGitPush(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTab) return;
    setPushing(true);
    try {
      const result = await api.fs.gitCommitPush(
        deploymentId,
        activeTab.path,
        activeTab.content,
        gitCommitMsg || `Update ${activeTab.name} via ShanuTechX IDE`,
        selectedAccountId || undefined
      );
      toast(
        result.commitUrl
          ? `Pushed commit to ${result.provider.toUpperCase()}!`
          : `Pushed commit successfully!`,
        'success'
      );
      if (result.commitUrl) {
        window.open(result.commitUrl, '_blank', 'noopener');
      }
      setShowGitPushModal(false);
      setGitCommitMsg('');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setPushing(false);
    }
  }

  async function handleCreateFile(e: React.FormEvent) {
    e.preventDefault();
    const filePath = currentPath ? `${currentPath}/${newFileName}` : newFileName;
    try {
      await api.fs.write(deploymentId, filePath, '');
      toast('File created!', 'success');
      setShowNewFileModal(false);
      setNewFileName('');
      loadDir(currentPath);
      openFileForEdit(newFileName);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  async function handleCreateDir() {
    const dirName = window.prompt('New folder name:');
    if (!dirName?.trim()) return;
    const dirPath = currentPath ? `${currentPath}/${dirName.trim()}` : dirName.trim();
    try {
      await api.fs.mkdir(deploymentId, dirPath);
      toast('Folder created!', 'success');
      loadDir(currentPath);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  async function handleDelete(entryName: string, type: 'file' | 'dir') {
    if (!window.confirm(`Delete ${type} "${entryName}"? This cannot be undone.`)) return;
    const entryPath = currentPath ? `${currentPath}/${entryName}` : entryName;
    try {
      await api.fs.delete(deploymentId, entryPath);
      toast(`${type === 'dir' ? 'Folder' : 'File'} deleted.`, 'success');
      closeTab(entryPath);
      loadDir(currentPath);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const fromPath = currentPath ? `${currentPath}/${renameFrom}` : renameFrom;
    const toPath = currentPath ? `${currentPath}/${renameTo}` : renameTo;
    try {
      await api.fs.rename(deploymentId, fromPath, toPath);
      toast('Renamed successfully!', 'success');
      setShowRenameModal(false);
      loadDir(currentPath);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }

  function navigateUp() {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    loadDir(parts.join('/'));
  }

  const breadcrumbs = ['root', ...currentPath.split('/').filter(Boolean)];
  const filteredEntries = entries?.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Line count for code editor gutter
  const lineCount = activeTab ? activeTab.content.split('\n').length : 1;

  return (
    <div className="flex flex-col border border-white/[0.06] rounded-2xl overflow-hidden bg-black/30 min-h-[580px] shadow-2xl">
      {/* Hidden File Input for Upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Top Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02] flex-wrap">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs font-mono text-text-muted overflow-x-auto">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-white/20">/</span>}
              <button
                type="button"
                onClick={() => {
                  const path = breadcrumbs.slice(1, i + 1).join('/');
                  loadDir(i === 0 ? '' : path);
                }}
                className="hover:text-white transition-colors"
              >
                {crumb}
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {currentPath && (
            <Button size="sm" variant="ghost" onClick={navigateUp}>
              <ArrowUp className="h-3.5 w-3.5 mr-1" /> Up
            </Button>
          )}
          <Button size="sm" onClick={() => fileInputRef.current?.click()} loading={uploading}>
            {uploading ? 'Uploading...' : <span className="flex items-center gap-1.5"><UploadCloud className="h-3.5 w-3.5" /> Upload Files</span>}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowNewFileModal(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New File
          </Button>
          <Button size="sm" variant="secondary" onClick={handleCreateDir}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Folder
          </Button>
          <Button size="sm" variant="secondary" onClick={() => loadDir(currentPath)}>
            <RotateCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 min-h-[500px]">
        {/* File Tree Panel */}
        <div className="w-full md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-white/[0.06] flex flex-col bg-white/[0.01]">
          {/* File Filter Input */}
          <div className="p-2 border-b border-white/[0.06]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-mono text-white placeholder:text-text-faint focus:outline-none focus:border-accent-cyan"
            />
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px]">
            {loadingDir && <div className="p-4"><Spinner label="Loading..." /></div>}
            {dirError && <p className="p-4 text-xs text-red-400">{dirError}</p>}
            {filteredEntries && filteredEntries.length === 0 && (
              <p className="p-4 text-xs text-text-faint italic">No files found</p>
            )}
            {filteredEntries?.map((entry) => (
              <div
                key={entry.name}
                className="group flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.04] cursor-pointer transition-all border-b border-white/[0.02]"
                onDoubleClick={() => {
                  if (entry.type === 'dir') loadDir(currentPath ? `${currentPath}/${entry.name}` : entry.name);
                  else openFileForEdit(entry.name);
                }}
                onClick={() => {
                  if (entry.type === 'dir') loadDir(currentPath ? `${currentPath}/${entry.name}` : entry.name);
                }}
              >
                <span className="flex-shrink-0">{renderFileIcon(entry)}</span>
                <span className="text-xs text-text-primary flex-1 truncate font-mono">{entry.name}</span>
                {/* Context actions on hover */}
                <div className="hidden group-hover:flex items-center gap-1">
                  {isArchive(entry.name) && (
                    <button
                      type="button"
                      onClick={(ev) => { ev.stopPropagation(); handleExtractArchive(entry.name); }}
                      disabled={extracting === entry.name}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-all"
                      title="Extract Archive"
                    >
                      {extracting === entry.name ? '...' : 'Extract'}
                    </button>
                  )}
                  {entry.type === 'file' && isEditable(entry.name) && (
                    <button
                      type="button"
                      onClick={(ev) => { ev.stopPropagation(); openFileForEdit(entry.name); }}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/60 transition-all"
                      title="Edit"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); setRenameFrom(entry.name); setRenameTo(entry.name); setShowRenameModal(true); }}
                    className="text-[10px] p-1 rounded bg-white/10 hover:bg-white/20 text-white/60 transition-all"
                    title="Rename"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); handleDelete(entry.name, entry.type); }}
                    className="text-[10px] p-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Web IDE Main Container */}
        <div className="flex-1 flex flex-col min-w-0 bg-black/40">
          {/* Multi-Tab Bar */}
          {tabs.length > 0 && (
            <div className="flex items-center gap-1 bg-white/[0.02] border-b border-white/[0.06] overflow-x-auto px-2 pt-1.5">
              {tabs.map((tab) => {
                const isActive = tab.path === activeTabPath;
                return (
                  <div
                    key={tab.path}
                    onClick={() => setActiveTabPath(tab.path)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono rounded-t-lg border-t border-x cursor-pointer transition-all select-none ${
                      isActive
                        ? 'bg-black/60 border-white/10 text-accent-cyan font-semibold'
                        : 'bg-white/[0.02] border-transparent text-text-muted hover:text-white'
                    }`}
                  >
                    <span>{tab.name}</span>
                    {tab.isDirty && (
                      <span className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" title="Unsaved changes" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => closeTab(tab.path, e)}
                      className="hover:text-red-400 text-text-faint text-[11px] ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!activeTab && (
            <div className="flex-1 flex items-center justify-center text-text-faint text-sm p-8">
              <div className="text-center space-y-3">
                <Terminal className="h-10 w-10 text-accent-cyan mx-auto opacity-80" />
                <h4 className="text-sm font-semibold text-white">ShanuTechX Web IDE</h4>
                <p className="text-xs text-text-muted max-w-sm">
                  Double-click any file in the workspace tree to open it in a tab. Edit code with syntax highlighting, shortcuts (<kbd className="px-1 py-0.5 bg-white/10 rounded">Ctrl+S</kbd>), and 1-click Git push.
                </p>
              </div>
            </div>
          )}

          {activeTab && (
            <>
              {/* File Editor Control Header */}
              <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-white/[0.06] bg-white/[0.01] flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono text-text-muted truncate">{activeTab.path}</span>
                  {activeTab.isDirty ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                      Unsaved Changes
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      Saved
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {connectedAccounts.length > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => { setGitCommitMsg(`Update ${activeTab.name}`); setShowGitPushModal(true); }}
                    >
                      <GitCommit className="h-3.5 w-3.5 mr-1" /> Push to Git
                    </Button>
                  )}
                  <Button size="sm" onClick={handleSaveFile} loading={savingFile} disabled={!activeTab.isDirty}>
                    {savingFile ? 'Saving...' : <span className="flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Save (Ctrl+S)</span>}
                  </Button>
                </div>
              </div>

              {/* Code Editor Body with Line Numbers */}
              {loadingFile ? (
                <div className="flex-1 flex items-center justify-center">
                  <Spinner label="Loading file..." />
                </div>
              ) : (
                <div className="flex-1 flex min-h-[420px] font-mono text-xs overflow-hidden">
                  {/* Line Number Gutter */}
                  <div className="w-12 bg-black/40 border-r border-white/[0.06] py-4 text-right pr-3 select-none text-text-faint text-[11px] leading-relaxed">
                    {Array.from({ length: lineCount }).map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>

                  {/* Textarea Code View */}
                  <textarea
                    ref={editorRef}
                    value={activeTab.content}
                    onChange={(e) => updateActiveTabContent(e.target.value)}
                    spellCheck={false}
                    className="flex-1 bg-transparent resize-none p-4 font-mono text-xs text-text-primary leading-relaxed focus:outline-none placeholder:text-text-faint whitespace-pre"
                    style={{ tabSize: 2 }}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const start = e.currentTarget.selectionStart;
                        const end = e.currentTarget.selectionEnd;
                        const newContent = activeTab.content.substring(0, start) + '  ' + activeTab.content.substring(end);
                        updateActiveTabContent(newContent);
                        setTimeout(() => {
                          if (editorRef.current) {
                            editorRef.current.selectionStart = start + 2;
                            editorRef.current.selectionEnd = start + 2;
                          }
                        }, 0);
                      }
                      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                        e.preventDefault();
                        if (activeTab.isDirty) handleSaveFile();
                      }
                    }}
                  />
                </div>
              )}

              {/* IDE Status Footer */}
              <div className="flex items-center justify-between px-4 py-1.5 border-t border-white/[0.06] bg-black/60 text-[10px] font-mono text-text-muted">
                <span>UTF-8 · {lineCount} lines</span>
                <span>Press <kbd className="px-1 bg-white/10 rounded">Ctrl+S</kbd> to save to server</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-sm text-white">Create New File</h3>
            <form onSubmit={handleCreateFile} className="space-y-4">
              <input
                autoFocus
                required
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="filename.ts"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-violet"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowNewFileModal(false)}>Cancel</Button>
                <Button type="submit" size="sm">Create</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-sm text-white">Rename "{renameFrom}"</h3>
            <form onSubmit={handleRename} className="space-y-4">
              <input
                autoFocus
                required
                value={renameTo}
                onChange={(e) => setRenameTo(e.target.value)}
                placeholder="new-name.ts"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-violet"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowRenameModal(false)}>Cancel</Button>
                <Button type="submit" size="sm">Rename</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Git Push Modal */}
      {showGitPushModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold text-sm text-white">Push to GitHub / GitLab</h3>
            <p className="text-xs text-text-muted">
              Save the current file and push it as a commit to the connected Git repository.
            </p>
            <form onSubmit={handleGitPush} className="space-y-4">
              {connectedAccounts.length > 1 && (
                <div>
                  <label className="text-xs font-medium text-text-muted block mb-1.5">Push from Account</label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-violet"
                  >
                    <option value="">Auto-detect from repo URL</option>
                    {connectedAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>@{acc.username} ({acc.provider})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">Commit Message</label>
                <input
                  required
                  value={gitCommitMsg}
                  onChange={(e) => setGitCommitMsg(e.target.value)}
                  placeholder={`Update ${activeTab?.name || 'file'}`}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-violet"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowGitPushModal(false)}>Cancel</Button>
                <Button type="submit" size="sm" loading={pushing}>
                  {pushing ? 'Pushing...' : '↑ Push Commit'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
