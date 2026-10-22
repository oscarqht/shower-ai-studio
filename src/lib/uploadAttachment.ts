import { uploadRaindropAttachment } from './uploadRaindropAttachment';

export async function uploadAttachment(file: File, token: string, refreshToken?: () => Promise<string | null>): Promise<string> {
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
  if (!response.ok || data.status !== 'success' || !data.url) throw new Error(data.message || 'Failed to upload attachment to Raindrop.');
  return data.url;
}
