'use client';

import React, { useEffect, useState } from 'react';
import { supabaseAdmin, EmailTemplate } from '@/lib/supabaseAdmin';
import { Button } from '@/components/ui';
import { sanitizeHtml } from '@/lib/sanitize';

export function EmailTemplateEditor() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>('confirmation');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabaseAdmin.smtp
      .getTemplates()
      .then((res) => {
        setTemplates(res.templates);
        if (res.templates.length > 0) {
          const t = res.templates[0];
          setSelectedId(t.id);
          setSubject(t.subject);
          setHtml(t.html);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelectTemplate = (id: string) => {
    setSelectedId(id);
    const t = templates.find((item) => item.id === id);
    if (t) {
      setSubject(t.subject);
      setHtml(t.html);
    }
  };

  const handleSave = () => {
    setSaving(true);
    supabaseAdmin.smtp
      .saveTemplate(selectedId, { subject, html })
      .then(() => {
        alert('Email template saved successfully!');
        setTemplates((prev) =>
          prev.map((item) => (item.id === selectedId ? { ...item, subject, html } : item))
        );
      })
      .catch((err) => alert(err.message))
      .finally(() => setSaving(false));
  };

  const insertVariable = (varTag: string) => {
    setHtml((prev) => prev + ` ${varTag} `);
  };

  if (loading) {
    return <div className="text-xs text-text-muted p-4">Loading email templates...</div>;
  }

  return (
    <div className="glass rounded-xl p-4 border border-white/[0.06] space-y-4">
      {/* Template Tab Selector */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelectTemplate(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                selectedId === t.id
                  ? 'bg-accent-violet text-white shadow-glow-violet'
                  : 'text-text-muted hover:bg-white/[0.04]'
              }`}
            >
              ✉️ {t.name}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Template'}
        </Button>
      </div>

      {/* Subject Line */}
      <div>
        <label className="text-[10px] uppercase text-text-faint block mb-1">Email Subject Line</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
        />
      </div>

      {/* Dynamic Variable Pills */}
      <div>
        <label className="text-[10px] uppercase text-text-faint block mb-1">Insert Dynamic Variables</label>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {['{{ .ConfirmationURL }}', '{{ .Email }}', '{{ .SiteURL }}', '{{ .Token }}'].map((v) => (
            <button
              key={v}
              onClick={() => insertVariable(v)}
              className="px-2 py-0.5 rounded bg-white/[0.06] hover:bg-white/[0.12] text-accent-violet-light font-mono transition-all"
            >
              + {v}
            </button>
          ))}
        </div>
      </div>

      {/* Editor & Live Preview Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] uppercase text-text-faint block mb-1">HTML Template Source</label>
          <textarea
            rows={10}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="w-full rounded-lg bg-black/50 border border-white/[0.08] p-3 font-mono text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase text-text-faint block mb-1">Live Visual Preview</label>
          <div
            className="w-full h-[230px] rounded-lg bg-white p-4 text-black text-xs overflow-y-auto font-sans"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(html.replace('{{ .ConfirmationURL }}', 'http://localhost:3000/auth/verify?token=demo123')),
            }}
          />
        </div>
      </div>
    </div>
  );
}
