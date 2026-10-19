import { NextRequest, NextResponse } from 'next/server';
import type { StylePack } from '@/types';

const API = 'https://api.raindrop.io/rest/v1';
type Item = Record<string, any>;
class StyleError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
const parentId = (collection: Item) => String(collection.parent?.$id ?? collection.parent ?? '');
const cleanTitle = (collection: Item) => String(collection.title || '').trim().toLowerCase();
const isMoreStyles = (collection: Item) => {
  const title = cleanTitle(collection);
  return title === 'more-styles' || title === 'more_styles' || title.includes('more style');
};
const image = (item?: Item) => item?.cover || item?.media?.[0]?.link || '';
const previewOf = (items: Item[], requested?: string | number) =>
  items.find(item => String(item._id) === String(requested)) ||
  items.find(item => String(item.title || '').toLowerCase().includes('preview')) || items[0];

function toStyle(id: number | string, title: string, items: Item[], preview?: Item): StylePack {
  const references = items.filter(item => {
    const name = String(item.title || '').trim().toLowerCase();
    return name.startsWith('reference-') && (/\.(jpg|jpeg|png|webp)$/.test(name) || !name.includes('.'));
  }).sort((a, b) => String(a.title).localeCompare(String(b.title), undefined, { numeric: true, sensitivity: 'base' }));
  return {
    id, title,
    style_prompt_raindrop_id: preview ? String(preview._id) : '',
    style_prompt: preview?.excerpt ?? preview?.title ?? '',
    extra_style_instruction: preview?.note || '',
    preview_cover: image(preview),
    style_reference_links: references.map(item => image(item) || item.link).filter(Boolean),
  };
}

export async function POST(req: NextRequest) {
  let createdCollection: number | undefined;
  let rollback: ((path: string, method?: string, body?: unknown) => Promise<Item>) | undefined;
  let mutationStarted = false;
  try {
    let body: any;
    try { body = await req.json(); } catch { throw new StyleError('Invalid JSON request.', 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new StyleError('Invalid style request.', 400);
    const { source, mode, title, style_prompt, extra_style_instruction } = body;
    if (!['copy', 'edit'].includes(mode) || !source || !/^\d+$/.test(String(source.id)) ||
        typeof title !== 'string' || !title.trim() || title.trim().length > 255 ||
        typeof style_prompt !== 'string' || !style_prompt.trim() || typeof extra_style_instruction !== 'string') {
      throw new StyleError('Provide a style, copy or edit mode, a name, prompt, and extra instructions.', 400);
    }
    const token = (typeof body.token === 'string' && body.token.trim()) ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || process.env.RAINDROP_TOKEN?.trim();
    if (!token) throw new StyleError('Raindrop API token is missing. Add it in settings.', 400);
    const request = async (path: string, method = 'GET', payload?: unknown): Promise<Item> => {
      const response = await fetch(`${API}${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        cache: 'no-store',
      });
      let data: Item;
      try { data = await response.json(); } catch { throw new StyleError(`Raindrop returned an invalid response (${response.status}).`); }
      if (!response.ok || data.result === false) {
        throw new StyleError(`Raindrop ${method} failed (${response.status}): ${data.errorMessage || data.message || 'request rejected'}`, response.ok ? 502 : response.status);
      }
      return data;
    };
    rollback = request;
    const itemRequest = async (path: string, method: string, payload: unknown): Promise<Item> => {
      const data = await request(path, method, payload);
      if (!data.item || !data.item._id) throw new StyleError('Raindrop did not return the saved item.');
      return data.item;
    };
    const [roots, children] = await Promise.all([request('/collections'), request('/collections/childrens')]);
    if (!Array.isArray(roots.items) || !Array.isArray(children.items)) throw new StyleError('Could not read Raindrop collections.');
    const collections: Item[] = [...roots.items, ...children.items];
    const shower = collections.find(collection => cleanTitle(collection) === 'shower');
    if (!shower) throw new StyleError('Could not find the Shower collection.', 404);
    const containers = collections.filter(collection => parentId(collection) === String(shower._id) &&
      (cleanTitle(collection) === 'styles' || isMoreStyles(collection)));
    const pack = collections.find(collection => String(collection._id) === String(source.id) &&
      containers.some(container => parentId(collection) === String(container._id)));
    const getItems = async (collectionId: string | number): Promise<Item[]> => {
      const items: Item[] = [];
      for (let page = 0; ; page++) {
        const data = await request(`/raindrops/${collectionId}?perpage=50&page=${page}`);
        if (!Array.isArray(data.items)) throw new StyleError('Could not read all style bookmarks.');
        items.push(...data.items);
        if (data.items.length < 50) return items;
      }
    };
    let items: Item[] = [];
    let loose: Item | undefined;
    let looseCollectionId: number | undefined;
    if (pack) {
      items = await getItems(pack._id);
    } else {
      // Legacy More styles packs are individual bookmarks rather than collections.
      for (const container of containers.filter(isMoreStyles)) {
        const candidates = await getItems(container._id);
        loose = candidates.find(item => String(item._id) === String(source.id));
        if (loose) { looseCollectionId = container._id; break; }
      }
      if (!loose) throw new StyleError('Style was not found under Shower / Styles or More styles. Re-sync and try again.', 404);
    }
    const metadata = { excerpt: style_prompt, note: extra_style_instruction };
    const name = title.trim();
    const clonePayload = (item: Item, collectionId: number | string): Item => {
      const payload: Item = { collection: { $id: Number(collectionId) } };
      for (const key of ['link', 'title', 'excerpt', 'note', 'cover', 'media', 'tags', 'type', 'important']) {
        if (item[key] !== undefined) payload[key] = item[key];
      }
      return payload;
    };
    if (loose) {
      mutationStarted = true;
      const savedItem = mode === 'copy'
        ? await itemRequest('/raindrop', 'POST', { ...clonePayload(loose, looseCollectionId!), title: name, ...metadata })
        : await itemRequest(`/raindrop/${loose._id}`, 'PUT', { title: name, ...metadata });
      const saved: Item = { ...loose, ...savedItem, title: name, ...metadata };
      return NextResponse.json({ status: 'success', style: toStyle(saved._id, name, [], saved) });
    }
    const originalPreview = previewOf(items, source.style_prompt_raindrop_id);
    let preview: Item;
    let savedItems = items;
    let id = pack!._id;
    if (mode === 'copy') {
      const collection = await itemRequest('/collection', 'POST', { title: name, parent: { $id: Number(parentId(pack!)) } });
      createdCollection = collection._id;
      id = collection._id;
      mutationStarted = true;
      savedItems = [];
      for (const item of items) {
        const payload = clonePayload(item, id);
        if (item === originalPreview) Object.assign(payload, metadata);
        const cloned = await itemRequest('/raindrop', 'POST', payload);
        savedItems.push(cloned);
        if (item === originalPreview) preview = cloned;
      }
    } else {
      // Update the preview first, so a rejected bookmark write cannot rename the pack.
      if (originalPreview) {
        mutationStarted = true;
        preview = { ...originalPreview, ...await itemRequest(`/raindrop/${originalPreview._id}`, 'PUT', metadata), ...metadata };
      }
    }
    if (!originalPreview) {
      mutationStarted = true;
      preview = await itemRequest('/raindrop', 'POST', {
        collection: { $id: Number(id) }, title: 'preview',
        link: `https://app.raindrop.io/my/${id}#preview`, ...metadata,
      });
      savedItems = [...savedItems, preview];
    }
    if (mode === 'edit') await itemRequest(`/collection/${id}`, 'PUT', { title: name });
    const style = toStyle(id, name, savedItems, preview!);
    style.style_prompt = style_prompt;
    style.extra_style_instruction = extra_style_instruction;
    return NextResponse.json({ status: 'success', style });
  } catch (error) {
    let cleanupFailed = false;
    if (createdCollection && rollback) {
      try { await rollback(`/collection/${createdCollection}`, 'DELETE'); } catch { cleanupFailed = true; }
    }
    const message = error instanceof Error ? error.message : 'Could not save style.';
    return NextResponse.json({ status: 'error', retrySafe: !mutationStarted && !createdCollection, message: message + (cleanupFailed
      ? ' A partial copy remains in Raindrop; re-sync before retrying.'
      : mutationStarted && !createdCollection ? ' Some changes may have been saved; re-sync before retrying.' : '') },
    { status: error instanceof StyleError ? error.status : 500 });
  }
}
