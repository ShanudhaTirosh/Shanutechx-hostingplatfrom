"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { AdminNav } from "@/features/admin/components/AdminNav";
import {
  AlertTriangle,
  Plus,
  Wrench,
  Pencil,
  Trash2,
  Clock,
  MessageSquarePlus,
  CheckCircle2,
  Send,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IncidentUpdate {
  id: number;
  incident_id: string;
  status: string;
  message: string;
  created_at: number;
}

interface Incident {
  id: string;
  title: string;
  type: "incident" | "maintenance";
  status: string;
  impact: "none" | "minor" | "major" | "critical";
  monitors: string;
  parsed_monitors: string[];
  scheduled_start: number | null;
  scheduled_end: number | null;
  created_at: number;
  updated_at: number;
  resolved_at: number | null;
  updates: IncidentUpdate[];
}

interface Monitor {
  id: string;
  name: string;
}

export default function AdminIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "incident" | "maintenance">("all");

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formType, setFormType] = useState<"incident" | "maintenance">("incident");
  const [formTitle, setFormTitle] = useState("");
  const [formImpact, setFormImpact] = useState<"none" | "minor" | "major" | "critical">("minor");
  const [formStatus, setFormStatus] = useState("investigating");
  const [formSelectedMonitors, setFormSelectedMonitors] = useState<string[]>(["all"]);
  const [formMessage, setFormMessage] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setEnd] = useState("");
  const [formNotify, setFormNotify] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Add Update Modal
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateNotify, setUpdateNotify] = useState(false);

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editImpact, setEditImpact] = useState<"none" | "minor" | "major" | "critical">("minor");
  const [editStatus, setEditStatus] = useState("");
  const [editSelectedMonitors, setEditSelectedMonitors] = useState<string[]>([]);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/incidents");
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents ?? []);
        setMonitors(data.monitors ?? []);
      }
    } catch (err) {
      console.error("Failed to load incidents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = (type: "incident" | "maintenance") => {
    setFormType(type);
    setFormTitle("");
    setFormImpact(type === "maintenance" ? "none" : "minor");
    setFormStatus(type === "maintenance" ? "scheduled" : "investigating");
    setFormSelectedMonitors(["all"]);
    setFormMessage("");
    setFormStart("");
    setEnd("");
    setFormNotify(false);
    setFormError("");
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!formMessage.trim()) {
      setFormError("Initial update message is required.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const body = {
        title: formTitle.trim(),
        type: formType,
        status: formStatus,
        impact: formImpact,
        monitors: formSelectedMonitors,
        message: formMessage.trim(),
        scheduled_start: formStart ? new Date(formStart).getTime() : null,
        scheduled_end: formEnd ? new Date(formEnd).getTime() : null,
        notify: formNotify,
      };

      const res = await fetch("/api/admin/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create incident");
      }

      setCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  const openUpdateModal = (inc: Incident) => {
    setActiveIncident(inc);
    setUpdateStatus(inc.status);
    setUpdateMessage("");
    setUpdateNotify(false);
    setUpdateModalOpen(true);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIncident || !updateMessage.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/incidents/${activeIncident.id}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: updateStatus,
          message: updateMessage.trim(),
          notify: updateNotify,
        }),
      });

      if (res.ok) {
        setUpdateModalOpen(false);
        loadData();
      }
    } catch (err) {
      console.error("Failed to post update:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (inc: Incident) => {
    setEditingIncident(inc);
    setEditTitle(inc.title);
    setEditImpact(inc.impact);
    setEditStatus(inc.status);
    setEditSelectedMonitors(inc.parsed_monitors || ["all"]);
    setEditStart(inc.scheduled_start ? new Date(inc.scheduled_start).toISOString().slice(0, 16) : "");
    setEditEnd(inc.scheduled_end ? new Date(inc.scheduled_end).toISOString().slice(0, 16) : "");
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIncident || !editTitle.trim()) return;

    setSubmitting(true);
    try {
      const body = {
        title: editTitle.trim(),
        impact: editImpact,
        status: editStatus,
        monitors: editSelectedMonitors,
        scheduled_start: editStart ? new Date(editStart).getTime() : null,
        scheduled_end: editEnd ? new Date(editEnd).getTime() : null,
      };

      const res = await fetch(`/api/admin/incidents/${editingIncident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEditModalOpen(false);
        loadData();
      }
    } catch (err) {
      console.error("Failed to edit incident:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickResolve = async (inc: Incident) => {
    const targetStatus = inc.type === "maintenance" ? "completed" : "resolved";
    const msg = prompt(`Post resolution note to resolve "${inc.title}":`, "Issue resolved. All services functioning normally.");
    if (msg === null) return;

    await fetch(`/api/admin/incidents/${inc.id}/updates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: targetStatus,
        message: msg.trim() || "Resolved.",
        notify: true,
      }),
    });
    loadData();
  };

  const handleDelete = async (inc: Incident) => {
    if (!confirm(`Permanently delete "${inc.title}" and its timeline updates?`)) return;
    await fetch(`/api/admin/incidents/${inc.id}`, { method: "DELETE" });
    loadData();
  };

  const filteredIncidents = incidents.filter((i) => {
    if (activeTab === "incident") return i.type === "incident";
    if (activeTab === "maintenance") return i.type === "maintenance";
    return true;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "resolved":
      case "completed":
        return "success";
      case "investigating":
      case "identified":
        return "error";
      case "monitoring":
      case "in_progress":
        return "warning";
      default:
        return "neutral";
    }
  };

  const getImpactBadgeVariant = (impact: string) => {
    switch (impact) {
      case "critical":
        return "error";
      case "major":
        return "warning";
      case "minor":
        return "neutral";
      default:
        return "neutral";
    }
  };

  return (
    <>
      <AdminNav />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Incidents & Scheduled Maintenance</h1>
          <p className="text-sm text-muted">
            Manage live incident response, updates, and maintenance schedules displayed publicly.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
          <Button
            size="sm"
            variant="outline"
            className="gap-2 whitespace-nowrap shrink-0"
            onClick={() => openCreateModal("maintenance")}
          >
            <Wrench size={15} />
            Schedule Maintenance
          </Button>
          <Button
            size="sm"
            className="gap-2 whitespace-nowrap shrink-0"
            onClick={() => openCreateModal("incident")}
          >
            <Plus size={15} />
            Declare Incident
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--card-border)] pb-3 mb-6">
        {(
          [
            { id: "all", label: "All Items", count: incidents.length },
            {
              id: "incident",
              label: "Incidents",
              count: incidents.filter((i) => i.type === "incident").length,
            },
            {
              id: "maintenance",
              label: "Maintenance",
              count: incidents.filter((i) => i.type === "maintenance").length,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
              activeTab === tab.id
                ? "bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--foreground)] font-bold shadow-sm dark:border-white/20"
                : "text-muted hover:text-[var(--foreground)]"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded-full font-bold",
                activeTab === tab.id
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                  : "bg-[var(--secondary-bg)] text-muted"
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Incident List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="p-8 text-center text-muted">Loading incidents and maintenance…</Card>
        ) : filteredIncidents.length === 0 ? (
          <Card className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[var(--secondary-bg)] mx-auto flex items-center justify-center text-muted">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="font-bold text-lg">No active or logged items</h3>
            <p className="text-sm text-muted max-w-sm mx-auto">
              Everything is clear. When an outage happens or maintenance is scheduled, post it here.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5 pt-2">
              <Button size="sm" className="gap-2" onClick={() => openCreateModal("incident")}>
                <Plus size={15} />
                Declare Incident
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => openCreateModal("maintenance")}>
                <Wrench size={15} />
                Schedule Maintenance
              </Button>
            </div>
          </Card>
        ) : (
          filteredIncidents.map((inc) => {
            const isResolved = inc.status === "resolved" || inc.status === "completed";
            const latestUpdate = inc.updates?.[0];

            return (
              <Card key={inc.id} className="p-5 space-y-4 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
                        {inc.type}
                      </span>
                      <Badge variant={getStatusBadgeVariant(inc.status)}>
                        {inc.status.replace("_", " ")}
                      </Badge>
                      <Badge variant={getImpactBadgeVariant(inc.impact)}>
                        {inc.impact} impact
                      </Badge>
                      {inc.type === "maintenance" && inc.scheduled_start && (
                        <span className="text-xs text-muted flex items-center gap-1">
                          <Calendar size={13} />
                          {new Date(inc.scheduled_start).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold">{inc.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
                      <span>Posted {new Date(inc.created_at).toLocaleString()}</span>
                      <span>•</span>
                      <span>
                        Affected:{" "}
                        <strong className="text-[var(--foreground)]">
                          {inc.parsed_monitors?.includes("all")
                            ? "All Systems"
                            : inc.parsed_monitors?.join(", ") || "None"}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-start flex-wrap">
                    {!isResolved && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          onClick={() => openUpdateModal(inc)}
                        >
                          <MessageSquarePlus size={14} />
                          Post Update
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1.5 text-xs text-emerald-600 hover:text-emerald-700"
                          onClick={() => handleQuickResolve(inc)}
                        >
                          <CheckCircle2 size={14} />
                          {inc.type === "maintenance" ? "Complete" : "Resolve"}
                        </Button>
                      </>
                    )}
                    {isResolved && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs"
                        onClick={() => openUpdateModal(inc)}
                      >
                        <MessageSquarePlus size={14} />
                        Add Note
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="p-2"
                      onClick={() => openEditModal(inc)}
                      aria-label="Edit"
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="p-2 text-rose-500 hover:text-rose-600"
                      onClick={() => handleDelete(inc)}
                      aria-label="Delete"
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>

                {/* Latest or Timeline Preview */}
                {latestUpdate && (
                  <div className="rounded-lg bg-[var(--secondary-bg)] p-3 border border-[var(--card-border)] space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                        Latest Update: {latestUpdate.status.replace("_", " ")}
                      </span>
                      <span className="text-muted">
                        {new Date(latestUpdate.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{latestUpdate.message}</p>
                  </div>
                )}

                {/* History expand info */}
                {inc.updates && inc.updates.length > 1 && (
                  <div className="text-xs text-muted">
                    + {inc.updates.length - 1} previous update
                    {inc.updates.length > 2 ? "s" : ""} in timeline
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* CREATE MODAL */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={formType === "maintenance" ? "Schedule New Maintenance" : "Declare New Incident"}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} disabled={submitting} className="gap-2">
              <Send size={15} />
              {submitting ? "Publishing…" : "Publish & Notify"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-500 font-medium">
              {formError}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormType("incident");
                  setFormStatus("investigating");
                }}
                className={cn(
                  "py-2 rounded-lg text-sm font-semibold border flex items-center justify-center gap-2",
                  formType === "incident"
                    ? "border-rose-500/50 bg-rose-500/10 text-rose-500"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted"
                )}
              >
                <AlertTriangle size={15} />
                Unplanned Incident
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormType("maintenance");
                  setFormStatus("scheduled");
                }}
                className={cn(
                  "py-2 rounded-lg text-sm font-semibold border flex items-center justify-center gap-2",
                  formType === "maintenance"
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-500 font-bold"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-muted"
                )}
              >
                <Wrench size={15} />
                Maintenance
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Title</label>
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder={
                formType === "maintenance"
                  ? "e.g. Scheduled Database Upgrade & Maintenance"
                  : "e.g. Elevated API Latency & Network Timeouts"
              }
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Impact</label>
              <Select
                value={formImpact}
                onChange={(e) => setFormImpact(e.target.value as any)}
              >
                <option value="none">None</option>
                <option value="minor">Minor Degradation</option>
                <option value="major">Major Outage</option>
                <option value="critical">Critical Down</option>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Status</label>
              <Select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
              >
                {formType === "incident" ? (
                  <>
                    <option value="investigating">Investigating</option>
                    <option value="identified">Identified</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="resolved">Resolved</option>
                  </>
                ) : (
                  <>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </>
                )}
              </Select>
            </div>
          </div>

          {formType === "maintenance" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">Start Time</label>
                <Input
                  type="datetime-local"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">End Time</label>
                <Input
                  type="datetime-local"
                  value={formEnd}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">
              Affected Services
            </label>
            <div className="border border-[var(--card-border)] bg-[var(--input-bg)] rounded-lg p-2.5 max-h-36 overflow-y-auto space-y-1.5 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={formSelectedMonitors.includes("all")}
                  onChange={(e) => {
                    if (e.target.checked) setFormSelectedMonitors(["all"]);
                    else setFormSelectedMonitors([]);
                  }}
                />
                All Monitored Services
              </label>
              {monitors.map((m) => (
                <label key={m.id} className="flex items-center gap-2 cursor-pointer text-muted hover:text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={
                      formSelectedMonitors.includes(m.id) ||
                      formSelectedMonitors.includes("all")
                    }
                    disabled={formSelectedMonitors.includes("all")}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormSelectedMonitors([...formSelectedMonitors, m.id]);
                      } else {
                        setFormSelectedMonitors(formSelectedMonitors.filter((x) => x !== m.id));
                      }
                    }}
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">
              Initial Update Note / Message
            </label>
            <textarea
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-white/50"
              rows={4}
              placeholder="Describe what happened, what systems are affected, and what action is being taken…"
              value={formMessage}
              onChange={(e) => setFormMessage(e.target.value)}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={formNotify}
              onChange={(e) => setFormNotify(e.target.checked)}
              className="h-4 w-4 accent-black dark:accent-white"
            />
            Broadcast notification alert to configured channels (Email, Teams, Telegram, Google Chat)
          </label>
        </form>
      </Modal>

      {/* ADD UPDATE MODAL */}
      <Modal
        open={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        title={`Post Timeline Update: ${activeIncident?.title}`}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setUpdateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSubmit} disabled={submitting} className="gap-2">
              <Send size={15} />
              {submitting ? "Posting…" : "Post Update"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleUpdateSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">New Status</label>
            <Select
              value={updateStatus}
              onChange={(e) => setUpdateStatus(e.target.value)}
            >
              {activeIncident?.type === "maintenance" ? (
                <>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </>
              ) : (
                <>
                  <option value="investigating">Investigating</option>
                  <option value="identified">Identified</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="resolved">Resolved</option>
                </>
              )}
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Progress Note</label>
            <textarea
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-white/50"
              rows={4}
              placeholder="Provide a progress update for this incident or maintenance…"
              value={updateMessage}
              onChange={(e) => setUpdateMessage(e.target.value)}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={updateNotify}
              onChange={(e) => setUpdateNotify(e.target.checked)}
            />
            Broadcast notification alert to configured channels
          </label>
        </form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit ${editingIncident?.type === "maintenance" ? "Maintenance" : "Incident"}`}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={submitting}>
              {submitting ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">Title</label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Impact</label>
              <Select
                value={editImpact}
                onChange={(e) => setEditImpact(e.target.value as any)}
              >
                <option value="none">None</option>
                <option value="minor">Minor Degradation</option>
                <option value="major">Major Outage</option>
                <option value="critical">Critical Down</option>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Status</label>
              <Select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              >
                {editingIncident?.type === "maintenance" ? (
                  <>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </>
                ) : (
                  <>
                    <option value="investigating">Investigating</option>
                    <option value="identified">Identified</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="resolved">Resolved</option>
                  </>
                )}
              </Select>
            </div>
          </div>

          {editingIncident?.type === "maintenance" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">Start Time</label>
                <Input
                  type="datetime-local"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-muted">End Time</label>
                <Input
                  type="datetime-local"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                />
              </div>
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
