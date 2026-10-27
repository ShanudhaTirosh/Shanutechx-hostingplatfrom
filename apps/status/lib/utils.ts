import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Detect if a target is an IP address, localhost, or private internal host.
 * Used to ensure server IPs and private node infrastructure are never leaked on public status views.
 */
export function isIpAddressOrPrivate(target?: string | null): boolean {
  if (!target) return false;
  const clean = target.replace(/^https?:\/\//, "").split(":")[0].split("/")[0].trim().toLowerCase();
  // IPv4 regex (e.g. 192.168.1.1, 10.0.0.1, 123.45.67.89)
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(clean)) return true;
  // IPv6
  if (clean.includes(":") || clean.startsWith("[") || clean.endsWith("]")) return true;
  // Localhost / internal
  if (clean === "localhost" || clean.endsWith(".local") || clean.endsWith(".internal") || clean.endsWith(".lan")) return true;
  return false;
}

/** Turn a display name into a URL/id-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
