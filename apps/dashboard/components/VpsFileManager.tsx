'use client';

import React, { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Button, Card, Spinner, useToast, ConfirmDialog } from '@/components/ui';
import {
  IconFolder,
  IconFile,
  IconZip,
  IconCode,
  IconImage,
  IconUp,
  IconRefresh,
  IconUpload,
  IconDownload,
  IconSearch,
  IconPlus,
  IconEdit,
  IconTrash,
  IconClose,
  IconSave,
} from '@/components/Icons';

interface SftpItem {
  name: string;
  size: number;
  isDirectory: boolean;
  modifyTime: number;
  permissions: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  item: SftpItem;
}

export function VpsFileManager({ provisionId }: { provisionId: string }) {
  const [currentPath, setCurrentPath] = useState<string>('/root');
  const [items, setItems] = useState<SftpItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Modals state
  const [editFile, setEditFile] = useState<{ path: string; name: string; content: string } | null>(null);
  const [renameItem, setRenameItem] = useState<{ item: SftpItem; newName: string } | null>(null);
  const [mkdirModal, setMkdirModal] = useState<boolean>(false);
  const [newDirName, setNewDirName] = useState<string>('');
  const [touchModal, setTouchModal] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');
  const [extractTarget, setExtractTarget] = useState<SftpItem | null>(null);
  const [extractDir, setExtractDir] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<SftpItem | null>(null);
  const [uploadModal, setUploadModal] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function loadPath(path: string) {
    setLoading(true);
    setContextMenu(null);
    api.vps
      .sftpList(provisionId, path)
      .then((data) => {
        setCurrentPath(data.path);
        // Sort directories first, then alphabetical
        const sorted = (data.items || []).sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
        setItems(sorted);
      })
      .catch((err) => {
        toast(`SFTP Error: ${err.message}`, 'error');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPath(currentPath);
  }, [provisionId]);

  // Close context menu on global click
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  function navigateTo(folderName: string) {
    const targetPath = currentPath.endsWith('/') ? `${currentPath}${folderName}` : `${currentPath}/${folderName}`;
    loadPath(targetPath);
  }

  function goUp() {
    if (currentPath === '/' || currentPath === '') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = '/' + parts.join('/');
    loadPath(parentPath || '/');
  }

  function formatSize(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(mtime: number) {
    if (!mtime) return '—';
    return new Date(mtime * 1000).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function renderFileIcon(item: SftpItem) {
    if (item.isDirectory) return <IconFolder size={16} className="text-amber-400" />;
    const name = item.name.toLowerCase();
    if (name.endsWith('.zip') || name.endsWith('.tar') || name.endsWith('.gz') || name.endsWith('.tgz')) return <IconZip size={16} className="text-purple-400" />;
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.svg') || name.endsWith('.webp')) return <IconImage size={16} className="text-emerald-400" />;
    if (name.endsWith('.json') || name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.py') || name.endsWith('.sh') || name.endsWith('.html') || name.endsWith('.css') || name.endsWith('.env')) return <IconCode size={16} className="text-cyan-400" />;
    return <IconFile size={16} className="text-text-muted" />;
  }

  function isArchive(name: string) {
    const lower = name.toLowerCase();
    return lower.endsWith('.zip') || lower.endsWith('.tar') || lower.endsWith('.gz') || lower.endsWith('.tgz') || lower.endsWith('.tar.gz');
  }

  function handleContextMenu(e: React.MouseEvent, item: SftpItem) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
    });
  }

  async function handleOpenFile(item: SftpItem) {
    if (item.isDirectory) {
      navigateTo(item.name);
      return;
    }
    const fullPath = `${currentPath}/${item.name}`.replace(/\/+/g, '/');
    setBusy(true);
    try {
      const data = await api.vps.sftpReadFile(provisionId, fullPath);
      setEditFile({ path: fullPath, name: item.name, content: data.content });
    } catch (err: any) {
      toast(`Cannot open file: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveFile() {
    if (!editFile) return;
    setBusy(true);
    try {
      await api.vps.sftpSaveFile(provisionId, editFile.path, editFile.content);
      toast('File saved successfully over SFTP', 'success');
      setEditFile(null);
      loadPath(currentPath);
    } catch (err: any) {
      toast(`Save error: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleMkdir() {
    if (!newDirName.trim()) return;
    const targetPath = `${currentPath}/${newDirName.trim()}`.replace(/\/+/g, '/');
    setBusy(true);
    try {
      await api.vps.sftpMkdir(provisionId, targetPath);
      toast(`Folder created: ${newDirName}`, 'success');
      setNewDirName('');
      setMkdirModal(false);
      loadPath(currentPath);
    } catch (err: any) {
      toast(`Mkdir error: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleTouch() {
    if (!newFileName.trim()) return;
    const targetPath = `${currentPath}/${newFileName.trim()}`.replace(/\/+/g, '/');
    setBusy(true);
    try {
      await api.vps.sftpTouch(provisionId, targetPath);
      toast(`File created: ${newFileName}`, 'success');
      setNewFileName('');
      setTouchModal(false);
      loadPath(currentPath);
    } catch (err: any) {
      toast(`Touch error: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    if (!renameItem || !renameItem.newName.trim()) return;
    const oldPath = `${currentPath}/${renameItem.item.name}`.replace(/\/+/g, '/');
    const newPath = `${currentPath}/${renameItem.newName.trim()}`.replace(/\/+/g, '/');
    setBusy(true);
    try {
      await api.vps.sftpRename(provisionId, oldPath, newPath);
      toast('Renamed successfully', 'success');
      setRenameItem(null);
      loadPath(currentPath);
    } catch (err: any) {
      toast(`Rename error: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleExtract() {
    if (!extractTarget) return;
    const archivePath = `${currentPath}/${extractTarget.name}`.replace(/\/+/g, '/');
    const targetDir = extractDir.trim() || currentPath;
    setBusy(true);
    try {
      const res = await api.vps.sftpExtract(provisionId, archivePath, targetDir);
      toast(res.message, 'success');
      setExtractTarget(null);
      setExtractDir('');
      loadPath(currentPath);
    } catch (err: any) {
      toast(`Extract error: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const targetPath = `${currentPath}/${deleteTarget.name}`.replace(/\/+/g, '/');
    setBusy(true);
    try {
      await api.vps.sftpDelete(provisionId, targetPath, deleteTarget.isDirectory);
      toast(`${deleteTarget.name} deleted`, 'success');
      setDeleteTarget(null);
      loadPath(currentPath);
    } catch (err: any) {
      toast(`Delete error: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload() {
    if (!uploadFile) return;
    const remotePath = `${currentPath}/${uploadFile.name}`.replace(/\/+/g, '/');
    setBusy(true);
    try {
      await api.vps.sftpUpload(provisionId, remotePath, uploadFile);
      toast(`Uploaded ${uploadFile.name} successfully`, 'success');
      setUploadFile(null);
      setUploadModal(false);
      loadPath(currentPath);
    } catch (err: any) {
      toast(`Upload error: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  // Breadcrumbs calculation
  const pathParts = currentPath.split('/').filter(Boolean);

  const filteredItems = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card className="border border-white/10 bg-black/40 space-y-4 shadow-xl" data-allow-contextmenu="true">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={goUp} disabled={currentPath === '/' || busy} className="flex items-center gap-1.5">
            <IconUp size={14} /> Up
          </Button>
          <Button size="sm" variant="secondary" onClick={() => loadPath(currentPath)} disabled={busy} className="flex items-center gap-1.5">
            <IconRefresh size={14} /> Refresh
          </Button>
          <Button size="sm" variant="primary" onClick={() => setTouchModal(true)} className="flex items-center gap-1.5">
            <IconPlus size={14} /> File
          </Button>
          <Button size="sm" variant="primary" onClick={() => setMkdirModal(true)} className="flex items-center gap-1.5">
            <IconFolder size={14} /> Folder
          </Button>
          <Button size="sm" variant="primary" onClick={() => setUploadModal(true)} className="flex items-center gap-1.5">
            <IconUpload size={14} /> Upload
          </Button>
        </div>

        <div className="w-full sm:w-48 relative">
          <input
            type="text"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-text-muted focus:outline-none focus:border-accent-teal"
          />
          <IconSearch size={14} className="absolute left-2.5 top-2.5 text-text-muted" />
        </div>
      </div>

      {/* Path Breadcrumbs Bar */}
      <div className="flex items-center gap-1.5 text-xs font-mono bg-white/5 px-3 py-2 rounded-xl overflow-x-auto border border-white/5">
        <span className="text-text-muted">Path:</span>
        <button
          onClick={() => loadPath('/')}
          className="hover:text-accent-teal text-white font-bold transition-colors"
        >
          /
        </button>
        {pathParts.map((part, idx) => {
          const buildPath = '/' + pathParts.slice(0, idx + 1).join('/');
          return (
            <React.Fragment key={buildPath}>
              <span className="text-text-muted">/</span>
              <button
                onClick={() => loadPath(buildPath)}
                className="hover:text-accent-teal text-white transition-colors"
              >
                {part}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Main File Table */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <Spinner label="Reading remote directory over SFTP..." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-text-muted uppercase font-semibold text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Size</th>
                <th className="py-2.5 px-3">Modified</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-text-muted italic">
                    {search ? 'No files match search' : 'Directory is empty'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.name}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                    onDoubleClick={() => handleOpenFile(item)}
                  >
                    <td className="py-2.5 px-3 font-medium text-white flex items-center gap-2 select-none">
                      <span className="select-none flex items-center justify-center">{renderFileIcon(item)}</span>
                      <button
                        onClick={() => handleOpenFile(item)}
                        className="hover:underline hover:text-accent-teal text-left truncate max-w-xs sm:max-w-md font-mono"
                      >
                        {item.name}
                      </button>
                      {isArchive(item.name) && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono">
                          Archive
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-text-muted">{item.isDirectory ? '—' : formatSize(item.size)}</td>
                    <td className="py-2.5 px-3 text-text-muted font-mono text-[11px]">{formatDate(item.modifyTime)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                        {item.isDirectory ? (
                          <Button size="sm" variant="ghost" onClick={() => navigateTo(item.name)} className="flex items-center gap-1">
                            <IconFolder size={13} /> Open
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleOpenFile(item)} className="flex items-center gap-1">
                              <IconEdit size={13} /> Edit
                            </Button>
                            <a
                              href={api.vps.sftpDownloadUrl(provisionId, `${currentPath}/${item.name}`.replace(/\/+/g, '/'))}
                              download
                              className="p-1.5 text-xs bg-white/5 hover:bg-white/10 rounded-md text-text-muted hover:text-white transition-colors flex items-center justify-center"
                              title="Download file"
                            >
                              <IconDownload size={13} />
                            </a>
                          </>
                        )}
                        {isArchive(item.name) && (
                          <Button size="sm" variant="secondary" onClick={() => setExtractTarget(item)} className="flex items-center gap-1">
                            <IconZip size={13} /> Unzip
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRenameItem({ item, newName: item.name })}
                          title="Rename"
                          className="px-2"
                        >
                          <IconEdit size={13} />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteTarget(item)}
                          title="Delete"
                          className="px-2"
                        >
                          <IconTrash size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating Custom Right-Click Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-neutral-900 border border-white/20 shadow-2xl rounded-xl py-1.5 w-48 text-xs font-medium text-white space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-white/10 text-[10px] text-text-muted font-mono truncate flex items-center gap-2">
            {renderFileIcon(contextMenu.item)} {contextMenu.item.name}
          </div>

          {contextMenu.item.isDirectory ? (
            <button
              onClick={() => {
                navigateTo(contextMenu.item.name);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2"
            >
              <IconFolder size={14} /> Open Folder
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  handleOpenFile(contextMenu.item);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2"
              >
                <IconEdit size={14} /> View / Edit File
              </button>
              <a
                href={api.vps.sftpDownloadUrl(provisionId, `${currentPath}/${contextMenu.item.name}`.replace(/\/+/g, '/'))}
                download
                onClick={() => setContextMenu(null)}
                className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2 block"
              >
                <IconDownload size={14} /> Download File
              </a>
            </>
          )}

          {isArchive(contextMenu.item.name) && (
            <button
              onClick={() => {
                setExtractTarget(contextMenu.item);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-amber-500/20 text-amber-300 flex items-center gap-2"
            >
              <IconZip size={14} /> Unzip Archive
            </button>
          )}

          <button
            onClick={() => {
              setRenameItem({ item: contextMenu.item, newName: contextMenu.item.name });
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center gap-2"
          >
            <IconEdit size={14} /> Rename
          </button>

          <button
            onClick={() => {
              setDeleteTarget(contextMenu.item);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-red-500/20 text-red-400 flex items-center gap-2"
          >
            <IconTrash size={14} /> Delete
          </button>
        </div>
      )}

      {/* Online Text File Editor Modal */}
      {editFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-4xl w-full border border-white/20 bg-neutral-900 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <IconCode size={16} className="text-cyan-400" /> Editing: <span className="font-mono text-accent-teal">{editFile.name}</span>
                </h3>
                <p className="text-[11px] text-text-muted font-mono">{editFile.path}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditFile(null)} className="flex items-center gap-1">
                <IconClose size={14} /> Close
              </Button>
            </div>

            <textarea
              value={editFile.content}
              onChange={(e) => setEditFile({ ...editFile, content: e.target.value })}
              className="flex-1 w-full bg-black/60 border border-white/10 rounded-xl p-4 font-mono text-xs text-white leading-relaxed focus:outline-none focus:border-accent-teal min-h-[400px] resize-y"
              spellCheck={false}
            />

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-text-muted font-mono">
                Length: {editFile.content.length} chars | Lines: {editFile.content.split('\n').length}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditFile(null)}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={handleSaveFile} loading={busy} className="flex items-center gap-1.5">
                  <IconSave size={14} /> Save Changes
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Rename Modal */}
      {renameItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-sm w-full border border-white/20 bg-neutral-900 space-y-4">
            <h3 className="text-sm font-bold text-white">Rename Item</h3>
            <input
              type="text"
              value={renameItem.newName}
              onChange={(e) => setRenameItem({ ...renameItem, newName: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-accent-teal"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setRenameItem(null)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleRename} loading={busy}>
                Rename
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Create Folder Modal */}
      {mkdirModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-sm w-full border border-white/20 bg-neutral-900 space-y-4">
            <h3 className="text-sm font-bold text-white">Create New Folder</h3>
            <input
              type="text"
              placeholder="Folder name (e.g. my-app)"
              value={newDirName}
              onChange={(e) => setNewDirName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-accent-teal"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setMkdirModal(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleMkdir} loading={busy}>
                Create Folder
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Create File Modal */}
      {touchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-sm w-full border border-white/20 bg-neutral-900 space-y-4">
            <h3 className="text-sm font-bold text-white">Create New File</h3>
            <input
              type="text"
              placeholder="File name (e.g. index.js)"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-accent-teal"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setTouchModal(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleTouch} loading={busy}>
                Create File
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Extract Archive Modal */}
      {extractTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full border border-white/20 bg-neutral-900 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <IconZip size={16} className="text-amber-300" /> Unzip Archive: <span className="font-mono text-amber-300">{extractTarget.name}</span>
            </h3>
            <p className="text-xs text-text-muted">
              Specify the target extraction directory on your remote VPS:
            </p>
            <input
              type="text"
              placeholder={`Target directory (default: ${currentPath})`}
              value={extractDir}
              onChange={(e) => setExtractDir(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-accent-teal font-mono"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setExtractTarget(null)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleExtract} loading={busy}>
                Confirm Unzip
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Upload File Modal */}
      {uploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full border border-white/20 bg-neutral-900 space-y-4">
            <h3 className="text-sm font-bold text-white">Upload File to Remote VPS</h3>
            <p className="text-xs text-text-muted">Target Directory: <span className="font-mono text-white">{currentPath}</span></p>

            <div
              className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer hover:border-accent-teal transition-colors flex flex-col items-center justify-center"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              <IconUpload size={32} className="text-text-muted mb-2" />
              {uploadFile ? (
                <p className="text-xs font-mono text-emerald-300 font-bold">{uploadFile.name} ({formatSize(uploadFile.size)})</p>
              ) : (
                <p className="text-xs text-text-muted">Click to browse or drag file here to upload via SFTP</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setUploadModal(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleUpload} disabled={!uploadFile} loading={busy}>
                Upload File
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Item"
        message={`Are you sure you want to delete '${deleteTarget?.name}'? ${deleteTarget?.isDirectory ? 'All nested directory contents will be erased.' : ''}`}
        confirmLabel="Delete Item"
        danger
      />
    </Card>
  );
}
