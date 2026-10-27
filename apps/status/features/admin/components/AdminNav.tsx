"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Monitor, Settings, LogOut, ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

const links = [
  { href: "/admin", label: "Monitors", icon: Monitor },
  { href: "/admin/incidents", label: "Incidents & Maintenance", icon: AlertTriangle },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-2">
        <img
          src="/images/stx-logo.png"
          alt="STX Logo"
          className="h-5 w-auto object-contain dark:invert"
        />
        <span className="font-bold text-xl leading-none">Admin</span>
      </div>
      <nav className="flex items-center gap-1">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link key={l.href} href={l.href}>
              <Button variant={active ? "secondary" : "ghost"} size="sm" className="gap-2">
                <l.icon size={16} />
                {l.label}
              </Button>
            </Link>
          );
        })}
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft size={16} />
            Status Page
          </Button>
        </Link>
        <Button variant="ghost" size="sm" className="gap-2" onClick={logout}>
          <LogOut size={16} />
          Logout
        </Button>
      </nav>
    </header>
  );
}
