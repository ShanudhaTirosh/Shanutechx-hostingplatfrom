"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Timeline } from "@/features/status/components/Timeline";
import Link from "next/link";
import { Search, Moon, Sun, X, Settings, AlertTriangle, ArrowRight, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { NotificationDropdown } from "@/components/ui/NotificationDropdown";

interface Site {
  id: string;
  name: string;
  url: string;
  type?: string;
  isNode?: boolean;
}

interface ActiveIncident {
  id: string;
  title: string;
  type: "incident" | "maintenance";
  status: string;
  impact: string;
  monitor_names?: string[];
  updates: { id: number; status: string; message: string; created_at: number }[];
}

interface Branding {
  siteName: string;
  tagline: string;
  description: string;
  footerText: string;
  footerLinkText: string;
  footerLinkUrl: string;
}

const DEFAULT_BRANDING: Branding = {
  siteName: "Status",
  tagline: "STX Cloud & Infrastructure Health",
  description: "Real-time availability, operational telemetry, and uptime status for STX platform services.",
  footerText: "Operated by",
  footerLinkText: "STX",
  footerLinkUrl: "https://info.shanutechx.com",
};

interface SiteData {
  site: Site;
  summary: { total: number; okCount: number; percent: number } | null;
  latest: { ts: number; ok: number; latency_ms: number | null } | null;
  checks: any[];
}

export default function Dashboard() {
  const { theme, toggleTheme } = useTheme();
  const [siteDataList, setSiteDataList] = useState<SiteData[]>([]);
  const [range, setRange] = useState({ type: "minutes", value: 60 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [activeItems, setActiveItems] = useState<ActiveIncident[]>([]);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => res.json())
      .then((d) => {
        if (d.branding) setBranding((prev) => ({ ...prev, ...d.branding }));
      })
      .catch(() => {});
  }, []);

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch("/api/incidents");
      if (res.ok) {
        const json = await res.json();
        const active = [
          ...(json?.incidents?.active || []),
          ...(json?.maintenance?.active || []),
        ];
        setActiveItems(active);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchIncidents();
    const timer = setInterval(fetchIncidents, 30000);
    return () => clearInterval(timer);
  }, [fetchIncidents]);

  const fetchData = useCallback(async () => {
    const days = range.type === "minutes" ? range.value / 1440 : range.type === "hours" ? range.value / 24 : range.value;
    try {
      const res = await fetch(`/api/dashboard?days=${days}`);
      const result = await res.json();
      if (result.data) {
        setSiteDataList(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 15000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const filteredSiteData = siteDataList.filter(d =>
    d.site.name.toLowerCase().includes(search.toLowerCase()) ||
    d.site.url.toLowerCase().includes(search.toLowerCase())
  );

  const anyDown = siteDataList.some(d => d.latest && !d.latest.ok);

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <img
              src="/images/stx-logo.png"
              alt="STX Logo"
              className="h-5 w-auto object-contain dark:invert"
            />
            <span className="font-bold text-xl leading-none">{branding.siteName}</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">{branding.tagline}</h1>
          <p className="text-muted">{branding.description}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap shrink-0">
          <Link href="/incidents">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs whitespace-nowrap shrink-0">
              <AlertTriangle
                size={14}
                className={activeItems.length > 0 ? "text-rose-500 animate-bounce" : "text-muted"}
              />
              <span>Incidents</span>
              {activeItems.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500" />
              )}
            </Button>
          </Link>
          <NotificationDropdown />
          <Link href="/admin" aria-label="Admin settings">
            <Button variant="ghost" size="sm" className="shrink-0">
              <Settings size={16} />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="shrink-0"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--card-border)] bg-[var(--secondary-bg)] whitespace-nowrap shrink-0 min-w-max select-none"
            style={{ whiteSpace: "nowrap", flexShrink: 0 }}
          >
            <div
              className={cn(
                "w-2 h-2 rounded-full shrink-0 animate-pulse",
                anyDown || activeItems.length > 0 ? "bg-rose-500" : "bg-emerald-500"
              )}
            />
            <span
              className="text-xs font-medium whitespace-nowrap leading-none select-none shrink-0"
              style={{ whiteSpace: "nowrap" }}
            >
              {anyDown || activeItems.length > 0
                ? "Issues\u00A0detected"
                : "All\u00A0systems\u00A0normal"}
            </span>
          </div>
        </div>
      </header>

      {/* Active Incidents & Maintenance Alert Banner */}
      {activeItems.length > 0 && (
        <div className="space-y-3">
          {activeItems.map((item) => {
            const latestUpdate = item.updates?.[0];
            const isCritical = item.impact === "critical" || item.impact === "major";
            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-sm",
                  item.type === "maintenance"
                    ? "bg-amber-500/10 border-amber-500/30"
                    : isCritical
                    ? "bg-rose-500/10 border-rose-500/30"
                    : "bg-amber-500/10 border-amber-500/30"
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--secondary-bg)]">
                      {item.type === "maintenance" ? "Maintenance in Progress" : "Active Incident"}
                    </span>
                    <Badge variant={isCritical ? "error" : "warning"}>
                      {item.status.replace("_", " ")}
                    </Badge>
                    {item.impact !== "none" && (
                      <span className="text-xs font-semibold text-muted">
                        • {item.impact} impact
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-base sm:text-lg">{item.title}</h3>
                  {latestUpdate && (
                    <p className="text-xs sm:text-sm text-muted line-clamp-2">
                      <strong className="text-[var(--foreground)]">Latest Update:</strong>{" "}
                      {latestUpdate.message}
                    </p>
                  )}
                </div>
                <Link href={`/incidents/${item.id}`} className="shrink-0">
                  <Button size="sm" variant="secondary" className="gap-1.5 text-xs font-bold">
                    View Incident Details
                    <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <Card className="flex flex-col md:flex-row gap-6 items-end">
        <div className="flex-1 space-y-2 w-full">
          <label className="text-xs font-bold uppercase tracking-wider text-muted">History window</label>
          <div className="flex gap-1 bg-[var(--secondary-bg)] p-1 rounded-lg w-fit">
            {[
              { type: "minutes", value: 60, label: "60 min" },
              { type: "hours", value: 24, label: "24 hours" },
              { type: "days", value: 30, label: "30 days" },
              { type: "days", value: 90, label: "90 days" },
            ].map((r) => (
              <button
                key={`${r.type}-${r.value}`}
                onClick={() => {
                  setLoading(true);
                  setRange(r);
                }}
                className={cn(
                  "px-3 py-1 rounded-md text-sm font-medium transition-colors",
                  range.type === r.type && range.value === r.value
                    ? "bg-[var(--card-bg)] shadow-sm"
                    : "text-muted hover:text-[var(--foreground)]"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-[2] space-y-2 w-full">
          <label htmlFor="search-monitors" className="text-xs font-bold uppercase tracking-wider text-muted">
            Search monitors
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              id="search-monitors"
              type="text"
              placeholder="Search by name or URL"
              className="w-full pl-10 pr-10 py-2 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-white/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-[var(--foreground)] transition-colors"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-4 text-xs font-medium text-muted">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" /> Healthy
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-500" /> Down
          </div>
        </div>
      </Card>

      <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity", loading && "opacity-50")}>
        {filteredSiteData.length === 0 && search && (
          <div className="col-span-full py-16 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[var(--secondary-bg)] flex items-center justify-center">
              <Search className="text-muted" size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold">No monitors found</h3>
              <p className="text-sm text-muted">No results for &quot;{search}&quot;. Try a different term.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSearch("")}>
              Clear Search
            </Button>
          </div>
        )}
        {filteredSiteData.map((data) => {
          const { site } = data;
          return (
            <Link key={site.id} href={`/monitor/${site.id}`}>
              <Card className="hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors cursor-pointer space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{site.name}</h3>
                    <p className="text-xs text-muted flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--secondary-bg)] uppercase tracking-wider text-muted">
                        {site.type === "tcp"
                          ? "VPS Host Node"
                          : site.type === "ping"
                          ? "VPS Ping Node"
                          : site.url?.startsWith("https")
                          ? "HTTPS"
                          : site.url?.startsWith("http")
                          ? "HTTP"
                          : "VPS Node"}
                      </span>
                      {site.type === "http" && site.url && (
                        <span className="truncate text-muted">
                          {site.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </span>
                      )}
                    </p>
                  </div>
                  {data?.latest && (
                    <Badge variant={data.latest.ok ? "success" : "error"}>
                      {data.latest.ok ? "Online" : "Down"}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 py-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Last Checked</span>
                    <span className="block text-xs font-semibold">
                      {data?.latest ? new Date(data.latest.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--"}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Uptime</span>
                    <span className="block text-xs font-semibold">
                      {data?.summary ? `${data.summary.percent}%` : "--"}
                    </span>
                  </div>
                   <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Checks</span>
                    <span className="block text-xs font-semibold">
                      {data?.summary ? data.summary.total : 0}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Latency</span>
                    <span className={cn(
                      "block text-sm font-bold",
                      data?.latest?.latency_ms && data.latest.latency_ms < 200 ? "text-emerald-500" : "text-[var(--foreground)]"
                    )}>
                      {data?.latest?.latency_ms ?? "--"} ms
                    </span>
                  </div>
                </div>

                <Timeline checks={data?.checks || []} range={range} />
              </Card>
            </Link>
          );
        })}
      </div>

      <footer className="text-center text-sm text-muted py-8">
        {branding.footerText}{" "}
        <a href={branding.footerLinkUrl} className="font-bold hover:text-white transition-colors underline underline-offset-4">
          {branding.footerLinkText}
        </a>
      </footer>
    </main>
  );
}
