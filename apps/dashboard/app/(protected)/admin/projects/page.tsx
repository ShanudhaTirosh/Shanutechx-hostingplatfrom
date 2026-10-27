'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Project, Node, Customer } from '@/lib/types';
import {
  Card,
  Button,
  Spinner,
  EmptyState,
  ErrorBanner,
  Input,
  Table,
  Tr,
  Td,
  Badge,
  PageHeader,
  useToast,
  Modal,
  ConfirmDialog,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

function StatusBadge({ status }: { status: Project['status'] }) {
  const map: Record<string, string> = {
    running: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    pending: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    failed: 'bg-red-500/15 text-red-300 border-red-500/20',
  };
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-lg border ${map[status] ?? ''} capitalize`}
    >
      {status}
    </span>
  );
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const { toast } = useToast();

  function load() {
    api.projects
      .list()
      .then((d) => setProjects(d.projects))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    api.nodes.list().then((d) => setNodes(d.nodes));
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.projects.delete(deleteTarget.id);
      toast('Project deleted', 'success');
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast(e.message || 'Delete failed', 'error');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Database Projects"
        description="Provision and manage customer Supabase-like database projects on hosting nodes."
        action={
          <Button onClick={() => setCreateOpen(true)}>+ Provision Project</Button>
        }
      />

      {error && <ErrorBanner message={error} />}
      {projects === null && <Spinner label="Loading projects…" />}
      {projects?.length === 0 && (
        <EmptyState
          message="No projects provisioned yet."
          action={{ label: 'Provision a project', onClick: () => setCreateOpen(true) }}
        />
      )}

      {projects && projects.length > 0 && (
        <Table headers={['Project', 'Customer', 'Node', 'Database', 'Status', 'Actions']}>
          {projects.map((p) => (
            <Tr key={p.id}>
              <Td>
                <div className="font-semibold text-sm text-text-primary">{p.name}</div>
                <div className="text-[10px] font-mono text-text-faint">{p.id}</div>
              </Td>
              <Td>
                <div className="text-sm text-text-primary">{p.user?.email ?? '—'}</div>
              </Td>
              <Td>
                <span className="font-mono text-xs text-text-muted">
                  {p.node?.label ?? p.nodeId}
                </span>
              </Td>
              <Td>
                <div className="font-mono text-xs text-text-primary">{p.dbName}</div>
                <div className="font-mono text-[10px] text-text-faint">{p.dbUsername}</div>
              </Td>
              <Td>
                <StatusBadge status={p.status} />
                {p.apiPort && (
                  <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                    :{p.apiPort}
                  </div>
                )}
              </Td>
              <Td>
                <div className="flex gap-2">
                  <Link href={`/projects/${p.id}`}>
                    <Button variant="secondary" size="sm">View</Button>
                  </Link>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteTarget(p)}
                  >
                    Delete
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      {/* Provision Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Provision New Database Project"
      >
        <ProvisionForm
          nodes={nodes}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Delete project "${deleteTarget?.name}"? This will stop its database container and cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function ProvisionForm({
  nodes,
  onCreated,
}: {
  nodes: Node[];
  onCreated: () => void;
}) {
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [nodeId, setNodeId] = useState(nodes[0]?.id ?? '');
  const [customerEmail, setCustomerEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Live email → userId resolution
  async function handleEmailBlur() {
    if (!customerEmail.trim()) return;
    setLookupBusy(true);
    try {
      const data = await api.admin.customers(customerEmail);
      const match = data.customers.find(
        (c) => c.email.toLowerCase() === customerEmail.toLowerCase()
      );
      if (match) {
        setUserId(match.id);
      } else {
        setError('No customer found with that email address.');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLookupBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !name || !nodeId) return;

    setBusy(true);
    setError(null);
    try {
      await api.projects.create({ userId, name, nodeId });
      toast('Project provisioning started', 'success');
      onCreated();
    } catch (e: any) {
      setError(e.message);
      toast('Provisioning failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Input
        label="Customer Email"
        type="email"
        placeholder="customer@example.com"
        value={customerEmail}
        onChange={(e) => setCustomerEmail(e.target.value)}
        onBlur={handleEmailBlur}
        hint={userId ? `Resolved to user ID: ${userId}` : 'Tab out to resolve to a user ID'}
      />

      <Input
        label="Project Name"
        placeholder="e.g. my-app-db"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        hint="Only letters, numbers, hyphens. Used as the display name."
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-muted">Hosting Node</label>
        <select
          value={nodeId}
          onChange={(e) => setNodeId(e.target.value)}
          required
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent-violet/50 text-text-primary"
        >
          {nodes.length === 0 && (
            <option value="" disabled>No nodes available</option>
          )}
          {nodes.map((n) => (
            <option key={n.id} value={n.id} className="bg-[#0a0a14]">
              {n.label} ({n.ip}) — {n.cpuCores} CPU / {Math.round(n.ramMb / 1024)}GB RAM
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <Button type="submit" loading={busy || lookupBusy} disabled={!userId || !name || !nodeId}>
          {busy ? 'Provisioning…' : 'Provision Project'}
        </Button>
      </div>
    </form>
  );
}
