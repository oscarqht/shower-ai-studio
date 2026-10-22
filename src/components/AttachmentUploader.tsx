'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { uploadAttachment } from '../lib/uploadAttachment';

type Attachment = { key: string; name: string; url: string };

export function AttachmentUploader({ token, refreshToken, onChange, onBusyChange }: {
  token: string;
  refreshToken?: () => Promise<string | null>;
  onChange: (urls: string[]) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onChange(attachments.map(item => item.url)); }, [attachments, onChange]);

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setError(null);
    setBusy(true);
    onBusyChange(true);
    const failures: string[] = [];
    try {
      for (const file of files) {
        if (!mounted.current) break;
        try {
          const url = await uploadAttachment(file, token, refreshToken);
          if (mounted.current) setAttachments(previous => [...previous, { key: crypto.randomUUID(), name: file.name, url }]);
        } catch (err) {
          failures.push(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed.'}`);
        }
      }
      if (mounted.current && failures.length) setError(failures.join('\n'));
    } finally {
      if (mounted.current) { setBusy(false); onBusyChange(false); }
    }
  };

  return <div className="mt-5 rounded-2xl border border-[#E3D8CA] dark:border-[#3D352E] p-4">
    <label htmlFor="attachment-files" className="block text-sm font-medium mb-2">Image attachments</label>
    <input id="attachment-files" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={busy} onChange={upload}
      className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:px-4 file:py-2 file:bg-[#F6F0E7] file:text-[#4F4740] disabled:opacity-50" />
    <p className="mt-2 text-xs text-[#8A7E73]">Uploaded to Raindrop. Public image links are included when you open the image app or copy the payload.</p>
    {busy && <p role="status" className="mt-2 text-sm">Uploading images…</p>}
    {error && <p role="alert" className="mt-2 whitespace-pre-line text-sm text-[#96402F] dark:text-[#F5AB88]">{error}</p>}
    {attachments.length > 0 && <>
      <div className="mt-3 flex flex-wrap gap-3">{attachments.map(item => <div key={item.key} className="relative w-24">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt={item.name} className="h-20 w-24 rounded-lg object-cover" />
        <span className="block truncate text-xs mt-1" title={item.name}>{item.name}</span>
        <button type="button" aria-label={`Remove attachment ${item.name}`} onClick={() => setAttachments(previous => previous.filter(value => value.key !== item.key))}
          className="absolute top-1 right-1 rounded-full bg-black/70 text-white p-1"><X size={12} /></button>
      </div>)}</div>
      <button type="button" className="mt-2 text-xs underline" onClick={() => setAttachments([])}>Clear attachments</button>
    </>}
  </div>;
}
