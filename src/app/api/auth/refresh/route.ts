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
    const refreshToken = (body.refreshToken || body.refresh_token)?.trim();

    if (!refreshToken) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Refresh token is missing in request body.',
        },
        { status: 400 }
      );
    }

    const payload = {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
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
      const errMessage = data.error_description || data.error || data.message || resText || 'Failed to refresh Raindrop access token.';
      return NextResponse.json(
        {
          status: 'error',
          message: `Raindrop OAuth token refresh failed (${response.status}): ${errMessage}`,
        },
        { status: response.status || 400 }
      );
    }

    const expiresIn = data.expires_in || 1209600; // default 14 days in seconds
    const expiresAt = Date.now() + expiresIn * 1000;

    return NextResponse.json({
      status: 'success',
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken, // fallback to old refresh token if not rotated
      token_type: data.token_type || 'Bearer',
      expires_in: expiresIn,
      expires_at: expiresAt,
    });
  } catch (err: any) {
    console.error('Error in /api/auth/refresh:', err);
    return NextResponse.json(
      {
        status: 'error',
        message: err.message || 'Internal server error during OAuth token refresh',
      },
      { status: 500 }
    );
  }
}
