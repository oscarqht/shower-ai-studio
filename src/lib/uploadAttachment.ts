import { uploadRaindropAttachment } from './uploadRaindropAttachment';

export type SavedAttachment = { id: string; name: string; url: string; previewUrl?: string };

export async function uploadAttachment(file: File, token: string, refreshToken?: () => Promise<string | null>): Promise<SavedAttachment> {
  // Keep file bytes outside the hosting proxy's body limit when a browser token is available.
  const direct = file.size > 3_500_000;
  if (direct && !token.trim()) throw new Error('Connect Raindrop in Settings to upload images larger than 3.5 MB.');
  const send = (currentToken: string) => {
    const form = new FormData();
    form.append('file', file);
    if (currentToken.trim()) form.append('token', currentToken.trim());
    return direct
      ? uploadRaindropAttachment(new Request('https://shower.local/api/raindrop/attachments', { method: 'POST', body: form }))
      : fetch('/api/raindrop/attachments', { method: 'POST', body: form });
  };
  const read = async (response: Response) => {
    try { return await response.json(); } catch {
      throw new Error(`Attachment upload failed (HTTP ${response.status}). ${response.status === 413 ? 'Try a smaller image or connect Raindrop in Settings.' : 'The server returned an invalid response.'}`);
    }
  };
  let response = await send(token);
  let data = await read(response);
  if (response.status === 401 && data.retrySafe !== false && refreshToken) {
    const refreshed = await refreshToken();
    if (refreshed) {
      response = await send(refreshed);
      data = await read(response);
    }
  }
  if (!response.ok || data.status !== 'success' || !data.url || !data.id) throw new Error(data.message || 'Failed to upload attachment to Raindrop.');
  return { id: data.id, name: file.name, url: data.url, ...(data.previewUrl ? { previewUrl: data.previewUrl } : {}) };
}

export async function attachmentLibraryRequest(
  token: string, options: { page: number } | { id: string }, refreshToken?: () => Promise<string | null>,
): Promise<{ attachments: SavedAttachment[]; hasMore: boolean }> {
  const deleting = 'id' in options;
  const send = (currentToken: string) => fetch(`/api/raindrop/attachments${deleting ? '' : `?page=${options.page}`}`, {
    method: deleting ? 'DELETE' : 'GET',
    headers: { ...(currentToken.trim() ? { Authorization: `Bearer ${currentToken.trim()}` } : {}),
      ...(deleting ? { 'Content-Type': 'application/json' } : {}) },
    ...(deleting ? { body: JSON.stringify({ id: options.id }) } : {}),
    cache: 'no-store',
  });
  let response = await send(token);
  if (response.status === 401 && refreshToken) {
    const refreshed = await refreshToken();
    if (refreshed) response = await send(refreshed);
  }
  let data;
  try { data = await response.json(); } catch { throw new Error(`Could not ${deleting ? 'delete' : 'load'} attachments (HTTP ${response.status}).`); }
  if (!response.ok || data?.status !== 'success' || (!deleting && !Array.isArray(data.attachments))) {
    throw new Error(data?.message || `Could not ${deleting ? 'delete' : 'load'} attachments.`);
  }
  return { attachments: data.attachments || [], hasMore: Boolean(data.hasMore) };
}
