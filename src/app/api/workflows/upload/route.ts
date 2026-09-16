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
    const formData = await req.formData();
    const customApiKey = (formData.get('apiKey') as string) || undefined;
    const apiKey = getBearerToken(req, customApiKey, 'IMAGE_API_KEY');
    const workflowId = (formData.get('workflowId') as string) || '';
    const imageUrl = (formData.get('imageUrl') as string) || '';
    const apiEndpoint = (formData.get('apiEndpoint') as string) || (formData.get('targetEndpoint') as string) || '';

    if (!workflowId) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Image Generation App / Workflow ID is missing. Please configure your App ID in Settings.',
        },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Image Processing API Key is missing.',
        },
        { status: 400 }
      );
    }

    let targetOrigin = 'https://ai.insea.io';
    if (apiEndpoint) {
      try {
        targetOrigin = new URL(apiEndpoint).origin;
      } catch {
        // fallback
      }
    }

    const uploadEndpoint = `${targetOrigin}/api/workflows/${workflowId}/upload`;
    const upstreamFormData = new FormData();

    const uploadedFile = formData.get('file');

    if (uploadedFile && typeof uploadedFile === 'object' && 'arrayBuffer' in uploadedFile) {
      const fileObj = uploadedFile as File;
      upstreamFormData.append('file', fileObj, fileObj.name || 'upload.png');
    } else if (imageUrl) {
      let targetImageUrl = String(imageUrl).trim();
      let imageRes: Response | null = null;
      let lastDlErr: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        const dlController = new AbortController();
        const dlTimeout = setTimeout(() => dlController.abort(), 40000);
        try {
          const resAttempt = await fetch(targetImageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'image/*,*/*',
            },
            signal: dlController.signal,
          });
          if (resAttempt.ok || resAttempt.status < 500) {
            imageRes = resAttempt;
            break;
          }
        } catch (fetchErr: any) {
          lastDlErr = fetchErr;
        } finally {
          clearTimeout(dlTimeout);
        }
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
        }
      }

      if (!imageRes) {
        const isAbort = lastDlErr?.name === 'AbortError';
        return NextResponse.json(
          {
            status: 'error',
            message: isAbort
              ? `Timed out downloading reference image from URL (${targetImageUrl})`
              : `Failed to fetch reference image: ${lastDlErr?.message || 'Network fetch failed'}`,
          },
          { status: isAbort ? 504 : 500 }
        );
      }

      if (!imageRes.ok) {
        return NextResponse.json(
          {
            status: 'error',
            message: `Failed to download reference image from URL: ${targetImageUrl} (${imageRes.status})`,
          },
          { status: 400 }
        );
      }

      const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await imageRes.arrayBuffer();
      let filename = 'reference.jpg';
      try {
        const parsedUrl = new URL(targetImageUrl);
        const basename = parsedUrl.pathname.split('/').pop();
        if (basename && basename.includes('.')) {
          filename = basename;
        }
      } catch {
        // fallback
      }
      const blob = new Blob([arrayBuffer], { type: contentType });
      upstreamFormData.append('file', blob, filename);
    } else {
      return NextResponse.json(
        {
          status: 'error',
          message: 'No file or imageUrl provided for upload.',
        },
        { status: 400 }
      );
    }

    let upstreamRes: Response | null = null;
    let lastUpErr: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const upController = new AbortController();
      const upTimeout = setTimeout(() => upController.abort(), 60000);
      try {
        const resAttempt = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: upstreamFormData,
          signal: upController.signal,
        });
        if (resAttempt.ok || (resAttempt.status >= 400 && resAttempt.status < 500)) {
          upstreamRes = resAttempt;
          break;
        }
      } catch (upErr: any) {
        lastUpErr = upErr;
      } finally {
        clearTimeout(upTimeout);
      }
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    if (!upstreamRes) {
      const isAbort = lastUpErr?.name === 'AbortError';
      return NextResponse.json(
        {
          status: 'error',
          message: isAbort
            ? `Timed out uploading reference image to upstream server (${uploadEndpoint})`
            : `Failed to upload to upstream server: ${lastUpErr?.message || 'Network fetch failed'}`,
        },
        { status: isAbort ? 504 : 502 }
      );
    }

    const contentType = upstreamRes.headers.get('content-type') || '';
    let upstreamData: any;
    if (contentType.includes('application/json')) {
      try {
        upstreamData = await upstreamRes.json();
      } catch {
        upstreamData = { rawText: 'Invalid JSON response from upstream' };
      }
    } else {
      const text = await upstreamRes.text();
      upstreamData = { rawText: text };
    }

    if (!upstreamRes.ok) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Upload to workflow ${workflowId} failed (${upstreamRes.status})`,
          upstreamData,
        },
        { status: upstreamRes.status }
      );
    }

    const fileId =
      upstreamData?.data?.file_id ||
      upstreamData?.file_id ||
      upstreamData?.id ||
      upstreamData?.data?.id ||
      upstreamData?.outputs?.image?.id ||
      upstreamData?.data?.outputs?.image?.id ||
      upstreamData?.file?.id ||
      upstreamData?.data?.file?.id;

    return NextResponse.json({
      status: 'success',
      file_id: fileId ? String(fileId) : null,
      data: upstreamData,
    });
  } catch (err: any) {
    console.error('Error in /api/workflows/upload:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Failed to upload reference image',
      },
      { status: 500 }
    );
  }
}
