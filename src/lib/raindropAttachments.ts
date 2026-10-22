import { ATTACHMENT_COLLECTION_ID } from './uploadRaindropAttachment';

const API = 'https://api.raindrop.io/rest/v1';
const PAGE_SIZE = 50;
type Item = Record<string, any>;
class AttachmentError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
function tokenFor(req: Request, fallbackToken?: string): string {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1].trim() || fallbackToken?.trim();
  if (!token) throw new AttachmentError('Raindrop API token is missing. Add it in settings.', 400);
  return token;
}
function originalImage(item: Item): { id: string; name: string; url: string } | undefined {
  if (!item || !/^[1-9]\d*$/.test(String(item._id)) || !item.file || typeof item.file !== 'object') return;
  if (item.type !== 'image' && !(typeof item.file.type === 'string' && item.file.type.startsWith('image/'))) return;
  if (typeof item.link !== 'string') return;
  try {
    const url = new URL(item.link);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
  } catch { return; }
  return { id: String(item._id), name: String(item.file.name || item.title || 'Image attachment'), url: item.link };
}
async function request(path: string, token: string, transport: typeof fetch, method = 'GET'): Promise<Item> {
  const response = await transport(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  let data: Item;
  try {
    data = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid response');
  } catch { throw new AttachmentError(`Raindrop returned an invalid response (${response.status}).`, response.ok ? 502 : response.status); }
  if (!response.ok || data.result === false) {
    throw new AttachmentError(`Raindrop attachment request failed (${response.status}): request rejected.`, response.ok ? 502 : response.status);
  }
  return data;
}
function errorResponse(error: unknown): Response {
  return Response.json({ status: 'error', message: error instanceof AttachmentError ? error.message : 'Could not access Raindrop attachments.' },
    { status: error instanceof AttachmentError ? error.status : 502 });
}
export async function listRaindropAttachments(req: Request, transport: typeof fetch = fetch, fallbackToken?: string): Promise<Response> {
  try {
    const page = new URL(req.url).searchParams.get('page') ?? '0';
    if (!/^\d+$/.test(page) || !Number.isSafeInteger(Number(page))) throw new AttachmentError('Provide a valid attachment page.', 400);
    const token = tokenFor(req, fallbackToken);
    const data = await request(`/raindrops/${ATTACHMENT_COLLECTION_ID}?perpage=${PAGE_SIZE}&page=${Number(page)}&sort=-created`, token, transport);
    if (!Array.isArray(data.items)) throw new AttachmentError('Raindrop did not return the saved attachments.');
    const attachments = data.items.filter((item: Item) => {
      const collection = item?.collection?.$id ?? item?.collection;
      return collection === undefined || String(collection) === ATTACHMENT_COLLECTION_ID;
    }).map(originalImage).filter(Boolean);
    return Response.json({ status: 'success', attachments, hasMore: data.items.length === PAGE_SIZE });
  } catch (error) { return errorResponse(error); }
}
export async function deleteRaindropAttachment(req: Request, transport: typeof fetch = fetch, fallbackToken?: string): Promise<Response> {
  try {
    let body: Item;
    try { body = await req.json(); } catch { throw new AttachmentError('Provide an attachment ID.', 400); }
    if (!body || !['number', 'string'].includes(typeof body.id) || !/^[1-9]\d*$/.test(String(body.id)) ||
      !Number.isSafeInteger(Number(body.id))) throw new AttachmentError('Provide a valid attachment ID.', 400);
    const token = tokenFor(req, fallbackToken);
    const id = String(body.id);
    const { item } = await request(`/raindrop/${id}`, token, transport);
    if (!item || String(item._id) !== id) throw new AttachmentError('Raindrop did not confirm the requested attachment.', 404);
    if (String(item.collection?.$id ?? item.collection) !== ATTACHMENT_COLLECTION_ID) {
      throw new AttachmentError('This attachment does not belong to the saved attachments collection.', 403);
    }
    if (!originalImage(item)) throw new AttachmentError('This item is not an uploaded image attachment.', 400);
    const deleted = await request(`/raindrop/${id}`, token, transport, 'DELETE');
    if (deleted.result !== true) throw new AttachmentError('Raindrop did not confirm the attachment deletion.');
    return Response.json({ status: 'success', id });
  } catch (error) { return errorResponse(error); }
}
