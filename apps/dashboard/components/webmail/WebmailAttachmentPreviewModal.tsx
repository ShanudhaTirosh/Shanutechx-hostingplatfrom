'use client';

import React from 'react';
import { X, Download, FileText, Image as ImageIcon, Music, Film, ExternalLink } from 'lucide-react';

interface Attachment {
  id?: string;
  filename: string;
  contentType: string;
  size: number;
  url?: string;
  data?: string;
}

interface WebmailAttachmentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: Attachment | null;
}

export function WebmailAttachmentPreviewModal({ isOpen, onClose, attachment }: WebmailAttachmentPreviewModalProps) {
  if (!isOpen || !attachment) return null;

  const isImage = attachment.contentType.startsWith('image/');
  const isAudio = attachment.contentType.startsWith('audio/');
  const isVideo = attachment.contentType.startsWith('video/');
  const isPdf = attachment.contentType.includes('pdf');

  const fileUrl = attachment.url || (attachment.data ? `data:${attachment.contentType};base64,${attachment.data}` : '');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-[#0f0f13] border border-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col text-slate-100 shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex-shrink-0">
              {isImage ? <ImageIcon className="w-5 h-5" /> : isAudio ? <Music className="w-5 h-5" /> : isVideo ? <Film className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div className="truncate">
              <h3 className="text-sm font-semibold truncate text-slate-200">{attachment.filename}</h3>
              <p className="text-xs text-slate-400">{attachment.contentType} • {formatSize(attachment.size)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {fileUrl && (
              <a
                href={fileUrl}
                download={attachment.filename}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-black/40 min-h-[300px]">
          {isImage && fileUrl ? (
            <img src={fileUrl} alt={attachment.filename} className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-lg border border-slate-800" />
          ) : isAudio && fileUrl ? (
            <div className="w-full max-w-md p-6 bg-slate-900 rounded-xl border border-slate-800 text-center">
              <Music className="w-12 h-12 text-indigo-400 mx-auto mb-4 animate-pulse" />
              <audio controls src={fileUrl} className="w-full" />
            </div>
          ) : isVideo && fileUrl ? (
            <video controls src={fileUrl} className="max-w-full max-h-[65vh] rounded-lg border border-slate-800 shadow-lg" />
          ) : isPdf && fileUrl ? (
            <iframe src={fileUrl} title={attachment.filename} className="w-full h-[65vh] rounded-lg border border-slate-800" />
          ) : (
            <div className="text-center p-8 max-w-md">
              <FileText className="w-16 h-16 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-300">Preview not directly supported in browser</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">You can download the file to open it on your device.</p>
              {fileUrl && (
                <a
                  href={fileUrl}
                  download={attachment.filename}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-700"
                >
                  <ExternalLink className="w-4 h-4" /> Download File
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
