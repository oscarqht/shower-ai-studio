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
    if (files.length === 0 || files.some((file) => typeof file === 'string')) {
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

    const showerCollection = (rootData.items || []).find(
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

    // Search all pages and use only the named bookmark, never a similar title.
    let uploadAppItem: any;
    for (let page = 0; ; page++) {
      const appsRes = await fetch(
        `https://api.raindrop.io/rest/v1/raindrops/${appsCollection._id}?perpage=50&page=${page}`,
        { headers, cache: 'no-store' }
      );
      if (!appsRes.ok) {
        return NextResponse.json(
          { status: 'error', message: `Failed to fetch items in Apps collection (${appsRes.status})` },
          { status: appsRes.status }
        );
      }
      const appsData = await appsRes.json();
      const items = appsData.items || [];
      uploadAppItem = items.find((item: any) =>
        item.title?.trim().toLowerCase() === 'image generation app'
      );
      if (uploadAppItem || items.length < 50) break;
    }

    if (!uploadAppItem) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Could not find "Image generation app" in Raindrop "Shower > Apps".',
        },
        { status: 404 }
      );
    }

    if (!uploadAppItem.link) {
      return NextResponse.json(
        {
          status: 'error',
          message: '"Image generation app" item exists but has no link.',
        },
        { status: 400 }
      );
    }

    if (!uploadAppItem.note) {
      return NextResponse.json(
        {
          status: 'error',
          message: '"Image generation app" item exists but has no note content containing API configuration.',
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
          message: 'The note content of "Image generation app" is not valid JSON.',
        },
        { status: 400 }
      );
    }

    if (typeof noteConfig?.API_KEY !== 'string' || !noteConfig.API_KEY.trim()) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'The note content of "Image generation app" does not contain an "API_KEY".',
        },
        { status: 400 }
      );
    }

    // The bookmark URL is the only source of the upload workflow ID.
    let appUrl: URL;

    try {
      let rawLink = uploadAppItem.link.trim();
      if (rawLink && !rawLink.startsWith('http://') && !rawLink.startsWith('https://')) {
        rawLink = 'https://' + rawLink;
      }
      appUrl = new URL(rawLink);
      if (!['https:', 'http:'].includes(appUrl.protocol)) throw new Error('Invalid protocol');
    } catch (e) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Invalid link format in "Image generation app": ${uploadAppItem.link}`,
        },
        { status: 400 }
      );
    }

    const workflowId = appUrl.pathname.match(/^\/app\/workflows\/([1-9]\d*)\/?$/)?.[1];

    if (!workflowId) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Expected "Image generation app" URL to use /app/workflows/<workflow id>.',
        },
        { status: 400 }
      );
    }

    const apiKey = String(noteConfig.API_KEY).trim();
    const apiUrl = `${appUrl.origin}/api/workflows/${workflowId}/upload`;

    try {
      const fileIds: string[] = [];

      for (const file of files) {
        const singleFileFormData = new FormData();
        singleFileFormData.append('file', file);

        const uploadRes = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: singleFileFormData,
        });

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();
          console.error('Upload API failed:', apiUrl, uploadRes.status);
          let parsedErrorMessage = '';
          try {
            const parsed = JSON.parse(errorText);
            const message = parsed.error?.message || parsed.message || parsed.detail;
            parsedErrorMessage = typeof message === 'string' ? message : '';
          } catch {}
          return NextResponse.json(
            {
              status: 'error',
              message: parsedErrorMessage
                ? `Upload API returned status ${uploadRes.status} for workflow ${workflowId}: ${parsedErrorMessage}`
                : `Upload API returned status ${uploadRes.status} for workflow ${workflowId}`,
              workflow_id: workflowId,
              upload_url: apiUrl,
            },
            { status: uploadRes.status }
          );
        }

        const uploadData = await uploadRes.json();

        const fileId = uploadData?.data?.file_id;

        if (typeof fileId !== 'string' || !fileId) {
          return NextResponse.json(
            {
              status: 'error',
              message: uploadData?.error?.message || 'Upload API did not return data.file_id for an uploaded file.',
            },
            { status: 500 }
          );
        }

        fileIds.push(fileId);
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
