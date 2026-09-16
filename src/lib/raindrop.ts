import { Character, StylePack, Preset } from '../types';

export const OH_AUTH_BASE_URL = 'https://oh-auth.vercel.app';
export const RAINDROP_API_BASE = 'https://api.raindrop.io/rest/v1';

export function loginWithRaindrop() {
  const targetRedirect = `${window.location.origin}/auth/callback`;
  const statePayload = {
    webRedirectTo: targetRedirect,
  };
  const stateStr = encodeURIComponent(JSON.stringify(statePayload));
  window.location.href = `${OH_AUTH_BASE_URL}/auth/raindrop?state=${stateStr}`;
}

export async function refreshRaindropToken(refreshToken: string): Promise<{ access_token?: string; refresh_token?: string; expires_at?: number } | null> {
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${OH_AUTH_BASE_URL}/auth/raindrop/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        return {
          access_token: data.access_token,
          refresh_token: data.refresh_token || refreshToken,
          expires_at: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : undefined,
        };
      }
    }
  } catch (err) {
    console.error('Failed to refresh Raindrop token via oh-auth:', err);
  }
  return null;
}

export async function fetchRaindropCollections(headers: HeadersInit) {
  const [rootRes, childRes] = await Promise.all([
    fetch(`${RAINDROP_API_BASE}/collections`, { headers }),
    fetch(`${RAINDROP_API_BASE}/collections/childrens`, { headers }),
  ]);

  if (!rootRes.ok || !childRes.ok) {
    throw new Error(`Failed to access Raindrop collections (${rootRes.status} / ${childRes.status})`);
  }

  const rootData = await rootRes.json();
  const childData = await childRes.json();
  return [...(rootData.items || []), ...(childData.items || [])];
}

export async function fetchRaindropData(token: string) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const allCollections = await fetchRaindropCollections(headers);

  const showerCollection = allCollections.find(
    (c) => c.title && c.title.trim().toLowerCase() === 'shower'
  );

  if (!showerCollection) {
    throw new Error('Could not find a collection named "Shower" in Raindrop.');
  }

  const showerId = showerCollection._id;
  const isParentShower = (c: any) => {
    if (!c) return false;
    const p = c.parent?.$id !== undefined ? c.parent.$id : c.parent;
    return String(p) === String(showerId);
  };

  const charactersCollection = allCollections.find(
    (c) => isParentShower(c) && c.title && c.title.trim().toLowerCase() === 'characters'
  );

  const stylesCollection = allCollections.find(
    (c) => isParentShower(c) && (c.title.trim().toLowerCase() === 'styles' || c.title.trim().toLowerCase() === 'style packs')
  );

  const appsCollection = allCollections.find(
    (c) => isParentShower(c) && c.title && c.title.trim().toLowerCase() === 'apps'
  );

  const presetsCollection = allCollections.find(
    (c) => isParentShower(c) && c.title && c.title.trim().toLowerCase() === 'presets'
  ) || allCollections.find(
    (c) => c.title && c.title.trim().toLowerCase() === 'presets'
  );

  let imageAppUrl = '';
  let hasUploadCapability = false;
  if (appsCollection) {
    try {
      const appsRes = await fetch(
        `${RAINDROP_API_BASE}/raindrops/${appsCollection._id}?perpage=50`,
        { headers }
      );
      if (appsRes.ok) {
        const appsData = await appsRes.json();
        const items = appsData.items || [];
        const uploadAppItem = items.find((item: any) => {
          if (!item.title) return false;
          const t = item.title.trim().toLowerCase();
          return t === 'image generation app' || t.includes('image generation app') || t.includes('image generation');
        }) || items[0];

        if (uploadAppItem?.link) {
          imageAppUrl = uploadAppItem.link.trim();
          if (!imageAppUrl.startsWith('http')) imageAppUrl = 'https://' + imageAppUrl;
        }
        if (uploadAppItem?.note) {
          try {
            const noteConfig = JSON.parse(uploadAppItem.note);
            if (noteConfig?.API_KEY) hasUploadCapability = true;
          } catch {}
        }
      }
    } catch (e) {
      console.error('Error loading Apps collection:', e);
    }
  }

  let characters: Character[] = [];
  if (charactersCollection) {
    try {
      const charRes = await fetch(
        `${RAINDROP_API_BASE}/raindrops/${charactersCollection._id}?perpage=50`,
        { headers }
      );
      if (charRes.ok) {
        const charData = await charRes.json();
        characters = (charData.items || []).map((item: any) => ({
          id: item._id,
          title: item.title || 'Untitled Character',
          excerpt: item.excerpt || '',
          cover: item.cover || (item.media && item.media[0] ? item.media[0].link : '') || item.link || '',
          note: item.note || '',
          link: item.link || '',
        }));
      }
    } catch (e) {
      console.error('Error loading characters:', e);
    }
  }

  let styles: StylePack[] = [];
  if (stylesCollection) {
    const stylePackCollections = allCollections.filter((c) => {
      const p = c.parent?.$id !== undefined ? c.parent.$id : c.parent;
      return String(p) === String(stylesCollection._id);
    });

    const stylePackResults: any[] = [];
    const chunkSize = 5;
    for (let i = 0; i < stylePackCollections.length; i += chunkSize) {
      const chunk = stylePackCollections.slice(i, i + chunkSize);
      const chunkPromises = chunk.map(async (spCol) => {
        try {
          const spRes = await fetch(
            `${RAINDROP_API_BASE}/raindrops/${spCol._id}?perpage=50`,
            { headers }
          );
          if (!spRes.ok) return null;
          const spData = await spRes.json();
          return { col: spCol, items: spData.items || [] };
        } catch {
          return null;
        }
      });
      const chunkResults = await Promise.all(chunkPromises);
      stylePackResults.push(...chunkResults.filter(Boolean));
    }

    styles = stylePackResults.map(({ col, items }) => {
      const previewItem = items.find((item: any) => item.title?.toLowerCase().includes('preview')) || items[0];
      const refItems = items.filter((item: any) => {
        if (!item.title) return false;
        const title = item.title.trim().toLowerCase();
        return title.startsWith('reference-');
      });

      refItems.sort((a: any, b: any) => (a.title || '').localeCompare(b.title || '', undefined, { numeric: true }));

      return {
        id: col._id,
        title: col.title || 'Untitled Style',
        style_prompt_raindrop_id: previewItem ? String(previewItem._id) : '',
        style_prompt: previewItem ? (previewItem.excerpt || previewItem.title || '') : '',
        extra_style_instruction: previewItem ? (previewItem.note || '') : '',
        preview_cover: previewItem ? (previewItem.cover || (previewItem.media?.[0]?.link ?? '')) : '',
        style_reference_links: refItems.map((it: any) => it.cover || it.media?.[0]?.link || it.link).filter(Boolean),
      };
    });
  }

  let presets: Preset[] = [];
  if (presetsCollection) {
    try {
      const presetRes = await fetch(
        `${RAINDROP_API_BASE}/raindrops/${presetsCollection._id}?perpage=50`,
        { headers }
      );
      if (presetRes.ok) {
        const presetData = await presetRes.json();
        presets = (presetData.items || []).map((item: any) => {
          let prompt = item.excerpt || '';
          let model, aspectRatio, textLanguage, stylePackName, characterNames;
          if (item.note) {
            try {
              const p = JSON.parse(item.note);
              if (p && typeof p === 'object') {
                prompt = p.prompt ?? p.instruction ?? p.compositionPrompt ?? p.description ?? prompt;
                model = p.model ?? p.ai_model;
                aspectRatio = p.aspect_ratio ?? p.aspectRatio ?? p.ratio;
                textLanguage = p.text_language ?? p.textLanguage ?? p.language;
                stylePackName = p.style_pack_name ?? p.stylePackName ?? p.style;
                const rawChars = p.character_names ?? p.characters ?? p.cast;
                if (Array.isArray(rawChars)) characterNames = rawChars;
              }
            } catch {
              if (!prompt) prompt = item.note;
            }
          }
          return {
            id: item._id,
            collection_id: presetsCollection._id,
            title: item.title || 'Untitled Preset',
            preview_image: item.cover || item.media?.[0]?.link || item.link || '',
            prompt,
            model,
            aspect_ratio: aspectRatio,
            text_language: textLanguage,
            style_pack_name: stylePackName,
            character_names: characterNames,
            raw_note: item.note || '',
          };
        });
      }
    } catch (e) {
      console.error('Error loading presets:', e);
    }
  }

  return {
    status: 'success',
    characters,
    styles,
    presets,
    presetsCollectionId: presetsCollection?._id || null,
    imageAppUrl,
    hasUploadCapability,
  };
}

export async function resolveAppUrl(token: string) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const allCollections = await fetchRaindropCollections(headers);
  const showerCol = allCollections.find((c) => c.title?.trim().toLowerCase() === 'shower');
  if (!showerCol) throw new Error('Shower collection not found');

  const appsCol = allCollections.find((c) => {
    const p = c.parent?.$id !== undefined ? c.parent.$id : c.parent;
    return String(p) === String(showerCol._id) && c.title?.trim().toLowerCase() === 'apps';
  });

  if (!appsCol) throw new Error('Shower > Apps collection not found');

  const appsRes = await fetch(`${RAINDROP_API_BASE}/raindrops/${appsCol._id}?perpage=50`, { headers });
  if (!appsRes.ok) throw new Error('Failed to load apps collection');

  const data = await appsRes.json();
  const items = data.items || [];
  const imgAppItem = items.find((item: any) => {
    const t = item.title?.trim().toLowerCase() || '';
    return t.includes('image generation app') || t.includes('image generation');
  }) || items[0];

  if (!imgAppItem?.link) throw new Error('No image generation app item found');

  let rawLink = imgAppItem.link.trim();
  if (!rawLink.startsWith('http')) rawLink = 'https://' + rawLink;

  let hasUploadCapability = false;
  if (imgAppItem.note) {
    try {
      const config = JSON.parse(imgAppItem.note);
      if (config?.API_KEY) hasUploadCapability = true;
    } catch {}
  }

  return {
    status: 'success',
    imageAppUrl: rawLink,
    hasUploadCapability,
    item: { id: imgAppItem._id, title: imgAppItem.title, link: rawLink },
  };
}

export async function uploadAttachments(token: string, files: File[]): Promise<{ status: string; file_ids: string[] }> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const allCollections = await fetchRaindropCollections(headers);
  const showerCol = allCollections.find((c) => c.title?.trim().toLowerCase() === 'shower');
  if (!showerCol) throw new Error('Could not find Shower collection');

  const appsCol = allCollections.find((c) => {
    const p = c.parent?.$id !== undefined ? c.parent.$id : c.parent;
    return String(p) === String(showerCol._id) && c.title?.trim().toLowerCase() === 'apps';
  });

  if (!appsCol) throw new Error('Could not find Apps collection under Shower');

  const appsRes = await fetch(`${RAINDROP_API_BASE}/raindrops/${appsCol._id}?perpage=50`, { headers });
  if (!appsRes.ok) throw new Error('Failed to load Apps collection');

  const appsData = await appsRes.json();
  const items = appsData.items || [];
  const uploadAppItem = items.find((it: any) => {
    const t = it.title?.trim().toLowerCase() || '';
    return t.includes('image generation app') || t.includes('image generation');
  });

  if (!uploadAppItem?.link || !uploadAppItem?.note) {
    throw new Error('Image generation app missing link or note configuration in Raindrop');
  }

  let noteConfig: any;
  try {
    noteConfig = JSON.parse(uploadAppItem.note);
  } catch {
    throw new Error('Note of Image generation app is not valid JSON');
  }

  if (!noteConfig.API_KEY) {
    throw new Error('Note does not contain API_KEY');
  }

  const parsedUrl = new URL(uploadAppItem.link);
  const origin = parsedUrl.origin;
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  const workflowId = pathParts.length >= 2 && pathParts[0] === 'app' ? pathParts[2] : pathParts[1];

  if (!workflowId) throw new Error('Could not extract workflow ID from link');

  const apiUrl = `${origin}/api/workflows/${workflowId}/upload`;
  const fileIds: string[] = [];

  for (const file of files) {
    const singleFormData = new FormData();
    singleFormData.append('file', file);

    const uploadRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${noteConfig.API_KEY}`,
      },
      body: singleFormData,
    });

    if (!uploadRes.ok) {
      throw new Error(`Upload API returned status ${uploadRes.status}`);
    }

    const uploadData = await uploadRes.json();
    const fileId = uploadData?.data?.file_id;
    if (!fileId) throw new Error('Upload API did not return file_id');
    fileIds.push(fileId);
  }

  return { status: 'success', file_ids: fileIds };
}

export async function createCharacter(
  token: string,
  charData: {
    title: string;
    excerpt?: string;
    note?: string;
    cover?: string;
    imageFile?: File;
  }
) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const allCollections = await fetchRaindropCollections(headers);
  const showerCol = allCollections.find((c) => c.title?.trim().toLowerCase() === 'shower');
  if (!showerCol) throw new Error('Shower collection not found');

  let charactersCol = allCollections.find((c) => {
    const p = c.parent?.$id !== undefined ? c.parent.$id : c.parent;
    return String(p) === String(showerCol._id) && c.title?.trim().toLowerCase() === 'characters';
  });

  if (!charactersCol) {
    const res = await fetch(`${RAINDROP_API_BASE}/collection`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Characters', parent: { $id: showerCol._id } }),
    });
    if (res.ok) {
      const data = await res.json();
      charactersCol = data.item;
    }
  }

  const collectionId = charactersCol ? charactersCol._id : showerCol._id;
  let createdItem: any = null;

  if (charData.imageFile) {
    try {
      const formData = new FormData();
      formData.append('file', charData.imageFile, charData.imageFile.name || 'character.png');
      formData.append('collectionId', String(collectionId));

      const fileRes = await fetch(`${RAINDROP_API_BASE}/raindrop/file`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (fileRes.ok) {
        const fileData = await fileRes.json();
        if (fileData.result && fileData.item) {
          createdItem = fileData.item;
          await fetch(`${RAINDROP_API_BASE}/raindrop/${createdItem._id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              title: charData.title,
              excerpt: charData.excerpt || '',
              note: charData.note || '',
              collection: { $id: collectionId },
            }),
          });
        }
      }
    } catch (e) {
      console.error('Failed to upload character image:', e);
    }
  }

  if (!createdItem) {
    const payload: any = {
      title: charData.title,
      excerpt: charData.excerpt || '',
      note: charData.note || '',
      collection: { $id: collectionId },
      link: charData.cover && charData.cover.startsWith('http') ? charData.cover : 'https://raindrop.io',
    };
    if (charData.cover) {
      payload.cover = charData.cover;
      payload.media = [{ link: charData.cover }];
    }
    const createRes = await fetch(`${RAINDROP_API_BASE}/raindrop`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!createRes.ok) throw new Error('Failed to create character item in Raindrop');
    const createData = await createRes.json();
    createdItem = createData.item;
  }

  return {
    status: 'success',
    character: {
      id: createdItem._id,
      title: createdItem.title || charData.title,
      excerpt: createdItem.excerpt || charData.excerpt || '',
      cover: createdItem.cover || charData.cover || '',
      note: createdItem.note || charData.note || '',
      link: createdItem.link || '',
    },
  };
}

export async function deleteCharacter(token: string, characterId: string | number) {
  const headers = { Authorization: `Bearer ${token}` };
  const res = await fetch(`${RAINDROP_API_BASE}/raindrop/${characterId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    await fetch(`${RAINDROP_API_BASE}/collection/${characterId}`, {
      method: 'DELETE',
      headers,
    });
  }
  return { status: 'success' };
}

export async function createPreset(
  token: string,
  presetData: {
    title: string;
    prompt: string;
    previewImageDataUrl?: string;
    previewImageFile?: File;
    model?: string;
    aspectRatio?: string;
    textLanguage?: string;
    stylePackName?: string;
    characterNames?: string[];
  }
) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const allCollections = await fetchRaindropCollections(headers);
  const showerCol = allCollections.find((c) => c.title?.trim().toLowerCase() === 'shower');
  if (!showerCol) throw new Error('Shower collection not found');

  let presetsCol = allCollections.find((c) => {
    const p = c.parent?.$id !== undefined ? c.parent.$id : c.parent;
    return String(p) === String(showerCol._id) && c.title?.trim().toLowerCase() === 'presets';
  }) || allCollections.find((c) => c.title?.trim().toLowerCase() === 'presets');

  if (!presetsCol) {
    const res = await fetch(`${RAINDROP_API_BASE}/collection`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Presets', parent: { $id: showerCol._id } }),
    });
    if (res.ok) {
      const data = await res.json();
      presetsCol = data.item;
    }
  }

  const collectionId = presetsCol ? presetsCol._id : showerCol._id;
  const notePayload = {
    prompt: presetData.prompt,
    model: presetData.model,
    aspect_ratio: presetData.aspectRatio,
    text_language: presetData.textLanguage,
    style_pack_name: presetData.stylePackName,
    character_names: presetData.characterNames,
  };
  const noteJson = JSON.stringify(notePayload, null, 2);

  let createdItem: any = null;

  if (presetData.previewImageFile) {
    try {
      const formData = new FormData();
      formData.append('file', presetData.previewImageFile, presetData.previewImageFile.name || 'preset.png');
      formData.append('collectionId', String(collectionId));

      const fileRes = await fetch(`${RAINDROP_API_BASE}/raindrop/file`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (fileRes.ok) {
        const fileData = await fileRes.json();
        if (fileData.result && fileData.item) {
          createdItem = fileData.item;
          await fetch(`${RAINDROP_API_BASE}/raindrop/${createdItem._id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              title: presetData.title,
              excerpt: presetData.prompt,
              note: noteJson,
              collection: { $id: collectionId },
            }),
          });
        }
      }
    } catch (e) {
      console.error('Failed to upload preset image:', e);
    }
  }

  if (!createdItem) {
    const payload: any = {
      title: presetData.title,
      excerpt: presetData.prompt,
      note: noteJson,
      collection: { $id: collectionId },
      link: presetData.previewImageDataUrl && presetData.previewImageDataUrl.startsWith('http')
        ? presetData.previewImageDataUrl
        : 'https://raindrop.io',
    };
    if (presetData.previewImageDataUrl) {
      payload.cover = presetData.previewImageDataUrl;
      payload.media = [{ link: presetData.previewImageDataUrl }];
    }
    const createRes = await fetch(`${RAINDROP_API_BASE}/raindrop`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!createRes.ok) throw new Error('Failed to create preset in Raindrop');
    const createData = await createRes.json();
    createdItem = createData.item;
  }

  return {
    status: 'success',
    preset: {
      id: createdItem._id,
      collection_id: collectionId,
      title: createdItem.title || presetData.title,
      preview_image: createdItem.cover || presetData.previewImageDataUrl || '',
      prompt: presetData.prompt,
      model: presetData.model,
      aspect_ratio: presetData.aspectRatio,
      text_language: presetData.textLanguage,
      style_pack_name: presetData.stylePackName,
      character_names: presetData.characterNames,
      raw_note: noteJson,
    },
  };
}

export async function deletePreset(token: string, presetId: string | number) {
  const headers = { Authorization: `Bearer ${token}` };
  const res = await fetch(`${RAINDROP_API_BASE}/raindrop/${presetId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error(`Failed to delete preset (${res.status})`);
  return { status: 'success' };
}

export async function updateCharacter(
  token: string,
  characterId: string | number,
  charData: {
    title: string;
    excerpt?: string;
    note?: string;
    coverDataUrl?: string;
    imageFile?: File;
  }
) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const payload: any = {
    title: charData.title,
    excerpt: charData.excerpt || '',
    note: charData.note || '',
  };
  if (charData.coverDataUrl) {
    payload.cover = charData.coverDataUrl;
  }

  const res = await fetch(`${RAINDROP_API_BASE}/raindrop/${characterId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Failed to update character on Raindrop (${res.status})`);
  }

  const data = await res.json();
  const item = data.item;

  return {
    status: 'success',
    character: {
      id: item._id,
      title: item.title || charData.title,
      excerpt: item.excerpt || charData.excerpt || '',
      cover: item.cover || charData.coverDataUrl || '',
      note: item.note || charData.note || '',
      link: item.link || '',
    },
  };
}

export async function fetchMoreStylesData(token: string): Promise<{ status: string; styles: StylePack[]; message?: string }> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const allCollections = await fetchRaindropCollections(headers);
  const showerCollection = allCollections.find(
    (c) => c.title && c.title.trim().toLowerCase() === 'shower'
  );

  if (!showerCollection) {
    return {
      status: 'partial',
      message: 'Could not find a collection named "Shower". Please ensure you have a "Shower" collection in Raindrop.',
      styles: [],
    };
  }

  const showerId = showerCollection._id;
  const isParentShower = (c: any) => {
    if (!c) return false;
    const p = c.parent?.$id !== undefined ? c.parent.$id : c.parent;
    return String(p) === String(showerId);
  };

  const moreStylesCollection =
    allCollections.find((c) => {
      if (!isParentShower(c) || !c.title) return false;
      const t = c.title.trim().toLowerCase();
      return (
        t === 'more styles' ||
        t === 'more style' ||
        t === 'more styles pack' ||
        t === 'more style packs' ||
        t === 'more-styles' ||
        t === 'more_styles' ||
        t.includes('more style')
      );
    }) ||
    allCollections.find((c) => {
      if (!c.title) return false;
      const t = c.title.trim().toLowerCase();
      return t === 'more styles' || t === 'more style' || t.includes('more style');
    });

  if (!moreStylesCollection) {
    return {
      status: 'success',
      styles: [],
      message: 'Could not find a "More styles" child collection under "Shower".',
    };
  }

  const moreStylesId = moreStylesCollection._id;
  const moreStylePackCollections = allCollections.filter((c) => {
    const p = c.parent?.$id !== undefined ? c.parent.$id : c.parent;
    return String(p) === String(moreStylesId);
  });

  let styles: StylePack[] = [];

  if (moreStylePackCollections.length > 0) {
    const chunkSize = 5;
    const stylePackResults: any[] = [];

    for (let i = 0; i < moreStylePackCollections.length; i += chunkSize) {
      const chunk = moreStylePackCollections.slice(i, i + chunkSize);
      const chunkPromises = chunk.map(async (spCol) => {
        try {
          const spRes = await fetch(
            `${RAINDROP_API_BASE}/raindrops/${spCol._id}?perpage=50`,
            { headers }
          );
          if (!spRes.ok) return null;
          const spData = await spRes.json();
          return {
            col: spCol,
            items: spData.items || [],
          };
        } catch (e) {
          console.error(`Failed to fetch items for more style collection ${spCol.title}:`, e);
          return null;
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      stylePackResults.push(...chunkResults.filter(Boolean));
      if (i + chunkSize < moreStylePackCollections.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    styles = stylePackResults.map(({ col, items }) => {
      const previewItem =
        items.find((item: any) => item.title && item.title.toLowerCase().includes('preview')) || items[0];

      const refItems = items.filter((item: any) => {
        if (!item.title) return false;
        const title = item.title.trim().toLowerCase();
        return (
          title.startsWith('reference-') &&
          (title.endsWith('.jpg') ||
            title.endsWith('.jpeg') ||
            title.endsWith('.png') ||
            title.endsWith('.webp') ||
            !title.includes('.'))
        );
      });

      refItems.sort((a: any, b: any) => {
        const tA = (a.title || '').toLowerCase();
        const tB = (b.title || '').toLowerCase();
        return tA.localeCompare(tB, undefined, { numeric: true, sensitivity: 'base' });
      });

      const style_prompt_raindrop_id = previewItem ? String(previewItem._id) : '';
      const style_prompt = previewItem ? previewItem.excerpt || previewItem.title || '' : '';
      const extra_style_instruction = previewItem ? previewItem.note || '' : '';
      const preview_cover = previewItem
        ? previewItem.cover || (previewItem.media && previewItem.media[0] ? previewItem.media[0].link : '')
        : '';

      const style_reference_links = refItems
        .map((item: any) => item.cover || (item.media && item.media[0] ? item.media[0].link : item.link))
        .filter(Boolean);

      return {
        id: col._id,
        title: col.title || 'Untitled Style',
        style_prompt_raindrop_id,
        style_prompt,
        extra_style_instruction,
        preview_cover,
        style_reference_links,
      };
    });
  } else {
    const directRes = await fetch(
      `${RAINDROP_API_BASE}/raindrops/${moreStylesId}?perpage=50`,
      { headers }
    );
    if (directRes.ok) {
      const directData = await directRes.json();
      const items = directData.items || [];
      if (items.length > 0) {
        styles = items.map((item: any) => ({
          id: item._id,
          title: item.title || 'Untitled Style',
          style_prompt_raindrop_id: String(item._id),
          style_prompt: item.excerpt || item.title || '',
          extra_style_instruction: item.note || '',
          preview_cover: item.cover || (item.media && item.media[0] ? item.media[0].link : ''),
          style_reference_links: [],
        }));
      }
    }
  }

  return {
    status: 'success',
    styles,
  };
}

