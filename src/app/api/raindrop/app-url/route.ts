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
          message: 'Raindrop API token is missing. Please configure your token in settings.',
        },
        { status: 400 }
      );
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

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
    const isParentShower = (c: any) => {
      if (!c) return false;
      const p = c.parent?.$id !== undefined ? c.parent.$id : c.parent;
      return String(p) === String(showerId);
    };

    const appsCollection = allCollections.find(
      (c) => isParentShower(c) && c.title && c.title.trim().toLowerCase() === 'apps'
    );

    if (!appsCollection) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Could not find "Apps" collection under "Shower" in Raindrop.',
        },
        { status: 404 }
      );
    }

    const appsRes = await fetch(
      `https://api.raindrop.io/rest/v1/raindrops/${appsCollection._id}?perpage=50`,
      { headers }
    );

    if (!appsRes.ok) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Failed to fetch items in Apps collection (${appsRes.status})`,
        },
        { status: appsRes.status }
      );
    }

    const appsData = await appsRes.json();
    const items = appsData.items || [];
    const imgAppItem = items.find((item: any) => {
      if (!item.title) return false;
      const t = item.title.trim().toLowerCase();
      return t === 'image generation app' || t.includes('image generation app') || t.includes('image generation');
    }) || items[0];

    if (!imgAppItem || !imgAppItem.link) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Could not find "Image generation app" item or link in Raindrop "Shower > Apps".',
        },
        { status: 404 }
      );
    }

    let rawLink = imgAppItem.link.trim();
    if (rawLink && !rawLink.startsWith('http://') && !rawLink.startsWith('https://')) {
      rawLink = 'https://' + rawLink;
    }

    let hasUploadCapability = false;
    if (imgAppItem.note) {
      try {
        const noteConfig = JSON.parse(imgAppItem.note);
        if (noteConfig && noteConfig.API_KEY) {
          hasUploadCapability = true;
        }
      } catch (e) {
        // Not valid JSON, ignore
      }
    }

    return NextResponse.json({
      status: 'success',
      imageAppUrl: rawLink,
      hasUploadCapability,
      item: {
        id: imgAppItem._id,
        title: imgAppItem.title,
        link: rawLink,
      },
    });
  } catch (err: any) {
    console.error('Error in /api/raindrop/app-url:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Server error resolving app URL from Raindrop',
      },
      { status: 500 }
    );
  }
}
