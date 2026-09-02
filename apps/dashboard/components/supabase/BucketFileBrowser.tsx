'use client';

import React, { useState } from 'react';
import { FileText } from 'lucide-react';

interface FileItem {
  name: string;
  size: number;
  updatedAt: string;
  type: string;
}

interface BucketFileBrowserProps {
  bucketName: string;
}

const SAMPLE_FILES: FileItem[] = [
  { name: 'avatar-user-101.jpg', size: 145200, updatedAt: new Date().toISOString(), type: 'image/jpeg' },
  { name: 'config-export.json', size: 3412, updatedAt: new Date().toISOString(), type: 'application/json' },
  { name: 'database-backup-08-11.sql.gz', size: 14502030, updatedAt: new Date().toISOString(), type: 'application/gzip' },
];

export function BucketFileBrowser({ bucketName }: BucketFileBrowserProps) {
  const [files, setFiles] = useState<FileItem[]>(SAMPLE_FILES);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(SAMPLE_FILES[0]);

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {/* File Tree & Upload */}
      <div className="md:col-span-2 glass rounded-xl p-4 border border-white/[0.06] flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 border-b border-white/[0.06] pb-3">
            <div>
              <h3 className="font-semibold text-sm text-text-primary">Bucket: {bucketName}</h3>
              <p className="text-xs text-text-muted">{files.length} objects stored</p>
            </div>
            <label className="px-3 py-1.5 rounded-lg bg-accent-violet/20 hover:bg-accent-violet/30 text-accent-violet-light border border-accent-violet/30 text-xs font-semibold cursor-pointer transition-all">
              + Upload File
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const f = e.target.files[0];
                    const newF: FileItem = {
                      name: f.name,
                      size: f.size,
                      updatedAt: new Date().toISOString(),
                      type: f.type || 'application/octet-stream',
                    };
                    setFiles([newF, ...files]);
                    setSelectedFile(newF);
                  }
                }}
              />
            </label>
          </div>

          <div className="space-y-1">
            {files.map((file) => (
              <div
                key={file.name}
                onClick={() => setSelectedFile(file)}
                className={`p-3 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-all ${
                  selectedFile?.name === file.name
                    ? 'bg-white/[0.08] border-accent-violet/40 text-text-primary'
                    : 'border-white/[0.04] text-text-muted hover:bg-white/[0.04] hover:text-text-primary'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <FileText className="h-4 w-4 text-accent-violet-light shrink-0" />
                  <span className="font-medium truncate">{file.name}</span>
                </div>
                <span className="text-[11px] text-text-faint shrink-0">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Preview Panel */}
      <div className="glass rounded-xl p-4 border border-white/[0.06]">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3 border-b border-white/[0.06] pb-2">
          Object Details
        </h4>
        {selectedFile ? (
          <div className="space-y-3 text-xs">
            <div>
              <p className="text-[10px] text-text-faint uppercase">Filename</p>
              <p className="font-mono text-text-primary break-all">{selectedFile.name}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-faint uppercase">Content Type</p>
              <p className="font-mono text-text-muted">{selectedFile.type}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-faint uppercase">Size</p>
              <p className="text-text-muted">{(selectedFile.size / 1024).toFixed(2)} KB ({selectedFile.size} bytes)</p>
            </div>
            <div>
              <p className="text-[10px] text-text-faint uppercase">Last Modified</p>
              <p className="text-text-muted">{new Date(selectedFile.updatedAt).toLocaleString()}</p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => alert(`Public URL: http://localhost:8001/storage/v1/object/public/${bucketName}/${selectedFile.name}`)}
                className="w-full py-2 px-3 rounded-lg bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 border border-teal-500/30 text-xs font-semibold transition-all"
              >
                Copy Public URL
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-text-muted">Select an object to inspect details.</p>
        )}
      </div>
    </div>
  );
}
