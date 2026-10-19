import type { SaveStyle, StylePack } from '@/types';
import { saveRaindropStyle } from './saveRaindropStyle';

// Leave room below the hosting function's 4.5 MB request-body limit.
const PROXY_BODY_BUDGET = 3_500_000;

type SaveOptions = {
  token: string;
  refreshToken?: () => Promise<string | null>;
  transport?: typeof fetch;
  directSave?: typeof saveRaindropStyle;
};

type SaveResponse = {
  status?: string;
  message?: string;
  retrySafe?: boolean;
  style?: StylePack;
  payloadRejected?: boolean;
};

export async function readStyleSaveResponse(response: Response): Promise<SaveResponse> {
  const raw = await response.text();
  let data: SaveResponse;
  try {
    data = JSON.parse(raw);
  } catch {
    if (response.status === 413) {
      return { status: 'error', payloadRejected: true, retrySafe: true,
        message: 'The server rejected this upload because it is too large. Try fewer or smaller images.' };
    }
    throw new Error(response.ok
      ? 'The server did not confirm the saved style. Re-sync before retrying.'
      : `Could not save style (HTTP ${response.status}). The server returned an invalid response. Please try again.`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`Could not save style (HTTP ${response.status}). The server returned an invalid response.`);
  }
  return data;
}

export async function saveStyle(
  source: Parameters<SaveStyle>[0],
  mode: Parameters<SaveStyle>[1],
  fields: Parameters<SaveStyle>[2],
  { token, refreshToken, transport = fetch, directSave = saveRaindropStyle }: SaveOptions,
): Promise<StylePack> {
  const { imageFiles, ...edits } = fields;
  // Only identifiers are needed; existing covers/references are read authoritatively.
  const payload = { source: { id: source.id, style_prompt_raindrop_id: source.style_prompt_raindrop_id }, mode, ...edits };
  const uploads = Object.entries(imageFiles || {});
  const estimatedSize = new Blob([JSON.stringify(payload)]).size + uploads.reduce((sum, [, file]) => sum + file.size + 1024, 0) + 1024;
  let useDirectUpload = estimatedSize > PROXY_BODY_BUDGET;
  if (useDirectUpload && !token.trim()) {
    throw new Error('Connect Raindrop in Settings to save large image uploads directly. Your image draft is kept.');
  }

  const send = async (currentToken: string) => {
    let body: BodyInit;
    let headers: HeadersInit | undefined;
    const data = { ...payload, token: currentToken || undefined };
    if (uploads.length) {
      const form = new FormData();
      form.set('payload', JSON.stringify(data));
      for (const [key, file] of uploads) form.append(key, file);
      body = form;
    } else {
      body = JSON.stringify(data);
      headers = { 'Content-Type': 'application/json' };
    }
    if (useDirectUpload) {
      // This Request is parsed locally by the shared save service. Its image bytes
      // go from the browser to Raindrop, never through the hosting function.
      return directSave(new Request('https://shower.local/api/raindrop/style', { method: 'POST', body, headers }), transport);
    }
    return transport('/api/raindrop/style', { method: 'POST', body, headers });
  };

  let response = await send(token);
  let data = await readStyleSaveResponse(response);
  // A hosting proxy can impose an even smaller limit. A plain 413 rejects the
  // request before the save handler runs, so switch transports once safely.
  if (!useDirectUpload && data.payloadRejected && token.trim()) {
    useDirectUpload = true;
    response = await send(token);
    data = await readStyleSaveResponse(response);
  }
  if (response.status === 401 && data.retrySafe !== false && refreshToken) {
    const refreshedToken = await refreshToken();
    if (refreshedToken) {
      response = await send(refreshedToken);
      data = await readStyleSaveResponse(response);
    }
  }
  if (!response.ok || data.status !== 'success' || !data.style) {
    throw new Error(data.message || 'Could not save style to Raindrop.');
  }
  return data.style;
}
