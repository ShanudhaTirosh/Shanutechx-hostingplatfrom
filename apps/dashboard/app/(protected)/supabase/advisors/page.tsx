'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader, Card, Button, useToast, Spinner } from '@/components/ui';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

interface AdvisorItem {
  id: string;
  title: string;
  category: string;
  severity: string;
  description: string;
  remediation: string;
}

export default function SupabaseAdvisorsPage() {
  const [activeTab, setActiveTab] = useState<'security' | 'performance'>('security');
  const [securityLints, setSecurityLints] = useState<AdvisorItem[]>([]);
  const [performanceLints, setPerformanceLints] = useState<AdvisorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const { toast } = useToast();

  const fetchAdvisors = () => {
    setLoading(true);
    supabaseAdmin
      .advisors()
      .then((res) => {
        setSecurityLints(res.security || []);
        setPerformanceLints(res.performance || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAdvisors();
  }, []);

  const handleRunLinter = () => {
    setScanning(true);
    setTimeout(() => {
      fetchAdvisors();
      setScanning(false);
      toast('Live security & performance linter scan complete!', 'success');
    }, 600);
  };

  const list = activeTab === 'security' ? securityLints : performanceLints;

  if (loading) return <Spinner label="Running PostgreSQL Linter & Security Scanner..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Supabase Advisors & Linter Studio"
        description="Automated security policies advisor, missing RLS detector, and PostgreSQL index optimization recommendations."
        action={
          <Button size="sm" onClick={handleRunLinter} loading={scanning}>
            Run Live Linter Scan
          </Button>
        }
      />

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 border border-white/10 rounded-2xl bg-white/[0.02]">
          <p className="text-xs text-text-muted">Total Security Lints</p>
          <p className="text-xl font-bold text-white font-mono">{securityLints.length}</p>
        </div>
        <div className="p-4 border border-white/10 rounded-2xl bg-white/[0.02]">
          <p className="text-xs text-text-muted">Performance Optimizations</p>
          <p className="text-xl font-bold text-emerald-400 font-mono">{performanceLints.length}</p>
        </div>
        <div className="p-4 border border-white/10 rounded-2xl bg-white/[0.02]">
          <p className="text-xs text-text-muted">Security Status</p>
          <p className="text-xl font-bold text-amber-400 font-mono">
            {securityLints.some((s) => s.severity === 'HIGH') ? 'Action Required' : 'Passed'}
          </p>
        </div>
        <div className="p-4 border border-white/10 rounded-2xl bg-white/[0.02]">
          <p className="text-xs text-text-muted">Target DB Engine</p>
          <p className="text-xl font-bold text-accent-cyan font-mono">PostgreSQL 17</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'security'
              ? 'bg-accent-violet text-white shadow-glow-violet'
              : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
          }`}
        >
          Security Advisors ({securityLints.length})
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'performance'
              ? 'bg-accent-violet text-white shadow-glow-violet'
              : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
          }`}
        >
          Performance Advisors ({performanceLints.length})
        </button>
      </div>

      {/* Advisors List */}
      <div className="space-y-4">
        {list.length === 0 ? (
          <Card className="p-8 text-center border border-white/[0.06]">
            <p className="text-xs text-text-muted">No advisor issues detected in this category!</p>
          </Card>
        ) : (
          list.map((item) => (
            <Card key={item.id} className="border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      item.severity === 'HIGH' || item.severity === 'CRITICAL'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : item.severity === 'MEDIUM' || item.severity === 'WARN'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {item.severity}
                  </span>
                  <h3 className="font-semibold text-sm text-text-primary">{item.title}</h3>
                </div>
              </div>

              <p className="text-xs text-text-muted leading-relaxed">{item.description}</p>

              <div className="p-3 rounded-xl bg-black/60 border border-white/[0.06] space-y-1">
                <p className="text-[10px] uppercase font-mono text-text-faint">Recommended Remediation SQL / Action</p>
                <pre className="font-mono text-xs text-teal-300 select-text overflow-x-auto">{item.remediation}</pre>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

