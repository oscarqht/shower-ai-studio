import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const clientId = process.env.RAINDROP_CLIENT_ID?.trim();
    const clientSecret = process.env.RAINDROP_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Raindrop OAuth credentials (RAINDROP_CLIENT_ID or RAINDROP_CLIENT_SECRET) are missing on the server.',
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const code = body.code?.trim();

    if (!code) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Authorization code is missing in request body.',
        },
        { status: 400 }
      );
    }

    let redirectUri = body.redirect_uri?.trim();
    if (!redirectUri) {
      let baseUrl = process.env.APP_URL?.trim();
      if (!baseUrl || baseUrl === 'MY_APP_URL') {
        const proto = req.headers.get('x-forwarded-proto') || 'http';
        const host = req.headers.get('host') || 'localhost:3000';
        baseUrl = `${proto}://${host}`;
      }
      redirectUri = `${baseUrl.replace(/\/+$/, '')}/auth/callback`;
    }

    const payload = {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    };

    // Attempt 1: JSON body
    let response = await fetch('https://raindrop.io/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let resText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(resText);
    } catch {
      data = {};
    }

    // Attempt 2: If JSON attempt failed, try application/x-www-form-urlencoded
    if (!response.ok || !data.access_token) {
      const formParams = new URLSearchParams(payload);
      const retryResponse = await fetch('https://raindrop.io/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: formParams.toString(),
      });

      if (retryResponse.ok) {
        const retryText = await retryResponse.text();
        try {
          const retryData = JSON.parse(retryText);
          if (retryData.access_token) {
            response = retryResponse;
            data = retryData;
            resText = retryText;
          }
        } catch {
          // ignore
        }
      }
    }

    if (!response.ok || !data.access_token) {
      const errMessage = data.error_description || data.error || data.message || resText || 'Failed to exchange authorization code for access token.';
      return NextResponse.json(
        {
          status: 'error',
          message: `Raindrop OAuth token exchange failed (${response.status}): ${errMessage}`,
        },
        { status: response.status || 400 }
      );
    }

    return NextResponse.json({
      status: 'success',
      access_token: data.access_token,
      token_type: data.token_type || 'Bearer',
      expires_in: data.expires_in,
      refresh_token: data.refresh_token,
    });
  } catch (err: any) {
    console.error('Error in /api/auth/callback:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Internal server error during OAuth callback exchange',
      },
      { status: 500 }
    );
  }
}
