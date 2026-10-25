'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import { api } from '@/lib/api';
import { CatalogTemplate } from '@/lib/types';
import { useAppUser } from '@/lib/AppUserContext';
import * as yaml from 'js-yaml';

// ── Category color mapping ───────────────────────────────────────────────────
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
  const initials = (name || slug)
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

  useEffect(() => {
    setCandidateIndex(0);
    setHasError(false);
  }, [logo, slug]);

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
          alt={name || slug}
          className="w-7 h-7 object-contain"
          onError={handleError}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

export default function TemplateEditorPage() {
  const { apiUser } = useAppUser();
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Template metadata
  const [name, setName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [documentation, setDocumentation] = useState('');
  const [category, setCategory] = useState('other');
  const [tags, setTags] = useState<string[]>([]);
  const [logo, setLogo] = useState('');
  const [port, setPort] = useState<number | null>(null);

  // YAML content
  const [yamlContent, setYamlContent] = useState('');
  const [yamlError, setYamlError] = useState('');

  // Tag input
  const [tagInput, setTagInput] = useState('');

  // Check authorization
  const isAdminOrDev = apiUser?.role === 'admin' || apiUser?.role === 'dev';

  useEffect(() => {
    if (!isAdminOrDev) {
      router.push('/catalog');
      return;
    }

    // Fetch existing template
    setLoading(true);
    api.catalog.get(slug)
      .then((res) => {
        const tpl = res.template;
        setName(tpl.name);
        setSlogan(tpl.slogan);
        setDocumentation(tpl.documentation);
        setCategory(tpl.category);
        setTags(tpl.tags);
        setLogo(tpl.logo);
        setPort(tpl.port);
        setYamlContent(tpl.yaml);
      })
      .catch((err) => {
        setError(`Failed to load template: ${err.message}`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug, isAdminOrDev, router]);

  // Validate YAML syntax
  const validateYaml = (content: string): boolean => {
    try {
      yaml.load(content);
      setYamlError('');
      return true;
    } catch (err: any) {
      setYamlError(err.message);
      return false;
    }
  };

  // Handle YAML editor change
  const handleYamlChange = (value: string | undefined) => {
    const newContent = value || '';
    setYamlContent(newContent);
    if (newContent.trim()) {
      validateYaml(newContent);
    } else {
      setYamlError('');
    }
  };

  // Handle save
  const handleSave = async () => {
    setError('');
    setSuccess('');

    // Validate YAML
    if (!validateYaml(yamlContent)) {
      setError('YAML syntax is invalid. Please fix errors before saving.');
      return;
    }

    // Validate required fields
    if (!category) {
      setError('Category is required');
      return;
    }

    if (port !== null && (port < 1 || port > 65535)) {
      setError('Port must be between 1 and 65535');
      return;
    }

    setSaving(true);

    try {
      await api.catalog.update(slug, {
        name,
        slogan,
        documentation,
        category,
        tags,
        logo,
        port,
        yaml: yamlContent,
      });

      setSuccess('Template updated successfully!');
      
      // Redirect back to catalog after a short delay
      setTimeout(() => {
        router.push('/catalog');
      }, 1500);
    } catch (err: any) {
      setError(`Failed to save template: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle add tag
  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  // Handle remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const accentColor = catColor(category);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <p className="text-sm text-neutral-400">Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/[0.08] bg-black px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/catalog')}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
                title="Back to catalog"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 border border-white/15">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </span>
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Edit Template</span>
                </div>
                <h1 className="text-xl font-bold text-white">{slug}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/catalog')}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-300 border border-white/10 hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !!yamlError}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black bg-white hover:bg-neutral-200 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span>{success}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Editor Layout */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* Left Panel - Metadata */}
          <div className="w-80 border-r border-white/[0.06] bg-surface overflow-y-auto">
            <div className="p-5 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">Template Metadata</h3>
                <p className="text-xs text-text-faint mb-4">
                  Configure the template's display information and categorization.
                </p>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-text-primary focus:outline-none focus:border-white/25 placeholder:text-text-faint"
                  placeholder="e.g., WordPress"
                />
              </div>

              {/* Slogan */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted">Slogan</label>
                <textarea
                  value={slogan}
                  onChange={(e) => setSlogan(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-text-primary focus:outline-none focus:border-white/25 placeholder:text-text-faint resize-none"
                  placeholder="Short description of the template"
                />
              </div>

              {/* Documentation URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted">Documentation URL</label>
                <input
                  type="url"
                  value={documentation}
                  onChange={(e) => setDocumentation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-text-primary focus:outline-none focus:border-white/25 placeholder:text-text-faint"
                  placeholder="https://docs.example.com"
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-text-primary focus:outline-none focus:border-white/25"
                >
                  {Object.keys(CAT_COLOR).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <div
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium inline-block"
                  style={{
                    color: accentColor,
                    background: `${accentColor}18`,
                    border: `1px solid ${accentColor}33`,
                  }}
                >
                  {category}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted">Tags</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-text-primary focus:outline-none focus:border-white/25 placeholder:text-text-faint"
                    placeholder="wordpress, cms"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 text-xs text-text-primary font-medium transition-all"
                  >
                    Add
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 rounded text-xs text-text-primary bg-white/[0.08] border border-white/[0.08] flex items-center gap-1.5"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-text-faint hover:text-red-400 transition-colors"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Logo */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text-muted">Logo Path & Live Preview</label>
                  <TemplateLogo logo={logo} name={name} slug={slug} color={accentColor} />
                </div>
                <input
                  type="text"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-text-primary focus:outline-none focus:border-white/25 placeholder:text-text-faint"
                  placeholder="svgs/wordpress.png or https://..."
                />
                <p className="text-xs text-text-faint">
                  URL, relative path, or filename (auto-resolves CDN & icons)
                </p>
              </div>

              {/* Port */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted">Port</label>
                <input
                  type="number"
                  value={port ?? ''}
                  onChange={(e) => setPort(e.target.value ? parseInt(e.target.value, 10) : null)}
                  min="1"
                  max="65535"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-text-primary focus:outline-none focus:border-white/25 placeholder:text-text-faint"
                  placeholder="8080"
                />
                <p className="text-xs text-text-faint">
                  Internal port (1-65535) or leave empty
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel - YAML Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-3 bg-surface flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <h3 className="text-sm font-semibold text-text-primary">YAML Template</h3>
              </div>
              {yamlError && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30">
                  <svg className="w-3.5 h-3.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="text-xs text-red-400">YAML Syntax Error</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-hidden">
              <Editor
                height="100%"
                defaultLanguage="yaml"
                theme="vs-dark"
                value={yamlContent}
                onChange={handleYamlChange}
                options={{
                  minimap: { enabled: true },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  tabSize: 2,
                  formatOnPaste: true,
                  formatOnType: true,
                }}
              />
            </div>

            {yamlError && (
              <div className="border-t border-white/[0.06] bg-red-500/5 px-5 py-3">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-red-400 mb-1">YAML Validation Error</p>
                    <pre className="text-xs text-red-300/80 font-mono whitespace-pre-wrap">{yamlError}</pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
