"use client";

import { useEffect, useState, use } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Timeline } from "@/features/status/components/Timeline";
import Link from "next/link";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { NotificationDropdown } from "@/components/ui/NotificationDropdown";

export default function MonitorDetails({ params }: { params: Promise<{ id: string }> }) {
  const { theme, toggleTheme } = useTheme();
  const { id } = use(params);
  const [site, setSite] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [range, setRange] = useState({ type: "minutes", value: 60 });
  const [branding, setBranding] = useState<any>({
    siteName: "Status",
    footerText: "Operated by",
    footerLinkText: "STX",
    footerLinkUrl: "https://info.shanutechx.com",
  });

  useEffect(() => {
    fetch("/api/settings/public")
      .then((res) => res.json())
      .then((d) => {
        if (d.branding) setBranding((prev: any) => ({ ...prev, ...d.branding }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/sites")
      .then((res) => res.json())
      .then((data) => {
        const found = data.sites.find((s: any) => s.id === id);
        setSite(found);
      });
  }, [id]);

  useEffect(() => {
    if (!site) return;

    const fetchData = async () => {
      const days = range.type === "minutes" ? range.value / 1440 : range.type === "hours" ? range.value / 24 : range.value;
      const [summaryRes, latestRes, checksRes] = await Promise.all([
        fetch(`/api/sites/${site.id}/summary?days=${days}`),
        fetch(`/api/sites/${site.id}/latest`),
        fetch(`/api/sites/${site.id}/checks?days=${days}`),
      ]);

      setData({
        summary: await summaryRes.json(),
        latest: (await latestRes.json()).latest,
        checks: (await checksRes.json()).checks,
      });
    };

    fetchData();
    const timer = setInterval(fetchData, 15000);
    return () => clearInterval(timer);
  }, [site, range]);

  if (!site) return <div className="p-8 text-center">Loading monitor details...</div>;

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/" className="hover:opacity-80 transition-opacity flex items-center gap-2">
              <img
                src="/images/stx-logo.png"
                alt="STX Logo"
                className="h-5 w-auto object-contain dark:invert"
              />
              <span className="font-bold text-xl leading-none">{branding.siteName}</span>
            </Link>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Monitor Details</p>
          <h1 className="text-4xl font-bold tracking-tight">{site.name}</h1>
          <p className="text-muted text-sm flex items-center gap-2 mt-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--secondary-bg)] uppercase tracking-wider text-muted">
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
            {site.type === "http" && site.url ? (
              <span>{site.url}</span>
            ) : (
              <span>Protected Host Infrastructure (Address Hidden)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap shrink-0">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap shrink-0">
              <ArrowLeft size={16} />
              Back to Status Page
            </Button>
          </Link>
          <NotificationDropdown />
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
                "w-2 h-2 rounded-full shrink-0",
                data?.latest?.ok ? "bg-emerald-500" : "bg-rose-500"
              )}
            />
            <span
              className="text-xs font-medium whitespace-nowrap leading-none select-none shrink-0"
              style={{ whiteSpace: "nowrap" }}
            >
              {data?.latest?.ok ? "Online" : "Loading"}
            </span>
          </div>
        </div>
      </header>

      <Card className="w-fit">
        <div className="flex flex-col md:flex-row gap-6 items-end">
          <div className="space-y-2">
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
                  onClick={() => setRange(r)}
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
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Current Status", value: data?.latest?.ok ? "Online" : "Down", color: data?.latest?.ok ? "text-emerald-500" : "text-rose-500" },
          { label: "Uptime", value: data?.summary ? `${data.summary.percent}%` : "--" },
          { label: "Last Checked", value: data?.latest ? new Date(data.latest.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--" },
          { label: "Avg Latency", value: data?.checks ? `${(data.checks.filter((c:any)=>c.latency_ms).reduce((a:any,b:any)=>a+b.latency_ms,0)/(data.checks.filter((c:any)=>c.latency_ms).length||1)).toFixed(0)} ms` : "--" },
          { label: "Total Checks", value: data?.summary?.total || 0 },
          { label: "Interval", value: `${site.intervalSeconds}s` },
        ].map((stat, i) => (
          <Card key={i} className="p-4 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">{stat.label}</span>
            <span className={cn("text-lg font-bold block", stat.color)}>{stat.value}</span>
          </Card>
        ))}
      </div>

      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Uptime History</h2>
        <Timeline checks={data?.checks || []} range={range} />
      </Card>

      <footer className="text-center text-sm text-muted py-8">
        {branding.footerText}{" "}
        <a href={branding.footerLinkUrl} className="font-bold hover:text-white transition-colors underline underline-offset-4">
          {branding.footerLinkText}
        </a>
      </footer>
    </main>
  );
}
