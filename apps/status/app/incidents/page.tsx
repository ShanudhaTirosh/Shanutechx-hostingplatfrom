"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/components/ThemeProvider";
import {
  ArrowLeft,
  Moon,
  Sun,
  AlertTriangle,
  AlertCircle,
  Wrench,
  CheckCircle2,
  Clock,
  Calendar,
  ChevronRight,
  Share2,
  ExternalLink,
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
  monitor_names?: string[];
  scheduled_start: number | null;
  scheduled_end: number | null;
  created_at: number;
  updated_at: number;
  resolved_at: number | null;
  updates: IncidentUpdate[];
}

interface IncidentsData {
  all: Incident[];
  incidents: {
    active: Incident[];
    past: Incident[];
  };
  maintenance: {
    active: Incident[];
    upcoming: Incident[];
    past: Incident[];
  };
  hasActiveIssues: boolean;
}

export default function IncidentsPage() {
  const { theme, toggleTheme } = useTheme();
  const [data, setData] = useState<IncidentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "history" | "maintenance">("active");
  const [siteName, setSiteName] = useState("Status");

  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => res.json())
      .then((d) => {
        if (d?.branding?.siteName) setSiteName(d.branding.siteName);
      })
      .catch(() => {});
  }, []);

  const loadIncidents = useCallback(async () => {
    try {
      const res = await fetch("/api/incidents");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load incidents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIncidents();
    const interval = setInterval(loadIncidents, 30000);
    return () => clearInterval(interval);
  }, [loadIncidents]);

  const activeIncidents = data?.incidents.active ?? [];
  const pastIncidents = data?.incidents.past ?? [];
  const activeMaint = data?.maintenance.active ?? [];
  const upcomingMaint = data?.maintenance.upcoming ?? [];
  const pastMaint = data?.maintenance.past ?? [];

  const activeAndUpcomingCount =
    activeIncidents.length + activeMaint.length + upcomingMaint.length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "resolved":
      case "completed":
        return <Badge variant="success">Resolved</Badge>;
      case "investigating":
        return <Badge variant="error">Investigating</Badge>;
      case "identified":
        return <Badge variant="error">Identified</Badge>;
      case "monitoring":
        return <Badge variant="warning">Monitoring</Badge>;
      case "in_progress":
        return <Badge variant="warning">In Progress</Badge>;
      case "scheduled":
        return <Badge variant="neutral">Scheduled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case "critical":
        return <Badge variant="error">Critical Impact</Badge>;
      case "major":
        return <Badge variant="warning">Major Outage</Badge>;
      case "minor":
        return <Badge variant="neutral">Minor Degradation</Badge>;
      default:
        return null;
    }
  };

  const copyIncidentLink = (id: string) => {
    const url = `${window.location.origin}/incidents/${id}`;
    navigator.clipboard.writeText(url);
    alert("Link copied to clipboard: " + url);
  };

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/" className="hover:opacity-80 transition-opacity flex items-center gap-2">
              <img
                src="/images/stx-logo.png"
                alt="STX Logo"
                className="h-5 w-auto object-contain dark:invert"
              />
              <span className="font-bold text-xl leading-none">{siteName}</span>
            </Link>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Incidents & Maintenance</h1>
          <p className="text-sm text-muted">
            Live updates, history of outages, and scheduled system maintenance.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap shrink-0">
              <ArrowLeft size={16} />
              Status Page
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
        </div>
      </header>

      {/* Top Status Card */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
              data?.hasActiveIssues
                ? "bg-rose-500/10 text-rose-500"
                : "bg-emerald-500/10 text-emerald-500"
            )}
          >
            {data?.hasActiveIssues ? (
              <AlertTriangle size={24} />
            ) : (
              <CheckCircle2 size={24} />
            )}
          </div>
          <div className="space-y-0.5">
            <h2 className="text-lg font-bold">
              {data?.hasActiveIssues
                ? "Active Incident or Maintenance in Progress"
                : "All Systems Operational"}
            </h2>
            <p className="text-xs text-muted">
              {data?.hasActiveIssues
                ? `${activeIncidents.length} active incident(s) and ${activeMaint.length} ongoing maintenance operation(s).`
                : "No ongoing disruptions or degraded performance reported at this time."}
            </p>
          </div>
        </div>
      </Card>

      {/* Navigation Tabs */}
      <div className="flex gap-2 p-1.5 rounded-xl bg-[var(--secondary-bg)] border border-[var(--card-border)] overflow-x-auto">
        <button
          onClick={() => setActiveTab("active")}
          className={cn(
            "px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shrink-0",
            activeTab === "active"
              ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm border border-[var(--card-border)] dark:border-white/20"
              : "text-muted hover:text-[var(--foreground)]"
          )}
        >
          <AlertCircle size={15} />
          Active & Upcoming
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full font-bold",
              activeTab === "active"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                : "bg-[var(--card-border)]/50 text-muted"
            )}
          >
            {activeAndUpcomingCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={cn(
            "px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shrink-0",
            activeTab === "history"
              ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm border border-[var(--card-border)] dark:border-white/20"
              : "text-muted hover:text-[var(--foreground)]"
          )}
        >
          <Clock size={15} />
          Past Incidents
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full font-bold",
              activeTab === "history"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                : "bg-[var(--card-border)]/50 text-muted"
            )}
          >
            {pastIncidents.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("maintenance")}
          className={cn(
            "px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shrink-0",
            activeTab === "maintenance"
              ? "bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm border border-[var(--card-border)] dark:border-white/20"
              : "text-muted hover:text-[var(--foreground)]"
          )}
        >
          <Wrench size={15} />
          Maintenance Schedule
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full font-bold",
              activeTab === "maintenance"
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                : "bg-[var(--card-border)]/50 text-muted"
            )}
          >
            {upcomingMaint.length + activeMaint.length + pastMaint.length}
          </span>
        </button>
      </div>

      {/* TAB 1: ACTIVE & UPCOMING */}
      {activeTab === "active" && (
        <section className="space-y-6">
          {loading ? (
            <Card className="p-8 text-center text-muted">Loading active incidents…</Card>
          ) : activeAndUpcomingCount === 0 ? (
            <Card className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
                <CheckCircle2 size={26} />
              </div>
              <h3 className="font-bold text-lg">No active incidents or upcoming maintenance</h3>
              <p className="text-sm text-muted max-w-sm mx-auto">
                All services are currently healthy. Past incidents can be viewed in the incident history tab.
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Active incidents */}
              {activeIncidents.map((inc) => (
                <IncidentDetailCard
                  key={inc.id}
                  incident={inc}
                  onShare={() => copyIncidentLink(inc.id)}
                />
              ))}

              {/* In-progress maintenance */}
              {activeMaint.map((inc) => (
                <IncidentDetailCard
                  key={inc.id}
                  incident={inc}
                  onShare={() => copyIncidentLink(inc.id)}
                />
              ))}

              {/* Upcoming maintenance */}
              {upcomingMaint.length > 0 && (
                <div className="space-y-4 pt-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                    <Calendar size={16} />
                    Scheduled Maintenance
                  </h3>
                  {upcomingMaint.map((inc) => (
                    <IncidentDetailCard
                      key={inc.id}
                      incident={inc}
                      onShare={() => copyIncidentLink(inc.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: PAST INCIDENTS */}
      {activeTab === "history" && (
        <section className="space-y-6">
          {pastIncidents.length === 0 ? (
            <Card className="p-12 text-center text-muted">
              No previous incidents recorded.
            </Card>
          ) : (
            pastIncidents.map((inc) => (
              <IncidentDetailCard
                key={inc.id}
                incident={inc}
                onShare={() => copyIncidentLink(inc.id)}
              />
            ))
          )}
        </section>
      )}

      {/* TAB 3: MAINTENANCE */}
      {activeTab === "maintenance" && (
        <section className="space-y-6">
          {activeMaint.length === 0 &&
          upcomingMaint.length === 0 &&
          pastMaint.length === 0 ? (
            <Card className="p-12 text-center text-muted">
              No scheduled or completed maintenance records.
            </Card>
          ) : (
            <>
              {activeMaint.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500">
                    Currently In Progress
                  </h3>
                  {activeMaint.map((inc) => (
                    <IncidentDetailCard
                      key={inc.id}
                      incident={inc}
                      onShare={() => copyIncidentLink(inc.id)}
                    />
                  ))}
                </div>
              )}

              {upcomingMaint.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                    <Calendar size={14} />
                    Upcoming Maintenance
                  </h3>
                  {upcomingMaint.map((inc) => (
                    <IncidentDetailCard
                      key={inc.id}
                      incident={inc}
                      onShare={() => copyIncidentLink(inc.id)}
                    />
                  ))}
                </div>
              )}

              {pastMaint.length > 0 && (
                <div className="space-y-4 pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                    Completed Maintenance
                  </h3>
                  {pastMaint.map((inc) => (
                    <IncidentDetailCard
                      key={inc.id}
                      incident={inc}
                      onShare={() => copyIncidentLink(inc.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}

function IncidentDetailCard({
  incident,
  onShare,
}: {
  incident: Incident;
  onShare: () => void;
}) {
  const isResolved = incident.status === "resolved" || incident.status === "completed";
  const isMaintenance = incident.type === "maintenance";

  return (
    <Card className="p-6 space-y-6 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted px-2 py-0.5 rounded bg-[var(--secondary-bg)]">
              {incident.type}
            </span>
            <Badge
              variant={
                isResolved
                  ? "success"
                  : incident.status === "investigating"
                  ? "error"
                  : "warning"
              }
            >
              {incident.status.replace("_", " ")}
            </Badge>
            {incident.impact !== "none" && (
              <Badge
                variant={
                  incident.impact === "critical"
                    ? "error"
                    : incident.impact === "major"
                    ? "warning"
                    : "neutral"
                }
              >
                {incident.impact} impact
              </Badge>
            )}
          </div>

          <h2 className="text-xl font-bold">{incident.title}</h2>

          <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
            <span>Posted {new Date(incident.created_at).toLocaleString()}</span>
            {isMaintenance && incident.scheduled_start && (
              <>
                <span>•</span>
                <span className="text-[var(--foreground)] font-medium">
                  Window: {new Date(incident.scheduled_start).toLocaleString()}
                  {incident.scheduled_end && ` – ${new Date(incident.scheduled_end).toLocaleTimeString()}`}
                </span>
              </>
            )}
            <span>•</span>
            <span>
              Affected:{" "}
              <strong className="text-[var(--foreground)] font-semibold">
                {incident.monitor_names?.length
                  ? incident.monitor_names.join(", ")
                  : incident.parsed_monitors?.join(", ") || "All Systems"}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/incidents/${incident.id}`}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
              <ExternalLink size={13} />
              Permalink
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={onShare}
            aria-label="Share incident"
          >
            <Share2 size={13} />
            Share
          </Button>
        </div>
      </div>

      {/* Chronological Timeline */}
      <div className="border-t border-[var(--card-border)] pt-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-4">
          Update Timeline
        </h3>
        <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--card-border)]">
          {incident.updates.map((update, idx) => {
            const isLatest = idx === 0;
            const updateStatus = update.status.toLowerCase();
            const dotColor =
              updateStatus === "resolved" || updateStatus === "completed"
                ? "bg-emerald-500 ring-emerald-500/20"
                : updateStatus === "investigating"
                ? "bg-rose-500 ring-rose-500/20"
                : updateStatus === "identified"
                ? "bg-amber-500 ring-amber-500/20"
                : "bg-neutral-400 ring-neutral-400/20";

            return (
              <div key={update.id} className="relative group">
                <div
                  className={cn(
                    "absolute -left-6 top-1 w-3 h-3 rounded-full ring-4 bg-[var(--card-bg)]",
                    dotColor
                  )}
                />
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold uppercase tracking-wider text-[var(--foreground)]">
                      {update.status.replace("_", " ")}
                      {isLatest && !isResolved && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold lowercase">
                          latest
                        </span>
                      )}
                    </span>
                    <span className="text-muted">
                      {new Date(update.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed text-[var(--foreground)]">
                    {update.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
