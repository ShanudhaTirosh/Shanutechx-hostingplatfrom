"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Check {
  ts: number;
  ok: number;
  error: string | null;
}

interface TimelineProps {
  checks: Check[];
  range: { type: string; value: number };
}

export function Timeline({ checks, range }: TimelineProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);

  const buckets = useMemo(() => {
    const rangeToMs = (r: { type: string; value: number }) => {
      if (r.type === "minutes") return r.value * 60 * 1000;
      if (r.type === "hours") return r.value * 60 * 60 * 1000;
      return r.value * 24 * 60 * 60 * 1000;
    };

    const rangeSegments = (r: { type: string; value: number }) => {
      if (r.type === "minutes") return 60;
      if (r.type === "hours") return 24;
      return r.value;
    };

    const rangeMs = rangeToMs(range);
    const segments = rangeSegments(range);
    const now = Date.now();
    const bucketMs = rangeMs / segments;

    const result = Array.from({ length: segments }, (_, i) => {
      const bucketEnd = now - (segments - 1 - i) * bucketMs;
      const bucketStart = bucketEnd - bucketMs;
      return { start: bucketStart, end: bucketEnd, status: "idle" as "idle" | "good" | "bad", hasBad: false, hasGood: false };
    });

    // Single pass over checks to fill buckets
    for (const check of checks) {
      const diff = now - check.ts;
      if (diff < 0 || diff >= rangeMs) continue;

      const bucketIdx = segments - 1 - Math.floor(diff / bucketMs);
      if (bucketIdx >= 0 && bucketIdx < segments) {
        if (check.ok) {
          result[bucketIdx].hasGood = true;
        } else {
          result[bucketIdx].hasBad = true;
        }
      }
    }

    return result.map(b => ({
      ...b,
      status: b.hasBad ? "bad" : b.hasGood ? "good" : "idle"
    }));
  }, [checks, range]);

  const now = useMemo(() => Date.now(), []);

  const formatBucketTime = (ts: number) => {
    if (range.type === "minutes") return format(ts, "HH:mm:ss");
    if (range.type === "hours") return format(ts, "HH:mm");
    return format(ts, "MMM d, HH:mm");
  };

  return (
    <div className="space-y-2">
      <div className="flex h-6 gap-0.5">
        {buckets.map((bucket, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-sm transition-colors",
              bucket.status === "good" ? "bg-emerald-500" :
              bucket.status === "bad" ? "bg-rose-500" :
              "bg-gray-200 dark:bg-zinc-800"
            )}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltip({
                x: rect.left + rect.width / 2,
                y: rect.top - 10,
                content: (
                  <div className="text-xs">
                    <div className="font-bold">{bucket.status === "good" ? "Healthy" : bucket.status === "bad" ? "Down" : "No Data"}</div>
                    <div>{formatBucketTime(bucket.start)} – {formatBucketTime(bucket.end)}</div>
                  </div>
                )
              });
            }}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-gray-500">
        <span>{range.value} {range.type} ago</span>
        <span>{format(now, "MMMM d, yyyy")}</span>
        <span>Now</span>
      </div>
      {tooltip && (
        <div
          className="fixed z-50 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-white shadow-lg pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
