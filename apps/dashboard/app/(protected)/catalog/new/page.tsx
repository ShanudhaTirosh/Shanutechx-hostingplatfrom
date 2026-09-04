'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import { api } from '@/lib/api';
import { useAppUser } from '@/lib/AppUserContext';
import * as yaml from 'js-yaml';

// ── Category color mapping (kept identical to the edit page for consistency) ──
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

const DEFAULT_YAML = `# Define the service(s) this template deploys.
# See an existing template (open any card -> Edit) for a real example.
name: my-template
services:
  app:
    image: nginx:alpine
    port: 80
`;

/**
 * Real "Create New Template" page — this used to be a modal that showed
 * "will be implemented when backend API is ready" with no form at all,
 * even though POST /api/catalog/:slug was already fully implemented and
 * working. Built as a sibling to the existing (real, working) edit page
 * at /catalog/[slug]/edit, reusing the same layout/validation approach.
 */
export default function CreateTemplatePage() {
  const { apiUser } = useAppUser();
  const router = useRouter();
  const isAdminOrDev = apiUser?.role === 'admin' || apiUser?.role === 'dev';

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [documentation, setDocumentation] = useState('');
  const [category, setCategory] = useState('other');
  const [tags, setTags] = useState<string[]>([]);
  const [logo, setLogo] = useState('');
  const [port, setPort] = useState<number | null>(null);
  const [tagInput, setTagInput] = useState('');

  const [yamlContent, setYamlContent] = useState(DEFAULT_YAML);
  const [yamlError, setYamlError] = useState('');

  if (!isAdminOrDev) {
    router.push('/catalog');
    return null;
  }

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

  const handleYamlChange = (value: string | undefined) => {
    const newContent = value || '';
    setYamlContent(newContent);
    if (newContent.trim()) validateYaml(newContent);
    else setYamlError('');
  };

  function slugify(input: string): string {
    return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const finalSlug = slugify(slug || name);
    if (!finalSlug) {
      setError('Slug (or name) is required so this template has a URL-safe identifier.');
      return;
    }
    if (!validateYaml(yamlContent)) {
      setError('YAML syntax is invalid. Please fix errors before saving.');
      return;
    }
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
      await api.catalog.create(finalSlug, {
        name, slogan, documentation, category, tags, logo, port, yaml: yamlContent,
      });
      setSuccess('Template created successfully!');
      setTimeout(() => router.push('/catalog'), 1200);
    } catch (err: any) {
      setError(`Failed to create template: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };
  const handleRemoveTag = (tagToRemove: string) => setTags(tags.filter((t) => t !== tagToRemove));

  const accentColor = catColor(category);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b border-white/[0.06] bg-gradient-to-b from-[#13101f] to-surface px-6 py-5">
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
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                  <span className="text-xs font-medium text-violet-400 uppercase tracking-widest">New Template</span>
                </div>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder={name ? slugify(name) : 'template-slug'}
                  className="text-xl font-bold text-text-primary bg-transparent border-none outline-none placeholder:text-text-faint/50 w-64"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/catalog')}
                className="px-4 py-2 rounded-xl text-sm text-text-muted border border-white/10 hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !!yamlError}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 transition-all shadow-lg shadow-violet-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Creating...' : 'Create Template'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
          )}
          {success && (
            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">{success}</div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          <div className="w-80 border-r border-white/[0.06] bg-surface overflow-y-auto">
            <div className="p-5 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">Template Metadata</h3>
                <p className="text-xs text-text-faint mb-4">
                  The slug above becomes the template's URL identifier — edit it if the auto-generated
                  version from the name isn't what you want.
                </p>
              </div>

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

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-text-primary focus:outline-none focus:border-white/25"
                >
                  {Object.keys(CAT_COLOR).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium inline-block"
                  style={{ color: accentColor, background: `${accentColor}18`, border: `1px solid ${accentColor}33` }}
                >
                  {category}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted">Tags</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-text-primary focus:outline-none focus:border-white/25 placeholder:text-text-faint"
                    placeholder="wordpress, cms"
                  />
                  <button type="button" onClick={handleAddTag} className="px-3 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 text-xs text-text-primary font-medium transition-all">
                    Add
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 rounded text-xs text-text-primary bg-white/[0.08] border border-white/[0.08] flex items-center gap-1.5">
                        {tag}
                        <button type="button" onClick={() => handleRemoveTag(tag)} className="text-text-faint hover:text-red-400 transition-colors">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text-muted">Logo Path & Live Preview</label>
                  <TemplateLogo logo={logo} name={name} slug={slug || 'new-template'} color={accentColor} />
                </div>
                <input
                  type="text"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-text-primary focus:outline-none focus:border-white/25 placeholder:text-text-faint"
                  placeholder="svgs/wordpress.png or https://..."
                />
              </div>

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
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-3 bg-surface flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">YAML Template</h3>
              {yamlError && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30">
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
                options={{ minimap: { enabled: true }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false, wordWrap: 'on', tabSize: 2 }}
              />
            </div>
            {yamlError && (
              <div className="border-t border-white/[0.06] bg-red-500/5 px-5 py-3">
                <pre className="text-xs text-red-300/80 font-mono whitespace-pre-wrap">{yamlError}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
