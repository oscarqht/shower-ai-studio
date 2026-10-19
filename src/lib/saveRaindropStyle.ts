import type { StylePack } from '@/types';

const API = 'https://api.raindrop.io/rest/v1';
const NO_COVER = 'shower:no-cover';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const FILE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
type Item = Record<string, any>;
type ImageInput = string | { fileKey: string };
class StyleError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
const parentId = (collection: Item) => String(collection.parent?.$id ?? collection.parent ?? '');
const cleanTitle = (collection: Item) => String(collection.title || '').trim().toLowerCase();
const isMoreStyles = (collection: Item) => {
  const title = cleanTitle(collection);
  return title === 'more-styles' || title === 'more_styles' || title.includes('more style');
};
const image = (item?: Item) => item?.tags?.includes(NO_COVER) ? '' : item?.cover || item?.media?.[0]?.link || '';
const isReference = (item: Item) => {
  const name = String(item.title || '').trim().toLowerCase();
  return name.startsWith('reference-') && (/\.(jpg|jpeg|png|webp|gif)$/.test(name) || !name.includes('.'));
};
const referenceUrl = (item: Item) => image(item) || item.link || '';
const previewOf = (items: Item[], requested?: string | number) =>
  items.find(item => String(item._id) === String(requested)) ||
  items.find(item => String(item.title || '').toLowerCase().includes('preview')) || items[0];
const sortedReferences = (items: Item[]) => items.filter(isReference).sort((a, b) =>
  String(a.title).localeCompare(String(b.title), undefined, { numeric: true, sensitivity: 'base' }));
function toStyle(id: number | string, title: string, items: Item[], preview: Item): StylePack {
  return {
    id, title, style_prompt_raindrop_id: String(preview._id),
    style_prompt: preview.excerpt ?? preview.title ?? '', extra_style_instruction: preview.note || '',
    preview_cover: image(preview), style_reference_links: sortedReferences(items).map(referenceUrl).filter(Boolean),
  };
}

export async function saveRaindropStyle(
  req: Request, raindropFetch: typeof fetch = fetch, fallbackToken?: string,
): Promise<Response> {
  let createdCollection: number | undefined;
  let rollback: ((path: string, method?: string, body?: unknown) => Promise<Item>) | undefined;
  const stagedItems: number[] = [];
  let mutationStarted = false;
  let existingChanged = false;
  try {
    let body: any;
    let form: FormData | undefined;
    try {
      if (req.headers.get('content-type')?.includes('multipart/form-data')) {
        form = await req.formData();
        const payload = form.get('payload');
        if (typeof payload !== 'string') throw new Error('Missing payload');
        body = JSON.parse(payload);
      } else body = await req.json();
    } catch { throw new StyleError('Invalid style request payload.', 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new StyleError('Invalid style request.', 400);
    const { source, mode, title, style_prompt, extra_style_instruction } = body;
    if (!['copy', 'edit'].includes(mode) || !source || !/^\d+$/.test(String(source.id)) ||
        typeof title !== 'string' || !title.trim() || title.trim().length > 255 ||
        typeof style_prompt !== 'string' || !style_prompt.trim() || typeof extra_style_instruction !== 'string') {
      throw new StyleError('Provide a style, copy or edit mode, a name, prompt, and extra instructions.', 400);
    }
    const coverChanged = Object.hasOwn(body, 'cover');
    const refsChanged = Object.hasOwn(body, 'references');
    const files = new Map<string, File>();
    const validateImage = (input: unknown): void => {
      if (typeof input === 'string') {
        try {
          if (!['http:', 'https:'].includes(new URL(input).protocol)) throw new Error('Invalid protocol');
        } catch { throw new StyleError('Image URLs must use HTTP or HTTPS.', 400); }
        return;
      }
      if (!input || typeof input !== 'object' || typeof (input as Item).fileKey !== 'string') {
        throw new StyleError('Each image must be a URL or an uploaded file.', 400);
      }
      const key = (input as Item).fileKey;
      const file = form?.get(key);
      if (!file || typeof file === 'string' || !FILE_TYPES[file.type] || !file.size || file.size > MAX_FILE_SIZE) {
        throw new StyleError('Upload PNG, JPEG, WEBP, or GIF images up to 10 MB each.', 400);
      }
      files.set(key, file);
    };
    if (coverChanged && body.cover !== null) validateImage(body.cover);
    if (refsChanged) {
      if (!Array.isArray(body.references) || body.references.length > 50) throw new StyleError('Provide up to 50 reference images.', 400);
      body.references.forEach(validateImage);
    }
    const token = (typeof body.token === 'string' && body.token.trim()) ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || fallbackToken?.trim();
    if (!token) throw new StyleError('Raindrop API token is missing. Add it in settings.', 400);
    const request = async (path: string, method = 'GET', payload?: unknown): Promise<Item> => {
      if (method !== 'GET') mutationStarted = true;
      const multipart = payload instanceof FormData;
      const response = await raindropFetch(`${API}${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, ...(!multipart ? { 'Content-Type': 'application/json' } : {}) },
        ...(payload === undefined ? {} : { body: multipart ? payload : JSON.stringify(payload) }), cache: 'no-store',
      });
      if (response.status === 413) {
        throw new StyleError('Raindrop rejected this image upload as too large.', 413);
      }
      let data: Item;
      try {
        data = await response.json();
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid JSON object');
      } catch {
        throw new StyleError(`Raindrop ${method} returned an invalid response (${response.status}).`, response.ok ? 502 : response.status);
      }
      if (!response.ok || data.result === false) {
        throw new StyleError(`Raindrop ${method} failed (${response.status}): request rejected.`, response.ok ? 502 : response.status);
      }
      return data;
    };
    rollback = request;
    const itemRequest = async (path: string, method: string, payload: unknown): Promise<Item> => {
      const data = await request(path, method, payload);
      if (!data.item || !data.item._id) throw new StyleError('Raindrop did not return the saved item.');
      return data.item;
    };
    const createItem = async (payload: Item): Promise<Item> => {
      const saved = await itemRequest('/raindrop', 'POST', payload);
      stagedItems.push(saved._id);
      return { ...payload, ...saved };
    };
    const updateItem = async (item: Item, payload: Item, original = false): Promise<Item> => {
      if (original) existingChanged = true;
      const saved = await itemRequest(`/raindrop/${item._id}`, 'PUT', payload);
      return { ...item, ...saved, ...payload };
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
    if (pack) items = await getItems(pack._id);
    else {
      for (const container of containers.filter(isMoreStyles)) {
        loose = (await getItems(container._id)).find(item => String(item._id) === String(source.id));
        if (loose) { looseCollectionId = container._id; break; }
      }
      if (!loose) throw new StyleError('Style was not found under Shower / Styles or More styles. Re-sync and try again.', 404);
      items = [loose];
    }
    const name = title.trim();
    const metadata = { excerpt: style_prompt, note: extra_style_instruction };
    const originalPreview = loose || previewOf(items, source.style_prompt_raindrop_id);
    const originalRefs = loose ? [] : sortedReferences(items);
    const coverFile = coverChanged && body.cover !== null && typeof body.cover === 'object' ? files.get(body.cover.fileKey)! : undefined;
    const replacePreview = Boolean(coverFile || (refsChanged && originalPreview && isReference(originalPreview)));
    const converted = Boolean(loose && refsChanged);
    const looseOutput = Boolean(loose && !converted);
    const newPack = !looseOutput && (mode === 'copy' || converted);
    let collectionId = pack?._id ?? looseCollectionId;
    if (newPack) {
      const collection = await itemRequest('/collection', 'POST', {
        title: name, parent: { $id: Number(pack ? parentId(pack) : looseCollectionId) },
      });
      createdCollection = collection._id;
      collectionId = collection._id;
    }
    const clonePayload = (item: Item): Item => {
      const payload: Item = { collection: { $id: Number(collectionId) } };
      for (const key of ['link', 'title', 'excerpt', 'note', 'cover', 'media', 'tags', 'type', 'important']) {
        if (item[key] !== undefined) payload[key] = item[key];
      }
      return payload;
    };
    const upload = async (file: File, payload: Item): Promise<Item> => {
      const uploadForm = new FormData();
      uploadForm.append('file', file, file.name);
      uploadForm.append('collectionId', String(collectionId));
      const uploaded = await itemRequest('/raindrop/file', 'PUT', uploadForm);
      stagedItems.push(uploaded._id);
      return updateItem(uploaded, payload);
    };
    const coverMetadata = (): Item => {
      const payload: Item = { ...metadata };
      if (coverChanged) {
        const tags = (originalPreview?.tags || []).filter((tag: string) => tag !== NO_COVER);
        payload.tags = body.cover === null ? [...tags, NO_COVER] : tags;
        if (typeof body.cover === 'string') Object.assign(payload, { cover: body.cover, media: [{ link: body.cover }] });
        if (body.cover === null) Object.assign(payload, { cover: '', media: [] });
      }
      return payload;
    };
    let preview: Item | undefined;
    let savedItems: Item[] = [];
    const clonedById = new Map<string, Item>();
    if (newPack) {
      for (const item of items) {
        if (item === originalPreview && replacePreview && !(isReference(item) && !refsChanged)) continue;
        if (isReference(item) && refsChanged && item !== originalPreview) continue;
        const payload = clonePayload(item);
        if (item === originalPreview && !replacePreview) Object.assign(payload, coverMetadata(), converted ? { title: 'preview' } : {});
        const cloned = await createItem(payload);
        savedItems.push(cloned);
        clonedById.set(String(item._id), cloned);
        if (item === originalPreview) preview = cloned;
      }
    } else savedItems = [...items];
    if (coverFile) {
      preview = await upload(coverFile, {
        title: looseOutput ? name : `preview.${FILE_TYPES[coverFile.type]}`, ...coverMetadata(),
        tags: (originalPreview?.tags || []).filter((tag: string) => tag !== NO_COVER),
      });
      savedItems.push(preview);
    } else if (replacePreview && originalPreview) {
      preview = await createItem({ ...clonePayload(originalPreview), title: 'preview', ...coverMetadata() });
      savedItems.push(preview);
    } else if (!originalPreview) {
      preview = await createItem({
        collection: { $id: Number(collectionId) }, title: 'preview',
        link: `https://app.raindrop.io/my/${collectionId}#preview`,
        tags: [NO_COVER], ...coverMetadata(),
      });
      savedItems.push(preview);
    } else if (looseOutput && mode === 'copy') {
      preview = await createItem({ ...clonePayload(originalPreview), title: name, ...coverMetadata() });
      savedItems = [preview];
    }
    const desiredRefs: Item[] = [];
    const reusedIds = new Set<string>();
    if (refsChanged) {
      for (let index = 0; index < body.references.length; index++) {
        const input: ImageInput = body.references[index];
        const retained = typeof input === 'string' ? originalRefs.find(item =>
          referenceUrl(item) === input && !reusedIds.has(String(item._id))) : undefined;
        const filename = `reference-${index + 1}.png`;
        if (retained) {
          reusedIds.add(String(retained._id));
          let saved = newPack ? clonedById.get(String(retained._id)) : retained;
          // Changed reference lists skipped cloning reference bookmarks above.
          if (!saved) saved = await createItem({ ...clonePayload(retained), title: filename });
          desiredRefs.push(saved);
        } else if (typeof input === 'string') {
          desiredRefs.push(await createItem({ collection: { $id: Number(collectionId) }, title: filename,
            link: input, cover: input, media: [{ link: input }] }));
        } else {
          const file = files.get(input.fileKey)!;
          desiredRefs.push(await upload(file, { title: `reference-${index + 1}.${FILE_TYPES[file.type]}` }));
        }
      }
    }
    // All replacements now exist. Only now change existing metadata and remove old images.
    if (!preview) {
      preview = await updateItem(originalPreview!, { ...coverMetadata(), ...(looseOutput ? { title: name } : {}) }, true);
    }
    if (refsChanged) {
      for (let index = 0; index < desiredRefs.length; index++) {
        let ref = desiredRefs[index];
        const extension = String(ref.title || '').match(/\.(jpg|jpeg|png|webp|gif)$/i)?.[1] || 'png';
        const desiredTitle = `reference-${index + 1}.${extension}`;
        if (ref.title !== desiredTitle) ref = await updateItem(ref, { title: desiredTitle }, !newPack && !stagedItems.includes(ref._id));
        desiredRefs[index] = ref;
      }
      savedItems = [...savedItems.filter(item => !isReference(item)), ...desiredRefs];
    }
    if (!looseOutput && !newPack) {
      existingChanged = true;
      await itemRequest(`/collection/${collectionId}`, 'PUT', { title: name });
    }
    const removeIds = new Set<string>();
    if (mode === 'edit') {
      if (converted) removeIds.add(String(loose!._id));
      else {
        if (replacePreview && originalPreview && !desiredRefs.some(item => String(item._id) === String(originalPreview._id)) &&
            !(isReference(originalPreview) && !refsChanged)) removeIds.add(String(originalPreview._id));
        if (refsChanged) for (const ref of originalRefs) {
          if (!desiredRefs.some(item => String(item._id) === String(ref._id)) && String(ref._id) !== String(preview._id)) removeIds.add(String(ref._id));
        }
      }
      for (const id of removeIds) {
        existingChanged = true;
        await request(`/raindrop/${id}`, 'DELETE');
      }
    }
    savedItems = savedItems.filter(item => !removeIds.has(String(item._id)));
    const style = toStyle(looseOutput ? preview._id : collectionId, name, looseOutput ? [] : savedItems, preview);
    style.style_prompt = style_prompt;
    style.extra_style_instruction = extra_style_instruction;
    return Response.json({ status: 'success', style });
  } catch (error) {
    let cleanupFailed = false;
    if (rollback && !existingChanged) {
      try {
        if (createdCollection) await rollback(`/collection/${createdCollection}`, 'DELETE');
        else for (const id of stagedItems) await rollback(`/raindrop/${id}`, 'DELETE');
      } catch { cleanupFailed = true; }
    }
    const message = error instanceof Error ? error.message : 'Could not save style.';
    return Response.json({ status: 'error', retrySafe: !mutationStarted, message: message + (cleanupFailed
      ? ' A partial copy remains in Raindrop; re-sync before retrying.'
      : existingChanged ? ' Some changes may have been saved; re-sync before retrying.' : '') },
    { status: error instanceof StyleError ? error.status : 500 });
  }
}
