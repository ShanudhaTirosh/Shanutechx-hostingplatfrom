'use client';

import React, { useEffect, useState } from 'react';
import { useAppUser } from '@/lib/AppUserContext';
import { IconLock, IconUnlock } from '@/components/Icons';

const DEV_RIGHT_CLICK_STORAGE_KEY = 'dev_enable_right_click';

export function RightClickProtector({ children }: { children: React.ReactNode }) {
  const { apiUser } = useAppUser();
  const [devRightClickEnabled, setDevRightClickEnabled] = useState(false);

  useEffect(() => {
    // Check initial dev toggle preference
    const stored = localStorage.getItem(DEV_RIGHT_CLICK_STORAGE_KEY);
    if (stored === 'true') {
      setDevRightClickEnabled(true);
    }

    const handleStorageChange = () => {
      setDevRightClickEnabled(localStorage.getItem(DEV_RIGHT_CLICK_STORAGE_KEY) === 'true');
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('dev_right_click_changed', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('dev_right_click_changed', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const isDev = apiUser?.role === 'dev';

      // If Dev and Dev toggle is ON -> allow native browser context menu
      if (isDev && devRightClickEnabled) {
        return;
      }

      // Allow custom app context menus if target has data-allow-contextmenu
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-allow-contextmenu="true"]')) {
        return;
      }

      // Suppress default browser right-click for all non-dev users and dev when toggle is OFF
      e.preventDefault();
    };

    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, [apiUser, devRightClickEnabled]);

  return <>{children}</>;
}

/**
 * Dev-only Toolbar Toggle Button to enable/disable native browser right-click inspect menu.
 */
export function DevRightClickToggle() {
  const { apiUser } = useAppUser();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(DEV_RIGHT_CLICK_STORAGE_KEY) === 'true';
    setEnabled(stored);
  }, []);

  if (apiUser?.role !== 'dev') {
    return null;
  }

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(DEV_RIGHT_CLICK_STORAGE_KEY, String(next));
    window.dispatchEvent(new Event('dev_right_click_changed'));
  };

  return (
    <button
      onClick={toggle}
      title={enabled ? 'Dev Mode: Native Right-Click ENABLED (Click to disable)' : 'Dev Mode: Native Right-Click DISABLED (Click to enable)'}
      className={`px-2.5 py-1 text-[11px] font-mono font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
        enabled
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
          : 'bg-white/5 border-white/10 text-text-muted hover:text-white hover:bg-white/10'
      }`}
    >
      {enabled ? <IconUnlock size={13} /> : <IconLock size={13} />}
      <span>{enabled ? 'Dev Inspect: ON' : 'Dev Inspect: OFF'}</span>
    </button>
  );
}
