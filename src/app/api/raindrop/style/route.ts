import type { NextRequest } from 'next/server';
import { saveRaindropStyle } from '@/lib/saveRaindropStyle';

export async function POST(req: NextRequest) {
  return saveRaindropStyle(req, fetch, process.env.RAINDROP_TOKEN);
}
