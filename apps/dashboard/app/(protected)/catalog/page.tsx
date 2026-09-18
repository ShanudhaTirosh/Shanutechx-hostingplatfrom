'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { CatalogTemplate } from '@/lib/types';
import { useAppUser } from '@/lib/AppUserContext';
import { ResourceScopeSelector } from '@/components/ResourceScopeSelector';

// ── Category colour mapping ───────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  automation:  '#8b5cf6',
  cms:         '#06b6d4',
  database:    '#10b981',
  dev:         '#f59e0b',
  development: '#f59e0b',
  media:       '#ec4899',
  monitoring:  '#ef4444',
  network:     '#3b82f6',
  storage:     '#84cc16',
  security:    '#f97316',
  messaging:   '#14b8a6',
  analytics:   '#a78bfa',
  gaming:      '#fb923c',
  other:       '#6b7280',
};

function catColor(cat: string) {
  return CAT_COLOR[cat.toLowerCase()] ?? CAT_COLOR.other;
}

// ── Template Logo component with multi-tier fallbacks ────────────────────────
function TemplateLogo({ logo, name, slug, color }: { logo?: string; name: string; slug: string; color: string }) {
  const initials = name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, '');

  const candidates: string[] = [];
  if (logo) {
    if (logo.startsWith('http://') || logo.startsWith('https://') || logo.startsWith('data:')) {
      candidates.push(logo);
    } else if (logo.startsWith('/')) {
      candidates.push(logo);
    } else {
      candidates.push(`https://raw.githubusercontent.com/coollabsio/coolify/main/public/uploads/${logo}`);
    }
  }

  if (cleanSlug) {
    candidates.push(`https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/${cleanSlug}.png`);
    candidates.push(`https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/svg/${cleanSlug}.svg`);
    candidates.push(`https://cdn.simpleicons.org/${cleanSlug}`);
  }

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  const currentSrc = candidates[candidateIndex];

  const handleError = () => {
    if (candidateIndex + 1 < candidates.length) {
      setCandidateIndex((prev) => prev + 1);
    } else {
      setHasError(true);
    }
  };

  return (
    <div
      className="flex items-center justify-center w-11 h-11 rounded-xl text-white text-sm font-bold shrink-0 shadow-lg overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${color}cc, ${color}55)`, border: `1px solid ${color}44` }}
    >
      {!hasError && currentSrc ? (
        <img
          src={currentSrc}
          alt={name}
          className="w-7 h-7 object-contain"
          onError={handleError}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────
function TemplateCard({
  tpl,
  onDeploy,
  onEdit,
  onDelete,
  isAdminOrDev,
}: {
  tpl: CatalogTemplate;
  onDeploy: (tpl: CatalogTemplate) => void;
  onEdit?: (tpl: CatalogTemplate) => void;
  onDelete?: (tpl: CatalogTemplate) => void;
  isAdminOrDev: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const color = catColor(tpl.category);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ '--accent': color } as React.CSSProperties}
      className="relative flex flex-col rounded-2xl border border-white/[0.08] bg-surface-card overflow-hidden transition-all duration-200 hover:border-white/20 hover:shadow-2xl hover:shadow-[var(--accent)]/10 hover:-translate-y-0.5 group"
    >
      {/* gradient top bar */}
      <div
        className="h-1 w-full transition-all duration-300"
        style={{ background: hovered ? `linear-gradient(90deg, ${color}cc, ${color}55)` : `linear-gradient(90deg, ${color}55, transparent)` }}
      />

      <div className="flex flex-col flex-1 p-5 gap-4">
        {/* header */}
        <div className="flex items-start gap-3">
          <TemplateLogo logo={tpl.logo} name={tpl.name} slug={tpl.slug} color={color} />

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary leading-tight truncate">{tpl.name}</h3>
            <span
              className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider"
              style={{ color, background: `${color}18`, border: `1px solid ${color}33` }}
            >
              {tpl.category}
            </span>
          </div>
        </div>

        {/* slogan */}
        <p className="text-xs text-text-muted leading-relaxed line-clamp-2 flex-1">{tpl.slogan || 'No description available.'}</p>

        {/* tags */}
        {tpl.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tpl.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 rounded text-[10px] text-text-faint bg-white/[0.04] border border-white/[0.06]"
              >
                {tag}
              </span>
            ))}
            {tpl.tags.length > 4 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] text-text-faint">+{tpl.tags.length - 4}</span>
            )}
          </div>
        )}

        {/* actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            {tpl.documentation ? (
              <a
                href={tpl.documentation}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-text-faint hover:text-text-muted transition-colors flex items-center gap-1"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Docs
              </a>
            ) : (
              <span />
            )}
            {isAdminOrDev && onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(tpl);
                }}
                className="text-[11px] text-text-faint hover:text-blue-400 transition-colors flex items-center gap-1"
                title="Edit template"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
            )}
            {isAdminOrDev && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(tpl);
                }}
                className="text-[11px] text-text-faint hover:text-red-400 transition-colors flex items-center gap-1"
                title="Delete template"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Delete
              </button>
            )}
          </div>
          <button
            onClick={() => onDeploy(tpl)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all duration-150 active:scale-95"
            style={{ background: `linear-gradient(135deg, ${color}cc, ${color}88)` }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            Deploy
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Deploy modal ──────────────────────────────────────────────────────────────
function parseYamlEnvVars(yaml: string): Record<string, string> {
  const envs: Record<string, string> = {};
  const lines = yaml.split('\n');
  let inEnv = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('environment:')) {
      inEnv = true;
      continue;
    }
    if (inEnv) {
      if (trimmed.startsWith('-')) {
        const item = trimmed.slice(1).trim();
        const parts = item.split('=');
        const key = parts[0].trim();
        let value = parts.slice(1).join('=').trim();

        // Skip automatic service environment variables
        if (
          key.startsWith('SERVICE_PASSWORD_') ||
          key.startsWith('SERVICE_USER_') ||
          key.startsWith('SERVICE_URL_') ||
          key.startsWith('SERVICE_FQDN_')
        ) {
          continue;
        }

        // Clean up ${VAR:-default}
        const defaultMatch = value.match(/\$\{[A-Za-z0-9_]+:-(.*)\}/);
        if (defaultMatch) {
          value = defaultMatch[1];
        } else if (value.startsWith('$')) {
          value = '';
        }

        // Remove surrounding quotes
        value = value.replace(/^['"]|['"]$/g, '');
        if (key) {
          envs[key] = value;
        }
      } else if (trimmed.length > 0 && !trimmed.startsWith('#')) {
        inEnv = false;
      }
    }
  }
  return envs;
}

function DeployModal({
  tpl,
  onClose,
}: {
  tpl: CatalogTemplate;
  onClose: () => void;
}) {
  const router = useRouter();
  const { apiUser } = useAppUser();
  const [nodes, setNodes] = useState<Array<{ id: string; name: string; location: string }>>([]);
  const [nodeId, setNodeId] = useState('');
  const [projectName, setProjectName] = useState(`${tpl.slug}-${Date.now().toString(36)}`);
  const [exposureMode, setExposureMode] = useState<'ssl_with_proxy' | 'internal_only' | 'raw_tcp'>('ssl_with_proxy');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ deploymentId: string; project: string; generatedSecrets?: Record<string, string> } | null>(null);
  
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [customKey, setCustomKey] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [fetchingYaml, setFetchingYaml] = useState(true);

  const [selectedScope, setSelectedScope] = useState<string>('personal');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdminOrDev = apiUser?.role === 'admin' || apiUser?.role === 'dev';

  useEffect(() => {
    if (isAdminOrDev) {
      api.catalog.nodes().then((d) => {
        setNodes(d.nodes);
        if (d.nodes.length === 1) setNodeId(d.nodes[0].id);
      }).catch(() => {});
    }

    setFetchingYaml(true);
    api.catalog.get(tpl.slug).then((res) => {
      const parsed = parseYamlEnvVars(res.template.yaml);
      setEnvVars(parsed);
    }).catch((err) => {
      console.error('Failed to load template YAML', err);
    }).finally(() => {
      setFetchingYaml(false);
    });
  }, [tpl.slug, isAdminOrDev]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const lines = content.split(/\r?\n/);
      const parsed: Record<string, string> = { ...envVars };
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const k = trimmed.slice(0, idx).trim();
          let v = trimmed.slice(idx + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          if (k) parsed[k] = v;
        }
      }
      setEnvVars(parsed);
    };
    reader.readAsText(file);
  }

  async function handleDeploy() {
    if (!nodeId && isAdminOrDev) { setError('Select a target node'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.catalog.deploy({
        slug: tpl.slug,
        nodeId: nodeId || 'default',
        projectName,
        envVars,
        teamId: selectedScope === 'personal' ? null : selectedScope,
      });
      setSuccess({
        deploymentId: res.deployment.id,
        project: res.deployment.subdomain ?? projectName,
        generatedSecrets: (res as any).generatedSecrets,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const color = catColor(tpl.category);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-surface-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* top gradient strip */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${color}, ${color}55)` }} />

        <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Deploy {tpl.name}</h2>
              <p className="text-xs text-text-faint mt-0.5">{tpl.slogan}</p>
            </div>
            <button onClick={onClose} className="text-text-faint hover:text-text-muted transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {success ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div>
                <p className="text-base font-bold text-emerald-400">Deployment Provisioned!</p>
                <p className="text-xs text-text-muted mt-1">Application URL: <code className="text-emerald-300 font-mono">https://{success.project}.app.shanutechx.com</code></p>
              </div>

              {/* Generated Secrets Banner */}
              {success.generatedSecrets && Object.keys(success.generatedSecrets).length > 0 && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 0121 9z" />
                      </svg>
                      Auto-Generated Master Passwords
                    </span>
                    <button
                      onClick={() => {
                        const copyText = Object.entries(success.generatedSecrets!)
                          .map(([k, v]) => `${k}=${v}`)
                          .join('\n');
                        navigator.clipboard.writeText(copyText);
                        alert('Credentials copied to clipboard!');
                      }}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                    >
                      Copy All
                    </button>
                  </div>
                  <div className="space-y-1 font-mono text-[11px] text-white bg-black/40 p-2 rounded max-h-32 overflow-y-auto">
                    {Object.entries(success.generatedSecrets).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center gap-2">
                        <span className="text-text-muted">{k}:</span>
                        <span className="text-amber-200 select-all font-semibold">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => router.push(`/deployments/${success.deploymentId}`)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  </svg>
                  <span>Open Control Panel</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs text-text-muted border border-white/10 hover:bg-white/[0.04]"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Ownership Scope Selector */}
              <div>
                <ResourceScopeSelector value={selectedScope} onChange={setSelectedScope} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Project Name & Subdomain</label>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="w-full px-3 py-2 rounded-lg bg-surface text-sm font-mono text-text-primary border border-white/10 focus:outline-none focus:border-accent-cyan placeholder:text-text-faint"
                  placeholder="my-n8n-instance"
                />
                <p className="text-[11px] text-text-faint">
                  URL slug: <span className="font-mono text-accent-cyan">https://{projectName || 'app'}.app.shanutechx.com</span>
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Network Exposure Mode</label>
                <select
                  value={exposureMode}
                  onChange={(e) => setExposureMode(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-surface text-xs text-text-primary border border-white/10 focus:outline-none"
                >
                  <option value="ssl_with_proxy">HTTPS SSL Proxy (Cloudflare DNS + SSL)</option>
                  <option value="internal_only">Internal Isolated VPC Network Only</option>
                  <option value="raw_tcp">Raw TCP Direct Port Exposure</option>
                </select>
              </div>

              {isAdminOrDev && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-muted">Target Compute Node</label>
                  <select
                    value={nodeId}
                    onChange={(e) => setNodeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface text-sm text-text-primary border border-white/10 focus:outline-none focus:border-white/25"
                  >
                    <option value="">Auto-Select Best Available Node…</option>
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>{n.name} — {n.location}</option>
                    ))}
                  </select>
                </div>
              )}

              {!isAdminOrDev && (
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-300">
                  Your app will be deployed on the next available high-performance node. Node selection is handled automatically.
                </div>
              )}

              {/* Editable Env Vars list + File Upload */}
              {fetchingYaml ? (
                <div className="flex items-center gap-2 text-xs text-text-faint py-2 animate-pulse">
                  <svg className="animate-spin w-3.5 h-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Parsing template env vars…
                </div>
              ) : (
                <div className="space-y-2 border-t border-white/[0.06] pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-text-muted">Environment Variables</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".env,.env.*,.txt,.config"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2 py-1 rounded text-[11px] font-semibold bg-accent-violet/20 border border-accent-violet/40 text-accent-violet hover:bg-accent-violet/30 transition-all flex items-center gap-1"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                      Upload .env
                    </button>
                  </div>
                  {Object.keys(envVars).length > 0 && (
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                      {Object.entries(envVars).map(([key, val]) => (
                        <div key={key} className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-mono text-text-faint break-all">{key}</span>
                          <input
                            value={val}
                            onChange={(e) => setEnvVars({ ...envVars, [key]: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-surface text-xs text-text-primary border border-white/10 focus:outline-none focus:border-white/20"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Add Custom Env Var */}
              {!fetchingYaml && (
                <div className="space-y-2 border-t border-white/[0.06] pt-3">
                  <label className="text-xs font-medium text-text-muted block">Custom Environment Variable</label>
                  <div className="flex gap-2">
                    <input
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                      placeholder="KEY"
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-surface text-xs text-text-primary border border-white/10 focus:outline-none font-mono"
                    />
                    <input
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      placeholder="VALUE"
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-surface text-xs text-text-primary border border-white/10 focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customKey.trim()) {
                          setEnvVars({ ...envVars, [customKey.trim()]: customValue });
                          setCustomKey('');
                          setCustomValue('');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] active:scale-95 text-xs text-text-primary font-medium transition-all"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm text-text-muted border border-white/10 hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeploy}
                  disabled={loading || fetchingYaml}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${color}dd, ${color}88)` }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      Deploying…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.58-5.84a14.927 14.927 0 015.84-2.58M6.3 17.7a2.25 2.25 0 103.18 3.18 2.25 2.25 0 00-3.18-3.18z" />
                      </svg>
                      Deploy Now
                    </span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CatalogPage() {
  const { apiUser } = useAppUser();
  const router = useRouter();
  const [templates, setTemplates] = useState<CatalogTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [deploying, setDeploying] = useState<CatalogTemplate | null>(null);
  const [deleting, setDeleting] = useState<CatalogTemplate | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdminOrDev = apiUser?.role === 'admin' || apiUser?.role === 'dev';

  const fetchCatalog = useCallback(
    async (q: string, cat: string) => {
      setLoading(true);
      try {
        const d = await api.catalog.list({ search: q || undefined, category: cat !== 'all' ? cat : undefined });
        setTemplates(d.templates);
        setCategories(d.categories);
        setTotal(d.total);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial load — get all categories from a full fetch
  useEffect(() => {
    fetchCatalog('', 'all');
  }, [fetchCatalog]);

  // Debounced search
  function handleSearch(q: string) {
    setSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCatalog(q, activeCategory), 280);
  }

  function handleCategory(cat: string) {
    setActiveCategory(cat);
    fetchCatalog(search, cat);
  }

  async function handleDelete(tpl: CatalogTemplate) {
    setDeleting(tpl);
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api.catalog.delete(deleting.slug);
      setDeleting(null);
      fetchCatalog(search, activeCategory);
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  }

  async function handleEdit(tpl: CatalogTemplate) {
    router.push(`/catalog/${tpl.slug}/edit`);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Hero header ── */}
      <div className="relative overflow-hidden border-b border-white/[0.06] bg-gradient-to-b from-[#13101f] to-surface px-6 py-8">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-violet-600/10 blur-3xl" />
          <div className="absolute top-0 right-1/3 w-40 h-40 rounded-full bg-cyan-500/8 blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                  <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </span>
              <span className="text-xs font-medium text-violet-400 uppercase tracking-widest">App Catalog</span>
            </div>
            {isAdminOrDev && (
              <button
                onClick={() => router.push('/catalog/new')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 transition-all shadow-lg shadow-violet-500/25 active:scale-95"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Create Template
              </button>
            )}
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">One-Click App Deployments</h1>
          <p className="text-sm text-text-muted mb-5">
            {total} pre-configured apps ready to deploy — from automation to databases, CMS to monitoring.
          </p>

          {/* Search */}
          <div className="relative max-w-lg">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search n8n, WordPress, Grafana…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-text-primary placeholder:text-text-faint focus:outline-none focus:border-white/25 focus:bg-white/[0.07] transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── Category tabs ── */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-white/[0.05] overflow-x-auto scrollbar-none shrink-0">
        {['all', ...categories].map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-white/[0.12] text-text-primary'
                : 'text-text-faint hover:text-text-muted hover:bg-white/[0.05]'
            }`}
            style={activeCategory === cat && cat !== 'all' ? {
              background: `${catColor(cat)}22`,
              color: catColor(cat),
              border: `1px solid ${catColor(cat)}44`,
            } : {}}
          >
            {cat === 'all' ? `All (${total})` : cat}
          </button>
        ))}
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-52 rounded-2xl bg-white/[0.03] animate-pulse border border-white/[0.04]" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-text-faint">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <p className="text-sm">No templates match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {templates.map((tpl) => (
              <TemplateCard 
                key={tpl.slug} 
                tpl={tpl} 
                onDeploy={setDeploying}
                onEdit={isAdminOrDev ? handleEdit : undefined}
                onDelete={isAdminOrDev ? handleDelete : undefined}
                isAdminOrDev={isAdminOrDev}
              />
            ))}
          </div>
        )}
      </div>

      {/* Deploy modal */}
      {deploying && <DeployModal tpl={deploying} onClose={() => setDeploying(null)} />}

      {/* Delete confirmation modal */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDeleting(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-surface-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 bg-gradient-to-r from-red-500 to-red-400" />
            <div className="p-6 space-y-5">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                    <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-text-primary">Delete Template</h2>
                  <p className="text-sm text-text-muted mt-1">
                    Are you sure you want to delete <strong className="text-text-primary">{deleting.name}</strong>? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setDeleting(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm text-text-muted border border-white/10 hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 transition-all active:scale-[0.98]"
                >
                  Delete Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
