'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DatabaseBackup, ManagedDatabase } from '@/lib/types';

export default function DatabaseS3BackupsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [database, setDatabase] = useState<ManagedDatabase | null>(null);
  const [backups, setBackups] = useState<DatabaseBackup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Custom S3 form fields
  const [s3Endpoint, setS3Endpoint] = useState('');
  const [s3Bucket, setS3Bucket] = useState('shanutechx-db-backups');
  const [s3AccessKeyId, setS3AccessKeyId] = useState('');
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState('');
  const [region, setRegion] = useState('auto');
  const [showConfigModal, setShowConfigModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    setLoading(true);
    try {
      const [dbRes, backupsRes] = await Promise.all([
        api.managedDatabases.list().then((res) => res.databases.find((d: any) => d.id === id)),
        api.managedDatabases.s3Backups(id).catch(() => ({ backups: [] })),
      ]);
      setDatabase(dbRes || null);
      setBackups(backupsRes.backups || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerS3Backup(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setIsCreatingBackup(true);
    try {
      const res = await api.managedDatabases.createS3Backup(id, {
        s3Endpoint: s3Endpoint.trim() || undefined,
        s3Bucket: s3Bucket.trim() || 'shanutechx-db-backups',
        s3AccessKeyId: s3AccessKeyId.trim() || undefined,
        s3SecretAccessKey: s3SecretAccessKey.trim() || undefined,
        region: region.trim() || 'auto',
      });
      setShowConfigModal(false);
      setNotice('Database snapshot successfully dumped and backed up to S3!');
      setTimeout(() => setNotice(null), 5000);
      fetchData();
    } catch (err: any) {
      alert(`Backup failed: ${err.message}`);
    } finally {
      setIsCreatingBackup(false);
    }
  }

  async function handleRestoreS3Backup(backupId: string) {
    if (!confirm('Are you sure you want to restore this S3 backup? Current database state will be overwritten.')) return;
    setRestoringId(backupId);
    try {
      await api.managedDatabases.restoreS3Backup(id, backupId);
      setNotice('Database restored successfully from S3 dump!');
      setTimeout(() => setNotice(null), 5000);
    } catch (err: any) {
      alert(`Restore failed: ${err.message}`);
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <button
            onClick={() => router.push('/databases')}
            className="text-xs font-medium text-text-muted hover:text-white flex items-center gap-1 mb-1"
          >
            ← Back to Managed Databases
          </button>
          <h1 className="text-2xl font-bold text-white">Automated S3 Database Backups</h1>
          <p className="text-xs text-text-muted mt-1">
            Cloudflare R2, AWS S3, and Self-Hosted MinIO / Garage / Ceph automated dumps with 1-click restore.
          </p>
        </div>

        <button
          onClick={() => setShowConfigModal(true)}
          className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Run S3 Backup Now
        </button>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-300 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-white hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-text-muted animate-pulse">Loading S3 database backups...</div>
      ) : (
        <div className="space-y-6">
          {/* Database Info Card */}
          {database && (
            <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{database.type} Engine</span>
                <h3 className="text-base font-bold text-white">{database.dbName || database.id}</h3>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <div>Status: <span className="text-emerald-400 font-bold uppercase">{database.status}</span></div>
                <div>Port: <span className="text-white font-mono">{database.internalPort || 5432}</span></div>
                <div>Host: <span className="text-white font-mono">{database.internalHost || 'local'}</span></div>
              </div>
            </div>
          )}

          {/* Backup History Table */}
          <div className="bg-[#0b0c16] border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white">S3 Snapshot History ({backups.length})</h2>

            {backups.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted bg-white/[0.02] border border-white/5 rounded-xl">
                No S3 backups found for this database. Click &quot;Run S3 Backup Now&quot; to trigger an automated snapshot dump.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-text-muted font-semibold">
                      <th className="pb-3 px-2">Snapshot Key</th>
                      <th className="pb-3 px-2">S3 Bucket</th>
                      <th className="pb-3 px-2">S3 Endpoint</th>
                      <th className="pb-3 px-2">Status</th>
                      <th className="pb-3 px-2">Timestamp</th>
                      <th className="pb-3 px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {backups.map((b) => (
                      <tr key={b.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-2 font-mono text-emerald-300 font-semibold">{b.s3Key}</td>
                        <td className="py-3 px-2 font-mono text-white">{b.s3Bucket}</td>
                        <td className="py-3 px-2 font-mono text-text-muted">{b.s3Endpoint || 'Cloudflare R2 (Default)'}</td>
                        <td className="py-3 px-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              b.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : b.status === 'in_progress'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-text-muted">{new Date(b.createdAt).toLocaleString()}</td>
                        <td className="py-3 px-2 text-right">
                          <button
                            onClick={() => handleRestoreS3Backup(b.id)}
                            disabled={restoringId === b.id || b.status !== 'completed'}
                            className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-semibold disabled:opacity-30"
                          >
                            {restoringId === b.id ? 'Restoring...' : '1-Click Restore'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* S3 Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0b0c16] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Configure S3 Storage Endpoint</h3>
              <button onClick={() => setShowConfigModal(false)} className="text-text-muted hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>

            <form onSubmit={handleTriggerS3Backup} className="space-y-3 text-xs">
              <div>
                <label className="block text-text-muted mb-1">Target S3 Bucket Name *</label>
                <input
                  type="text"
                  required
                  value={s3Bucket}
                  onChange={(e) => setS3Bucket(e.target.value)}
                  placeholder="e.g. my-app-db-backups"
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-text-muted mb-1">Custom S3 Endpoint (Optional for Self-Hosted MinIO/S3)</label>
                <input
                  type="text"
                  value={s3Endpoint}
                  onChange={(e) => setS3Endpoint(e.target.value)}
                  placeholder="https://minio.mycompany.com or leave empty for default Cloudflare R2"
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-muted mb-1">Access Key ID (Optional)</label>
                  <input
                    type="text"
                    value={s3AccessKeyId}
                    onChange={(e) => setS3AccessKeyId(e.target.value)}
                    placeholder="Leave empty for default"
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-text-muted mb-1">Secret Access Key (Optional)</label>
                  <input
                    type="password"
                    value={s3SecretAccessKey}
                    onChange={(e) => setS3SecretAccessKey(e.target.value)}
                    placeholder="Leave empty for default"
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-white font-semibold hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBackup}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold disabled:opacity-50"
                >
                  {isCreatingBackup ? 'Backing Up...' : 'Start S3 Dump'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
