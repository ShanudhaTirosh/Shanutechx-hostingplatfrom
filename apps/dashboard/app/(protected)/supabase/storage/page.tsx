'use client';

import React, { useEffect, useState } from 'react';
import { PageHeader, Card, Spinner, ErrorBanner, Button, useToast } from '@/components/ui';
import { supabaseAdmin, SupabaseStorageBucket } from '@/lib/supabaseAdmin';
import { BucketFileBrowser } from '@/components/supabase/BucketFileBrowser';

export default function SupabaseStoragePage() {
  const [buckets, setBuckets] = useState<SupabaseStorageBucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();


  // New Bucket Form
  const [newBucketName, setNewBucketName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadBuckets = () => {
    setLoading(true);
    supabaseAdmin.storage
      .buckets()
      .then((res) => {
        setBuckets(res.buckets);
        if (res.buckets.length > 0 && !selectedBucket) {
          setSelectedBucket(res.buckets[0].name);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBuckets();
  }, []);

  const handleCreateBucket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBucketName) return;
    setCreating(true);
    supabaseAdmin.storage
      .createBucket({ id: newBucketName.toLowerCase().replace(/\s+/g, '-'), name: newBucketName, isPublic })
      .then(() => {
        toast(`Storage bucket "${newBucketName}" created!`, 'success');
        setNewBucketName('');
        loadBuckets();
      })
      .catch((err) => toast(err.message || 'Failed to create bucket', 'error'))
      .finally(() => setCreating(false));
  };


  if (loading) return <Spinner label="Loading Storage API..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Storage Buckets &amp; Files"
        description="Public/Private object storage buckets, file explorer, public URLs, and S3 protocol access."
      />

      {error && <ErrorBanner message={error} />}

      {/* Create Bucket Card */}
      <Card className="border border-white/[0.06]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
          Create Storage Bucket
        </h3>
        <form onSubmit={handleCreateBucket} className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Bucket Name (e.g. user-uploads)"
            value={newBucketName}
            onChange={(e) => setNewBucketName(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg bg-black/40 border border-white/[0.08] p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-violet/50"
            required
          />
          <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded bg-black/40 border-white/[0.1] text-accent-violet focus:ring-0"
            />
            Public Access
          </label>
          <Button type="submit" size="sm" disabled={creating}>
            {creating ? 'Creating...' : '+ Create Bucket'}
          </Button>
        </form>
      </Card>

      {/* Bucket Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2 overflow-x-auto">
        {buckets.map((b) => (
          <button
            key={b.id}
            onClick={() => setSelectedBucket(b.name)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all shrink-0 ${
              selectedBucket === b.name
                ? 'bg-accent-violet text-white shadow-md'
                : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h14a2 2 0 002-2V8m-9 4h4" />
              </svg>
              {b.name} {b.public ? '(Public)' : '(Private)'}
            </span>
          </button>
        ))}
      </div>

      {/* File Browser Component */}
      {selectedBucket ? (
        <BucketFileBrowser bucketName={selectedBucket} />
      ) : (
        <Card className="text-center py-8 text-xs text-text-muted">
          No bucket selected. Create your first bucket above.
        </Card>
      )}
    </div>
  );
}
