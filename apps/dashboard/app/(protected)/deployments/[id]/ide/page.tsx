'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import WebIDE from '@/components/ide/WebIDE';
import { ArrowLeft, Code, ExternalLink, RefreshCw, Terminal, Loader2 } from 'lucide-react';
import Link from 'next/link';

import { api } from '@/lib/api';

export default function DeploymentIDEPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [deployment, setDeployment] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

  useEffect(() => {
    async function loadDeployment() {
      if (!id) return;
      try {
        setLoading(true);
        const data = await api.deployments.get(id);
        setDeployment(data.deployment);
      } catch (err: any) {
        setError(err.message || 'Failed to load deployment details');
      } finally {
        setLoading(false);
      }
    }

    loadDeployment();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <Loader2 size={32} className="animate-spin text-indigo-500" />
        <p className="text-sm">Loading Web IDE workspace...</p>
      </div>
    );
  }

  if (error || !deployment) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <Code size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Unable to load Web IDE</h2>
        <p className="text-sm text-slate-400">{error || 'Deployment workspace could not be found'}</p>
        <Link
          href="/deployments"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={14} /> Back to Deployments
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-[1600px] mx-auto w-full">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/deployments/${id}`}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Code className="text-indigo-400" size={18} />
              Web IDE — {deployment.subdomain || deployment.id}
            </h1>
            <p className="text-xs text-slate-400">
              Edit code live, save locally to compute node, and push changes back to repository.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {deployment.subdomain && (
            <a
              href={`https://${deployment.subdomain}.shanutechx.com`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs transition-colors"
            >
              <span>View Site</span>
              <ExternalLink size={12} />
            </a>
          )}
          <Link
            href={`/deployments/${id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Terminal size={13} />
            <span>Deployment Control Panel</span>
          </Link>
        </div>
      </div>

      {/* Embedded Web IDE Workspace Component */}
      <WebIDE
        deploymentId={deployment.id}
        repoUrl={deployment.repoUrl}
        subdomain={deployment.subdomain}
        apiBaseUrl={API_BASE_URL}
        authToken={typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''}
      />
    </div>
  );
}
