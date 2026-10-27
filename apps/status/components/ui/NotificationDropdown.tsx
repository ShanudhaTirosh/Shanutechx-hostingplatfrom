"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Circle, CheckCircle2, XCircle, Trash2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface Notification {
  id: string;
  siteId: string;
  siteName: string;
  type: 'DOWN' | 'UP';
  timestamp: number;
  message: string;
}

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readAt, setReadAt] = useState<number>(0);
  const [clearedAt, setClearedAt] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      // Fetch dashboard data for last 24 hours to find recent events
      const res = await fetch("/api/dashboard?days=7");
      const result = await res.json();
      if (!result.data) return;

      const newNotifications: Notification[] = [];

      result.data.forEach((item: any) => {
        const checks = [...item.checks].sort((a: any, b: any) => a.ts - b.ts);

        for (let i = 1; i < checks.length; i++) {
          const prev = checks[i - 1];
          const curr = checks[i];

          if (prev.ok && !curr.ok) {
            newNotifications.push({
              id: `${item.site.id}-${curr.ts}-DOWN`,
              siteId: item.site.id,
              siteName: item.site.name,
              type: 'DOWN',
              timestamp: curr.ts,
              message: "went down",
            });
          } else if (!prev.ok && curr.ok) {
            newNotifications.push({
              id: `${item.site.id}-${curr.ts}-UP`,
              siteId: item.site.id,
              siteName: item.site.name,
              type: 'UP',
              timestamp: curr.ts,
              message: "recovered",
            });
          }
        }
      });

      // Sort by timestamp descending
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const sorted = newNotifications
        .filter(n => n.timestamp > clearedAt && n.timestamp > oneDayAgo)
        .sort((a, b) => b.timestamp - a.timestamp);

      setNotifications(sorted);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  }, [clearedAt]);

  useEffect(() => {
    const savedReadAt = localStorage.getItem("notificationsReadAt");
    const savedClearedAt = localStorage.getItem("notificationsClearedAt");
    if (savedReadAt) setReadAt(Number(savedReadAt));
    if (savedClearedAt) setClearedAt(Number(savedClearedAt));
  }, []);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 30000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEsc);

      // Mark as read when opening
      const now = Date.now();
      localStorage.setItem("notificationsReadAt", String(now));
      setReadAt(now);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isOpen]);

  const clearNotifications = () => {
    const now = Date.now();
    localStorage.setItem("notificationsClearedAt", String(now));
    setClearedAt(now);
    setNotifications([]);
    setIsOpen(false);
  };

  const unreadCount = notifications.filter(n => n.timestamp > readAt).length;

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-[var(--secondary-bg)] transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-white/50"
        aria-label={`View notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <Bell size={20} className="text-[var(--foreground)]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-[var(--card-bg)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-xl z-50 animate-in fade-in zoom-in duration-200">
          {/* Header Bar */}
          <div className="h-1 bg-neutral-900 dark:bg-white w-full" />

          <div className="flex items-center justify-between p-4 border-b border-[var(--card-border)]">
            <h3 className="font-bold text-lg">Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md hover:bg-[var(--secondary-bg)] text-muted transition-colors"
              aria-label="Close notifications"
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-[var(--secondary-bg)] flex items-center justify-center mb-3">
                  <Bell size={24} className="text-muted" />
                </div>
                <p className="text-sm font-medium text-[var(--foreground)]">All caught up!</p>
                <p className="text-xs text-muted mt-1">No new notifications to show.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--card-border)]">
                {notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={`/monitor/${n.siteId}`}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-start gap-3 p-4 transition-colors hover:bg-[var(--secondary-bg)]",
                      n.timestamp > readAt && "bg-neutral-500/5 dark:bg-white/5"
                    )}
                  >
                    <div className="mt-0.5">
                      {n.type === 'DOWN' ? (
                        <div className="p-1.5 rounded-full bg-rose-100 dark:bg-rose-900/30">
                          <XCircle size={16} className="text-rose-600 dark:text-rose-400" />
                        </div>
                      ) : (
                        <div className="p-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold leading-none">
                          {n.siteName}
                        </p>
                        {n.timestamp > readAt && (
                          <div className="w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
                        )}
                      </div>
                      <p className="text-sm text-[var(--foreground)]">
                        {n.siteName} <span className="text-muted">{n.message}</span>
                      </p>
                      <p className="text-[10px] font-medium text-muted uppercase tracking-wider">
                        {formatDistanceToNow(n.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-[var(--card-border)] bg-[var(--secondary-bg)]/50">
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-2 text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10"
              onClick={clearNotifications}
            >
              <Trash2 size={14} />
              Clear Notifications
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
