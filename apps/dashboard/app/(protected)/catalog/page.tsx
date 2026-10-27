'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { CatalogTemplate, Plan } from '@/lib/types';
import { useAppUser } from '@/lib/AppUserContext';

// ── Category colour mapping ───────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  automation:  '#ffffff',
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
  analytics:   '#e4e4e7',
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
  catalogPlan,
}: {
  tpl: CatalogTemplate;
  onDeploy: (tpl: CatalogTemplate) => void;
  onEdit?: (tpl: CatalogTemplate) => void;
  onDelete?: (tpl: CatalogTemplate) => void;
  isAdminOrDev: boolean;
  catalogPlan?: Plan | null;
}) {
  const [hovered, setHovered] = useState(false);
  const color = catColor(tpl.category);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ '--accent': color } as React.CSSProperties}
      className="relative flex flex-col rounded-2xl border border-white/[0.08] bg-[#0c0d12] overflow-hidden transition-all duration-200 hover:border-white/20 hover:shadow-2xl hover:shadow-[var(--accent)]/10 hover:-translate-y-0.5 group"
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

        {/* Plan Pricing & Standard Specs */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
          <div className="flex flex-col">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold tracking-wider">Plan & Pricing</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm font-extrabold text-white tracking-tight">
                {catalogPlan
                  ? `${catalogPlan.currency} ${(catalogPlan.price / 100).toLocaleString()}`
                  : 'Standard'}
              </span>
              <span className="text-[10px] text-neutral-400">
                /{catalogPlan?.billingType === 'monthly' ? 'mo' : (catalogPlan?.billingType || 'mo')}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              1 App Slot
            </span>
            <span className="text-[10px] text-neutral-400 font-mono mt-0.5">
              {catalogPlan?.specsJson && typeof catalogPlan.specsJson === 'object' && (catalogPlan.specsJson as any).cpuCores
                ? `${(catalogPlan.specsJson as any).cpuCores} vCPU • ${((catalogPlan.specsJson as any).ramMb || 1024) >= 1024 ? `${((catalogPlan.specsJson as any).ramMb || 1024) / 1024}GB` : `${(catalogPlan.specsJson as any).ramMb}MB`} RAM`
                : '0.5 vCPU • 1GB RAM'}
            </span>
          </div>
        </div>

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
  catalogPlan,
}: {
  tpl: CatalogTemplate;
  onClose: () => void;
  catalogPlan?: Plan | null;
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
  const [cpuLimit, setCpuLimit] = useState<'0.5' | '1.0' | '2.0'>('0.5');
  const [memoryLimit, setMemoryLimit] = useState<'512M' | '1G' | '2G'>('1G');
  const [maskedKeys, setMaskedKeys] = useState<Record<string, boolean>>({});
  const [customKey, setCustomKey] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [fetchingYaml, setFetchingYaml] = useState(true);

  // Configuration file state (manual editing or file upload)
  const defaultLiveKitYaml = `# LiveKit WebRTC Server Configuration
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
redis:
  address: redis:6379
keys:
  # API Key and Secret are auto-generated and wired automatically
logging:
  level: info
`;

  const defaultLavalinkYaml = `# Lavalink v4 Audio Server Configuration
server:
  port: 2333
  address: 0.0.0.0
  http2:
    enabled: false
lavalink:
  plugins:
    - dependency: "dev.lavalink.youtube:youtube-plugin:1.5.2"
      snapshot: false
  server:
    password: "\${LAVALINK_PASSWORD}"
    sources:
      youtube: true
      bandcamp: true
      soundcloud: true
      twitch: true
      vimeo: true
      http: true
      local: false
    filters:
      volume: true
      equalizer: true
      karaoke: true
      timescale: true
      tremolo: true
      vibrato: true
      distortion: true
      rotation: true
      channelMix: true
      lowPass: true
    bufferDurationMs: 400
    frameBufferDurationMs: 5000
    opusEncodingQuality: 10
    resamplingQuality: LOW
    trackStuckThresholdMs: 10000
    useSeekGhosting: true
    playerUpdateInterval: 5
    youtubePlaylistLoadLimit: 6
    youtubeSearchEnabled: true
    soundcloudSearchEnabled: true
    gc-warnings: true
plugins:
  youtube:
    enabled: true
    allowSearch: true
    allowDirectVideoIds: true
    allowDirectPlaylistIds: true
    clients:
      - MUSIC
      - ANDROID
      - WEB
metrics:
  prometheus:
    enabled: false
    endpoint: /metrics
logging:
  level:
    root: INFO
    lavalink: INFO
`;

  const initialConfigName = tpl.slug === 'livekit' ? 'livekit.yaml' : tpl.slug === 'lavalink' ? 'application.yml' : '';
  const initialConfigContent = tpl.slug === 'livekit' ? defaultLiveKitYaml : tpl.slug === 'lavalink' ? defaultLavalinkYaml : '';
  const initialShowEditor = tpl.slug === 'livekit' || tpl.slug === 'lavalink';

  const [configFileName, setConfigFileName] = useState(initialConfigName);
  const [configFileContent, setConfigFileContent] = useState(initialConfigContent);
  const [showConfigEditor, setShowConfigEditor] = useState(initialShowEditor);
  const configFileRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPasteEnv, setShowPasteEnv] = useState(false);
  const [pasteEnvText, setPasteEnvText] = useState('');

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

  function handlePasteEnvApply() {
    if (!pasteEnvText.trim()) return;
    const lines = pasteEnvText.split(/\r?\n/);
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
    setPasteEnvText('');
    setShowPasteEnv(false);
  }

  function handleConfigFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setConfigFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (typeof content === 'string') {
        setConfigFileContent(content);
        setShowConfigEditor(true);
      }
    };
    reader.readAsText(file);
  }

  async function handleDeploy() {
    setLoading(true);
    setError('');
    try {
      const targetNodeId = nodeId || (nodes.length > 0 ? nodes[0].id : 'default');
      const res = await api.catalog.deploy({
        slug: tpl.slug,
        nodeId: targetNodeId,
        projectName: projectName.trim() || `${tpl.slug}-${crypto.randomUUID().slice(0, 4)}`,
        envVars,
        teamId: null,
        exposureMode: 'auto',
        configFileContent: configFileContent.trim() ? configFileContent : undefined,
        configFileName: configFileName.trim() ? configFileName : undefined,
        cpuLimit,
        memoryLimit,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div
        className="relative z-10 w-full max-w-xl rounded-2xl border border-white/15 bg-[#0a0a0d] shadow-2xl shadow-black overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* top gradient strip */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${color}, ${color}55)` }} />

        <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto bg-[#0a0a0d] scrollbar-thin">
          <div className="flex items-center justify-between pb-1 border-b border-white/[0.08]">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Deploy {tpl.name}</h2>
              <p className="text-xs text-neutral-400 mt-0.5">{tpl.slogan}</p>
            </div>
            <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
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
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-black bg-white hover:bg-neutral-200 transition-colors flex items-center gap-1.5 shadow"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  </svg>
                  <span>Open Control Panel</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs text-neutral-300 border border-white/15 bg-white/5 hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Project Subdomain & Preconfigured Architecture */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white">Project Name</label>
                  <input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e1015] text-sm font-mono text-white border border-white/15 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 placeholder:text-neutral-500"
                    placeholder="my-app-instance"
                  />
                  <p className="text-[11px] text-neutral-400">
                    Live URL: <code className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded border border-white/10">https://{projectName || 'app'}.app.shanutechx.com</code>
                  </p>
                </div>

                {/* Preconfigured Locked Isolation Settings Banner */}
                <div className="p-3.5 rounded-xl border border-white/15 bg-[#0e1015] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <div>
                        <div className="text-xs font-semibold text-white">Infrastructure & Expose Mode: Preconfigured</div>
                        <div className="text-[11px] text-neutral-400">
                          Reverse Proxy with automated SSL • Internal container port routing (No host ports exposed)
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white font-semibold border border-white/15">
                      Locked
                    </span>
                  </div>

                  {/* 3-Pillar Security & Isolation Badges */}
                  <div className="pt-2 border-t border-white/[0.08] grid grid-cols-3 gap-2 text-[10px] text-neutral-300">
                    <div className="flex items-center gap-1.5 bg-black/50 px-2 py-1.5 rounded-lg border border-white/5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      <span className="truncate">Isolated Network</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-black/50 px-2 py-1.5 rounded-lg border border-white/5">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 shrink-0" />
                      <span className="truncate">Sandboxed Storage</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-black/50 px-2 py-1.5 rounded-lg border border-white/5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="truncate">Internal Port Only</span>
                    </div>
                  </div>
                </div>

                {/* Resource Specifications (CPU Cores & RAM Limits) */}
                <div className="p-4 rounded-xl border border-white/15 bg-[#0e1015] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <span>Container Hardware Specs</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                          {catalogPlan
                            ? `${catalogPlan.currency} ${(catalogPlan.price / 100).toLocaleString()} / ${catalogPlan.billingType === 'monthly' ? 'mo' : catalogPlan.billingType}`
                            : 'Standard Pricing'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Build and deploy application with dedicated cgroups CPU and memory limits
                      </p>
                    </div>
                  </div>

                  {/* CPU Limit Selector */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-300 font-medium">CPU Core Allocation:</span>
                      <span className="font-mono text-emerald-400 font-bold">{cpuLimit} vCPU {cpuLimit === '0.5' ? '(Half Core)' : 'Cores'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setCpuLimit('0.5')}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                          cpuLimit === '0.5'
                            ? 'bg-white text-black font-bold border-white shadow-md'
                            : 'bg-black/40 text-neutral-300 border-white/10 hover:border-white/25 hover:bg-white/5'
                        }`}
                      >
                        <div className="font-bold">0.5 vCPU</div>
                        <div className={`text-[10px] ${cpuLimit === '0.5' ? 'text-neutral-700' : 'text-neutral-500'}`}>Standard (0.5 Core)</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCpuLimit('1.0')}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                          cpuLimit === '1.0'
                            ? 'bg-white text-black font-bold border-white shadow-md'
                            : 'bg-black/40 text-neutral-300 border-white/10 hover:border-white/25 hover:bg-white/5'
                        }`}
                      >
                        <div className="font-bold">1.0 vCPU</div>
                        <div className={`text-[10px] ${cpuLimit === '1.0' ? 'text-neutral-700' : 'text-neutral-500'}`}>Dedicated 1 Core</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCpuLimit('2.0')}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                          cpuLimit === '2.0'
                            ? 'bg-white text-black font-bold border-white shadow-md'
                            : 'bg-black/40 text-neutral-300 border-white/10 hover:border-white/25 hover:bg-white/5'
                        }`}
                      >
                        <div className="font-bold">2.0 vCPU</div>
                        <div className={`text-[10px] ${cpuLimit === '2.0' ? 'text-neutral-700' : 'text-neutral-500'}`}>Dual Core Boost</div>
                      </button>
                    </div>
                  </div>

                  {/* RAM Selector */}
                  <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-300 font-medium">Memory (RAM) Limit:</span>
                      <span className="font-mono text-emerald-400 font-bold">{memoryLimit === '512M' ? '512 MB' : memoryLimit === '1G' ? '1 GB' : '2 GB'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setMemoryLimit('512M')}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                          memoryLimit === '512M'
                            ? 'bg-white text-black font-bold border-white shadow-md'
                            : 'bg-black/40 text-neutral-300 border-white/10 hover:border-white/25 hover:bg-white/5'
                        }`}
                      >
                        <div className="font-bold">512 MB</div>
                        <div className={`text-[10px] ${memoryLimit === '512M' ? 'text-neutral-700' : 'text-neutral-500'}`}>Lightweight</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMemoryLimit('1G')}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                          memoryLimit === '1G'
                            ? 'bg-white text-black font-bold border-white shadow-md'
                            : 'bg-black/40 text-neutral-300 border-white/10 hover:border-white/25 hover:bg-white/5'
                        }`}
                      >
                        <div className="font-bold">1 GB</div>
                        <div className={`text-[10px] ${memoryLimit === '1G' ? 'text-neutral-700' : 'text-neutral-500'}`}>Standard (1024M)</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMemoryLimit('2G')}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                          memoryLimit === '2G'
                            ? 'bg-white text-black font-bold border-white shadow-md'
                            : 'bg-black/40 text-neutral-300 border-white/10 hover:border-white/25 hover:bg-white/5'
                        }`}
                      >
                        <div className="font-bold">2 GB</div>
                        <div className={`text-[10px] ${memoryLimit === '2G' ? 'text-neutral-700' : 'text-neutral-500'}`}>Extended (2048M)</div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable Env Vars list + File Upload */}
              {fetchingYaml ? (
                <div className="flex items-center gap-2 text-xs text-text-faint py-2 animate-pulse">
                  <svg className="animate-spin w-3.5 h-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Parsing template env vars…
                </div>
              ) : (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-semibold text-white">Environment Variables</label>
                      <p className="text-[11px] text-neutral-400">Configure secrets and runtime parameters</p>
                    </div>
                    <div className="flex items-center gap-2">
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
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-all flex items-center gap-1.5"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                        Upload .env
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPasteEnv(!showPasteEnv)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                          showPasteEnv
                            ? 'bg-white text-black border-white'
                            : 'bg-white/5 border-white/15 text-white hover:bg-white/10'
                        }`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Paste .env
                      </button>
                    </div>
                  </div>

                  {showPasteEnv && (
                    <div className="p-3 rounded-xl bg-black/50 border border-white/15 space-y-2">
                      <textarea
                        value={pasteEnvText}
                        onChange={(e) => setPasteEnvText(e.target.value)}
                        placeholder="KEY=VALUE&#10;DATABASE_PASSWORD=...&#10;AUTH_SECRET=..."
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-white/30"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => { setShowPasteEnv(false); setPasteEnvText(''); }}
                          className="px-2.5 py-1 rounded-lg text-xs text-neutral-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handlePasteEnvApply}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-white text-black hover:bg-neutral-200 transition-colors"
                        >
                          Apply Variables
                        </button>
                      </div>
                    </div>
                  )}
                  {Object.keys(envVars).length > 0 && (
                    <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                      {Object.entries(envVars).map(([key, val]) => {
                        const isSecretKey = /PASSWORD|SECRET|KEY|TOKEN|PASS/i.test(key);
                        const isMasked = maskedKeys[key] !== false;
                        return (
                          <div key={key} className="flex flex-col gap-1.5 p-3 rounded-xl bg-[#0e1015] border border-white/10 shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-semibold text-white break-all flex items-center gap-1.5">
                                {key}
                                {isSecretKey && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-sans border border-amber-500/30">Secret</span>}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {isSecretKey && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                                        const array = new Uint8Array(20);
                                        crypto.getRandomValues(array);
                                        const gen = Array.from(array, (b) => chars[b % chars.length]).join('');
                                        setEnvVars({ ...envVars, [key]: gen });
                                      }}
                                      className="px-2 py-1 rounded text-[10px] bg-white/10 hover:bg-white/20 text-white font-mono flex items-center gap-1 border border-white/10"
                                      title="Generate random secret password"
                                    >
                                      <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                      </svg>
                                      <span>Generate</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setMaskedKeys((prev) => ({ ...prev, [key]: !isMasked }))}
                                      className="px-2 py-1 rounded text-[10px] text-neutral-400 hover:text-white flex items-center gap-1 bg-white/5 border border-white/10"
                                      title={isMasked ? 'Show password' : 'Hide password'}
                                    >
                                      {isMasked ? (
                                        <>
                                          <svg className="w-3 h-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                          </svg>
                                          <span>Show</span>
                                        </>
                                      ) : (
                                        <>
                                          <svg className="w-3 h-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 0110.122 7c-.57 1.817-1.636 3.39-3.029 4.568m-4.568-4.568A3 3 0 1012 9a3 3 0 000 6z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                                          </svg>
                                          <span>Hide</span>
                                        </>
                                      )}
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...envVars };
                                    delete updated[key];
                                    setEnvVars(updated);
                                  }}
                                  className="text-neutral-400 hover:text-red-400 p-1 rounded hover:bg-white/5 transition-colors"
                                  title="Delete variable"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <input
                              type={isSecretKey && isMasked ? 'password' : 'text'}
                              value={val}
                              onChange={(e) => setEnvVars({ ...envVars, [key]: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg bg-[#0a0a0c] text-xs text-white border border-white/15 focus:outline-none focus:border-white/40 font-mono"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Application Config File (Upload or Edit Manually) */}
              <div className="space-y-2 border-t border-white/[0.08] pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-white">Configuration File</label>
                    {showConfigEditor && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {configFileName || 'custom.yaml'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={configFileRef}
                      type="file"
                      accept=".yaml,.yml,.json,.conf,.toml,.ini,.txt"
                      className="hidden"
                      onChange={handleConfigFileUpload}
                    />
                    <button
                      type="button"
                      onClick={() => configFileRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 border border-white/15 text-white hover:bg-white/20 transition-all flex items-center gap-1.5"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                      Upload Config File
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowConfigEditor(!showConfigEditor);
                        if (!showConfigEditor && !configFileName) {
                          setConfigFileName(tpl.slug === 'livekit' ? 'livekit.yaml' : `${tpl.slug}.yaml`);
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                        showConfigEditor
                          ? 'bg-white text-black border-white'
                          : 'bg-white/5 border-white/15 text-neutral-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      {showConfigEditor ? 'Editor Open' : 'Edit Manually'}
                    </button>
                  </div>
                </div>

                {showConfigEditor && (
                  <div className="space-y-2 p-3 rounded-xl bg-[#0e1015] border border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-[11px] text-neutral-400 font-mono">Filename:</span>
                        <input
                          type="text"
                          value={configFileName}
                          onChange={(e) => setConfigFileName(e.target.value)}
                          placeholder="e.g. livekit.yaml"
                          className="px-2.5 py-1 rounded bg-[#0a0a0c] border border-white/15 text-xs font-mono text-white focus:outline-none focus:border-white/40 flex-1 max-w-xs"
                        />
                      </div>
                      {(tpl.slug === 'livekit' || tpl.slug === 'lavalink') && (
                        <button
                          type="button"
                          onClick={() => {
                            if (tpl.slug === 'livekit') setConfigFileContent(defaultLiveKitYaml);
                            else if (tpl.slug === 'lavalink') setConfigFileContent(defaultLavalinkYaml);
                          }}
                          className="text-[10px] text-neutral-400 hover:text-white underline"
                        >
                          Reset defaults
                        </button>
                      )}
                    </div>

                    <textarea
                      value={configFileContent}
                      onChange={(e) => setConfigFileContent(e.target.value)}
                      rows={6}
                      placeholder="# Type or paste configuration YAML/JSON here..."
                      className="w-full px-3 py-2 rounded-lg bg-[#0a0a0c] border border-white/15 text-xs font-mono text-white focus:outline-none focus:border-white/40 leading-relaxed scrollbar-thin"
                      spellCheck={false}
                    />
                    <p className="text-[10px] text-neutral-400">
                      Saved directly into the application project container and mounted during startup.
                    </p>
                  </div>
                )}
              </div>
              {!fetchingYaml && (
                <div className="space-y-2 border-t border-white/[0.08] pt-3">
                  <label className="text-xs font-semibold text-white block">Add Environment Variable</label>
                  <div className="flex gap-2">
                    <input
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                      placeholder="KEY (e.g. API_KEY)"
                      className="flex-1 px-3 py-2 rounded-xl bg-[#0e1015] text-xs text-white border border-white/15 focus:outline-none focus:border-white/40 font-mono placeholder:text-neutral-500"
                    />
                    <input
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      placeholder="VALUE"
                      className="flex-1 px-3 py-2 rounded-xl bg-[#0e1015] text-xs text-white border border-white/15 focus:outline-none focus:border-white/40 font-mono placeholder:text-neutral-500"
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
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs text-white font-semibold transition-all border border-white/15 cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-neutral-300 border border-white/15 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeploy}
                  disabled={loading || fetchingYaml}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-black bg-white hover:bg-neutral-200 transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-white/10 flex items-center justify-center cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2 text-black">
                      <svg className="animate-spin w-4 h-4 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      Deploying…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5 text-black">
                      <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.58-5.84a14.927 14.927 0 015.84-2.58M6.3 17.7a2.25 2.25 0 103.18 3.18 2.25 2.25 0 00-3.18-3.18z" />
                      </svg>
                      Build & Deploy ({cpuLimit} vCPU • {memoryLimit})
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
  const [catalogPlan, setCatalogPlan] = useState<Plan | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [deploying, setDeploying] = useState<CatalogTemplate | null>(null);
  const [deleting, setDeleting] = useState<CatalogTemplate | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdminOrDev = apiUser?.role === 'admin' || apiUser?.role === 'dev';

  useEffect(() => {
    api.products.list('app_catalog')
      .then((res) => {
        const plan = res.products?.[0]?.plans?.[0] || null;
        setCatalogPlan(plan);
      })
      .catch(() => {});
  }, []);

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
      <div className="relative overflow-hidden border-b border-white/[0.08] bg-black px-6 py-8">
        <div className="relative max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 border border-white/15">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                  <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </span>
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">App Catalog</span>
            </div>
            {isAdminOrDev && (
              <button
                onClick={() => router.push('/catalog/new')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-black bg-white hover:bg-neutral-200 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Create Template
              </button>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">One-Click App Deployments</h1>
          <p className="text-sm text-neutral-400 mb-3">
            {total} pre-configured apps ready to deploy — from automation to databases, CMS to monitoring.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 mb-5 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              App Catalog Plan: <strong className="text-white">
                {catalogPlan
                  ? `${catalogPlan.currency} ${(catalogPlan.price / 100).toLocaleString()} / ${catalogPlan.billingType === 'monthly' ? 'mo' : catalogPlan.billingType}`
                  : 'Standard Pricing'}
              </strong> per slot
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300">
              Hardware Specs: <strong className="text-emerald-400">0.5 vCPU • 1GB RAM</strong> standard
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-400">
              Dedicated Cgroup Resource Enforcement
            </span>
          </div>

          {/* Search */}
          <div className="relative max-w-lg">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search n8n, WordPress, Grafana…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0e1015] border border-white/10 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/30 focus:bg-[#12141a] transition-all font-sans"
            />
          </div>
        </div>
      </div>

      {/* ── Category tabs ── */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-white/[0.08] bg-black overflow-x-auto scrollbar-none shrink-0">
        {['all', ...categories].map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === cat
                ? 'bg-white text-black shadow-sm'
                : 'text-neutral-400 hover:text-white hover:bg-white/10 border border-transparent'
            }`}
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
                catalogPlan={catalogPlan}
              />
            ))}
          </div>
        )}
      </div>

      {/* Deploy modal */}
      {deploying && <DeployModal tpl={deploying} onClose={() => setDeploying(null)} catalogPlan={catalogPlan} />}

      {/* Delete confirmation modal */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" onClick={() => setDeleting(null)}>
          <div
            className="relative z-10 w-full max-w-md rounded-2xl border border-white/15 bg-[#0a0a0d] shadow-2xl shadow-black overflow-hidden"
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
