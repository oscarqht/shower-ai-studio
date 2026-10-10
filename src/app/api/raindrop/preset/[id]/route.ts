import { NextRequest, NextResponse } from 'next/server';

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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    let token = searchParams.get('token') || '';
    if (!token) {
      try {
        const body = await req.json();
        token = body?.token || '';
      } catch {
        // ignore
      }
    }
    if (!token) {
      token = getBearerToken(req, undefined, 'RAINDROP_TOKEN');
    }

    if (!token) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Raindrop API token is missing.',
        },
        { status: 400 }
      );
    }

    const deleteRes = await fetch(`https://api.raindrop.io/rest/v1/raindrop/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!deleteRes.ok) {
      const errText = await deleteRes.text();
      return NextResponse.json(
        {
          status: 'error',
          message: `Failed to delete Raindrop preset item ${id} (${deleteRes.status}): ${errText}`,
        },
        { status: deleteRes.status }
      );
    }

    return NextResponse.json({
      status: 'success',
      id,
    });
  } catch (err: any) {
    console.error('Error deleting preset:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Server error deleting preset from Raindrop',
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ status: 'error', message: 'Invalid preset ID.' }, { status: 400 });
    const form = await req.formData();
    const token = getBearerToken(req, String(form.get('token') || ''), 'RAINDROP_TOKEN');
    if (!token) return NextResponse.json({ status: 'error', message: 'Raindrop API token is missing. Please connect Raindrop in settings.' }, { status: 400 });
    const title = String(form.get('title') || '').trim();
    if (!title) return NextResponse.json({ status: 'error', message: 'A preset title is required.' }, { status: 400 });
    let characterNames: unknown;
    try { characterNames = JSON.parse(String(form.get('characterNames') || '[]')); } catch {
      return NextResponse.json({ status: 'error', message: 'Character names must be valid JSON.' }, { status: 400 });
    }
    if (!Array.isArray(characterNames) || characterNames.some((name) => typeof name !== 'string')) {
      return NextResponse.json({ status: 'error', message: 'Character names must be a list of strings.' }, { status: 400 });
    }
    const image = form.get('imageFile');
    if (image instanceof File && (!['image/png', 'image/jpeg', 'image/gif'].includes(image.type) || image.size > 10 * 1024 * 1024)) {
      return NextResponse.json({ status: 'error', message: 'Choose a PNG, JPG, or GIF thumbnail up to 10MB.' }, { status: 400 });
    }
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const endpoint = `https://api.raindrop.io/rest/v1/raindrop/${id}`;
    const currentRes = await fetch(endpoint, { headers });
    const current = await currentRes.json();
    if (!currentRes.ok || !current.result || !current.item) {
      return NextResponse.json({ status: 'error', message: 'Could not load the existing preset from Raindrop.' }, { status: currentRes.ok ? 502 : currentRes.status });
    }
    let existingNote = {};
    try {
      const parsed = JSON.parse(current.item.note || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existingNote = parsed;
    } catch { /* Legacy plain text notes are replaced by the edited recipe. */ }
    const recipe = {
      prompt: String(form.get('prompt') || ''),
      model: String(form.get('model') || ''),
      aspect_ratio: String(form.get('aspectRatio') || ''),
      text_language: String(form.get('textLanguage') || ''),
      style_pack_name: String(form.get('stylePackName') || ''),
      character_names: characterNames,
    };
    const note = JSON.stringify({ ...existingNote, ...recipe }, null, 2);
    const removeCover = form.has('cover') && form.get('cover') === '' && !(image instanceof File);
    const updateRes = await fetch(endpoint, {
      method: 'PUT', headers,
      body: JSON.stringify({ title, excerpt: recipe.prompt, note, ...(removeCover ? { cover: '', media: [] } : {}) }),
    });
    const updated = await updateRes.json();
    if (!updateRes.ok || !updated.result || !updated.item) {
      return NextResponse.json({ status: 'error', message: updated.errorMessage || 'Failed to update preset in Raindrop.' }, { status: updateRes.ok ? 502 : updateRes.status });
    }
    let item = updated.item;
    if (image instanceof File) {
      const upload = new FormData();
      upload.append('cover', image, image.name);
      const coverRes = await fetch(`${endpoint}/cover`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: upload });
      const coverData = await coverRes.json();
      if (!coverRes.ok || !coverData.result || !coverData.item?.cover) {
        return NextResponse.json({ status: 'error', message: 'Recipe changes were saved, but the thumbnail upload failed. Please retry saving.' }, { status: coverRes.ok ? 502 : coverRes.status });
      }
      item = { ...item, ...coverData.item };
    }
    return NextResponse.json({ status: 'success', preset: {
      id: current.item._id,
      collection_id: current.item.collection?.$id ?? current.item.collectionId,
      title: item.title || title,
      preview_image: removeCover ? '' : (item.cover || item.media?.[0]?.link || ''),
      ...recipe,
      raw_note: note,
    } });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message || 'Failed to update preset.' }, { status: 500 });
  }
}
