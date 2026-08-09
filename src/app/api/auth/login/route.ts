import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const clientId = process.env.RAINDROP_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'RAINDROP_CLIENT_ID is not configured in server environment variables.',
      },
      { status: 400 }
    );
  }

  let baseUrl = process.env.APP_URL?.trim();
  if (!baseUrl || baseUrl === 'MY_APP_URL') {
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    baseUrl = `${proto}://${host}`;
  }
  baseUrl = baseUrl.replace(/\/+$/, '');

  const redirectUri = `${baseUrl}/auth/callback`;
  const authorizeUrl = new URL('https://raindrop.io/oauth/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);

  const shouldRedirect = req.nextUrl.searchParams.get('redirect') === 'true';
  if (shouldRedirect) {
    return NextResponse.redirect(authorizeUrl.toString());
  }

  return NextResponse.json({
    status: 'success',
    url: authorizeUrl.toString(),
    redirectUri,
  });
}
