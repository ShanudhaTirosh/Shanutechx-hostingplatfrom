'use client';

import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { PageHeader, Card, Spinner, ErrorBanner, Button, useToast, ConfirmDialog } from '@/components/ui';
import { supabaseAdmin, SupabaseDbTable, ClientSupabaseProject } from '@/lib/supabaseAdmin';
import { DataGrid } from '@/components/supabase/DataGrid';
import { CreateTablePanel } from '@/components/CreateTablePanel';
import { ProjectSwitcher } from '@/components/supabase/ProjectSwitcher';


export default function SupabaseDatabasePage() {
  const [activeProject, setActiveProject] = useState<ClientSupabaseProject | null>(null);
  const [tables, setTables] = useState<SupabaseDbTable[]>([]);

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [queryRows, setQueryRows] = useState<Record<string, any>[]>([]);
  const [queryColumns, setQueryColumns] = useState<string[]>([]);
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM public.users LIMIT 20;');
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals & Panels
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [showInsertRowModal, setShowInsertRowModal] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});
  const [insertingRow, setInsertingRow] = useState(false);

  const { toast } = useToast();

  function loadTables() {
    supabaseAdmin.db
      .tables()
      .then((res) => {
        setTables(res.tables || []);
        if (res.tables && res.tables.length > 0 && !selectedTable) {
          setSelectedTable(res.tables[0].name);
          handleRunQuery(`SELECT * FROM public.${res.tables[0].name} LIMIT 20;`);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTables();
  }, []);

  const handleRunQuery = (queryToRun?: string) => {
    const q = queryToRun || sqlQuery;
    setExecuting(true);
    setError(null);
    supabaseAdmin.db
      .query(q)
      .then((res) => {
        if (res.rows && res.rows.length > 0) {
          setQueryColumns(Object.keys(res.rows[0]));
          setQueryRows(res.rows);
        } else {
          setQueryColumns([]);
          setQueryRows([]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setExecuting(false));
  };

  const handleSelectTable = (tblName: string) => {
    setSelectedTable(tblName);
    const q = `SELECT * FROM public.${tblName} LIMIT 20;`;
    setSqlQuery(q);
    handleRunQuery(q);
  };

  const handleInsertRowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;
    setInsertingRow(true);
    try {
      const keys = Object.keys(newRowData).filter((k) => newRowData[k] !== '');
      if (keys.length === 0) {
        toast('Please enter at least one column value.', 'error');
        setInsertingRow(false);
        return;
      }
      const cols = keys.map((k) => `"${k}"`).join(', ');
      const vals = keys.map((k) => `'${newRowData[k].replace(/'/g, "''")}'`).join(', ');
      const q = `INSERT INTO public."${selectedTable}" (${cols}) VALUES (${vals});`;
      await supabaseAdmin.db.query(q);
      toast(`Inserted record into ${selectedTable}!`, 'success');
      setShowInsertRowModal(false);
      setNewRowData({});
      handleRunQuery(`SELECT * FROM public."${selectedTable}" LIMIT 20;`);
    } catch (err: any) {
      toast(err.message || 'Failed to insert record', 'error');
    } finally {
      setInsertingRow(false);
    }
  };

  if (loading) return <Spinner label="Connecting to Database Studio..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Database Studio (Supabase PostgreSQL 17)"
        description="Explore public schemas, edit rows, run raw SQL queries, and manage database structures."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowCreateTable(!showCreateTable)}>
              {showCreateTable ? 'Close Table Creator' : '+ New Table'}
            </Button>
            {selectedTable && (
              <Button size="sm" onClick={() => setShowInsertRowModal(true)}>
                + Insert Row
              </Button>
            )}
          </div>
        }
      />

      {/* Per-Project Switcher Header */}
      <ProjectSwitcher activeProject={activeProject} onSelectProject={setActiveProject} />

      {error && <ErrorBanner message={error} />}


      {/* Table Creator Drawer */}
      {showCreateTable && (
        <Card className="border border-accent-violet/40 bg-black/40">
          <CreateTablePanel
            onTableCreated={() => {
              setShowCreateTable(false);
              loadTables();
            }}
          />
        </Card>
      )}

      <div className="grid md:grid-cols-4 gap-6">
        {/* Table Selector Sidebar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Tables ({tables.length})
            </h3>
            <button type="button" onClick={loadTables} className="text-xs text-text-muted hover:text-white">↺ Refresh</button>
          </div>
          <div className="glass rounded-xl p-2 border border-white/[0.06] space-y-1 max-h-[520px] overflow-y-auto">
            {tables.map((t) => (
              <button
                key={t.name}
                onClick={() => handleSelectTable(t.name)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-all flex items-center justify-between ${
                  selectedTable === t.name
                    ? 'bg-accent-violet/20 text-accent-violet-light border border-accent-violet/30 font-semibold'
                    : 'text-text-muted hover:bg-white/[0.04] hover:text-text-primary'
                }`}
              >
                <span className="truncate flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {t.name}
                </span>
                <span className="text-[10px] text-text-faint font-mono">{t.rows_count ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Query & Data Grid Workspace */}
        <div className="md:col-span-3 space-y-4">
          {/* SQL Templates Bar */}
          <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
            <span className="text-text-muted font-mono text-[11px] shrink-0">SQL Snippets:</span>
            {selectedTable && (
              <>
                <button
                  type="button"
                  onClick={() => setSqlQuery(`SELECT * FROM public."${selectedTable}" ORDER BY 1 DESC LIMIT 50;`)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 font-mono text-[11px] shrink-0"
                >
                  SELECT ALL
                </button>
                <button
                  type="button"
                  onClick={() => setSqlQuery(`SELECT COUNT(*) FROM public."${selectedTable}";`)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 font-mono text-[11px] shrink-0"
                >
                  COUNT(*)
                </button>
                <button
                  type="button"
                  onClick={() => setSqlQuery(`TRUNCATE TABLE public."${selectedTable}" RESTART IDENTITY;`)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 font-mono text-[11px] shrink-0"
                >
                  TRUNCATE TABLE
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setSqlQuery(`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public';`)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 font-mono text-[11px] shrink-0"
            >
              SCHEMA COLUMNS
            </button>
            <button
              type="button"
              onClick={() => setSqlQuery(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nCREATE EXTENSION IF NOT EXISTS "vector";`)}
              className="px-2.5 py-1 rounded-lg bg-accent-violet/10 hover:bg-accent-violet/20 text-accent-violet-light border border-accent-violet/20 font-mono text-[11px] shrink-0"
            >
              ENABLE EXTENSIONS
            </button>
          </div>

          {/* Monaco SQL Editor */}
          <Card className="border border-white/[0.06] p-0 overflow-hidden shadow-2xl">
            <div className="p-3 bg-[#0d0f17] border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-xs font-semibold text-accent-cyan uppercase tracking-wider font-mono flex items-center gap-1.5">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                SQL Editor (Press Cmd+Enter / Ctrl+Enter)
              </span>
              <Button size="sm" onClick={() => handleRunQuery()} disabled={executing}>
                {executing ? 'Executing...' : 'Run SQL'}
              </Button>
            </div>
            <div className="h-44">
              <Editor
                height="100%"
                defaultLanguage="sql"
                theme="vs-dark"
                value={sqlQuery}
                onChange={(val) => setSqlQuery(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </Card>

          {/* Results Data Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Results Grid ({queryRows.length} rows)
              </h3>
            </div>
            <DataGrid columns={queryColumns} rows={queryRows} loading={executing} />
          </div>
        </div>
      </div>

      {/* Insert Row Modal */}
      {showInsertRowModal && selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-white">Insert Record into "{selectedTable}"</h3>
            <form onSubmit={handleInsertRowSubmit} className="space-y-3">
              {queryColumns.length === 0 ? (
                <p className="text-xs text-text-muted">Run a SELECT query first to populate table columns.</p>
              ) : (
                queryColumns.map((col) => (
                  <div key={col}>
                    <label className="text-[11px] font-mono text-text-muted block mb-1">{col}</label>
                    <input
                      type="text"
                      value={newRowData[col] || ''}
                      onChange={(e) => setNewRowData({ ...newRowData, [col]: e.target.value })}
                      placeholder={`value for ${col}`}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-accent-cyan"
                    />
                  </div>
                ))
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowInsertRowModal(false)}>Cancel</Button>
                <Button type="submit" size="sm" loading={insertingRow}>Insert Row</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
