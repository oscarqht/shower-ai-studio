import { NextRequest, NextResponse } from 'next/server';
import { getCharacterAddOns } from '@/lib/characterNote';
import { randomUUID } from 'node:crypto';

function getBearerToken(req: NextRequest, bodyToken?: string, envTokenName?: string): string {
  if (bodyToken && bodyToken.trim()) return bodyToken.trim();
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (envTokenName && process.env[envTokenName]) {
    return process.env[envTokenName]!.trim();
  }
  return '';
}

type CopyFields = { title?: unknown; excerpt?: unknown; note?: unknown; cover?: unknown; imageFile?: File | null };
type Item = Record<string, any>;
class CopyError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
function parseNoteObject(note: unknown): Item | undefined {
  if (typeof note !== 'string') return undefined;
  try {
    const parsed = JSON.parse(note);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
  } catch { return undefined; }
}

async function copyCharacter(token: string, sourceId: unknown, fields: CopyFields) {
  let stagedId: string | number | undefined;
  let mutationStarted = false;
  let request: ((path: string, method?: string, payload?: unknown) => Promise<Item>) | undefined;
  try {
    if (!/^[1-9]\d*$/.test(String(sourceId))) throw new CopyError('Provide a valid source character ID.', 400);
    for (const key of ['title', 'excerpt', 'note', 'cover'] as const) {
      if (fields[key] !== undefined && typeof fields[key] !== 'string') throw new CopyError('Character fields must be text.', 400);
    }
    if (fields.title !== undefined && !(fields.title as string).trim()) throw new CopyError('Enter a character name.', 400);
    if (fields.imageFile && (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(fields.imageFile.type) ||
        !fields.imageFile.size || fields.imageFile.size > 10 * 1024 * 1024)) {
      throw new CopyError('Upload a PNG, JPEG, WEBP, or GIF image up to 10 MB.', 400);
    }
    request = async (path, method = 'GET', payload) => {
      if (method !== 'GET') mutationStarted = true;
      const multipart = payload instanceof FormData;
      const response = await fetch(`https://api.raindrop.io/rest/v1${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, ...(!multipart ? { 'Content-Type': 'application/json' } : {}) },
        ...(payload === undefined ? {} : { body: multipart ? payload : JSON.stringify(payload) }), cache: 'no-store',
      });
      let data: Item;
      try { data = await response.json(); } catch { throw new CopyError(`Raindrop returned an invalid response (${response.status}).`); }
      if (!response.ok || data.result === false) throw new CopyError(
        `Raindrop ${method} failed (${response.status}): ${data.errorMessage || data.message || 'request rejected'}`,
        response.ok ? 502 : response.status);
      return data;
    };
    const [roots, children, sourceData] = await Promise.all([
      request('/collections'), request('/collections/childrens'), request(`/raindrop/${sourceId}`),
    ]);
    if (!Array.isArray(roots.items) || !Array.isArray(children.items)) throw new CopyError('Could not read Raindrop collections.');
    const collections: Item[] = [...roots.items, ...children.items];
    const nameOf = (item: Item) => String(item.title || '').trim().toLowerCase();
    const shower = collections.find(collection => nameOf(collection) === 'shower');
    const characters = shower && collections.find(collection =>
      String(collection.parent?.$id ?? collection.parent) === String(shower._id) && nameOf(collection) === 'characters');
    const source = sourceData.item;
    if (!characters || !source || String(source._id) !== String(sourceId) ||
        String(source.collection?.$id ?? source.collection) !== String(characters._id)) {
      throw new CopyError('Source character was not found in Shower / Characters. Re-sync and try again.', 404);
    }
    let note = fields.note === undefined ? String(source.note || '') : fields.note as string;
    const sourceNote = parseNoteObject(source.note);
    const suppliedNote = parseNoteObject(note);
    if (fields.note !== undefined && sourceNote) {
      note = JSON.stringify({ ...sourceNote, ...(suppliedNote || { tags: note }) });
    }
    const noteObject = parseNoteObject(note);
    let tags: string[] = Array.isArray(source.tags) ? source.tags : [];
    if (fields.note !== undefined && noteObject && Object.hasOwn(noteObject, 'tags')) {
      const value = noteObject.tags;
      tags = (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
        .filter((tag: unknown): tag is string => typeof tag === 'string').map((tag: string) => tag.trim()).filter(Boolean);
    } else if (fields.note !== undefined && !noteObject) {
      tags = note.split(',').map(tag => tag.trim()).filter(Boolean);
    }
    const metadata: Item = {
      title: fields.title === undefined ? source.title : (fields.title as string).trim(),
      excerpt: fields.excerpt === undefined ? source.excerpt || '' : fields.excerpt,
      note, tags, collection: { $id: characters._id },
    };
    for (const key of ['link', 'cover', 'media', 'type', 'important']) if (source[key] !== undefined) metadata[key] = source[key];
    const sourceCover = source.cover || source.media?.[0]?.link || '';
    if (!fields.imageFile && fields.cover && fields.cover !== sourceCover) {
      metadata.cover = fields.cover;
      metadata.media = [{ link: fields.cover }];
    }
    // Create with a unique URL first so a server-side same-link upsert cannot touch the source.
    let created: Item;
    if (fields.imageFile) {
      const form = new FormData();
      form.append('file', fields.imageFile, fields.imageFile.name || 'character.png');
      form.append('collectionId', String(characters._id));
      created = (await request('/raindrop/file', 'PUT', form)).item;
    } else created = (await request('/raindrop', 'POST', {
      ...metadata, link: `https://app.raindrop.io/my/${characters._id}#character-copy-${randomUUID()}`,
    })).item;
    if (!created?._id || String(created._id) === String(sourceId)) throw new CopyError('Raindrop did not create an independent character. Re-sync before retrying.');
    stagedId = created._id;
    if (fields.imageFile) {
      for (const key of ['link', 'cover', 'media', 'type']) delete metadata[key];
    }
    const saved = (await request(`/raindrop/${stagedId}`, 'PUT', metadata)).item;
    if (!saved?._id || String(saved._id) !== String(stagedId)) throw new CopyError('Raindrop did not confirm the copied character.');
    const item = { ...created, ...saved, ...metadata };
    return NextResponse.json({ status: 'success', character: {
      id: item._id, title: item.title, excerpt: item.excerpt || '', note: item.note || '',
      cover: item.cover || item.media?.[0]?.link || '', link: item.link || '', addOns: getCharacterAddOns(item.note),
    } });
  } catch (error) {
    let cleanupFailed = false;
    if (stagedId && request) {
      try { await request(`/raindrop/${stagedId}`, 'DELETE'); } catch { cleanupFailed = true; }
    }
    return NextResponse.json({ status: 'error', retrySafe: !mutationStarted,
      message: (error instanceof Error ? error.message : 'Could not copy character.') +
        (cleanupFailed ? ' A partial copy remains in Raindrop; re-sync before retrying.' : '') },
    { status: error instanceof CopyError ? error.status : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let token = '';
    let title = 'Untitled Character';
    let excerpt = '';
    let note = '';
    let cover = '';
    let fileObj: File | null = null;
    let sourceId: unknown;
    let copyFields: CopyFields = {};

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      sourceId = formData.get('sourceId') ?? undefined;
      for (const key of ['title', 'excerpt', 'note', 'cover'] as const) {
        if (formData.has(key)) copyFields[key] = formData.get(key);
      }
      token = (formData.get('token') as string) || getBearerToken(req, undefined, 'RAINDROP_TOKEN');
      title = (formData.get('title') as string) || title;
      excerpt = (formData.get('excerpt') as string) || excerpt;
      note = (formData.get('note') as string) || note;
      cover = (formData.get('cover') as string) || cover;
      const file = formData.get('imageFile');
      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        fileObj = file as File;
      }
    } else {
      let body: any = {};
      try {
        body = await req.json();
      } catch {
        // ignore
      }
      sourceId = body?.sourceId;
      copyFields = { title: body?.title, excerpt: body?.excerpt, note: body?.note, cover: body?.cover };
      token = getBearerToken(req, body?.token, 'RAINDROP_TOKEN');
      title = body?.title || title;
      excerpt = body?.excerpt || excerpt;
      note = body?.note || note;
      cover = body?.cover || cover;
    }

    if (!token) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Raindrop API token is missing. Please enter your Bearer token in settings.',
        },
        { status: 400 }
      );
    }

    if (sourceId !== undefined) return copyCharacter(token, sourceId, { ...copyFields, imageFile: fileObj });

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Locate Characters collection under Shower
    const [rootRes, childRes] = await Promise.all([
      fetch('https://api.raindrop.io/rest/v1/collections', { headers }),
      fetch('https://api.raindrop.io/rest/v1/collections/childrens', { headers }),
    ]);

    if (!rootRes.ok || !childRes.ok) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Failed to access Raindrop collections.',
        },
        { status: 400 }
      );
    }

    const rootData = await rootRes.json();
    const childData = await childRes.json();
    const allCollections = [...(rootData.items || []), ...(childData.items || [])];

    const showerCollection = allCollections.find(
      (c) => c.title && c.title.trim().toLowerCase() === 'shower'
    );

    if (!showerCollection) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Could not find a collection named "Shower" in Raindrop.',
        },
        { status: 404 }
      );
    }

    const showerId = showerCollection._id;
    let charactersCollection = allCollections.find((c) => {
      const p = c.parent?.$id !== undefined ? c.parent.$id : c.parent;
      return String(p) === String(showerId) && c.title && c.title.trim().toLowerCase() === 'characters';
    });

    if (!charactersCollection) {
      try {
        const createColRes = await fetch('https://api.raindrop.io/rest/v1/collection', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: 'Characters',
            parent: { $id: showerId },
          }),
        });
        if (createColRes.ok) {
          const createColData = await createColRes.json();
          charactersCollection = createColData.item;
        }
      } catch (e) {
        console.error('Failed to auto-create Characters collection:', e);
      }
    }

    const collectionId = charactersCollection ? charactersCollection._id : showerId;

    let parsedTags = note;
    try {
      const parsed = JSON.parse(note);
      if (parsed && typeof parsed === 'object' && parsed.tags !== undefined) {
        parsedTags = parsed.tags;
      }
    } catch (e) {
      // not JSON
    }

    const tagsArray = parsedTags
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);

    let createdItem: any = null;

    if (fileObj) {
      try {
        const upstreamFormData = new FormData();
        upstreamFormData.append('file', fileObj, fileObj.name || 'character.png');
        upstreamFormData.append('collectionId', String(collectionId));

        let fileRes = await fetch('https://api.raindrop.io/rest/v1/raindrop/file', {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: upstreamFormData,
        });

        if (!fileRes.ok) {
          fileRes = await fetch('https://api.raindrop.io/rest/v1/raindrop/file', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: upstreamFormData,
          });
        }

        if (fileRes.ok) {
          const fileData = await fileRes.json();
          if (fileData.result && fileData.item) {
            createdItem = fileData.item;

            const updateRes = await fetch(`https://api.raindrop.io/rest/v1/raindrop/${createdItem._id}`, {
              method: 'PUT',
              headers,
              body: JSON.stringify({
                title,
                excerpt,
                note,
                tags: tagsArray,
                collection: { $id: collectionId },
              }),
            });

            if (updateRes.ok) {
              const updateData = await updateRes.json();
              if (updateData.item) {
                createdItem = updateData.item;
              }
            }
          }
        }
      } catch (fileErr) {
        console.error('Error uploading file to Raindrop:', fileErr);
      }
    }

    if (!createdItem) {
      const payload: any = {
        title,
        excerpt,
        note,
        tags: tagsArray,
        collection: { $id: collectionId },
        link: cover && cover.startsWith('http') ? cover : 'https://raindrop.io',
      };

      if (cover) {
        payload.cover = cover;
        payload.media = [{ link: cover }];
      }

      const createRes = await fetch('https://api.raindrop.io/rest/v1/raindrop', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        return NextResponse.json(
          {
            status: 'error',
            message: `Raindrop item creation failed (${createRes.status}): ${errText}`,
          },
          { status: createRes.status }
        );
      }

      const createData = await createRes.json();
      createdItem = createData.item;
    }

    const newChar = {
      id: createdItem._id,
      title: createdItem.title || title,
      excerpt: createdItem.excerpt || excerpt,
      cover: createdItem.cover || cover || (createdItem.media && createdItem.media[0] ? createdItem.media[0].link : ''),
      note: createdItem.note || note,
      addOns: getCharacterAddOns(createdItem.note || note),
      link: createdItem.link || '',
    };

    return NextResponse.json({
      status: 'success',
      character: newChar,
    });
  } catch (err: any) {
    console.error('Error in /api/raindrop/character:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Server error creating character in Raindrop',
      },
      { status: 500 }
    );
  }
}
