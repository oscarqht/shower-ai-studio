import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.RAINDROP_CLIENT_ID?.trim();
  const envToken = process.env.RAINDROP_TOKEN?.trim();
  return NextResponse.json({
    oauthConfigured: Boolean(clientId),
    hasClientId: Boolean(clientId),
    hasEnvToken: Boolean(envToken),
  });
}
