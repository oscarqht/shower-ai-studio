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
          styles: [],
        },
        { status: 404 }
      );
    }

    const showerId = showerCollection._id;
    const isParentShower = (c: any) => {
      if (!c) return false;
      const p = c.parent?.$id !== undefined ? c.parent.$id : c.parent;
      return String(p) === String(showerId);
    };

    // Step 3: Locate "More styles" child collection under "Shower"
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
      return NextResponse.json({
        status: 'success',
        styles: [],
        message: 'Could not find a "More styles" child collection under "Shower".',
        debugInfo: {
          showerCollectionId: showerId,
          collectionsFound: allCollections.map((c) => ({ id: c._id, title: c.title, parentId: c.parent?.$id })),
        },
      });
    }

    const moreStylesId = moreStylesCollection._id;

    // Step 4: Find child collections under "More styles"
    const moreStylePackCollections = allCollections.filter((c) => {
      const p = c.parent?.$id !== undefined ? c.parent.$id : c.parent;
      return String(p) === String(moreStylesId);
    });

    let styles: any[] = [];

    // If there are child collections under "More styles" (standard structure)
    if (moreStylePackCollections.length > 0) {
      const chunkSize = 5;
      const stylePackResults: any[] = [];

      for (let i = 0; i < moreStylePackCollections.length; i += chunkSize) {
        const chunk = moreStylePackCollections.slice(i, i + chunkSize);
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
      // Fallback in case raindrops were added directly into "More styles" collection
      const directRes = await fetch(
        `https://api.raindrop.io/rest/v1/raindrops/${moreStylesId}?perpage=50`,
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

    return NextResponse.json({
      status: 'success',
      styles,
      count: styles.length,
      collectionId: moreStylesId,
    });
  } catch (err: any) {
    console.error('Error in /api/raindrop/more-styles:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Server error fetching more styles from Raindrop',
      },
      { status: 500 }
    );
  }
}
