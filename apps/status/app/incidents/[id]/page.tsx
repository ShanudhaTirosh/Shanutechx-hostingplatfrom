"use client";

import { useEffect, useState, use } from "react";
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
  Calendar,
  Share2,
  CheckCircle2,
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

export default function SingleIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { theme, toggleTheme } = useTheme();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [siteName, setSiteName] = useState("Status");

  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => res.json())
      .then((d) => {
        if (d?.branding?.siteName) setSiteName(d.branding.siteName);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/incidents/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Incident not found");
        return res.json();
      })
      .then((data) => setIncident(data.incident))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Permalink copied to clipboard!");
  };

  const isResolved =
    incident?.status === "resolved" || incident?.status === "completed";

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-8">
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
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-muted">
            Incident Reference: {id}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/incidents">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft size={16} />
              All Incidents
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

      {loading ? (
        <Card className="p-12 text-center text-muted">Loading incident details…</Card>
      ) : error || !incident ? (
        <Card className="p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-xl font-bold">Incident Not Found</h2>
          <p className="text-sm text-muted">
            The requested incident ID does not exist or may have been removed.
          </p>
          <Link href="/incidents">
            <Button size="sm">Back to Incidents</Button>
          </Link>
        </Card>
      ) : (
        <Card className="p-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted px-2 py-0.5 rounded bg-[var(--secondary-bg)]">
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

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {incident.title}
              </h1>

              <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
                <span>Opened {new Date(incident.created_at).toLocaleString()}</span>
                {incident.resolved_at && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-500 font-semibold">
                      Resolved {new Date(incident.resolved_at).toLocaleString()}
                    </span>
                  </>
                )}
                {incident.type === "maintenance" && incident.scheduled_start && (
                  <>
                    <span>•</span>
                    <span className="text-[var(--foreground)] font-medium">
                      Window: {new Date(incident.scheduled_start).toLocaleString()}
                      {incident.scheduled_end && ` – ${new Date(incident.scheduled_end).toLocaleTimeString()}`}
                    </span>
                  </>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={copyLink}
            >
              <Share2 size={14} />
              Copy Link
            </Button>
          </div>

          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--secondary-bg)] p-4 flex items-center justify-between text-xs">
            <span className="text-muted font-medium">Affected Components</span>
            <strong className="text-[var(--foreground)]">
              {incident.monitor_names?.length
                ? incident.monitor_names.join(", ")
                : incident.parsed_monitors?.join(", ") || "All Systems"}
            </strong>
          </div>

          {/* Timeline */}
          <div className="space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
              Incident Progression
            </h2>

            <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--card-border)]">
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
                  <div key={update.id} className="relative">
                    <div
                      className={cn(
                        "absolute -left-6 top-1.5 w-3 h-3 rounded-full ring-4 bg-[var(--card-bg)]",
                        dotColor
                      )}
                    />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold uppercase tracking-wider text-base text-[var(--foreground)]">
                          {update.status.replace("_", " ")}
                          {isLatest && !isResolved && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold lowercase">
                              current status
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
      )}
    </main>
  );
}
