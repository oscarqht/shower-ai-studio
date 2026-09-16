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
          message: `Failed to delete Raindrop preset item ${id} (${deleteRes.status}): ${errText}`,
        },
        { status: deleteRes.status }
      );
    }

    return NextResponse.json({
      status: 'success',
      id,
    });
  } catch (err: any) {
    console.error('Error deleting preset:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Server error deleting preset from Raindrop',
      },
      { status: 500 }
    );
  }
}
