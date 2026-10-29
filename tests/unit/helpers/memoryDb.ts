/** Minimal stateful in-memory database: updateMany returns a real count, so claims are compare-and-set. */
export function memoryDb(seed: Record<string, any[]>) {
  const t: Record<string, any[]> = { webmailSnooze: [], webmailMessage: [], webmailScheduledSend: [], smtpAccount: [], announcement: [], user: [], ...structuredClone(seed) };
  let n = 0;
  const matches = (row: any, where: any = {}): boolean =>
    Object.entries(where).every(([k, v]: [string, any]) => {
      if (k === 'OR') return v.some((w: any) => matches(row, w));
      const val = row[k];
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if ('lte' in v) return val != null && val <= v.lte;
        if ('gte' in v) return val != null && val >= v.gte;
        if ('not' in v) return val !== v.not;
        if ('has' in v) return Array.isArray(val) && val.includes(v.has);
        if ('contains' in v) return typeof val === 'string' && val.includes(v.contains);
        if ('in' in v) return Array.isArray(v.in) && v.in.includes(val);
      }
      return val === v;
    });
  const apply = (row: any, data: any) => {
    for (const [k, v] of Object.entries<any>(data)) row[k] = v && typeof v === 'object' && 'increment' in v ? (row[k] ?? 0) + v.increment : v;
  };
  const model = (name: string) => ({
    findMany: async ({ where, orderBy, take }: any = {}) => {
      let rows = t[name].filter((r) => matches(r, where));
      if (orderBy) { const [[f, dir]] = Object.entries<any>(orderBy); rows = [...rows].sort((a, b) => (a[f] > b[f] ? 1 : -1) * (dir === 'desc' ? -1 : 1)); }
      return structuredClone(take ? rows.slice(0, take) : rows);
    },
    count: async ({ where }: any = {}) => t[name].filter((r) => matches(r, where)).length,
    findUnique: async ({ where }: any) => structuredClone(t[name].find((r) => matches(r, where)) ?? null),
    findFirst: async ({ where, orderBy }: any = {}) => {
      let rows = t[name].filter((r) => matches(r, where));
      if (orderBy) { const [[f]] = Object.entries<any>(orderBy); rows = [...rows].sort((a, b) => (a[f] > b[f] ? 1 : -1)); }
      return structuredClone(rows[0] ?? null);
    },
    updateMany: async ({ where, data }: any) => { const rows = t[name].filter((r) => matches(r, where)); rows.forEach((r) => apply(r, data)); return { count: rows.length }; },
    update: async ({ where, data }: any) => { const r = t[name].find((x) => matches(x, where)); if (!r) throw new Error('not found'); apply(r, data); return structuredClone(r); },
    upsert: async ({ where, create, update }: any) => {
      let r = t[name].find((x) => matches(x, where));
      if (r) {
        apply(r, update);
        return structuredClone(r);
      } else {
        r = { id: `new${++n}`, ...create };
        t[name].push(r);
        return structuredClone(r);
      }
    },
    delete: async ({ where }: any) => { const i = t[name].findIndex((x) => matches(x, where)); if (i < 0) throw new Error('not found'); return t[name].splice(i, 1)[0]; },
    create: async ({ data }: any) => { const r = { id: `new${++n}`, ...data }; t[name].push(r); return structuredClone(r); },
  });
  const db: any = {};
  for (const name of Object.keys(t)) db[name] = model(name);
  db.tables = t;
  return db;
}
