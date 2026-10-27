'use client';

/**
 * CreateTablePanel — inspired by Supabase Studio's TableEditor SidePanel.
 * Lets users define a new table with multiple columns, types, and constraints,
 * then runs the generated CREATE TABLE SQL against the managed Postgres project.
 *
 * Adapted from:
 *   New folder/supabase-master/apps/studio/components/interfaces/
 *     TableGridEditor/SidePanelEditor/TableEditor/TableEditor.tsx
 *     TableGridEditor/SidePanelEditor/ColumnEditor/ColumnEditor.tsx
 */

import { useState, useCallback } from 'react';
import { Button, Modal } from './ui';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Postgres data types available in the column-type dropdown. */
export const PG_TYPES = [
  // Numeric
  { label: 'int2 (smallint)', value: 'int2' },
  { label: 'int4 (integer)', value: 'int4' },
  { label: 'int8 (bigint)', value: 'int8' },
  { label: 'float4 (real)', value: 'float4' },
  { label: 'float8 (double precision)', value: 'float8' },
  { label: 'numeric / decimal', value: 'numeric' },
  // Text
  { label: 'text', value: 'text' },
  { label: 'varchar (character varying)', value: 'varchar' },
  { label: 'char (character)', value: 'char' },
  { label: 'bpchar', value: 'bpchar' },
  // Boolean
  { label: 'bool (boolean)', value: 'bool' },
  // Date / Time
  { label: 'date', value: 'date' },
  { label: 'time', value: 'time' },
  { label: 'timetz', value: 'timetz' },
  { label: 'timestamp', value: 'timestamp' },
  { label: 'timestamptz', value: 'timestamptz' },
  { label: 'interval', value: 'interval' },
  // UUID
  { label: 'uuid', value: 'uuid' },
  // JSON
  { label: 'json', value: 'json' },
  { label: 'jsonb', value: 'jsonb' },
  // Binary
  { label: 'bytea', value: 'bytea' },
  // Other
  { label: 'inet', value: 'inet' },
  { label: 'cidr', value: 'cidr' },
  { label: 'macaddr', value: 'macaddr' },
  { label: 'tsvector', value: 'tsvector' },
  { label: 'tsquery', value: 'tsquery' },
  { label: 'xml', value: 'xml' },
  { label: 'point', value: 'point' },
  { label: 'line', value: 'line' },
  { label: 'lseg', value: 'lseg' },
];

interface ColumnDef {
  id: string; // local uuid for keying
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isUnique: boolean;
  isNullable: boolean;
  defaultValue: string;
  comment: string;
}

function makeId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function defaultColumn(overrides: Partial<ColumnDef> = {}): ColumnDef {
  return {
    id: makeId(),
    name: '',
    type: 'text',
    isPrimaryKey: false,
    isUnique: false,
    isNullable: true,
    defaultValue: '',
    comment: '',
    ...overrides,
  };
}

/** Build a CREATE TABLE SQL string from the form state. */
function buildSql(tableName: string, columns: ColumnDef[]): string {
  if (!tableName.trim() || columns.length === 0) return '';

  const colLines = columns
    .filter((c) => c.name.trim())
    .map((c) => {
      let def = `  "${c.name.trim()}" ${c.type}`;
      if (c.isPrimaryKey) def += ' PRIMARY KEY';
      if (!c.isPrimaryKey && !c.isNullable) def += ' NOT NULL';
      if (!c.isPrimaryKey && c.isUnique) def += ' UNIQUE';
      if (c.defaultValue.trim()) def += ` DEFAULT ${c.defaultValue.trim()}`;
      return def;
    });

  return `CREATE TABLE IF NOT EXISTS "${tableName.trim()}" (\n${colLines.join(',\n')}\n);`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ColumnRow({
  col,
  index,
  onChange,
  onRemove,
}: {
  col: ColumnDef;
  index: number;
  onChange: (id: string, changes: Partial<ColumnDef>) => void;
  onRemove: (id: string) => void;
}) {
  const set = (changes: Partial<ColumnDef>) => onChange(col.id, changes);
  const inputClass =
    'w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet-light transition-colors font-mono';

  return (
    <div className="rounded-xl border border-white/[0.07] p-3 space-y-3 bg-white/[0.01] hover:bg-white/[0.02] transition-colors">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-text-faint font-semibold">
          Column {index + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(col.id)}
          className="text-red-400/40 hover:text-red-400 transition-colors text-xs p-1 rounded hover:bg-red-500/10"
          title="Remove column"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Name + Type */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] text-text-muted uppercase tracking-wider">Name</label>
          <input
            type="text"
            value={col.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="column_name"
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-text-muted uppercase tracking-wider">Type</label>
          <select
            value={col.type}
            onChange={(e) => set({ type: e.target.value })}
            className="w-full bg-[#18181b]/80 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet-light transition-colors"
          >
            {PG_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Default value */}
      <div className="space-y-1">
        <label className="text-[10px] text-text-muted uppercase tracking-wider">
          Default Value <span className="normal-case text-text-faint">(optional)</span>
        </label>
        <input
          type="text"
          value={col.defaultValue}
          onChange={(e) => set({ defaultValue: e.target.value })}
          placeholder={
            col.type === 'uuid'
              ? 'gen_random_uuid()'
              : col.type.includes('timestamp')
              ? 'now()'
              : ''
          }
          className={inputClass}
        />
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <Toggle
          id={`pk-${col.id}`}
          label="Primary Key"
          checked={col.isPrimaryKey}
          onChange={(v) => set({ isPrimaryKey: v, isNullable: v ? false : col.isNullable, isUnique: v ? false : col.isUnique })}
        />
        <Toggle
          id={`nullable-${col.id}`}
          label="Nullable"
          checked={col.isNullable}
          disabled={col.isPrimaryKey}
          onChange={(v) => set({ isNullable: v })}
        />
        <Toggle
          id={`unique-${col.id}`}
          label="Unique"
          checked={col.isUnique}
          disabled={col.isPrimaryKey}
          onChange={(v) => set({ isUnique: v })}
        />
      </div>
    </div>
  );
}

function Toggle({
  id,
  label,
  checked,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-1.5 text-xs cursor-pointer select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'text-text-muted hover:text-text-primary'
      }`}
    >
      <div
        id={id}
        role="checkbox"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={`w-7 h-4 rounded-full transition-colors relative flex-shrink-0 ${
          checked ? 'bg-accent-violet' : 'bg-white/10'
        } ${disabled ? '' : 'cursor-pointer'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-3' : 'translate-x-0'
          }`}
        />
      </div>
      {label}
    </label>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

interface CreateTablePanelProps {
  open?: boolean;
  onClose?: () => void;
  onSubmit?: (sql: string) => Promise<void>;
  onTableCreated?: () => void;
}

export function CreateTablePanel({ open = true, onClose = () => {}, onSubmit, onTableCreated }: CreateTablePanelProps) {

  const [tableName, setTableName] = useState('');
  const [tableComment, setTableComment] = useState('');
  const [columns, setColumns] = useState<ColumnDef[]>([
    defaultColumn({ name: 'id', type: 'int4', isPrimaryKey: true, isNullable: false, defaultValue: '' }),
    defaultColumn({ name: 'created_at', type: 'timestamptz', defaultValue: 'now()', isNullable: false }),
  ]);
  const [showSql, setShowSql] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'columns' | 'sql'>('columns');

  const sql = buildSql(tableName, columns);

  const updateColumn = useCallback((id: string, changes: Partial<ColumnDef>) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  }, []);

  const removeColumn = useCallback((id: string) => {
    setColumns((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addColumn = () => {
    setColumns((prev) => [...prev, defaultColumn()]);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tableName.trim()) { setError('Table name is required.'); return; }
    if (columns.filter((c) => c.name.trim()).length === 0) { setError('At least one column is required.'); return; }
    setError(null);
    setSaving(true);
    try {
      if (onSubmit) {
        await onSubmit(sql);
      } else {
        const { supabaseAdmin } = await import('@/lib/supabaseAdmin');
        await supabaseAdmin.db.query(sql);
      }
      if (onTableCreated) onTableCreated();
      // Reset form
      setTableName('');
      setTableComment('');
      setColumns([
        defaultColumn({ name: 'id', type: 'int4', isPrimaryKey: true, isNullable: false }),
        defaultColumn({ name: 'created_at', type: 'timestamptz', defaultValue: 'now()', isNullable: false }),
      ]);
      onClose();
    } catch (err: any) {

      setError(err.message || 'Failed to create table');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create a New Table" width="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tab switcher */}
        <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1 w-fit">
          {(['columns', 'sql'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${
                tab === t
                  ? 'bg-white/[0.08] text-text-primary shadow'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t === 'sql' ? 'SQL Preview' : 'Columns'}
            </button>
          ))}
        </div>

        {/* Table name + comment (always visible) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted">
              Table Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={tableName}
              onChange={(e) => { setTableName(e.target.value); setError(null); }}
              placeholder="my_table"
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet-light transition-colors font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted">Description (optional)</label>
            <input
              type="text"
              value={tableComment}
              onChange={(e) => setTableComment(e.target.value)}
              placeholder="Add a comment…"
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-violet-light transition-colors"
            />
          </div>
        </div>

        {/* Tab content */}
        {tab === 'columns' ? (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {columns.map((col, idx) => (
              <ColumnRow
                key={col.id}
                col={col}
                index={idx}
                onChange={updateColumn}
                onRemove={removeColumn}
              />
            ))}

            <button
              type="button"
              onClick={addColumn}
              className="w-full border border-dashed border-white/10 rounded-xl py-3 text-xs text-text-muted hover:text-text-primary hover:border-white/20 transition-all flex items-center justify-center gap-2"
            >
              <span className="text-lg leading-none">+</span>
              Add Column
            </button>
          </div>
        ) : (
          <div className="bg-black/40 rounded-xl p-4 font-mono text-xs text-emerald-300 whitespace-pre max-h-[50vh] overflow-auto border border-white/[0.06]">
            {sql || <span className="text-text-faint italic">Fill in table name and columns above.</span>}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <span className="text-[10px] text-text-faint">
            {columns.filter((c) => c.name.trim()).length} column
            {columns.filter((c) => c.name.trim()).length !== 1 ? 's' : ''} defined
          </span>
          <div className="flex gap-3">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={saving}>
              Create Table
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
