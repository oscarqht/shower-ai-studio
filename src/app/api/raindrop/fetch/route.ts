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
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // ignore
    }

    const token = getBearerToken(req, body?.token, 'RAINDROP_TOKEN');

    if (!token) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Raindrop API token is missing. Please provide a Bearer token in settings or environment variables.',
        },
        { status: 400 }
      );
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Step 1: Fetch root collections and child collections concurrently
    const [rootRes, childRes] = await Promise.all([
      fetch('https://api.raindrop.io/rest/v1/collections', { headers }),
      fetch('https://api.raindrop.io/rest/v1/collections/childrens', { headers }),
    ]);

    if (!rootRes.ok) {
      const errText = await rootRes.text();
      return NextResponse.json(
        {
          status: 'error',
          message: `Raindrop API root collections request failed (${rootRes.status}): ${errText}`,
        },
        { status: rootRes.status }
      );
    }

    if (!childRes.ok) {
      const errText = await childRes.text();
      return NextResponse.json(
        {
          status: 'error',
          message: `Raindrop API child collections request failed (${childRes.status}): ${errText}`,
        },
        { status: childRes.status }
      );
    }

    const rootData = await rootRes.json();
    const childData = await childRes.json();

    const rootCollections: any[] = rootData.items || [];
    const childCollections: any[] = childData.items || [];
    const allCollections = [...rootCollections, ...childCollections];

    // Step 2: Locate the "Shower" collection
    const showerCollection = allCollections.find(
      (c) => c.title && c.title.trim().toLowerCase() === 'shower'
    );

    if (!showerCollection) {
      return NextResponse.json(
        {
          status: 'partial',
          message: 'Could not find a collection named "Shower". Please ensure you have a "Shower" collection in Raindrop.',
          debugInfo: {
            collectionsFound: allCollections.map((c) => ({ id: c._id, title: c.title, parentId: c.parent?.$id })),
          },
        },
        { status: 404 }
      );
    }

    // Step 3: Find "Characters" and "Styles" under "Shower"
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
      (c) => isParentShower(c) && c.title && c.title.trim().toLowerCase() === 'styles'
    );
    const appsCollection = allCollections.find(
      (c) => isParentShower(c) && c.title && c.title.trim().toLowerCase() === 'apps'
    );
    const presetsCollection = allCollections.find(
      (c) => isParentShower(c) && c.title && c.title.trim().toLowerCase() === 'presets'
    ) || allCollections.find(
      (c) => c.title && c.title.trim().toLowerCase() === 'presets'
    );

    let characters: any[] = [];
    let styles: any[] = [];
    let presets: any[] = [];
    let imageAppUrl = '';
    let hasUploadCapability = false;

    // Step 4: Fetch items in "Apps" collection to get "Image generation app" link
    if (appsCollection) {
      try {
        const appsRes = await fetch(
          `https://api.raindrop.io/rest/v1/raindrops/${appsCollection._id}?perpage=50`,
          { headers }
        );
        if (appsRes.ok) {
          const appsData = await appsRes.json();
          const items = appsData.items || [];
          const imgAppItem = items.find((item: any) => {
            if (!item.title) return false;
            const t = item.title.trim().toLowerCase();
            return t === 'image generation app' || t.includes('image generation app') || t.includes('image generation');
          });
          if (imgAppItem && imgAppItem.link) {
            let rawLink = imgAppItem.link.trim();
            if (rawLink && !rawLink.startsWith('http://') && !rawLink.startsWith('https://')) {
              rawLink = 'https://' + rawLink;
            }
            imageAppUrl = rawLink;
          }
          if (imgAppItem && imgAppItem.note) {
            try {
              const noteConfig = JSON.parse(imgAppItem.note);
              if (noteConfig && noteConfig.API_KEY) {
                hasUploadCapability = true;
              }
            } catch (e) {
              // Not valid JSON, ignore
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch Apps collection items:', e);
      }
    }

    // Step 5: Fetch items in "Characters" collection
    if (charactersCollection) {
      const charRes = await fetch(
        `https://api.raindrop.io/rest/v1/raindrops/${charactersCollection._id}?perpage=50`,
        { headers }
      );
      if (charRes.ok) {
        const charData = await charRes.json();
        const items = charData.items || [];
        characters = items.map((item: any) => {
          let parsedNote: any = null;
          let parsedTags = '';
          let parsedIndex: number | undefined = undefined;
          try {
            if (item.note) {
              const parsed = JSON.parse(item.note);
              if (parsed.tags !== undefined) {
                parsedTags = parsed.tags;
                parsedNote = parsed;
                if (parsed.index !== undefined) {
                  parsedIndex = typeof parsed.index === 'number' ? parsed.index : parseInt(parsed.index, 10);
                  if (isNaN(parsedIndex)) {
                     parsedIndex = undefined;
                  }
                }
              }
            }
          } catch (e) {
            // Not JSON
          }

          const resolvedNote = parsedNote ? parsedTags : (item.note || '');

          return {
            id: item._id,
            title: item.title || 'Untitled Character',
            excerpt: item.excerpt || resolvedNote,
            cover: item.cover || (item.media && item.media[0] ? item.media[0].link : ''),
            link: item.link || '',
            note: item.note || '',
            index: parsedIndex,
          };
        });
      }
    }

    // Step 6: Fetch style pack child collections under "Styles"
    let stylePackCollectionsCount = 0;
    if (stylesCollection) {
      const stylesId = stylesCollection._id;
      const stylePackCollections = allCollections.filter((c) => {
        const p = c.parent?.$id !== undefined ? c.parent.$id : c.parent;
        return String(p) === String(stylesId);
      });
      stylePackCollectionsCount = stylePackCollections.length;

      const chunkSize = 5;
      const stylePackResults: any[] = [];

      for (let i = 0; i < stylePackCollections.length; i += chunkSize) {
        const chunk = stylePackCollections.slice(i, i + chunkSize);
        const chunkPromises = chunk.map(async (spCol) => {
          try {
            const spRes = await fetch(
              `https://api.raindrop.io/rest/v1/raindrops/${spCol._id}?perpage=50`,
              { headers }
            );
            if (!spRes.ok) return null;
            const spData = await spRes.json();
            return {
              col: spCol,
              items: spData.items || [],
            };
          } catch (e) {
            console.error(`Failed to fetch items for style collection ${spCol.title}:`, e);
            return null;
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        stylePackResults.push(...chunkResults.filter(Boolean));
        if (i + chunkSize < stylePackCollections.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      styles = stylePackResults.map(({ col, items }) => {
        const previewItem = items.find((item: any) =>
          item.title && item.title.toLowerCase().includes('preview')
        ) || items[0];

        const refItems = items.filter((item: any) => {
          if (!item.title) return false;
          const title = item.title.trim().toLowerCase();
          return title.startsWith('reference-') && (title.endsWith('.jpg') || title.endsWith('.jpeg') || title.endsWith('.png') || title.endsWith('.webp') || !title.includes('.'));
        });

        refItems.sort((a: any, b: any) => {
          const tA = (a.title || '').toLowerCase();
          const tB = (b.title || '').toLowerCase();
          return tA.localeCompare(tB, undefined, { numeric: true, sensitivity: 'base' });
        });

        const style_prompt_raindrop_id = previewItem ? String(previewItem._id) : '';
        const style_prompt = previewItem ? (previewItem.excerpt || previewItem.title || '') : '';
        const extra_style_instruction = previewItem ? (previewItem.note || '') : '';
        const preview_cover = previewItem
          ? (previewItem.cover || (previewItem.media && previewItem.media[0] ? previewItem.media[0].link : ''))
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
    }

    // Step 7: Fetch items in "Presets" collection
    if (presetsCollection) {
      try {
        const presetRes = await fetch(
          `https://api.raindrop.io/rest/v1/raindrops/${presetsCollection._id}?perpage=50`,
          { headers }
        );
        if (presetRes.ok) {
          const presetData = await presetRes.json();
          const items = presetData.items || [];
          presets = items.map((item: any) => {
            const title = item.title || 'Untitled Preset';
            // Preview image should be the raindrop item's thumbnail
            const preview_image = item.cover || (item.media && item.media[0] ? item.media[0].link : '') || item.link || '';

            let prompt = item.excerpt || '';
            let model: string | undefined = undefined;
            let aspect_ratio: string | undefined = undefined;
            let text_language: string | undefined = undefined;
            let style_pack_name: string | undefined = undefined;
            let character_names: string[] | undefined = undefined;

            if (item.note) {
              try {
                const parsed = JSON.parse(item.note);
                if (parsed && typeof parsed === 'object') {
                  if (parsed.prompt !== undefined) prompt = String(parsed.prompt);
                  else if (parsed.instruction !== undefined) prompt = String(parsed.instruction);
                  else if (parsed.compositionPrompt !== undefined) prompt = String(parsed.compositionPrompt);
                  else if (parsed.composition_prompt !== undefined) prompt = String(parsed.composition_prompt);
                  else if (parsed.description !== undefined) prompt = String(parsed.description);

                  if (parsed.model !== undefined) model = String(parsed.model);
                  else if (parsed.ai_model !== undefined) model = String(parsed.ai_model);
                  else if (parsed.aiModel !== undefined) model = String(parsed.aiModel);

                  if (parsed.aspect_ratio !== undefined) aspect_ratio = String(parsed.aspect_ratio);
                  else if (parsed.aspectRatio !== undefined) aspect_ratio = String(parsed.aspectRatio);
                  else if (parsed.ratio !== undefined) aspect_ratio = String(parsed.ratio);

                  if (parsed.text_language !== undefined) text_language = String(parsed.text_language);
                  else if (parsed.textLanguage !== undefined) text_language = String(parsed.textLanguage);
                  else if (parsed.language !== undefined) text_language = String(parsed.language);

                  if (parsed.style_pack_name !== undefined) style_pack_name = String(parsed.style_pack_name);
                  else if (parsed.stylePackName !== undefined) style_pack_name = String(parsed.stylePackName);
                  else if (parsed.style_pack !== undefined) style_pack_name = String(parsed.style_pack);
                  else if (parsed.style !== undefined) style_pack_name = String(parsed.style);
                  else if (parsed.stylePack !== undefined) style_pack_name = String(parsed.stylePack);

                  const rawChars = parsed.character_names ?? parsed.characterNames ?? parsed.characters ?? parsed.cast;
                  if (Array.isArray(rawChars)) {
                    character_names = rawChars.map((c: any) => String(c).trim()).filter(Boolean);
                  } else if (typeof rawChars === 'string' && rawChars.trim()) {
                    character_names = rawChars.split(/[,·]/).map((c: string) => c.trim()).filter(Boolean);
                  }
                }
              } catch {
                if (!prompt) prompt = item.note;
              }
            }

            return {
              id: item._id,
              title,
              preview_image,
              prompt,
              model,
              aspect_ratio,
              text_language,
              style_pack_name,
              character_names,
              raw_note: item.note || '',
            };
          });
        }
      } catch (e) {
        console.error('Failed to fetch Presets collection items:', e);
      }
    }

    return NextResponse.json({
      status: 'success',
      characters,
      styles,
      presets,
      imageAppUrl,
      hasUploadCapability,
      debugInfo: {
        showerCollectionId: showerId,
        charactersCollectionId: charactersCollection?._id || null,
        stylesCollectionId: stylesCollection?._id || null,
        appsCollectionId: appsCollection?._id || null,
        presetsCollectionId: presetsCollection?._id || null,
        styleCollectionsCount: stylePackCollectionsCount,
        presetsCount: presets.length,
        imageAppUrl,
        hasUploadCapability,
      },
    });
  } catch (err: any) {
    console.error('Error in /api/raindrop/fetch:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Server error fetching Raindrop data',
      },
      { status: 500 }
    );
  }
}
