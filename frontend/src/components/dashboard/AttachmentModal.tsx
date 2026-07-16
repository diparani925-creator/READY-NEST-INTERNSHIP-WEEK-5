'use client';

import React from 'react';
import { Paperclip, Plus, Loader2, Trash2, FileText, File } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

interface Attachment {
  id: string;
  filename: string;
  path: string;
  mimeType: string;
  size: number;
  user?: { name: string } | null;
}

interface AttachmentModalProps {
  open: boolean;
  title: string;
  isLoading: boolean;
  attachments: Attachment[];
  onClose: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (id: string) => void;
}

export default function AttachmentModal({
  open,
  title,
  isLoading,
  attachments,
  onClose,
  onUpload,
  onDelete,
}: AttachmentModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-900 bg-slate-950 p-6 flex flex-col gap-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
          <div className="flex items-center gap-2 text-white">
            <Paperclip className="h-5 w-5 text-indigo-400" />
            <h3 className="font-bold text-lg">{title}</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-white text-xs font-semibold"
          >
            Close
          </button>
        </div>

        {/* Document Uploader Input widget */}
        <div className="p-6 border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/50 flex flex-col items-center justify-center text-center gap-3 relative hover:border-indigo-600/50 transition">
          <Plus className="h-8 w-8 text-slate-500 animate-pulse" />
          <div className="text-xs text-slate-400">
            <p className="font-bold text-slate-200 text-sm">Select files or drag and drop</p>
            <p className="mt-1">Supported: Images, PDF, Word, Excel, ZIP (Max 10MB)</p>
          </div>
          <input 
            type="file"
            onChange={onUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>

        {/* Attachments List */}
        <div className="flex-1 flex flex-col gap-3 min-h-[200px] max-h-[300px] overflow-y-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Workspace Files</span>
          {isLoading ? (
            <div className="h-32 flex items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <span>Retrieving file log...</span>
            </div>
          ) : attachments.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-slate-500 text-xs italic">
              No attachments uploaded to this workspace task/project.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {attachments.map((file) => {
                const isImg = file.mimeType.startsWith('image/');
                return (
                  <div key={file.id} className="p-3.5 rounded-xl border border-slate-900 bg-slate-950/40 hover:bg-slate-900/40 flex items-center justify-between gap-4 transition text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* File type icon or visual image thumbnail preview */}
                      {isImg ? (
                        <div className="h-10 w-10 rounded overflow-hidden border border-slate-800 shrink-0 bg-slate-900">
                          <img 
                            src={`${BACKEND_URL}${file.path}`} 
                            alt={file.filename}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded border border-slate-800 flex items-center justify-center shrink-0 bg-slate-900 text-slate-500">
                          {file.mimeType.includes('pdf') ? <FileText className="h-5 w-5 text-red-400" /> : <File className="h-5 w-5 text-blue-400" />}
                        </div>
                      )}

                      <div className="min-w-0 flex flex-col">
                        <a 
                          href={`${BACKEND_URL}${file.path}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-bold text-slate-200 hover:text-indigo-400 hover:underline truncate"
                        >
                          {file.filename}
                        </a>
                        <span className="text-[10px] text-slate-500 mt-0.5">
                          {Math.round(file.size / 1024)} KB • Uploaded by {file.user?.name || 'Unknown'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onDelete(file.id)}
                      className="p-2 rounded bg-slate-900 hover:bg-red-950/30 text-slate-500 hover:text-red-400 transition"
                      title="Delete File"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
