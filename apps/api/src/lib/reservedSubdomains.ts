/** Hostnames the platform itself uses; no customer deployment or port exposure may take them. */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  'www', 'api', 'app', 'admin', 'mail', 'smtp', 'ftp', 'cdn', 'status',
  'blog', 'docs', 'support', 'help', 'dashboard', 'grafana', 'prometheus', 'loki', 'traefik',
]);

export const isReservedSubdomain = (subdomain: string): boolean => RESERVED_SUBDOMAINS.has(subdomain.toLowerCase());
