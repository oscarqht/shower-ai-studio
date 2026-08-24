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

export async function POST(req: NextRequest) {
  try {
    let token = '';
    let title = 'Untitled Preset';
    let prompt = '';
    let model = 'GPT Image 2';
    let aspectRatio = 'Auto';
    let textLanguage = 'Auto';
    let stylePackName = '';
    let characterNames: string[] = [];
    let cover = '';
    let fileObj: File | null = null;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      token = (formData.get('token') as string) || getBearerToken(req, undefined, 'RAINDROP_TOKEN');
      title = (formData.get('title') as string) || title;
      prompt = (formData.get('prompt') as string) || (formData.get('excerpt') as string) || prompt;
      model = (formData.get('model') as string) || model;
      aspectRatio = (formData.get('aspect_ratio') as string) || (formData.get('aspectRatio') as string) || aspectRatio;
      textLanguage = (formData.get('text_language') as string) || (formData.get('textLanguage') as string) || textLanguage;
      stylePackName = (formData.get('style_pack_name') as string) || (formData.get('stylePackName') as string) || stylePackName;
      
      const rawCharNames = formData.get('character_names') || formData.get('characterNames');
      if (rawCharNames) {
        try {
          const parsed = JSON.parse(rawCharNames as string);
          if (Array.isArray(parsed)) characterNames = parsed;
          else characterNames = String(rawCharNames).split(',').map((s) => s.trim()).filter(Boolean);
        } catch {
          characterNames = String(rawCharNames).split(',').map((s) => s.trim()).filter(Boolean);
        }
      }

      cover = (formData.get('cover') as string) || cover;
      const file = formData.get('imageFile') || formData.get('file');
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
      token = getBearerToken(req, body?.token, 'RAINDROP_TOKEN');
      title = body?.title || title;
      prompt = body?.prompt || body?.excerpt || prompt;
      model = body?.model || model;
      aspectRatio = body?.aspect_ratio || body?.aspectRatio || aspectRatio;
      textLanguage = body?.text_language || body?.textLanguage || textLanguage;
      stylePackName = body?.style_pack_name || body?.stylePackName || stylePackName;
      if (Array.isArray(body?.character_names)) {
        characterNames = body.character_names;
      } else if (Array.isArray(body?.characterNames)) {
        characterNames = body.characterNames;
      } else if (typeof body?.character_names === 'string') {
        characterNames = body.character_names.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
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

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Locate Shower collection and Presets collection under Shower
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
    let presetsCollection = allCollections.find((c) => {
      const p = c.parent?.$id !== undefined ? c.parent.$id : c.parent;
      return String(p) === String(showerId) && c.title && c.title.trim().toLowerCase() === 'presets';
    }) || allCollections.find(
      (c) => c.title && c.title.trim().toLowerCase() === 'presets'
    );

    if (!presetsCollection) {
      try {
        const createColRes = await fetch('https://api.raindrop.io/rest/v1/collection', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: 'Presets',
            parent: { $id: showerId },
          }),
        });
        if (createColRes.ok) {
          const createColData = await createColRes.json();
          presetsCollection = createColData.item;
        }
      } catch (e) {
        console.error('Failed to auto-create Presets collection:', e);
      }
    }

    const collectionId = presetsCollection ? presetsCollection._id : showerId;

    const notePayload = {
      prompt,
      model,
      aspect_ratio: aspectRatio,
      text_language: textLanguage,
      style_pack_name: stylePackName,
      character_names: characterNames,
    };
    const noteJson = JSON.stringify(notePayload, null, 2);

    let createdItem: any = null;

    if (fileObj) {
      try {
        const upstreamFormData = new FormData();
        upstreamFormData.append('file', fileObj, fileObj.name || 'preset_preview.png');
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
                excerpt: prompt,
                note: noteJson,
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
        console.error('Error uploading preset file to Raindrop:', fileErr);
      }
    }

    if (!createdItem) {
      const payload: any = {
        title,
        excerpt: prompt,
        note: noteJson,
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
            message: `Raindrop preset creation failed (${createRes.status}): ${errText}`,
          },
          { status: createRes.status }
        );
      }

      const createData = await createRes.json();
      createdItem = createData.item;
    }

    const newPreset = {
      id: createdItem._id,
      collection_id: collectionId,
      title: createdItem.title || title,
      preview_image: createdItem.cover || cover || (createdItem.media && createdItem.media[0] ? createdItem.media[0].link : '') || createdItem.link || '',
      prompt,
      model,
      aspect_ratio: aspectRatio,
      text_language: textLanguage,
      style_pack_name: stylePackName,
      character_names: characterNames,
      raw_note: noteJson,
    };

    return NextResponse.json({
      status: 'success',
      preset: newPreset,
    });
  } catch (err: any) {
    console.error('Error in /api/raindrop/preset:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Server error creating preset in Raindrop',
      },
      { status: 500 }
    );
  }
}
