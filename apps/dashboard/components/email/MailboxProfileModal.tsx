'use client';

import React, { useState, useRef } from 'react';
import {
  UserCircle,
  Camera,
  UploadCloud,
  Trash2,
  X,
  Loader2,
  Check,
  AlertCircle,
  Mail,
  Building,
  Briefcase,
  Phone,
  FileText,
  Globe,
  Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api';

export interface MailboxProfileData {
  avatarUrl?: string | null;
  displayName?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  phone?: string | null;
  bio?: string | null;
  website?: string | null;
}

interface MailboxProfileModalProps {
  mailbox: {
    id: string;
    email: string;
    username: string;
    profile?: MailboxProfileData;
  };
  onClose: () => void;
  onSaved: (updatedProfile: MailboxProfileData) => void;
}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const MailboxProfileModal: React.FC<MailboxProfileModalProps> = ({
  mailbox,
  onClose,
  onSaved,
}) => {
  const [displayName, setDisplayName] = useState(mailbox.profile?.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(mailbox.profile?.avatarUrl || '');
  const [jobTitle, setJobTitle] = useState(mailbox.profile?.jobTitle || '');
  const [company, setCompany] = useState(mailbox.profile?.company || '');
  const [phone, setPhone] = useState(mailbox.profile?.phone || '');
  const [bio, setBio] = useState(mailbox.profile?.bio || '');
  const [website, setWebsite] = useState(mailbox.profile?.website || '');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client-side image validation before upload
  async function handleImageFile(file: File) {
    setError(null);
    setSuccessMessage(null);

    // 1. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError('Security verification: Only image files (JPEG, PNG, WebP, or GIF) are permitted for profile pictures.');
      return;
    }

    // 2. Validate file size (max 5MB)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError(`File size exceeds 5MB limit. Please upload an image under 5MB (selected file: ${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      return;
    }

    setUploading(true);
    try {
      const res = await api.email.uploadMailboxAvatar(mailbox.id, file);
      if (res.ok && res.avatarUrl) {
        setAvatarUrl(res.avatarUrl);
        setSuccessMessage('Profile picture uploaded and verified successfully.');
      } else {
        throw new Error(res.message || 'Failed to upload image');
      }
    } catch (err: any) {
      setError(err.message || 'Image upload failed. Please verify that the file is a valid image.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleRemoveAvatar() {
    if (!avatarUrl) return;
    setUploading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.email.removeMailboxAvatar(mailbox.id);
      if (res.ok) {
        setAvatarUrl('');
        setSuccessMessage('Profile picture removed.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove profile picture');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload: MailboxProfileData = {
        avatarUrl: avatarUrl.trim() || null,
        displayName: displayName.trim() || null,
        jobTitle: jobTitle.trim() || null,
        company: company.trim() || null,
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        website: website.trim() || null,
      };

      const res = await api.email.updateMailboxProfile(mailbox.id, payload);
      if (res.ok) {
        setSuccessMessage('Mailbox profile updated successfully.');
        onSaved(res.profile);
        setTimeout(() => {
          onClose();
        }, 600);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save mailbox profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/15 text-white">
              <UserCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Mailbox Profile & Identity</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{mailbox.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
              <Check className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* SECTION 1: Profile Picture Upload with Security Protections */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-white uppercase tracking-wider block">
              Mailbox Profile Picture
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-5 p-5 rounded-2xl bg-slate-950/60 border border-slate-800">
              {/* Avatar Preview */}
              <div className="relative group shrink-0">
                <div className="w-24 h-24 rounded-3xl bg-slate-800 border-2 border-slate-700/80 overflow-hidden flex items-center justify-center shadow-lg">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName || mailbox.username}
                      className="w-full h-full object-cover"
                      onError={() => setAvatarUrl('')}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-600/30 to-purple-600/30 flex items-center justify-center text-slate-400">
                      <Camera className="h-8 w-8 text-white" />
                    </div>
                  )}
                </div>

                {uploading && (
                  <div className="absolute inset-0 bg-black/60 rounded-3xl flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="space-y-3 flex-1 text-center sm:text-left">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files?.[0]) {
                      handleImageFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
                    dragOver
                      ? 'border-white/30 bg-white/5'
                      : 'border-slate-700 hover:border-white/15 bg-slate-900/60'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleImageFile(e.target.files[0]);
                      }
                    }}
                  />
                  <UploadCloud className="h-5 w-5 text-white" />
                  <span className="text-xs font-bold text-slate-200">
                    Click to browse or drag & drop photo
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    JPEG, PNG, WebP, GIF (Max 5MB)
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-400">
                  <span className="font-mono text-[10px]">Protected with binary signature verification</span>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={uploading}
                      className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition-colors ml-auto"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Remove Picture</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Identity & Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1.5">
                <UserCircle className="h-3.5 w-3.5 text-white" />
                <span>Display Name</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/30"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Shown as sender name in outbound emails.</span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1.5">
                <Briefcase className="h-3.5 w-3.5 text-white" />
                <span>Job Title / Role</span>
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Lead Technical Architect"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1.5">
                <Building className="h-3.5 w-3.5 text-white" />
                <span>Company / Department</span>
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Corp / Cloud Ops"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1.5">
                <Phone className="h-3.5 w-3.5 text-white" />
                <span>Contact Phone</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +1 (555) 019-2834"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1.5">
              <FileText className="h-3.5 w-3.5 text-white" />
              <span>Bio / Mailbox Signature Note</span>
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short bio or business note attached to this mailbox profile..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30 resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Globe className="h-3.5 w-3.5 text-white" />
              <span>Website</span>
            </label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/30 font-mono"
            />
          </div>

          {/* SECTION 3: Live Preview Card */}
          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-white/15 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-300">
              <Sparkles className="h-3.5 w-3.5 text-white" />
              <span>Recipient Header Preview</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-white text-sm">
                    {(displayName || mailbox.username || 'M').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white truncate">
                    {displayName || mailbox.username}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono truncate">
                    &lt;{mailbox.email}&gt;
                  </span>
                </div>
                {(jobTitle || company) && (
                  <span className="text-[10px] text-slate-400 block truncate">
                    {[jobTitle, company].filter(Boolean).join(' • ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-6 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 text-white font-bold text-xs shadow-lg shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>Save Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
