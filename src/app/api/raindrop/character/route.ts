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
    let title = 'Untitled Character';
    let excerpt = '';
    let note = '';
    let cover = '';
    let fileObj: File | null = null;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
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
