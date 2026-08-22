'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Deployment } from '@/lib/types';
import {
  Card,
  Button,
  Spinner,
  ErrorBanner,
  PageHeader,
  useToast,
  Modal,
  Input,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

type FsItem = {
  name: string;
  type: 'file' | 'dir';
  size: number | null;
  mtime: number | null;
};

// ── Language detection by extension ─────────────────────────────────────────
function getLang(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    js: 'javascript', ts: 'typescript', tsx: 'tsx', jsx: 'jsx',
    json: 'json', md: 'markdown', py: 'python', sh: 'bash',
    yml: 'yaml', yaml: 'yaml', env: 'dotenv', dockerfile: 'dockerfile',
    html: 'html', css: 'css', sql: 'sql', txt: 'plaintext',
  };
  return map[ext] ?? 'plaintext';
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function FileManagerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [cwd, setCwd] = useState('');
  const [items, setItems] = useState<FsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [saving, setSaving] = useState(false);
  const isDirty = fileContent !== originalContent;

  // Modals
  const [newNameModal, setNewNameModal] = useState<'file' | 'dir' | null>(null);
  const [newName, setNewName] = useState('');
  const [renameTarget, setRenameTarget] = useState<FsItem | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FsItem | null>(null);

  const deploymentId = params.id;

  // ── Directory listing ──────────────────────────────────────────────────────
  const listDir = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fs.list(deploymentId, path);
      setItems(data.items);
      setCwd(path);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [deploymentId]);

  useEffect(() => { listDir(''); }, [listDir]);

  // ── Open file in editor ────────────────────────────────────────────────────
  async function openFileInEditor(item: FsItem) {
    if (item.type === 'dir') {
      listDir(cwd ? `${cwd}/${item.name}` : item.name);
      return;
    }
    const filePath = cwd ? `${cwd}/${item.name}` : item.name;
    try {
      const data = await api.fs.read(deploymentId, filePath);
      setOpenFile(filePath);
      setFileContent(data.content);
      setOriginalContent(data.content);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }

  // ── Save file ──────────────────────────────────────────────────────────────
  async function saveFile() {
    if (!openFile) return;
    setSaving(true);
    try {
      await api.fs.write(deploymentId, openFile, fileContent);
      setOriginalContent(fileContent);
      toast('File saved', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Create new file/dir ────────────────────────────────────────────────────
  async function handleCreate() {
    if (!newName.trim() || !newNameModal) return;
    const target = cwd ? `${cwd}/${newName}` : newName;
    try {
      if (newNameModal === 'dir') {
        await api.fs.mkdir(deploymentId, target);
        toast('Directory created', 'success');
      } else {
        await api.fs.write(deploymentId, target, '');
        toast('File created', 'success');
      }
      setNewNameModal(null);
      setNewName('');
      listDir(cwd);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    const target = cwd ? `${cwd}/${deleteTarget.name}` : deleteTarget.name;
    try {
      await api.fs.delete(deploymentId, target);
      toast('Deleted', 'success');
      setDeleteTarget(null);
      if (openFile?.startsWith(target)) setOpenFile(null);
      listDir(cwd);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }

  // ── Rename ─────────────────────────────────────────────────────────────────
  async function handleRename() {
    if (!renameTarget || !renameTo.trim()) return;
    const from = cwd ? `${cwd}/${renameTarget.name}` : renameTarget.name;
    const to = cwd ? `${cwd}/${renameTo}` : renameTo;
    try {
      await api.fs.rename(deploymentId, from, to);
      toast('Renamed', 'success');
      setRenameTarget(null);
      setRenameTo('');
      listDir(cwd);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  }

  // ── Breadcrumbs ────────────────────────────────────────────────────────────
  const breadcrumbs = ['/', ...cwd.split('/').filter(Boolean)];

  function navToBreadcrumb(index: number) {
    const path = index === 0 ? '' : cwd.split('/').filter(Boolean).slice(0, index).join('/');
    listDir(path);
    setOpenFile(null);
  }

  // ── Key shortcuts ──────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && openFile) {
        e.preventDefault();
        saveFile();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="File Manager"
        description={`Editing deployment workspace: ${deploymentId}`}
        action={
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            ← Back
          </Button>
        }
      />

      <div className="flex gap-3 h-[calc(100vh-14rem)] min-h-[500px]">
        {/* ── Left: file tree ── */}
        <div className="w-60 shrink-0 flex flex-col gap-2">
          {/* Toolbar */}
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              title="New file"
              onClick={() => { setNewNameModal('file'); setNewName(''); }}
            >
              + File
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="New folder"
              onClick={() => { setNewNameModal('dir'); setNewName(''); }}
            >
              + Folder
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Refresh"
              onClick={() => listDir(cwd)}
            >
              ↻
            </Button>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-0.5 text-[10px] text-text-muted flex-wrap">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-0.5">
                {i > 0 && <span className="text-text-faint">/</span>}
                <button
                  onClick={() => navToBreadcrumb(i)}
                  className="hover:text-accent-violet-light transition-colors"
                >
                  {crumb}
                </button>
              </span>
            ))}
          </div>

          {/* File list */}
          <Card className="flex-1 overflow-y-auto p-2 border border-white/[0.06] space-y-0.5">
            {cwd && (
              <button
                onClick={() => {
                  const parent = cwd.includes('/')
                    ? cwd.split('/').slice(0, -1).join('/')
                    : '';
                  listDir(parent);
                }}
                className="w-full text-left text-xs px-2 py-1.5 rounded-lg text-text-faint hover:bg-white/[0.04] hover:text-text-muted transition-colors"
              >
                ../
              </button>
            )}

            {loading && <Spinner label="Loading…" />}
            {error && <ErrorBanner message={error} />}
            {!loading && items.length === 0 && (
              <p className="text-xs text-text-faint px-2 py-4 text-center">Empty directory</p>
            )}

            {items.map((item) => {
              const filePath = cwd ? `${cwd}/${item.name}` : item.name;
              const isActive = openFile === filePath;
              return (
                <div
                  key={item.name}
                  className={`group flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition-all ${
                    isActive
                      ? 'bg-white/[0.08] text-text-primary'
                      : 'text-text-muted hover:bg-white/[0.04] hover:text-text-primary'
                  }`}
                  onClick={() => openFileInEditor(item)}
                >
                  <span className="shrink-0 text-[12px]">
                    {item.type === 'dir' ? '📁' : getFileIcon(item.name)}
                  </span>
                  <span className="text-xs truncate flex-1 font-mono">{item.name}</span>
                  {item.size !== null && (
                    <span className="text-[10px] text-text-faint shrink-0">
                      {formatBytes(item.size)}
                    </span>
                  )}
                  {/* Context actions */}
                  <div className="hidden group-hover:flex gap-0.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameTarget(item);
                        setRenameTo(item.name);
                      }}
                      className="text-[10px] px-1 py-0.5 rounded hover:bg-white/[0.08] text-text-faint hover:text-text-muted"
                      title="Rename"
                    >
                      ✏
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                      className="text-[10px] px-1 py-0.5 rounded hover:bg-red-500/20 text-text-faint hover:text-red-400"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>

        {/* ── Right: editor ── */}
        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          {openFile ? (
            <>
              {/* Editor tab bar */}
              <div className="flex items-center justify-between glass rounded-xl px-4 py-2 border border-white/[0.06] shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{getFileIcon(openFile)}</span>
                  <span className="font-mono text-xs text-text-primary">{openFile}</span>
                  {isDirty && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full">
                      unsaved
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <span className="text-[10px] text-text-faint">
                    {getLang(openFile)}
                  </span>
                  <Button
                    size="sm"
                    loading={saving}
                    disabled={!isDirty || saving}
                    onClick={saveFile}
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenFile(null)}
                  >
                    ✕
                  </Button>
                </div>
              </div>

              {/* Editor textarea */}
              <div className="flex-1 overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="w-full h-full bg-transparent font-mono text-xs text-text-primary p-4 resize-none focus:outline-none leading-relaxed"
                  spellCheck={false}
                />
              </div>

              <p className="text-[10px] text-text-faint shrink-0">
                Press <kbd className="bg-white/10 px-1 rounded">Ctrl+S</kbd> to save ·{' '}
                {fileContent.split('\n').length} lines · {fileContent.length} chars
              </p>
            </>
          ) : (
            <Card className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/[0.08] text-center">
              <div className="text-4xl mb-4">📝</div>
              <p className="text-sm font-medium text-text-primary">No file open</p>
              <p className="text-xs text-text-muted mt-1">
                Click any file in the tree to open it in the editor.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* New file/dir modal */}
      <Modal
        open={newNameModal !== null}
        onClose={() => setNewNameModal(null)}
        title={newNameModal === 'dir' ? 'New Folder' : 'New File'}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
          className="space-y-4"
        >
          <Input
            label={newNameModal === 'dir' ? 'Folder name' : 'File name'}
            placeholder={newNameModal === 'dir' ? 'my-folder' : 'index.js'}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            autoFocus
          />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" type="button" onClick={() => setNewNameModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newName.trim()}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rename modal */}
      <Modal
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title={`Rename "${renameTarget?.name}"`}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); handleRename(); }}
          className="space-y-4"
        >
          <Input
            label="New name"
            value={renameTo}
            onChange={(e) => setRenameTo(e.target.value)}
            required
            autoFocus
          />
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" type="button" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button type="submit">Rename</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete"
      >
        <p className="text-sm text-text-muted mb-6">
          Delete <code className="font-mono text-text-primary">{deleteTarget?.name}</code>
          {deleteTarget?.type === 'dir' ? ' and all its contents' : ''}? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    js: '🟨', ts: '🔷', tsx: '⚛', jsx: '⚛', json: '📋',
    md: '📄', py: '🐍', sh: '⚙', env: '🔑', dockerfile: '🐳',
    html: '🌐', css: '🎨', sql: '🗄', txt: '📝', yml: '⚙', yaml: '⚙',
    png: '🖼', jpg: '🖼', gif: '🖼', svg: '🎭', ico: '🖼',
    pdf: '📕', zip: '📦', tar: '📦',
  };
  return map[ext] ?? '📄';
}
