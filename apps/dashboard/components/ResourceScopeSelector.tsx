'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui';

import { User, Users, X } from 'lucide-react';

interface TeamItem {
  id: string;
  name: string;
  myRole: string;
}

interface Props {
  value: string; // 'personal' or teamId
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
}

export function ResourceScopeSelector({
  value,
  onChange,
  label = 'Ownership Scope',
  hint = 'Choose whether this deployment/resource belongs to your Personal Account or a Team Workspace.',
}: Props) {
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  function loadTeams() {
    setLoading(true);
    api.teams
      .list()
      .then((data) => {
        const owned = (data.ownedTeams || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          myRole: 'owner',
        }));
        const joined = (data.joinedTeams || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          myRole: t.myRole || 'member',
        }));

        // Deduplicate teams by ID
        const map = new Map<string, TeamItem>();
        for (const item of [...owned, ...joined]) {
          map.set(item.id, item);
        }
        setTeams(Array.from(map.values()));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTeams();
  }, []);

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setCreating(true);
    try {
      const res = await api.teams.create(newTeamName.trim());
      toast(`Team "${res.team.name}" created successfully!`, 'success');
      setShowCreateModal(false);
      setNewTeamName('');
      loadTeams();
      onChange(res.team.id);
    } catch (err: any) {
      toast(err.message || 'Failed to create team', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-text-muted">{label}</label>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="text-[11px] text-accent-violet hover:underline flex items-center gap-1 font-medium"
        >
          <span>+ Create Team Workspace</span>
        </button>
      </div>

      <select
        value={value || 'personal'}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50 transition-colors"
      >
        <option value="personal" className="bg-[#0a0a14]">
          Personal Account (Private to You)
        </option>
        {teams.map((t) => (
          <option key={t.id} value={t.id} className="bg-[#0a0a14]">
            Team: {t.name} ({t.myRole.toUpperCase()})
          </option>
        ))}
      </select>

      {hint && <p className="text-[10px] text-text-faint">{hint}</p>}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-background-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-semibold text-sm text-text-primary">Create Team Workspace</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-text-muted hover:text-text-primary text-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-text-muted">
              Create a shared workspace to collaborate on deployments, manage team permissions, and delegate resource access.
            </p>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-muted">Team Name</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Acme Studio / Bot Operations"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-violet/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-text-muted hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-brand-gradient text-white shadow-glow-violet hover:opacity-90 transition-opacity"
                >
                  {creating ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
