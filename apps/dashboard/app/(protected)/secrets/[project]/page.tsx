'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader, Card, Button, Spinner, ErrorBanner } from '@/components/ui';
import { secretsApi, SecretProject } from '@/lib/secretsApi';
import { SecretRow } from '@/components/secrets/SecretRow';
import { EnvImporter } from '@/components/secrets/EnvImporter';

export default function ProjectSecretsPage() {
  const params = useParams();
  const projectId = params.project as string;

  const [project, setProject] = useState<SecretProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImporter, setShowImporter] = useState(false);

  // Single secret form
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProject = () => {
    setLoading(true);
    secretsApi.projects
      .get(projectId)
      .then((res) => setProject(res.project))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (projectId) loadProject();
  }, [projectId]);

  const handleSaveSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key || !value) return;
    setSaving(true);
    secretsApi.secrets
      .save(projectId, { key, value, comment })
      .then((res) => {
        setProject(res.project);
        setKey('');
        setValue('');
        setComment('');
      })
      .catch((err) => alert(err.message))
      .finally(() => setSaving(false));
  };

  const handleDeleteSecret = (targetKey: string) => {
    if (!confirm(`Delete secret ${targetKey}?`)) return;
    secretsApi.secrets
      .delete(projectId, targetKey)
      .then(() => loadProject())
      .catch((err) => alert(err.message));
  };

  const handleBulkImport = (parsedItems: Array<{ key: string; value: string }>) => {
    secretsApi.secrets
      .bulkImport(projectId, parsedItems)
      .then((res) => {
        setProject(res.project);
        setShowImporter(false);
      })
      .catch((err) => alert(err.message));
  };

  const handleExportEnv = () => {
    if (!project) return;
    const content = project.secrets.map((s) => `${s.key}=${s.value}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}.env`;
    a.click();
  };

  if (loading) return <Spinner label="Loading project secrets..." />;
  if (error || !project) return <ErrorBanner message={error || 'Project not found'} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={project.name}
        description={`Environment: ${project.environment.toUpperCase()} • ${project.secrets.length} variables`}
      />

      {/* Action Bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <button
          onClick={() => setShowImporter(!showImporter)}
          className="px-3 py-1.5 rounded-lg bg-accent-violet/20 hover:bg-accent-violet/30 text-accent-violet-light border border-accent-violet/30 text-xs font-semibold transition-all"
        >
          {showImporter ? 'Hide Importer' : '📥 Bulk Import .env'}
        </button>

        <button
          onClick={handleExportEnv}
          className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-text-muted hover:text-text-primary text-xs font-medium border border-white/[0.08] transition-all"
        >
          📤 Export .env File
        </button>
      </div>

      {showImporter && <EnvImporter onImport={handleBulkImport} />}

      {/* Add Secret Form */}
      <Card className="border border-white/[0.06]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
          Add / Update Variable
        </h3>
        <form onSubmit={handleSaveSecret} className="grid md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="VARIABLE_KEY"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="rounded-lg bg-black/40 border border-white/[0.08] p-2.5 font-mono text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
            required
          />
          <input
            type="text"
            placeholder="Secret Value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-lg bg-black/40 border border-white/[0.08] p-2.5 font-mono text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
            required
          />
          <input
            type="text"
            placeholder="Optional comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
          />
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving...' : '+ Save Secret'}
          </Button>
        </form>
      </Card>

      {/* Secret Rows List */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Variables ({project.secrets.length})
        </h3>
        {project.secrets.length === 0 ? (
          <Card className="text-center py-8 text-xs text-text-muted">
            No secrets defined yet in this project.
          </Card>
        ) : (
          project.secrets.map((sec) => (
            <SecretRow
              key={sec.key}
              secretKey={sec.key}
              value={sec.value}
              comment={sec.comment}
              onDelete={handleDeleteSecret}
            />
          ))
        )}
      </div>
    </div>
  );
}
