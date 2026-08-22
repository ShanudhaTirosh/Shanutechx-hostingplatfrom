'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Spinner, useToast } from '@/components/ui';

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
        // If DB has no env vars set yet, attempt auto-load from repo .env / .env.example
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

  if (loading) return <Spinner label="Loading environment variables..." />;

  return (
    <div className="space-y-5">
      {/* Info Banner & Repository Sync Action */}
      <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="text-sm">🔐</span>
          <span>Environment variables are stored securely in platform DB (encrypted with AES-256).</span>
        </div>
        <Button size="sm" variant="secondary" onClick={fetchFromRepo} loading={fetchingFromRepo}>
          📥 Import Defaults from Repo (.env)
        </Button>
      </div>

      {isRunning && (
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2">
          <span className="text-base leading-none">ℹ️</span>
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
            No environment variables set yet. Click "Import Defaults from Repo" or "+ Add Variable" below.
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
                className="absolute right-2 text-text-faint hover:text-white transition-colors text-[10px]"
              >
                {row.masked ? '👁' : '🙈'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleRemoveRow(i)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors text-xs"
            >
              ✕
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
