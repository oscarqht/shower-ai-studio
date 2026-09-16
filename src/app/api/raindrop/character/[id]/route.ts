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

const getCharactersCollectionId = async (token: string): Promise<number | null> => {
  try {
    const headers = { Authorization: `Bearer ${token}` };
    const [rootRes, childRes] = await Promise.all([
      fetch('https://api.raindrop.io/rest/v1/collections', { headers }),
      fetch('https://api.raindrop.io/rest/v1/collections/childrens', { headers }),
    ]);

    if (!rootRes.ok || !childRes.ok) return null;

    const rootData = await rootRes.json();
    const childData = await childRes.json();
    const allCollections = [...(rootData.items || []), ...(childData.items || [])];

    const showerCollection = allCollections.find(
      (c) => c.title && c.title.trim().toLowerCase() === 'shower'
    );
    if (!showerCollection) return null;

    const showerId = showerCollection._id;
    let charactersCollection = allCollections.find((c) => {
      const p = c.parent?.$id !== undefined ? c.parent.$id : c.parent;
      return String(p) === String(showerId) && c.title && c.title.trim().toLowerCase() === 'characters';
    });

    if (!charactersCollection) {
      const createColRes = await fetch('https://api.raindrop.io/rest/v1/collection', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Characters',
          parent: { $id: showerId },
        }),
      });
      if (createColRes.ok) {
        const createColData = await createColRes.json();
        charactersCollection = createColData.item;
      }
    }

    return charactersCollection ? charactersCollection._id : showerId;
  } catch (err) {
    console.error('Error fetching/creating characters collection ID:', err);
    return null;
  }
};

async function handleUpdateCharacter(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    let token = '';
    let title: string | undefined;
    let excerpt: string | undefined;
    let note: string | undefined;
    let cover = '';
    let fileObj: File | null = null;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      token = (formData.get('token') as string) || getBearerToken(req, undefined, 'RAINDROP_TOKEN');
      title = (formData.get('title') as string) ?? undefined;
      excerpt = (formData.get('excerpt') as string) ?? '';
      note = (formData.get('note') as string) ?? '';
      cover = (formData.get('cover') as string) || '';
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
      title = body?.title;
      excerpt = body?.excerpt !== undefined ? body.excerpt : '';
      note = body?.note !== undefined ? body.note : '';
      cover = body?.cover || '';
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

    let parsedTags = (note || '');
    try {
      const parsed = JSON.parse(parsedTags);
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

    const isImageReplacement = Boolean(fileObj || (cover && cover.startsWith('data:')));

    if (isImageReplacement) {
      const collectionId = (await getCharactersCollectionId(token)) || 0;
      let createdItem: any = null;

      if (fileObj) {
        try {
          const upstreamFormData = new FormData();
          upstreamFormData.append('file', fileObj, fileObj.name || 'character.png');
          if (collectionId) {
            upstreamFormData.append('collectionId', String(collectionId));
          }

          let fileRes = await fetch('https://api.raindrop.io/rest/v1/raindrop/file', {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
            body: upstreamFormData,
          });

          if (!fileRes.ok) {
            fileRes = await fetch('https://api.raindrop.io/rest/v1/raindrop/file', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: upstreamFormData,
            });
          }

          if (fileRes.ok) {
            const fileData = await fileRes.json();
            if (fileData.result && fileData.item) {
              createdItem = fileData.item;

              const updateRes = await fetch(`https://api.raindrop.io/rest/v1/raindrop/${createdItem._id}`, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  title,
                  excerpt,
                  note,
                  tags: tagsArray,
                  ...(collectionId ? { collection: { $id: collectionId } } : {}),
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
          console.error('Error uploading replacement file to Raindrop:', fileErr);
        }
      }

      if (!createdItem) {
        const payload: any = {
          title,
          excerpt,
          note,
          tags: tagsArray,
          link: cover && cover.startsWith('http') ? cover : 'https://raindrop.io',
        };
        if (collectionId) payload.collection = { $id: collectionId };
        if (cover) {
          payload.cover = cover;
          payload.media = [{ link: cover }];
        }

        const createRes = await fetch('https://api.raindrop.io/rest/v1/raindrop', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (createRes.ok) {
          const createData = await createRes.json();
          createdItem = createData.item;
        }
      }

      if (createdItem && createdItem._id) {
        try {
          await fetch(`https://api.raindrop.io/rest/v1/raindrop/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (delErr) {
          console.warn('Could not delete old Raindrop item during image replace:', delErr);
        }

        const updatedChar = {
          id: createdItem._id,
          title: createdItem.title || title,
          excerpt: createdItem.excerpt !== undefined ? createdItem.excerpt : excerpt,
          cover: createdItem.cover || cover || (createdItem.media && createdItem.media[0] ? createdItem.media[0].link : ''),
          note: createdItem.note !== undefined ? createdItem.note : note,
          link: createdItem.link || '',
        };

        return NextResponse.json({
          status: 'success',
          character: updatedChar,
        });
      }
    }

    // Metadata-only update
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const payload: any = {};
    if (title !== undefined) payload.title = title;
    if (excerpt !== undefined) payload.excerpt = excerpt;
    if (note !== undefined) payload.note = note;
    payload.tags = tagsArray;
    if (cover && !cover.startsWith('data:')) {
      payload.cover = cover;
      payload.media = [{ link: cover }];
    }

    const updateRes = await fetch(`https://api.raindrop.io/rest/v1/raindrop/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return NextResponse.json(
        {
          status: 'error',
          message: `Raindrop item update failed (${updateRes.status}): ${errText}`,
        },
        { status: updateRes.status }
      );
    }

    const updateData = await updateRes.json();
    const updatedItem = updateData.item || {};

    const updatedChar = {
      id: updatedItem._id || id,
      title: updatedItem.title || title,
      excerpt: updatedItem.excerpt !== undefined ? updatedItem.excerpt : excerpt,
      cover: updatedItem.cover || cover || (updatedItem.media && updatedItem.media[0] ? updatedItem.media[0].link : ''),
      note: updatedItem.note !== undefined ? updatedItem.note : note,
      link: updatedItem.link || '',
    };

    return NextResponse.json({
      status: 'success',
      character: updatedChar,
    });
  } catch (err: any) {
    console.error('Error updating character:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Server error updating character in Raindrop',
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleUpdateCharacter(req, context);
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleUpdateCharacter(req, context);
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
          message: `Failed to delete Raindrop item ${id} (${deleteRes.status}): ${errText}`,
        },
        { status: deleteRes.status }
      );
    }

    return NextResponse.json({
      status: 'success',
      id,
    });
  } catch (err: any) {
    console.error('Error deleting character:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Server error deleting character from Raindrop',
      },
      { status: 500 }
    );
  }
}
