'use client';

import { useState, useEffect, ReactNode } from 'react';
import { Card, Input, Button, ErrorBanner } from './ui';
import { api } from '@/lib/api';

interface PasswordLockGuardProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

const UNLOCK_STORAGE_KEY = 'shanutechx_settings_unlocked_until';

export default function PasswordLockGuard({
  children,
  title = 'Settings Protection',
  description = 'Please enter your Account Password or Settings PIN to view and modify sensitive system configurations.',
}: PasswordLockGuardProps) {
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if session is currently unlocked
    const storedUnlockTime = localStorage.getItem(UNLOCK_STORAGE_KEY);
    if (storedUnlockTime) {
      const until = parseInt(storedUnlockTime, 10);
      if (until > Date.now()) {
        setUnlocked(true);
      } else {
        localStorage.removeItem(UNLOCK_STORAGE_KEY);
      }
    }
  }, []);

  async function handleVerify(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!password.trim()) {
      setError('Please enter your password or PIN');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.settings.verifyPassword(password.trim());
      if (res.ok && res.unlocked) {
        setUnlocked(true);
        // Keep unlocked for 30 minutes
        const expireAt = Date.now() + 30 * 60 * 1000;
        localStorage.setItem(UNLOCK_STORAGE_KEY, expireAt.toString());
        setPassword('');
      } else {
        setError(res.message || 'Incorrect password or PIN.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleLock() {
    setUnlocked(false);
    localStorage.removeItem(UNLOCK_STORAGE_KEY);
  }

  if (unlocked) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-2.5 text-xs text-emerald-300 mb-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium">Settings Unlocked (Active Security Session)</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLock} className="text-xs py-1 h-7">
            🔒 Lock Settings
          </Button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] py-8">
      <Card className="max-w-md w-full border border-white/10 shadow-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-brand-gradient" />
        
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-accent-violet/15 text-accent-violet-light flex items-center justify-center text-2xl shadow-glow-violet">
            🔐
          </div>

          <div>
            <h2 className="text-lg font-bold text-text-primary">{title}</h2>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">{description}</p>
          </div>

          {error && <ErrorBanner message={error} />}

          <form onSubmit={handleVerify} className="w-full space-y-4 pt-2">
            <Input
              type="password"
              placeholder="Enter password or PIN..."
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              autoFocus
            />

            <Button type="submit" variant="primary" className="w-full justify-center py-2.5" loading={loading}>
              Unlock Settings
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
