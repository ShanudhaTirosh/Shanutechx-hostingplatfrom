"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AdminNav } from "@/features/admin/components/AdminNav";
import {
  MonitorForm,
  MonitorFormValues,
  toFormValues,
} from "@/features/admin/components/MonitorForm";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Monitor {
  id: string;
  name: string;
  type: string;
  url: string | null;
  host: string | null;
  port: number | null;
  interval_seconds: number;
  enabled: number;
}

function target(m: Monitor): string {
  if (m.type === "tcp") return `${m.host}:${m.port}`;
  if (m.type === "ping") return m.host ?? "";
  return m.url ?? "";
}

export default function AdminMonitors() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MonitorFormValues | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/monitors");
    if (res.ok) {
      const data = await res.json();
      setMonitors(data.monitors ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(m: Monitor) {
    setEditing(toFormValues(m));
    setFormOpen(true);
  }

  async function remove(m: Monitor) {
    if (!confirm(`Delete monitor "${m.name}"? Its uptime history will be kept.`)) return;
    await fetch(`/api/admin/monitors/${m.id}`, { method: "DELETE" });
    load();
  }

  async function toggle(m: Monitor) {
    await fetch(`/api/admin/monitors/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !m.enabled }),
    });
    load();
  }

  return (
    <>
      <AdminNav />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Monitors</h1>
          <p className="text-sm text-muted">Add, edit, enable or remove monitored services.</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openAdd}>
          <Plus size={16} />
          Add monitor
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted">Loading…</div>
        ) : monitors.length === 0 ? (
          <div className="p-8 text-center text-muted">No monitors yet. Add your first one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)] text-left text-muted">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Target</th>
                  <th className="px-4 py-3 font-semibold">Interval</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {monitors.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--card-border)] last:border-0">
                    <td className="px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3 uppercase text-xs text-muted">{m.type}</td>
                    <td className="px-4 py-3 text-muted max-w-[260px] truncate">{target(m)}</td>
                    <td className="px-4 py-3 text-muted">{m.interval_seconds}s</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggle(m)} title="Toggle enabled">
                        <Badge variant={m.enabled ? "success" : "neutral"}>
                          {m.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(m)} aria-label="Edit">
                          <Pencil size={15} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(m)} aria-label="Delete">
                          <Trash2 size={15} className="text-rose-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <MonitorForm
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          load();
        }}
      />
    </>
  );
}
