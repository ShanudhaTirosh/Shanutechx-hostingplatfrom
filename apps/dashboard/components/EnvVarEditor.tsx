'use client';

import { useState } from 'react';
import { Modal, Button, Input, ConfirmDialog, useToast } from './ui';
import { api } from '@/lib/api';

interface EnvVarEditorProps {
  deploymentId: string;
  initialEnvVars: Record<string, string>;
  deploymentStatus: 'pending' | 'building' | 'running' | 'failed' | 'stopped';
  onClose: () => void;
  onSaved: () => void;
}

export function EnvVarEditor({ deploymentId, initialEnvVars, deploymentStatus, onClose, onSaved }: EnvVarEditorProps) {
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string; id: string }>>(
    Object.entries(initialEnvVars).map(([key, value], idx) => ({
      key,
      value,
      id: `${idx}-${key}`,
    }))
  );
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const { toast } = useToast();

  function addVariable() {
    setEnvVars([...envVars, { key: '', value: '', id: `new-${Date.now()}` }]);
  }

  function updateVariable(id: string, field: 'key' | 'value', newValue: string) {
    setEnvVars(envVars.map(v => (v.id === id ? { ...v, [field]: newValue } : v)));
  }

  function removeVariable(id: string) {
    setEnvVars(envVars.filter(v => v.id !== id));
  }

  function handleSave() {
    // Validate that all keys are non-empty
    const invalidVars = envVars.filter(v => !v.key.trim());
    if (invalidVars.length > 0) {
      toast('All environment variable keys must be non-empty', 'error');
      return;
    }

    // Check for duplicate keys
    const keys = envVars.map(v => v.key.trim());
    const duplicates = keys.filter((key, idx) => keys.indexOf(key) !== idx);
    if (duplicates.length > 0) {
      toast(`Duplicate keys found: ${duplicates.join(', ')}`, 'error');
      return;
    }

    // Show confirmation dialog
    setShowConfirmDialog(true);
  }

  async function confirmSave() {
    setSaving(true);
    setProgress([]);
    
    try {
      const envVarsObject = envVars.reduce((acc, v) => {
        if (v.key.trim()) {
          acc[v.key.trim()] = v.value;
        }
        return acc;
      }, {} as Record<string, string>);

      await api.deployments.updateEnv(deploymentId, envVarsObject, (event) => {
        if (event.message) {
          setProgress(prev => [...prev, event.message!]);
        }
        if (event.phase === 'complete') {
          toast('Environment variables updated successfully', 'success');
          setTimeout(() => {
            onSaved();
            onClose();
          }, 1000);
        } else if (event.phase === 'error') {
          toast(event.message || 'Failed to update environment variables', 'error');
          setSaving(false);
        }
      });

      // For non-streaming responses (stopped deployments)
      if (deploymentStatus !== 'running') {
        toast('Environment variables updated. Changes will apply on next start.', 'success');
        onSaved();
        onClose();
      }
    } catch (err: any) {
      toast(err.message || 'Failed to update environment variables', 'error');
      setSaving(false);
    }
  }

  return (
    <>
      <Modal open={true} onClose={!saving ? onClose : () => {}} title="Edit Environment Variables" width="max-w-3xl">
        <div className="space-y-4">
          {!saving ? (
            <>
              <p className="text-sm text-text-muted">
                Update environment variables for this deployment. 
                {deploymentStatus === 'running' 
                  ? ' The deployment will be restarted to apply changes.'
                  : ' Changes will apply when the deployment starts.'}
              </p>

              {/* Environment Variables List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {envVars.length === 0 ? (
                  <div className="text-center py-8 text-text-muted text-sm">
                    No environment variables. Click "Add Variable" to add one.
                  </div>
                ) : (
                  envVars.map((envVar) => (
                    <div key={envVar.id} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Input
                          placeholder="VARIABLE_NAME"
                          value={envVar.key}
                          onChange={(e) => updateVariable(envVar.id, 'key', e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          placeholder="value"
                          value={envVar.value}
                          onChange={(e) => updateVariable(envVar.id, 'value', e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>
                      <button
                        onClick={() => removeVariable(envVar.id)}
                        className="mt-2.5 p-2 text-text-muted hover:text-red-400 transition-colors"
                        title="Remove variable"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add Variable Button */}
              <Button variant="secondary" size="sm" onClick={addVariable} className="w-full">
                + Add Variable
              </Button>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-white/[0.06]">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleSave}>
                  Save Changes
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-text-muted mb-4">
                {deploymentStatus === 'running' 
                  ? 'Updating environment variables and restarting deployment...'
                  : 'Updating environment variables...'}
              </p>
              
              {/* Progress Log */}
              <div className="bg-black/60 rounded-xl p-4 max-h-96 overflow-y-auto">
                {progress.length === 0 ? (
                  <div className="flex items-center gap-2 text-text-muted text-sm">
                    <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-accent-violet animate-spin" />
                    Processing...
                  </div>
                ) : (
                  <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                    {progress.join('\n')}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={confirmSave}
        title={deploymentStatus === 'running' ? 'Restart Required' : 'Update Environment Variables'}
        message={
          deploymentStatus === 'running'
            ? 'Updating environment variables will restart the deployment. This may cause brief downtime. Do you want to continue?'
            : 'Environment variables will be updated. Changes will apply when the deployment starts.'
        }
        confirmLabel="Update & Restart"
        danger={false}
      />
    </>
  );
}
