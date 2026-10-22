import type { NextRequest } from 'next/server';
import { listRaindropAttachments, deleteRaindropAttachment } from '@/lib/raindropAttachments';
import { uploadRaindropAttachment } from '@/lib/uploadRaindropAttachment';

export async function POST(req: NextRequest) {
  return uploadRaindropAttachment(req, fetch, process.env.RAINDROP_TOKEN);
}

export async function GET(req: NextRequest) {
  return listRaindropAttachments(req, fetch, process.env.RAINDROP_TOKEN);
}

export async function DELETE(req: NextRequest) {
  return deleteRaindropAttachment(req, fetch, process.env.RAINDROP_TOKEN);
}
