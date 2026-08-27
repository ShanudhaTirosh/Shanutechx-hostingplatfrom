'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { Button, Spinner, Modal, useToast } from '@/components/ui';

interface Props {
  deploymentId: string;
  /** If true, shows a banner explaining changes will trigger a live rebuild */
  isRunning?: boolean;
}

export function EnvVarsPanel({ deploymentId, isRunning }: Props) {
  const [loading, setLoading] = useState(true);
  const [fetchingFromRepo, setFetchingFromRepo] = useState(false);
  const [rows, setRows] = useState<Array<{ key: string; value: string; masked: boolean }>>([]);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const { toast } = useToast();

  function parseEnvString(envText: string): Array<{ key: string; value: string; masked: boolean }> {
    const lines = envText.split('\n');
    const parsedRows: Array<{ key: string; value: string; masked: boolean }> = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        let value = trimmed.substring(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        parsedRows.push({ key, value, masked: true });
      }
    }
    return parsedRows;
  }

  async function fetchFromRepo() {
    setFetchingFromRepo(true);
    try {
      let content = '';
      try {
        const res = await api.fs.read(deploymentId, '.env');
        content = res.content;
      } catch {
        const res = await api.fs.read(deploymentId, '.env.example');
        content = res.content;
      }

      const parsed = parseEnvString(content);
      if (parsed.length === 0) {
        toast('No .env or .env.example file found in workspace root.', 'info');
      } else {
        // Merge with existing rows without overwriting
        setRows((prev) => {
          const existingKeys = new Set(prev.map((r) => r.key));
          const newRows = parsed.filter((p) => !existingKeys.has(p.key));
          return [...prev, ...newRows];
        });
        toast(`Loaded ${parsed.length} variables from repository!`, 'success');
      }
    } catch (err: any) {
      toast(err.message || 'Could not fetch env from repo workspace', 'error');
    } finally {
      setFetchingFromRepo(false);
    }
  }

  async function loadEnv() {
    setLoading(true);
    try {
      const data = await api.deployments.get(deploymentId);
      if (data.envVars && Object.keys(data.envVars).length > 0) {
        setRows(
          Object.entries(data.envVars).map(([key, value]) => ({ key, value, masked: true }))
        );
      } else {
        setRows([]);
        fetchFromRepo();
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEnv(); }, [deploymentId]);

  function handleAddRow() {
    setRows((prev) => [...prev, { key: '', value: '', masked: false }]);
  }

  function handleUpdateRow(i: number, field: 'key' | 'value', val: string) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: val, masked: false } : r));
  }

  function handleRemoveRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleApplyBulkPaste() {
    const parsed = parseEnvString(bulkText);
    if (parsed.length === 0) {
      toast('No valid KEY=VALUE pairs found in text.', 'error');
      return;
    }

    setRows((prev) => {
      const existingKeys = new Set(prev.map((r) => r.key));
      const updated = [...prev];
      for (const item of parsed) {
        if (existingKeys.has(item.key)) {
          const idx = updated.findIndex((r) => r.key === item.key);
          if (idx >= 0) updated[idx] = { ...updated[idx], value: item.value };
        } else {
          updated.push(item);
        }
      }
      return updated;
    });

    toast(`Applied ${parsed.length} variables!`, 'success');
    setShowBulkPasteModal(false);
    setBulkText('');
  }

  function handleDownloadEnvFile() {
    const envContent = rows
      .filter((r) => r.key.trim())
      .map((r) => `${r.key.trim()}=${r.value.includes(' ') ? `"${r.value}"` : r.value}`)
      .join('\n');

    const blob = new Blob([envContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `.env`;
    a.click();
    URL.revokeObjectURL(url);
    toast('.env file downloaded!', 'success');
  }

  async function handleSave() {
    const keys = rows.map((r) => r.key.trim()).filter(Boolean);
    if (new Set(keys).size !== keys.length) {
      toast('Duplicate variable keys found — each key must be unique.', 'error');
      return;
    }
    const envVars = Object.fromEntries(rows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value]));
    if (Object.keys(envVars).length === 0) {
      toast('Add at least one environment variable before saving.', 'error');
      return;
    }

    setSaving(true);
    setLog([]);
    setShowLog(false);
    try {
      await api.deployments.updateEnv(deploymentId, envVars, (event) => {
        const msg = event.message;
        if (event.phase === 'error') {
          if (msg) setLog((prev) => [...prev, `[ERROR] ${msg}`]);
          setShowLog(true);
        } else {
          if (msg) setLog((prev) => [...prev, msg]);
        }
        if (event.phase !== 'heartbeat') setShowLog(true);
      });
      toast(isRunning ? 'Environment variables updated & deployment restarted!' : 'Environment variables saved.', 'success');
      loadEnv();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseEnvString(text);
      if (parsed.length === 0) {
        toast(`No valid KEY=VALUE pairs found in ${file.name}.`, 'error');
        return;
      }

      setRows((prev) => {
        const existingKeys = new Set(prev.map((r) => r.key));
        const updated = [...prev];
        for (const item of parsed) {
          if (existingKeys.has(item.key)) {
            const idx = updated.findIndex((r) => r.key === item.key);
            if (idx >= 0) updated[idx] = { ...updated[idx], value: item.value };
          } else {
            updated.push(item);
          }
        }
        return updated;
      });

      toast(`Imported ${parsed.length} variables from ${file.name}!`, 'success');
    } catch (err: any) {
      toast(`Failed to read file: ${err.message}`, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (loading) return <Spinner label="Loading environment variables..." />;

  return (
    <div className="space-y-5">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".env,.env.*,.txt,.config"
        className="hidden"
      />

      {/* Info Banner & Repository Sync Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 002-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Environment variables are encrypted at rest via AES-256 GCM.</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload .env File
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowBulkPasteModal(true)}>
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Bulk Paste .env
          </Button>
          <Button size="sm" variant="secondary" onClick={handleDownloadEnvFile} disabled={rows.length === 0}>
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export .env
          </Button>
          <Button size="sm" variant="secondary" onClick={fetchFromRepo} loading={fetchingFromRepo}>
            Import Repo Defaults
          </Button>
        </div>
      </div>

      {isRunning && (
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Saving will automatically restart the running container to apply your changes.</span>
        </div>
      )}

      {/* Variable Table */}
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Variable Name</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Value</span>
          <span className="w-8" />
        </div>

        {rows.length === 0 && (
          <p className="text-xs text-text-faint py-4 text-center border border-dashed border-white/10 rounded-xl">
            No environment variables set yet. Click "Bulk Paste .env" or "+ Add Variable" below.
          </p>
        )}

        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <input
              type="text"
              value={row.key}
              onChange={(e) => handleUpdateRow(i, 'key', e.target.value)}
              placeholder="VARIABLE_NAME"
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-faint focus:outline-none focus:border-accent-violet transition-all"
            />
            <div className="relative flex items-center">
              <input
                type={row.masked ? 'password' : 'text'}
                value={row.value}
                onChange={(e) => handleUpdateRow(i, 'value', e.target.value)}
                placeholder="value"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-faint focus:outline-none focus:border-accent-violet transition-all pr-8"
              />
              <button
                type="button"
                onClick={() => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, masked: !r.masked } : r))}
                className="absolute right-2 text-text-faint hover:text-white transition-colors p-1"
                title={row.masked ? 'Reveal value' : 'Hide value'}
              >
                {row.masked ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a8.98 8.98 0 013.682-.787c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18" />
                  </svg>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleRemoveRow(i)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors text-xs"
              title="Remove variable"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button size="sm" variant="secondary" onClick={handleAddRow}>
          + Add Variable
        </Button>
        <Button size="sm" loading={saving} onClick={handleSave} className="bg-brand-gradient">
          {isRunning ? 'Save & Restart Deployment' : 'Save Variables'}
        </Button>
      </div>

      {/* Bulk Paste Modal */}
      {showBulkPasteModal && (
        <Modal open={true} onClose={() => setShowBulkPasteModal(false)} title="Bulk Paste .env File Content" width="max-w-2xl">
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Paste raw <code className="text-indigo-400 font-mono">KEY=VALUE</code> lines below. Existing keys will be updated with new values.
            </p>
            <textarea
              rows={10}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`PORT=3000\nDATABASE_URL=postgresql://user:pass@host:5432/db\nAPI_KEY="sk_live_sample"`}
              className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:border-accent-violet placeholder:text-text-faint"
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button size="sm" variant="ghost" onClick={() => setShowBulkPasteModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApplyBulkPaste}>
                Apply Variables
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rebuild/Restart Live Log */}
      {showLog && log.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            {isRunning ? 'Rebuild Log (Applying env changes)' : 'Update Log'}
          </p>
          <pre className="bg-black/70 border border-white/[0.05] rounded-xl p-3 text-xs font-mono text-emerald-400 max-h-64 overflow-y-auto whitespace-pre-wrap">
            {log.join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
}
