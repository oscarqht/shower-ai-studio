import type { NextRequest } from 'next/server';
import { uploadRaindropAttachment } from '@/lib/uploadRaindropAttachment';

export async function POST(req: NextRequest) {
  return uploadRaindropAttachment(req, fetch, process.env.RAINDROP_TOKEN);
}
