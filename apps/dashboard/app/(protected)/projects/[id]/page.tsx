'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import { api } from '@/lib/api';
import { Project, ProjectTable, SqlResult } from '@/lib/types';
import { Clock, XCircle, Edit2, X } from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Spinner,
  ErrorBanner,
  EmptyState,
  Input,
  PageHeader,
  Tabs,
  useToast,
  Modal,
} from '@/components/ui';
import { CreateTablePanel, PG_TYPES } from '@/components/CreateTablePanel';
import { useAppUser } from '@/lib/AppUserContext';

export const dynamic = 'force-dynamic';

type TabId = 'table-editor' | 'sql-runner' | 'connection';

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { apiUser } = useAppUser();
  const isStaff = apiUser?.role === 'admin' || apiUser?.role === 'dev';
  const [project, setProject] = useState<Project | null>(null);
  const [tables, setTables] = useState<ProjectTable[]>([]);
  const [activeTab, setActiveTab] = useState<string>('table-editor');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const TABS = [
    { label: 'Table Editor', value: 'table-editor' },
    { label: 'SQL Runner', value: 'sql-runner' },
    { label: 'Connection Info', value: 'connection' },
    ...(isStaff ? [{ label: 'Storage', value: 'storage' }, { label: 'Auth', value: 'auth' }] : []),
  ];

  const load = useCallback(() => {
    api.projects
      .get(params.id)
      .then((d) => setProject(d.project))
      .catch((e) => setError(e.message));
  }, [params.id]);

  const loadTables = useCallback(() => {
    if (!project || project.status !== 'running') return;
    api.projects
      .tables(params.id)
      .then((d) => {
        setTables(d.tables);
        if (!selectedTable && d.tables.length > 0) setSelectedTable(d.tables[0].name);
      })
      .catch((e) => console.warn('Table load error', e));
  }, [params.id, project, selectedTable]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadTables(); }, [loadTables]);

  if (error) return <ErrorBanner message={error} />;
  if (!project) return <Spinner label="Loading project…" />;

  const statusColor: Record<string, string> = {
    running: 'text-emerald-400',
    pending: 'text-amber-400',
    failed: 'text-red-400',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={project.name}
        description={
          <span className={`text-sm font-medium ${statusColor[project.status] ?? 'text-text-muted'}`}>
            {project.status === 'running'
              ? '● Online'
              : project.status === 'pending'
              ? <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-400" /> Provisioning…</span>
              : <span className="inline-flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-red-400" /> Failed</span>}
          </span>
        }
        action={
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            ← Back
          </Button>
        }
      />

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'table-editor' && (
        <TableEditorPanel
          projectId={params.id}
          tables={tables}
          selectedTable={selectedTable}
          onSelectTable={setSelectedTable}
          onReloadTables={loadTables}
          projectRunning={project.status === 'running'}
        />
      )}
      {activeTab === 'sql-runner' && (
        <SqlRunnerPanel projectId={params.id} projectRunning={project.status === 'running'} />
      )}
      {activeTab === 'connection' && (
        <ConnectionPanel project={project} />
      )}
      {activeTab === 'storage' && isStaff && (
        <StoragePanel project={project} onProvisioned={load} />
      )}
      {activeTab === 'auth' && isStaff && (
        <AuthPanel project={project} />
      )}
    </div>
  );
}

// ── Auth-as-a-Service (dev/admin only) ───────────────────────────────────────

const OAUTH_PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  discord: 'Discord',
};

function AuthPanel({ project }: { project: Project }) {
  const [users, setUsers] = useState<Array<{ id: string; email: string; emailVerified: boolean; createdAt: string; lastLoginAt: string | null }> | null>(null);
  const [configs, setConfigs] = useState<Array<{ id: string; provider: string; clientId: string; redirectUri: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [provider, setProvider] = useState<'google' | 'github' | 'discord'>('google');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api.projects.authUsers(project.id).then((d) => setUsers(d.users)).catch((e) => setError(e.message));
    api.projects.oauthConfigs(project.id).then((d) => setConfigs(d.configs)).catch((e) => setError(e.message));
  }

  useEffect(load, [project.id]);

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.projects.saveOAuthConfig(project.id, { provider, clientId, clientSecret, redirectUri });
      toast(`${OAUTH_PROVIDER_LABELS[provider]} OAuth configured`, 'success');
      setConfigModalOpen(false);
      setClientId('');
      setClientSecret('');
      setRedirectUri('');
      load();
    } catch (err: any) {
      toast(err.message || 'Failed to save OAuth config', 'error');
    } finally {
      setBusy(false);
    }
  }

  const apiBase = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000') : '';

  return (
    <div className="space-y-6">
      {error && <ErrorBanner message={error} />}

      <Card className="border border-white/[0.06]">
        <h3 className="font-semibold text-text-primary text-sm mb-1">Auth Endpoints</h3>
        <p className="text-xs text-text-muted mb-3">
          Point your project's own frontend/backend at these — email/password, magic links, and
          OAuth all issue the same kind of JWT (verify with GET .../auth/me).
        </p>
        <div className="space-y-1.5 font-mono text-[11px] text-text-faint">
          <p>POST {apiBase}/api/projects/{project.id}/auth/signup</p>
          <p>POST {apiBase}/api/projects/{project.id}/auth/login</p>
          <p>POST {apiBase}/api/projects/{project.id}/auth/magic-link</p>
          <p>POST {apiBase}/api/projects/{project.id}/auth/magic-link/verify</p>
          <p>GET  {apiBase}/api/projects/{project.id}/auth/oauth/&#123;provider&#125;/start?redirectUrl=...</p>
        </div>
      </Card>

      <Card className="border border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-text-primary text-sm">OAuth Providers</h3>
            <p className="text-xs text-text-muted">
              Register your own OAuth app with each provider first, then paste its credentials here.
            </p>
          </div>
          <Button size="sm" onClick={() => setConfigModalOpen(true)}>+ Configure Provider</Button>
        </div>

        {configs === null ? (
          <Spinner label="Loading..." />
        ) : configs.length === 0 ? (
          <p className="text-xs text-text-faint italic">No OAuth providers configured yet.</p>
        ) : (
          <div className="space-y-2">
            {configs.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-xs">
                <span className="font-medium text-text-primary">{OAUTH_PROVIDER_LABELS[c.provider] ?? c.provider}</span>
                <span className="font-mono text-text-faint truncate ml-2">{c.redirectUri}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="border border-white/[0.06]">
        <h3 className="font-semibold text-text-primary text-sm mb-3">End Users ({users?.length ?? 0})</h3>
        {users === null ? (
          <Spinner label="Loading users..." />
        ) : users.length === 0 ? (
          <EmptyState message="No end users have signed up to this project yet." />
        ) : (
          <div className="space-y-1.5">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-xs py-1.5 border-b border-white/[0.03] last:border-0">
                <span className="text-text-primary">{u.email}</span>
                <span className="text-text-faint flex items-center gap-2">
                  {u.emailVerified && <Badge status="running" />}
                  {u.lastLoginAt ? `Last login ${new Date(u.lastLoginAt).toLocaleDateString()}` : 'Never logged in'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={configModalOpen} onClose={() => setConfigModalOpen(false)} title="Configure OAuth Provider">
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as any)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent-violet/50 text-text-primary"
            >
              <option value="google" className="bg-bg">Google</option>
              <option value="github" className="bg-bg">GitHub</option>
              <option value="discord" className="bg-bg">Discord</option>
            </select>
          </div>
          <Input label="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} required />
          <Input label="Client Secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} required />
          <Input
            label="Redirect URI"
            placeholder={`${apiBase}/api/projects/${project.id}/auth/oauth/${provider}/callback`}
            value={redirectUri}
            onChange={(e) => setRedirectUri(e.target.value)}
            required
          />
          <p className="text-[11px] text-text-faint">
            Register this exact redirect URI with {OAUTH_PROVIDER_LABELS[provider]} when creating the OAuth app there.
          </p>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfigModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" loading={busy}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ── Storage (R2 bucket) — dev/admin only ─────────────────────────────────────

function StoragePanel({ project, onProvisioned }: { project: Project; onProvisioned: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleProvision() {
    setBusy(true);
    setError(null);
    try {
      await api.projects.provisionStorage(project.id);
      toast('R2 bucket provisioned for this project.', 'success');
      onProvisioned();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border border-white/[0.06] max-w-lg">
      <h3 className="font-semibold text-text-primary text-sm mb-1">Object Storage (Cloudflare R2)</h3>
      <p className="text-xs text-text-muted mb-4">
        Provision an R2 bucket dedicated to this project — useful for file uploads, exports, or
        anything this project's app needs to store outside its database.
      </p>
      {error && <div className="mb-3"><ErrorBanner message={error} /></div>}

      {project.r2BucketName ? (
        <div className="text-xs bg-black/30 rounded-lg p-3 space-y-1">
          <p>Bucket: <span className="font-mono text-text-primary">{project.r2BucketName}</span></p>
          <p className="text-text-faint">
            Already provisioned. Use the platform's R2 credentials with this bucket name from
            within your app's environment to read/write objects.
          </p>
        </div>
      ) : (
        <Button onClick={handleProvision} loading={busy} size="sm">
          Provision R2 Bucket
        </Button>
      )}
    </Card>
  );
}

// ── Table Editor ─────────────────────────────────────────────────────────────

function TableEditorPanel({
  projectId,
  tables,
  selectedTable,
  onSelectTable,
  onReloadTables,
  projectRunning,
}: {
  projectId: string;
  tables: ProjectTable[];
  selectedTable: string | null;
  onSelectTable: (t: string) => void;
  onReloadTables: () => void;
  projectRunning: boolean;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | number | null>(null);
  
  // Insert & Edit Row State
  const [insertModalOpen, setInsertModalOpen] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});
  const [editRowTarget, setEditRowTarget] = useState<Record<string, unknown> | null>(null);
  const [editRowData, setEditRowData] = useState<Record<string, string>>({});
  const [savingRow, setSavingRow] = useState(false);
  const [createTableOpen, setCreateTableOpen] = useState(false);

  // Table & Column Management States
  const [renameTableOpen, setRenameTableOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [truncateConfirmOpen, setTruncateConfirmOpen] = useState(false);
  const [dropConfirmOpen, setDropConfirmOpen] = useState(false);
  
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('text');
  const [newColNullable, setNewColNullable] = useState(true);
  const [newColDefault, setNewColDefault] = useState('');
  const [columnRenameTarget, setColumnRenameTarget] = useState<string | null>(null);
  const [columnRenameNewName, setColumnRenameNewName] = useState('');
  const [savingColumnAction, setSavingColumnAction] = useState(false);

  const { toast } = useToast();
  const LIMIT = 50;

  const table = tables.find((t) => t.name === selectedTable);
  const pkCol = table?.columns.find((c) => c.isPrimaryKey)?.name ?? 'id';

  const loadRows = useCallback(() => {
    if (!selectedTable || !projectRunning) return;
    setLoading(true);
    setError(null);
    api.projects
      .rows(projectId, selectedTable, page, LIMIT)
      .then((d) => {
        setRows(d.rows);
        setTotal(d.total ?? d.rows.length);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId, selectedTable, page, projectRunning]);

  useEffect(() => { loadRows(); }, [loadRows]);

  async function handleDeleteRow(pk: string | number) {
    try {
      await api.projects.deleteRow(projectId, selectedTable!, pk);
      toast('Row deleted', 'success');
      setDeleteTarget(null);
      loadRows();
    } catch (e: any) {
      toast(e.message || 'Delete failed', 'error');
    }
  }

  // Table Management Actions
  async function handleRenameTable(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTable || !newTableName.trim()) return;
    try {
      await api.projects.sql(projectId, `ALTER TABLE "${selectedTable}" RENAME TO "${newTableName.trim()}";`);
      toast('Table renamed successfully', 'success');
      onSelectTable(newTableName.trim());
      setRenameTableOpen(false);
      onReloadTables();
    } catch (err: any) {
      toast(err.message || 'Rename failed', 'error');
    }
  }

  async function handleTruncateTable() {
    if (!selectedTable) return;
    try {
      await api.projects.sql(projectId, `TRUNCATE TABLE "${selectedTable}" RESTART IDENTITY;`);
      toast('Table truncated successfully', 'success');
      setTruncateConfirmOpen(false);
      loadRows();
    } catch (err: any) {
      toast(err.message || 'Truncate failed', 'error');
    }
  }

  async function handleDropTable() {
    if (!selectedTable) return;
    try {
      await api.projects.sql(projectId, `DROP TABLE "${selectedTable}";`);
      toast('Table dropped successfully', 'success');
      onSelectTable('');
      setDropConfirmOpen(false);
      onReloadTables();
    } catch (err: any) {
      toast(err.message || 'Drop failed', 'error');
    }
  }

  // Column Management Actions
  async function handleAddColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTable || !newColName.trim()) return;
    setSavingColumnAction(true);
    try {
      let constraints = '';
      if (!newColNullable) constraints += ' NOT NULL';
      if (newColDefault.trim()) constraints += ` DEFAULT ${newColDefault.trim()}`;
      
      const sql = `ALTER TABLE "${selectedTable}" ADD COLUMN "${newColName.trim()}" ${newColType}${constraints};`;
      await api.projects.sql(projectId, sql);
      toast('Column added successfully', 'success');
      setNewColName('');
      setNewColDefault('');
      loadRows();
      onReloadTables();
    } catch (err: any) {
      toast(err.message || 'Failed to add column', 'error');
    } finally {
      setSavingColumnAction(false);
    }
  }

  async function handleDropColumn(colName: string) {
    if (!selectedTable) return;
    if (!confirm(`Are you sure you want to drop column "${colName}"?`)) return;
    try {
      await api.projects.sql(projectId, `ALTER TABLE "${selectedTable}" DROP COLUMN "${colName}";`);
      toast('Column dropped successfully', 'success');
      loadRows();
      onReloadTables();
    } catch (err: any) {
      toast(err.message || 'Failed to drop column', 'error');
    }
  }

  async function handleRenameColumn(oldName: string) {
    if (!selectedTable || !columnRenameNewName.trim()) return;
    try {
      await api.projects.sql(projectId, `ALTER TABLE "${selectedTable}" RENAME COLUMN "${oldName}" TO "${columnRenameNewName.trim()}";`);
      toast('Column renamed successfully', 'success');
      setColumnRenameTarget(null);
      setColumnRenameNewName('');
      loadRows();
      onReloadTables();
    } catch (err: any) {
      toast(err.message || 'Failed to rename column', 'error');
    }
  }

  // Insert Row Submit
  async function handleInsertRow(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTable) return;
    setSavingRow(true);
    try {
      const parsedData: Record<string, unknown> = {};
      table?.columns.forEach((col) => {
        const rawVal = newRowData[col.name];
        if (rawVal === undefined || rawVal === '') {
          if (col.nullable) {
            parsedData[col.name] = null;
          }
          return;
        }
        if (col.type.includes('int') || col.type.includes('numeric') || col.type.includes('real')) {
          parsedData[col.name] = Number(rawVal);
        } else if (col.type.includes('bool')) {
          parsedData[col.name] = rawVal === 'true';
        } else {
          parsedData[col.name] = rawVal;
        }
      });

      await api.projects.insertRow(projectId, selectedTable, parsedData);
      toast('Row inserted successfully', 'success');
      setInsertModalOpen(false);
      setNewRowData({});
      loadRows();
    } catch (err: any) {
      toast(err.message || 'Insert failed', 'error');
    } finally {
      setSavingRow(false);
    }
  }

  // Update Row Submit
  async function handleUpdateRow(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTable || !editRowTarget) return;
    setSavingRow(true);
    const pkVal = editRowTarget[pkCol] as string | number;
    try {
      const parsedData: Record<string, unknown> = {};
      table?.columns.forEach((col) => {
        if (col.isPrimaryKey) return;

        const rawVal = editRowData[col.name];
        if (rawVal === undefined || rawVal === '') {
          if (col.nullable) {
            parsedData[col.name] = null;
          }
          return;
        }
        if (col.type.includes('int') || col.type.includes('numeric') || col.type.includes('real')) {
          parsedData[col.name] = Number(rawVal);
        } else if (col.type.includes('bool')) {
          parsedData[col.name] = rawVal === 'true';
        } else {
          parsedData[col.name] = rawVal;
        }
      });

      await api.projects.updateRow(projectId, selectedTable, pkVal, parsedData);
      toast('Row updated successfully', 'success');
      setEditRowTarget(null);
      setEditRowData({});
      loadRows();
    } catch (err: any) {
      toast(err.message || 'Update failed', 'error');
    } finally {
      setSavingRow(false);
    }
  }

  function startEditRow(row: Record<string, unknown>) {
    setEditRowTarget(row);
    const initialData: Record<string, string> = {};
    table?.columns.forEach((col) => {
      initialData[col.name] = row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : '';
    });
    setEditRowData(initialData);
  }

  if (!projectRunning) {
    return (
      <Card className="border border-amber-500/20 bg-amber-500/[0.03] text-center py-12">
        <p className="text-amber-300 text-sm">Project must be running to use the Table Editor.</p>
      </Card>
    );
  }

  return (
    <div className="flex gap-4 min-h-[60vh]">
      {/* Sidebar: table list */}
      <div className="w-48 shrink-0 flex flex-col gap-3">
        <Card className="flex-1 p-3 space-y-1 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[10px] uppercase tracking-widest text-text-faint font-semibold">
              Tables
            </p>
            <button
              onClick={() => setCreateTableOpen(true)}
              title="Create table"
              className="text-text-muted hover:text-accent-violet-light transition-colors text-sm leading-none p-0.5 rounded"
            >
              +
            </button>
          </div>
          {tables.length === 0 && (
            <p className="text-text-muted text-xs px-1">No tables yet.</p>
          )}
          <div className="space-y-0.5 overflow-y-auto max-h-[50vh]">
            {tables.map((t) => (
              <button
                key={t.name}
                onClick={() => { onSelectTable(t.name); setPage(1); }}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all ${
                  selectedTable === t.name
                    ? 'bg-white/[0.08] text-text-primary'
                    : 'text-text-muted hover:bg-white/[0.04] hover:text-text-primary'
                }`}
              >
                <span className="font-mono">{t.name}</span>
                <span className="ml-1 text-[10px] text-text-faint">({t.rowCount ?? '?'})</span>
              </button>
            ))}
          </div>
        </Card>

        <Button variant="secondary" size="sm" onClick={() => setCreateTableOpen(true)}>
          + New Table
        </Button>
      </div>

      {/* Main area */}
      <div className="flex-1 space-y-3 overflow-hidden">
        {error && <ErrorBanner message={error} />}

        {!selectedTable ? (
          <Card className="border border-white/[0.06] text-center py-16">
            <p className="text-text-muted text-sm">Select a table on the left.</p>
          </Card>
        ) : loading ? (
          <Spinner label="Loading rows…" />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-text-primary font-bold">{selectedTable}</span>
                <span className="text-[10px] text-text-faint bg-white/5 border border-white/10 rounded px-1.5 py-0.5">{total} rows</span>
              </div>
              <div className="flex gap-2 items-center">
                <Button variant="secondary" size="sm" onClick={() => {
                  setNewColName('');
                  setNewColDefault('');
                  setColumnManagerOpen(true);
                }} className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Columns
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setInsertModalOpen(true)}>
                  + Insert Row
                </Button>
                <div className="relative group">
                  <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Actions <span className="text-[10px]">▼</span>
                  </Button>
                  <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-[#18181b] border border-white/10 rounded-xl p-1 z-20 shadow-xl min-w-[130px] text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setNewTableName(selectedTable);
                        setRenameTableOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-all"
                    >
                      Rename Table
                    </button>
                    <button
                      type="button"
                      onClick={() => setTruncateConfirmOpen(true)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-amber-400/80 hover:text-amber-400 transition-all"
                    >
                      Truncate (Clear)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDropConfirmOpen(true)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-red-400/80 hover:text-red-400 transition-all"
                    >
                      Drop (Delete)
                    </button>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={loadRows}>↻ Refresh</Button>
              </div>
            </div>

            {/* Data grid */}
            <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
              <table className="w-full text-xs min-w-full">
                <thead className="border-b border-white/[0.06] bg-white/[0.02]">
                  <tr>
                    {table?.columns.map((col) => (
                      <th
                        key={col.name}
                        className="px-3 py-2 text-left font-medium text-text-muted whitespace-nowrap"
                      >
                        <span className="font-mono">{col.name}</span>
                        {col.isPrimaryKey && (
                          <span className="ml-1 text-[9px] text-accent-violet-light bg-accent-violet/10 px-1 rounded">
                            PK
                          </span>
                        )}
                        <span className="ml-1 text-[10px] text-text-faint">
                          {col.type}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-2 w-20 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={(table?.columns.length ?? 1) + 1}
                        className="px-3 py-8 text-center text-text-muted"
                      >
                        No rows found.
                      </td>
                    </tr>
                  )}
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    >
                      {table?.columns.map((col) => (
                        <td
                          key={col.name}
                          className="px-3 py-2 font-mono text-text-primary max-w-[200px] truncate"
                          title={String(row[col.name] ?? '')}
                        >
                          {row[col.name] === null ? (
                            <span className="text-text-faint italic">null</span>
                          ) : (
                            String(row[col.name])
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-1 text-right whitespace-nowrap">
                        <button
                          onClick={() => startEditRow(row)}
                          className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-white/5 mr-1"
                          title="Edit row"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(row[pkCol] as string | number)}
                          className="text-red-400/50 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
                          title="Delete row"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > LIMIT && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  Page {page} of {Math.ceil(total / LIMIT)}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← Prev
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page * LIMIT >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Insert Modal */}
      <Modal
        open={insertModalOpen}
        onClose={() => setInsertModalOpen(false)}
        title="Insert a New Row"
      >
        <form onSubmit={handleInsertRow} className="space-y-4">
          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
            {table?.columns.map((col) => {
              const isBool = col.type.includes('bool');
              return (
                <div key={col.name} className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted flex justify-between">
                    <span className="font-mono text-text-primary">{col.name}</span>
                    <span>
                      {col.type} {col.nullable ? '(nullable)' : ''}
                      {col.isPrimaryKey ? ' [PK]' : ''}
                    </span>
                  </label>
                  {isBool ? (
                    <select
                      value={newRowData[col.name] ?? ''}
                      onChange={(e) => setNewRowData({ ...newRowData, [col.name]: e.target.value })}
                      className="w-full bg-[#18181b]/80 border border-white/10 rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet-light transition-colors"
                    >
                      <option value="">-- Select --</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      type={col.type.includes('int') || col.type.includes('numeric') ? 'number' : 'text'}
                      value={newRowData[col.name] ?? ''}
                      onChange={(e) => setNewRowData({ ...newRowData, [col.name]: e.target.value })}
                      placeholder={col.isPrimaryKey ? 'Auto-generated if serial' : `Enter ${col.name}...`}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet-light transition-colors font-mono"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-white/[0.06]">
            <Button variant="ghost" onClick={() => setInsertModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" loading={savingRow} type="submit">
              Save Row
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editRowTarget !== null}
        onClose={() => setEditRowTarget(null)}
        title="Edit Row"
      >
        <form onSubmit={handleUpdateRow} className="space-y-4">
          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
            {table?.columns.map((col) => {
              const isBool = col.type.includes('bool');
              return (
                <div key={col.name} className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted flex justify-between">
                    <span className="font-mono text-text-primary">{col.name}</span>
                    <span>
                      {col.type} {col.nullable ? '(nullable)' : ''}
                      {col.isPrimaryKey ? ' [PK] (Read Only)' : ''}
                    </span>
                  </label>
                  {col.isPrimaryKey ? (
                    <input
                      type="text"
                      disabled
                      value={String(editRowTarget?.[col.name] ?? '')}
                      className="w-full bg-white/[0.01] border border-white/5 rounded-xl px-4 py-2 text-sm text-text-muted cursor-not-allowed font-mono"
                    />
                  ) : isBool ? (
                    <select
                      value={editRowData[col.name] ?? ''}
                      onChange={(e) => setEditRowData({ ...editRowData, [col.name]: e.target.value })}
                      className="w-full bg-[#18181b]/80 border border-white/10 rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet-light transition-colors"
                    >
                      <option value="">-- Select --</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      type={col.type.includes('int') || col.type.includes('numeric') ? 'number' : 'text'}
                      value={editRowData[col.name] ?? ''}
                      onChange={(e) => setEditRowData({ ...editRowData, [col.name]: e.target.value })}
                      placeholder={`Enter ${col.name}...`}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet-light transition-colors font-mono"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-white/[0.06]">
            <Button variant="ghost" onClick={() => setEditRowTarget(null)} type="button">
              Cancel
            </Button>
            <Button variant="primary" loading={savingRow} type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Row"
      >
        <p className="text-sm text-text-muted mb-6">
          This will permanently delete row with {pkCol} = <code className="font-mono text-accent-violet-light">{String(deleteTarget)}</code>. This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => handleDeleteRow(deleteTarget!)}>Delete</Button>
        </div>
      </Modal>

      {/* Create Table Panel */}
      <CreateTablePanel
        open={createTableOpen}
        onClose={() => setCreateTableOpen(false)}
        onSubmit={async (sql) => {
          await api.projects.sql(projectId, sql);
          toast('Table created successfully', 'success');
          onReloadTables();
        }}
      />

      {/* Rename Table Modal */}
      <Modal
        open={renameTableOpen}
        onClose={() => setRenameTableOpen(false)}
        title="Rename Table"
      >
        <form onSubmit={handleRenameTable} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted">Table Name</label>
            <input
              type="text"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet-light transition-colors font-mono"
              required
            />
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-white/[0.06]">
            <Button variant="ghost" onClick={() => setRenameTableOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Truncate Table Confirm */}
      <Modal
        open={truncateConfirmOpen}
        onClose={() => setTruncateConfirmOpen(false)}
        title="Truncate Table"
      >
        <p className="text-sm text-text-muted mb-6">
          Are you sure you want to delete all rows from <code className="font-mono text-accent-violet-light">{selectedTable}</code> and reset all auto-increment identifiers? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={() => setTruncateConfirmOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleTruncateTable}>Truncate</Button>
        </div>
      </Modal>

      {/* Drop Table Confirm */}
      <Modal
        open={dropConfirmOpen}
        onClose={() => setDropConfirmOpen(false)}
        title="Drop Table"
      >
        <p className="text-sm text-text-muted mb-6">
          Are you sure you want to permanently delete table <code className="font-mono text-red-400">{selectedTable}</code> and all of its data? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={() => setDropConfirmOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDropTable}>Drop Table</Button>
        </div>
      </Modal>

      {/* Column Manager Modal */}
      <Modal
        open={columnManagerOpen}
        onClose={() => setColumnManagerOpen(false)}
        title={`Columns for ${selectedTable}`}
        width="max-w-2xl"
      >
        <div className="space-y-6">
          {/* List existing columns */}
          <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
            <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold px-1">
              Existing Columns
            </h4>
            {table?.columns.map((col) => {
              const isRenaming = columnRenameTarget === col.name;
              return (
                <div
                  key={col.name}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] transition-colors gap-4"
                >
                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={columnRenameNewName}
                          onChange={(e) => setColumnRenameNewName(e.target.value)}
                          className="flex-1 bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-violet-light transition-colors font-mono"
                          placeholder="New column name"
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameColumn(col.name)}
                          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setColumnRenameTarget(null)}
                          className="text-xs text-text-muted hover:text-text-primary"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-text-primary font-semibold">
                          {col.name}
                        </span>
                        <span className="text-[10px] text-text-faint font-mono">
                          {col.type}
                        </span>
                        {col.isPrimaryKey && (
                          <span className="text-[9px] text-accent-violet-light bg-accent-violet/10 px-1 rounded">
                            PK
                          </span>
                        )}
                        {!col.nullable && (
                          <span className="text-[9px] text-amber-400/80 bg-amber-400/10 px-1 rounded">
                            NOT NULL
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {!isRenaming && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setColumnRenameTarget(col.name);
                          setColumnRenameNewName(col.name);
                        }}
                        className="text-text-muted hover:text-text-primary transition-colors text-xs p-1"
                        title="Rename Column"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDropColumn(col.name)}
                        disabled={col.isPrimaryKey}
                        className={`text-red-400/50 hover:text-red-400 transition-colors text-xs p-1 ${
                          col.isPrimaryKey ? 'opacity-30 cursor-not-allowed' : ''
                        }`}
                        title={col.isPrimaryKey ? 'Cannot drop primary key' : 'Drop Column'}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Column subform */}
          <form onSubmit={handleAddColumn} className="border-t border-white/[0.06] pt-4 space-y-4">
            <h4 className="text-xs uppercase tracking-wider text-text-muted font-semibold px-1">
              Add New Column
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted">Column Name</label>
                <input
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="new_column"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet-light transition-colors font-mono"
                  required={columnManagerOpen}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted">Data Type</label>
                <select
                  value={newColType}
                  onChange={(e) => setNewColType(e.target.value)}
                  className="w-full bg-[#18181b]/80 border border-white/10 rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet-light transition-colors"
                >
                  {PG_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted">Default Value (optional)</label>
                <input
                  type="text"
                  value={newColDefault}
                  onChange={(e) => setNewColDefault(e.target.value)}
                  placeholder="e.g. 'active', now()"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet-light transition-colors font-mono"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <label className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary cursor-pointer select-none">
                  <div
                    role="checkbox"
                    aria-checked={newColNullable}
                    onClick={() => setNewColNullable(!newColNullable)}
                    className={`w-7 h-4 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${
                      newColNullable ? 'bg-accent-violet' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                        newColNullable ? 'translate-x-3' : 'translate-x-0'
                      }`}
                    />
                  </div>
                  Allow Nullable
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" type="submit" loading={savingColumnAction}>
                + Add Column
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}

// ── SQL Runner ───────────────────────────────────────────────────────────────

function SqlRunnerPanel({
  projectId,
  projectRunning,
}: {
  projectId: string;
  projectRunning: boolean;
}) {
  const [sql, setSql] = useState('SELECT current_database();');
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const { toast } = useToast();

  // Load history on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`shanutechx_sql_history_${projectId}`);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load SQL history', e);
    }
  }, [projectId]);

  const saveToHistory = useCallback((query: string) => {
    if (!query.trim()) return;
    setHistory((prev) => {
      // Remove query if it already exists to put it at the top
      const filtered = prev.filter((q) => q.trim() !== query.trim());
      const next = [query, ...filtered].slice(0, 30); // limit to 30 items
      try {
        localStorage.setItem(`shanutechx_sql_history_${projectId}`, JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to save SQL history', e);
      }
      return next;
    });
  }, [projectId]);

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(`shanutechx_sql_history_${projectId}`);
      toast('SQL history cleared', 'success');
    } catch (e) {
      console.warn('Failed to clear SQL history', e);
    }
  };

  async function run() {
    if (!sql.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.projects.sql(projectId, sql);
      setResult(r);
      saveToHistory(sql);
      toast(`Query returned ${r.rowCount} row${r.rowCount === 1 ? '' : 's'}`, 'success');
    } catch (e: any) {
      setError(e.message);
      toast('Query failed', 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        {/* Editor & output */}
        <div className="flex-1 flex flex-col gap-4">
          <Card className="border border-white/[0.06] p-0 overflow-hidden flex flex-col">
            {/* Editor toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.01]">
              <span className="text-xs text-text-muted font-mono">SQL Editor</span>
              <Button
                size="sm"
                loading={running}
                disabled={!projectRunning || !sql.trim() || running}
                onClick={run}
              >
                ▶ Run Query
              </Button>
            </div>

            {/* Monaco Editor */}
            <div className="h-64 border-b border-white/[0.06] bg-[#1e1e1e]">
              <Editor
                height="100%"
                language="sql"
                theme="vs-dark"
                value={sql}
                onChange={(val) => setSql(val ?? '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  readOnly: !projectRunning,
                  automaticLayout: true,
                }}
              />
            </div>
            <p className="text-[10px] text-text-faint px-4 py-2 bg-white/[0.01]">
              Press run or execute your PostgreSQL query. Make sure the container is healthy and running.
            </p>
          </Card>

          {!projectRunning && (
            <Card className="border border-amber-500/20 bg-amber-500/[0.03]">
              <p className="text-sm text-amber-300">Project must be running to execute queries.</p>
            </Card>
          )}

          {error && <ErrorBanner message={error} />}

          {result && (
            <Card className="border border-white/[0.06] p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.01]">
                <span className="text-xs text-text-muted">
                  Results · <span className="text-text-primary">{result.rowCount}</span> row
                  {result.rowCount !== 1 ? 's' : ''}
                </span>
              </div>
              {result.rows.length === 0 ? (
                <p className="p-4 text-sm text-text-muted">Query executed successfully — no rows returned.</p>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs">
                    <thead className="border-b border-white/[0.06] bg-white/[0.02] sticky top-0">
                      <tr>
                        {result.fields.map((f) => (
                          <th
                            key={f.name}
                            className="px-3 py-2 text-left font-medium text-text-muted font-mono whitespace-nowrap"
                          >
                            {f.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                          {result.fields.map((f) => (
                            <td
                              key={f.name}
                              className="px-3 py-2 font-mono text-text-primary max-w-xs truncate"
                              title={String(row[f.name] ?? '')}
                            >
                              {row[f.name] === null ? (
                                <span className="text-text-faint italic">null</span>
                              ) : typeof row[f.name] === 'object' ? (
                                JSON.stringify(row[f.name])
                              ) : (
                                String(row[f.name])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* History panel */}
        <Card className="w-72 shrink-0 p-4 border border-white/[0.06] flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3">
            <span className="text-xs uppercase tracking-wider text-text-muted font-semibold">
              Query History
            </span>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-[10px] text-red-400/70 hover:text-red-400 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {history.length === 0 ? (
              <p className="text-xs text-text-faint italic text-center py-8">
                No recent queries. Successful queries will appear here.
              </p>
            ) : (
              history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => setSql(h)}
                  className="w-full text-left p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/10 transition-all font-mono text-[10px] text-text-muted hover:text-text-primary block truncate max-h-16 overflow-hidden"
                  title={h}
                >
                  <div className="truncate mb-1 text-[9px] text-text-faint">
                    Query #{history.length - i}
                  </div>
                  <div className="whitespace-pre-line text-left leading-relaxed">
                    {h}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Connection Info ──────────────────────────────────────────────────────────

function ConnectionPanel({ project }: { project: Project }) {
  const [revealed, setRevealed] = useState(false);
  const [snippetTab, setSnippetTab] = useState<'js-sdk' | 'node-pg' | 'python-db'>('js-sdk');
  const { toast } = useToast();

  const connString = `postgresql://${project.dbUsername}:${project.dbPassword}@${project.node?.ip ?? 'YOUR_NODE_IP'}:5432/${project.dbName}`;
  const apiUrl = project.apiPort ? `http://${project.node?.ip ?? 'YOUR_NODE_IP'}:${project.apiPort}` : '';

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => toast(`${label} copied`, 'success'));
  }

  const rows = [
    { label: 'Host', value: project.node?.ip ?? '—', mono: true },
    { label: 'Port', value: '5432', mono: true },
    { label: 'Database', value: project.dbName, mono: true },
    { label: 'Username', value: project.dbUsername, mono: true },
    { label: 'Password', value: revealed ? project.dbPassword : '••••••••••••••••', mono: true, secret: true },
    { label: 'Status', value: project.status, mono: false },
    { label: 'Project ID', value: project.id, mono: true },
  ];

  // Code snippet templates
  const jsSdkCode = `import { createClient } from '@shanutechx/supabase-js'

// Initialize the isomorphic JS client
const supabase = createClient(
  '${apiUrl || 'http://your-node-ip:port'}',
  'your-anon-key-secret'
)

// Query database tables reactively
const { data, error } = await supabase
  .from('users')
  .select('id, email, display_name')
  .eq('status', 'active')

// Insert database rows
const { error: insError } = await supabase
  .from('users')
  .insert({ email: 'newuser@example.com', display_name: 'Shanu' })

// Subscribe to realtime database changes
supabase
  .channel('table-db-changes')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, payload => {
    console.log('New user created realtime:', payload.new)
  })
  .subscribe()`;

  const nodePgCode = `const { Client } = require('pg')

const client = new Client({
  connectionString: '${connString}'
})

async function run() {
  await client.connect()
  const res = await client.query('SELECT * FROM users WHERE status = $1', ['active'])
  console.log(res.rows)
  await client.end()
}

run().catch(console.error)`;

  const pythonDbCode = `import psycopg2

conn = psycopg2.connect(
    host="${project.node?.ip ?? 'your-node-ip'}",
    database="${project.dbName}",
    user="${project.dbUsername}",
    password="${project.dbPassword ?? 'your-password'}",
    port="5432"
)

cur = conn.cursor()
cur.execute("SELECT * FROM users;")
rows = cur.fetchall()

for row in rows:
    print(row)

cur.close()
conn.close()`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <Card className="border border-white/[0.06] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Database Credentials</h2>
            <Button variant="ghost" size="sm" onClick={() => setRevealed((v) => !v)} className="flex items-center gap-1.5">
              {revealed ? (
                <>
                  <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 014.122-.863c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18" />
                  </svg>
                  Hide
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Reveal Password
                </>
              )}
            </Button>
          </div>

          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 py-2 border-b border-white/[0.04] last:border-0"
              >
                <span className="text-xs text-text-muted w-24 shrink-0">{row.label}</span>
                <span className={`text-sm flex-1 ${row.mono ? 'font-mono text-text-primary' : 'text-text-primary capitalize'}`}>
                  {row.value}
                </span>
                {row.mono && row.value !== '—' && !row.secret && (
                  <button
                    onClick={() => copy(row.value, row.label)}
                    className="text-[10px] text-text-faint hover:text-accent-violet-light transition-colors px-2 py-0.5 rounded-lg hover:bg-white/[0.04]"
                  >
                    copy
                  </button>
                )}
                {row.secret && revealed && (
                  <button
                    onClick={() => copy(project.dbPassword, 'Password')}
                    className="text-[10px] text-text-faint hover:text-accent-violet-light transition-colors px-2 py-0.5 rounded-lg hover:bg-white/[0.04]"
                  >
                    copy
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Connection string */}
        <Card className="border border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-text-muted">Connection String (PostgreSQL)</p>
            <button
              onClick={() => copy(connString, 'Connection string')}
              className="text-[10px] text-text-faint hover:text-accent-violet-light transition-colors px-2 py-0.5 rounded-lg hover:bg-white/[0.04]"
            >
              copy
            </button>
          </div>
          <pre className="text-xs font-mono text-text-primary bg-black/20 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all border border-white/[0.04]">
            {revealed ? connString : connString.replace(/:[^:@]+@/, ':••••••••••••••••@')}
          </pre>
        </Card>

        {/* Node agent API endpoint */}
        {apiUrl && (
          <Card className="border border-white/[0.06]">
            <p className="text-xs font-semibold text-text-muted mb-2">REST API Endpoint</p>
            <pre className="text-xs font-mono text-emerald-400 bg-black/20 rounded-xl p-3 overflow-x-auto border border-white/[0.04]">
              {apiUrl}/api
            </pre>
            <p className="text-xs text-text-muted mt-2">
              Use this as your base URL for auto-generated CRUD endpoints. Prefix with your table name:
              <code className="ml-1 font-mono text-text-primary">/api/your_table</code>
            </p>
          </Card>
        )}
      </div>

      {/* Code Snippets Section */}
      <div className="space-y-4">
        <Card className="border border-white/[0.06] p-0 overflow-hidden flex flex-col min-h-[450px]">
          {/* Tabs for snippets */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.01] shrink-0">
            <div className="flex gap-2">
              <button
                onClick={() => setSnippetTab('js-sdk')}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  snippetTab === 'js-sdk'
                    ? 'bg-white/[0.08] text-text-primary'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/[0.02]'
                }`}
              >
                JS Client SDK
              </button>
              <button
                onClick={() => setSnippetTab('node-pg')}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  snippetTab === 'node-pg'
                    ? 'bg-white/[0.08] text-text-primary'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/[0.02]'
                }`}
              >
                Node.js (pg)
              </button>
              <button
                onClick={() => setSnippetTab('python-db')}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  snippetTab === 'python-db'
                    ? 'bg-white/[0.08] text-text-primary'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/[0.02]'
                }`}
              >
                Python psycopg2
              </button>
            </div>
            <button
              onClick={() => {
                const code = snippetTab === 'js-sdk' ? jsSdkCode : snippetTab === 'node-pg' ? nodePgCode : pythonDbCode;
                copy(code, 'Code snippet');
              }}
              className="text-xs text-text-muted hover:text-text-primary px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-all"
            >
              Copy Snippet
            </button>
          </div>

          {/* Monaco Snippet Display */}
          <div className="flex-1 bg-[#1e1e1e]">
            <Editor
              height="400px"
              language={snippetTab === 'python-db' ? 'python' : 'javascript'}
              theme="vs-dark"
              value={snippetTab === 'js-sdk' ? jsSdkCode : snippetTab === 'node-pg' ? nodePgCode : pythonDbCode}
              options={{
                minimap: { enabled: false },
                fontSize: 11,
                lineNumbers: 'off',
                scrollBeyondLastLine: false,
                readOnly: true,
                automaticLayout: true,
              }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
