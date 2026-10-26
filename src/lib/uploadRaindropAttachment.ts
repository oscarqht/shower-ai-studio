const UPLOAD_URL = 'https://api.raindrop.io/rest/v1/raindrop/file';
export const ATTACHMENT_COLLECTION_ID = '76326590';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

// Preview images are separate from the original file URL used in the payload.
export function attachmentPreviewUrl(item: { cover?: unknown; media?: unknown; link?: unknown }): string | undefined {
  const media = Array.isArray(item.media) ? item.media.map(value => value?.link) : [];
  for (const candidate of [item.cover, ...media, item.link]) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    try {
      const url = new URL(candidate);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return candidate;
    } catch { /* Try the next preview source. */ }
  }
}

class AttachmentError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

// Shared by the server route and direct browser uploads that exceed proxy limits.
export async function uploadRaindropAttachment(
  req: Request, raindropFetch: typeof fetch = fetch, fallbackToken?: string,
): Promise<Response> {
  let uploadStarted = false;
  let retrySafe = true;
  try {
    let form: FormData;
    try { form = await req.formData(); }
    catch { throw new AttachmentError('Provide an image attachment as multipart form data.', 400); }
    const file = form.get('file');
    if (!file || typeof file === 'string' || !IMAGE_TYPES.has(file.type) || !file.size || file.size > MAX_FILE_SIZE) {
      throw new AttachmentError('Upload a PNG, JPEG, WEBP, or GIF image up to 10 MB.', 400);
    }
    const bodyToken = form.get('token');
    const token = (typeof bodyToken === 'string' && bodyToken.trim()) ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || fallbackToken?.trim();
    if (!token) throw new AttachmentError('Raindrop API token is missing. Add it in settings.', 400);

    const uploadForm = new FormData();
    // Raindrop reads destination fields before the multipart file stream.
    uploadForm.append('collectionId', ATTACHMENT_COLLECTION_ID);
    uploadForm.append('file', file, file.name);
    uploadStarted = true;
    retrySafe = false;
    const response = await raindropFetch(UPLOAD_URL, {
      method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: uploadForm, cache: 'no-store',
    });
    // An explicit authorization rejection did not create an attachment.
    retrySafe = response.status === 401;
    if (response.status === 413) throw new AttachmentError('Raindrop rejected this image upload as too large.', 413);
    let data: Record<string, any>;
    try {
      data = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid response');
    } catch {
      throw new AttachmentError(`Raindrop returned an invalid upload response (${response.status}).`, response.ok ? 502 : response.status);
    }
    if (!response.ok || data.result === false) {
      throw new AttachmentError(`Raindrop image upload failed (${response.status}): request rejected.`, response.ok ? 502 : response.status);
    }
    const item = data.item;
    if (!item || !/^[1-9]\d*$/.test(String(item._id))) {
      throw new AttachmentError('Raindrop did not confirm the uploaded attachment.');
    }
    const collectionId = item.collection?.$id ?? item.collection;
    if (collectionId !== undefined && String(collectionId) !== ATTACHMENT_COLLECTION_ID) {
      throw new AttachmentError('Raindrop did not save the attachment in the requested collection.');
    }
    // item.link is the original downloadable file; cover/media can be thumbnails.
    let url: URL;
    try {
      if (typeof item.link !== 'string') throw new Error('Missing link');
      url = new URL(item.link);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid link');
    } catch { throw new AttachmentError('Raindrop did not return a public download URL for the attachment.'); }
    return Response.json({ status: 'success', url: item.link, previewUrl: attachmentPreviewUrl(item), id: String(item._id) });
  } catch (error) {
    return Response.json({ status: 'error', retrySafe: !uploadStarted || retrySafe,
      message: error instanceof AttachmentError ? error.message : 'Could not upload the image to Raindrop. Check attachments before retrying.' },
    { status: error instanceof AttachmentError ? error.status : 502 });
  }
}
