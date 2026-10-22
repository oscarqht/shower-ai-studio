'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { attachmentLibraryRequest, SavedAttachment, uploadAttachment } from '../lib/uploadAttachment';

export function AttachmentUploader({ token, refreshToken, onChange, onBusyChange }: {
  token: string;
  refreshToken?: () => Promise<string | null>;
  onChange: (urls: string[]) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [attachments, setAttachments] = useState<SavedAttachment[]>([]);
  const [selected, setSelected] = useState<SavedAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const loadVersion = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; loadVersion.current++; }; }, []);
  useEffect(() => { onChange(selected.map(item => item.url)); }, [selected, onChange]);

  const load = useCallback(async (nextPage = 0) => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    try {
      const data = await attachmentLibraryRequest(token, { page: nextPage }, refreshToken);
      if (!mounted.current || version !== loadVersion.current) return;
      setAttachments(previous => {
        const items = nextPage === 0 ? data.attachments : [...previous, ...data.attachments];
        return items.filter((item, index) => items.findIndex(value => value.id === item.id) === index);
      });
      setPage(nextPage);
      setHasMore(data.hasMore);
    } catch (err) {
      if (mounted.current && version === loadVersion.current) setError(err instanceof Error ? err.message : 'Could not load attachments.');
    } finally {
      if (mounted.current && version === loadVersion.current) setLoading(false);
    }
  }, [token, refreshToken]);
  useEffect(() => { void load(); }, [load]);

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    // An older list response must not overwrite a newly uploaded item.
    loadVersion.current++;
    setLoading(false);
    setError(null);
    setBusy(true);
    onBusyChange(true);
    const failures: string[] = [];
    try {
      for (const file of files) {
        if (!mounted.current) break;
        try {
          const item = await uploadAttachment(file, token, refreshToken);
          if (mounted.current) {
            setAttachments(previous => [item, ...previous.filter(value => value.id !== item.id)]);
            setSelected(previous => [...previous.filter(value => value.id !== item.id), item]);
          }
        } catch (err) { failures.push(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed.'}`); }
      }
      if (mounted.current && failures.length) setError(failures.join('\n'));
    } finally {
      if (mounted.current) { setBusy(false); onBusyChange(false); }
    }
  };

  const remove = async (item: SavedAttachment) => {
    loadVersion.current++;
    setLoading(false);
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      await attachmentLibraryRequest(token, { id: item.id }, refreshToken);
      if (mounted.current) {
        setAttachments(previous => previous.filter(value => value.id !== item.id));
        setSelected(previous => previous.filter(value => value.id !== item.id));
        // Deletion shifts paginated results, so reload before fetching another page.
        await load();
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Could not delete attachment.');
    } finally {
      if (mounted.current) { setBusy(false); onBusyChange(false); }
    }
  };

  return <div className="mt-5 rounded-2xl border border-[#E3D8CA] dark:border-[#3D352E] p-4">
    <label htmlFor="attachment-files" className="block text-sm font-medium mb-2">Image attachments</label>
    <input id="attachment-files" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={busy} onChange={upload}
      className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:px-4 file:py-2 file:bg-[#F6F0E7] file:text-[#4F4740] disabled:opacity-50" />
    <p className="mt-2 text-xs text-[#8A7E73]">Select saved images to include their public links when you open the image app or copy the payload. PNG, JPEG, WEBP or GIF, up to 10 MB each.</p>
    {busy && <p role="status" className="mt-2 text-sm">Saving attachment changes…</p>}
    {error && <p role="alert" className="mt-2 whitespace-pre-line text-sm text-[#96402F] dark:text-[#F5AB88]">{error}</p>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-medium">Saved attachments <span className="text-[#8A7E73]">· {selected.length} selected</span></h3>
      <div className="flex gap-3 text-xs">
        {selected.length > 0 && <button type="button" disabled={busy} className="underline" onClick={() => setSelected([])}>Clear selection</button>}
        <button type="button" disabled={busy || loading} className="underline disabled:opacity-50" onClick={() => void load()}>Refresh attachments</button>
      </div>
    </div>
    {loading && <p role="status" className="mt-3 text-sm">Loading saved attachments…</p>}
    {!loading && !error && !attachments.length && <p className="mt-3 text-sm text-[#8A7E73]">No saved attachments yet. Upload an image to start.</p>}
    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3" id="saved-attachments">
      {attachments.map(item => {
        const checked = selected.some(value => value.id === item.id);
        return <div key={item.id} className={`overflow-hidden rounded-xl border ${checked ? 'border-[#C4633E] dark:border-[#E07A52]' : 'border-[#E3D8CA] dark:border-[#3D352E]'}`}>
          <label className="block cursor-pointer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={item.name} loading="lazy" className="h-24 w-full object-cover" />
            <span className="flex items-center gap-2 p-2 text-xs">
              <input type="checkbox" aria-label={`Use attachment ${item.name}`} checked={checked} disabled={busy}
                onChange={() => setSelected(previous => checked ? previous.filter(value => value.id !== item.id) : [...previous, item])} />
              <span className="truncate" title={item.name}>{item.name}</span>
            </span>
          </label>
          <button type="button" disabled={busy} aria-label={`Delete attachment ${item.name}`} onClick={() => void remove(item)}
            className="flex w-full items-center justify-center gap-1 border-t border-[#E3D8CA] dark:border-[#3D352E] py-2 text-xs text-[#96402F] dark:text-[#F5AB88] disabled:opacity-50"><Trash2 size={12} />Delete</button>
        </div>;
      })}
    </div>
    {hasMore && <button type="button" disabled={busy || loading} className="mt-3 text-sm underline disabled:opacity-50" onClick={() => void load(page + 1)}>Load more attachments</button>}
  </div>;
}
