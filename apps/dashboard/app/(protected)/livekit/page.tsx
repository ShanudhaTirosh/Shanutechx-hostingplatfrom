'use client';

import { useEffect, useState } from 'react';
import { useAppUser } from '@/lib/AppUserContext';
import { api } from '@/lib/api';
import { LiveKitProject } from '@/lib/types';
import {
  Card,
  Button,
  Spinner,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Input,
  useToast,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

function VideoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7l-7 5 7 5V7z"/>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

export default function LiveKitPage() {
  const { apiUser } = useAppUser();
  const [projects, setProjects] = useState<LiveKitProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.livekit
      .list()
      .then((data) => setProjects(data.projects))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      <PageHeader
        title="LiveKit Video Rooms"
        description="Generate client access tokens for real-time multi-user audio/video rooms on your LiveKit instances."
      />

      {error && <ErrorBanner message={error} />}

      <div>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Active LiveKit Projects</h2>
        {projects === null && <Spinner label="Loading LiveKit projects..." />}
        {projects?.length === 0 && (
          <EmptyState message="No LiveKit projects found. Purchase a LiveKit plan from Services and an admin will provision it." />
        )}

        <div className="space-y-4 mb-8">
          {projects?.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>

      {apiUser?.role === 'admin' && <AdminCreateProject onCreated={load} />}
    </div>
  );
}

function ProjectCard({ project }: { project: LiveKitProject }) {
  const [roomName, setRoomName] = useState('');
  const [identity, setIdentity] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.livekit.createToken(project.id, roomName, identity);
      setToken(token);
      toast('Access token generated successfully', 'success');
    } catch (err: any) {
      setError(err.message);
      toast('Failed to generate token', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border border-white/[0.06] hover:border-white/10 transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-xl bg-accent-violet/10 text-accent-violet-light flex items-center justify-center shrink-0">
          <VideoIcon />
        </div>
        <div>
          <h3 className="font-semibold text-text-primary text-sm">LiveKit Connection Parameters</h3>
          <p className="text-text-muted text-[10px] font-mono mt-0.5">API Key: {project.apiKey}</p>
        </div>
      </div>

      <form onSubmit={handleGenerate} className="grid md:grid-cols-3 gap-4 items-end bg-white/[0.01] border border-white/[0.04] p-4 rounded-2xl">
        <Input
          required
          label="Room Name"
          placeholder="e.g. general-lounge"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
        />
        <Input
          required
          label="Identity / Username"
          placeholder="e.g. user-alice"
          value={identity}
          onChange={(e) => setIdentity(e.target.value)}
        />
        <Button type="submit" loading={busy} className="justify-center">
          Generate Token
        </Button>
      </form>

      {error && <div className="mt-4"><ErrorBanner message={error} /></div>}
      
      {token && (
        <div className="mt-4 animate-fade-in bg-white/[0.02] border border-white/[0.04] p-4 rounded-xl space-y-2">
          <p className="text-xs font-semibold text-text-primary">Generated JWT Token (Valid for 1 Hour):</p>
          <code className="text-xs bg-black/40 rounded-lg p-3 block break-all select-all font-mono text-accent-teal-bright border border-white/5">
            {token}
          </code>
          <p className="text-[10px] text-text-faint">Double-click the token to copy it to your clipboard.</p>
        </div>
      )}
    </Card>
  );
}

function AdminCreateProject({ onCreated }: { onCreated: () => void }) {
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setWarning(null);
    try {
      const result = await api.livekit.create({ userId });
      if (result.warning) {
        setWarning(result.warning);
      } else {
        toast('LiveKit project provisioned successfully', 'success');
        setUserId('');
        onCreated();
      }
    } catch (err: any) {
      setError(err.message);
      toast('Failed to provision project', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border border-white/[0.06] bg-white/[0.01]">
      <h2 className="font-semibold text-sm text-text-primary mb-1 flex items-center gap-2">
        <PlusIcon /> Provision LiveKit Instance
      </h2>
      <p className="text-text-muted text-xs mb-4">
        Auto-selects a host node tagged "livekit", sets up key pairs, and configures the node.
      </p>
      {error && <div className="mb-4"><ErrorBanner message={error} /></div>}
      {warning && (
        <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
          {warning}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-4 items-end">
        <div className="flex-1">
          <Input
            required
            label="Customer User ID"
            placeholder="e.g. 123456"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>
        <Button type="submit" loading={busy}>
          Provision Instance
        </Button>
      </form>
    </Card>
  );
}
