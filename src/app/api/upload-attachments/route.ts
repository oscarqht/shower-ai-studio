import { NextRequest, NextResponse } from 'next/server';

function getBearerToken(req: NextRequest, formDataToken?: string, envTokenName?: string): string {
  if (formDataToken && formDataToken.trim()) return formDataToken.trim();
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
    const formData = await req.formData();
    const token = getBearerToken(req, formData.get('token') as string | undefined, 'RAINDROP_TOKEN');

    if (!token) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Raindrop API token is missing.',
        },
        { status: 400 }
      );
    }

    const files = formData.getAll('files');
    if (!files || files.length === 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'No files provided.',
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

    // Find the "Upload files app"
    const uploadAppItem = items.find((item: any) => {
      if (!item.title) return false;
      const t = item.title.trim().toLowerCase();
      return t === 'upload files app';
    });

    if (!uploadAppItem) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Could not find "Upload files app" in Raindrop "Shower > Apps".',
        },
        { status: 404 }
      );
    }

    if (!uploadAppItem.link) {
      return NextResponse.json(
        {
          status: 'error',
          message: '"Upload files app" item exists but has no link.',
        },
        { status: 400 }
      );
    }

    if (!uploadAppItem.note) {
      return NextResponse.json(
        {
          status: 'error',
          message: '"Upload files app" item exists but has no note content containing API configuration.',
        },
        { status: 400 }
      );
    }

    let noteConfig: any;
    try {
      noteConfig = JSON.parse(uploadAppItem.note);
    } catch (e) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'The note content of "Upload files app" is not valid JSON.',
        },
        { status: 400 }
      );
    }

    if (!noteConfig.API_KEY) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'The note content of "Upload files app" does not contain an "API_KEY".',
        },
        { status: 400 }
      );
    }

    // Parse URL to get origin and workflow id
    let origin: string;
    let workflowId: string;

    try {
      const parsedUrl = new URL(uploadAppItem.link);
      origin = parsedUrl.origin;
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      // Example: https://alpha.sea.com/workflows/475
      if (pathParts.length >= 2 && pathParts[0] === 'workflows') {
        workflowId = pathParts[1];
      } else {
         return NextResponse.json(
          {
            status: 'error',
            message: 'Could not extract workflow ID from the link. Expected format: origin/workflows/<id>',
          },
          { status: 400 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Invalid link format in "Upload files app": ${uploadAppItem.link}`,
        },
        { status: 400 }
      );
    }

    // Prepare upload payload
    const uploadFormData = new FormData();
    files.forEach(file => {
      uploadFormData.append('files', file);
    });

    const apiUrl = `${origin}/api/workflows/${workflowId}/run`;

    try {
      const uploadRes = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${noteConfig.API_KEY}`,
          // Don't set Content-Type manually for FormData, node-fetch/undici handles boundaries
        },
        body: uploadFormData,
      });

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        console.error('Upload API failed:', uploadRes.status, errorText);
        return NextResponse.json(
          {
            status: 'error',
            message: `Upload API returned status ${uploadRes.status}`,
          },
          { status: uploadRes.status }
        );
      }

      const uploadData = await uploadRes.json();

      const fileIds = uploadData?.data?.outputs?.file_ids;

      if (!fileIds || !Array.isArray(fileIds)) {
        return NextResponse.json(
          {
            status: 'error',
            message: 'Upload API did not return data.outputs.file_ids as an array.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        status: 'success',
        file_ids: fileIds,
      });

    } catch (e: any) {
      console.error('Error calling upload API:', e);
      return NextResponse.json(
        {
          status: 'error',
          message: `Network error calling upload API: ${e.message}`,
        },
        { status: 500 }
      );
    }

  } catch (err: any) {
    console.error('Error in /api/upload-attachments:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Server error uploading attachments',
      },
      { status: 500 }
    );
  }
}
