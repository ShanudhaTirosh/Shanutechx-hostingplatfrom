"use client";

import { AdminNav } from "@/features/admin/components/AdminNav";
import { SettingsForm } from "@/features/admin/components/SettingsForm";

export default function AdminSettings() {
  return (
    <>
      <AdminNav />
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted">Branding, theme, notifications and data retention.</p>
      </div>
      <SettingsForm />
    </>
  );
}
