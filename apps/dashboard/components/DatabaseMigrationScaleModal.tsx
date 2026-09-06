'use client';

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Node, ManagedDatabase } from '../lib/types';
import {
  Server,
  Cpu,
  Database,
  RefreshCw,
  X,
  CheckCircle,
  AlertTriangle,
  Zap,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  database: ManagedDatabase | null;
  onSuccess?: () => void;
}

export default function DatabaseMigrationScaleModal({ isOpen, onClose, database, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<'scale' | 'migrate'>('scale');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [targetNodeId, setTargetNodeId] = useState<string>('');
  
  // Scaling State
  const [cpuLimit, setCpuLimit] = useState<number>(1);
  const [memoryMb, setMemoryMb] = useState<number>(1024);
  const [maxConnections, setMaxConnections] = useState<number>(100);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && database) {
      setError(null);
      setSuccessMsg(null);
      setMaxConnections(database.maxConnections || 100);
      
      // Load nodes for target selection in migration tab
      api.nodes.list()
        .then((res) => {
          const activeNodes = (res.nodes || []).filter((n) => n.isActive);
          setNodes(activeNodes);
          const otherNode = activeNodes.find((n) => n.id !== database.nodeId);
          if (otherNode) setTargetNodeId(otherNode.id);
        })
        .catch(() => {});
    }
  }, [isOpen, database]);

  if (!isOpen || !database) return null;

  const handleScale = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.managedDatabases.scale(database.id, {
        cpuLimit,
        memoryLimitMb: memoryMb,
        maxConnections,
      });

      setSuccessMsg(res.message || 'Database resources scaled successfully!');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to scale database resources');
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.managedDatabases.migrate(database.id, targetNodeId || undefined);
      setSuccessMsg(res.message || 'Database live migration complete!');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to migrate database');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">
                Manage {database.dbName || database.type.toUpperCase()} Database
              </h3>
              <p className="text-xs text-slate-400">
                Engine: <span className="text-cyan-400 font-mono">{database.type}</span> • Status: <span className="text-emerald-400 font-mono">{database.status}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('scale')}
            className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'scale'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            Dynamic Scaling & Tuning
          </button>
          <button
            onClick={() => setActiveTab('migrate')}
            className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-all ${
              activeTab === 'migrate'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-4 h-4" />
            Live Compute Migration
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'scale' ? (
            <div className="space-y-6">
              {/* CPU Cores */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" /> CPU Allocation Limit
                  </label>
                  <span className="text-xs font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/50">
                    {cpuLimit} {cpuLimit === 1 ? 'Core' : 'Cores'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={16}
                  step={0.5}
                  value={cpuLimit}
                  onChange={(e) => setCpuLimit(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                  <span>0.5 Core</span>
                  <span>4 Cores</span>
                  <span>16 Cores</span>
                </div>
              </div>

              {/* Memory RAM */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" /> RAM Memory Allocation
                  </label>
                  <span className="text-xs font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/50">
                    {memoryMb >= 1024 ? `${(memoryMb / 1024).toFixed(1)} GB` : `${memoryMb} MB`}
                  </span>
                </div>
                <input
                  type="range"
                  min={256}
                  max={16384}
                  step={256}
                  value={memoryMb}
                  onChange={(e) => setMemoryMb(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                  <span>256 MB</span>
                  <span>4 GB</span>
                  <span>16 GB</span>
                </div>
              </div>

              {/* Max Connections */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" /> Max Concurrent Connections
                  </label>
                  <span className="text-xs font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/50">
                    {maxConnections} Conns
                  </span>
                </div>
                <input
                  type="range"
                  min={25}
                  max={2000}
                  step={25}
                  value={maxConnections}
                  onChange={(e) => setMaxConnections(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                  <span>25</span>
                  <span>500</span>
                  <span>2000</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Select a target VPS compute node to perform a live database migration. The database snapshot will be transferred seamlessly with minimal read-lock latency.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Target VPS Compute Node
                </label>
                <select
                  value={targetNodeId}
                  onChange={(e) => setTargetNodeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Auto Select Optimal Compute Node --</option>
                  {nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label || node.ip} ({node.ip}) {node.id === database.nodeId ? '[Current Node]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Current Host Node:</span>
                  <span className="text-slate-200 font-mono">{database.nodeId}</span>
                </div>
                <div className="flex justify-between">
                  <span>Database Engine:</span>
                  <span className="text-cyan-400 font-mono">{database.type}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-800 bg-slate-950/60">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={activeTab === 'scale' ? handleScale : handleMigrate}
            disabled={loading}
            className="px-5 py-2 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            {activeTab === 'scale' ? 'Apply Resource Limits' : 'Start Live Migration'}
          </button>
        </div>
      </div>
    </div>
  );
}
