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

export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const { fileId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const customApiKey = searchParams.get('apiKey') || undefined;
    const apiKey = getBearerToken(req, customApiKey, 'IMAGE_API_KEY');
    const apiEndpoint = searchParams.get('apiEndpoint') || searchParams.get('targetEndpoint') || '';

    if (!apiKey) {
      return new NextResponse('API Key missing', { status: 400 });
    }

    let targetOrigin = 'https://ai.insea.io';
    if (apiEndpoint) {
      try {
        targetOrigin = new URL(apiEndpoint).origin;
      } catch {
        // fallback
      }
    }

    const fileRes = await fetch(`${targetOrigin}/api/files/${fileId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!fileRes.ok) {
      return new NextResponse(`Failed to download file ${fileId} from ${targetOrigin}`, {
        status: fileRes.status,
      });
    }

    const contentType = fileRes.headers.get('content-type') || 'image/png';
    const arrayBuffer = await fileRes.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (err: any) {
    return new NextResponse(err.message || 'Server error downloading file', { status: 500 });
  }
}
