import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { cors } from 'hono/cors';
import dotenv from 'dotenv';

dotenv.config();

// Handlers
import * as authConfig from './api/auth/config/route';
import * as authLogin from './api/auth/login/route';
import * as authCallback from './api/auth/callback/route';
import * as authRefresh from './api/auth/refresh/route';
import * as files from './api/files/[fileId]/route';
import * as generate from './api/generate/route';
import * as uploadAttachments from './api/upload-attachments/route';
import * as workflowsUpload from './api/workflows/upload/route';
import * as workflowsBatchUpload from './api/workflows/batch-upload/route';
import * as raindropFetch from './api/raindrop/fetch/route';
import * as raindropAppUrl from './api/raindrop/app-url/route';
import * as raindropPreset from './api/raindrop/preset/route';
import * as raindropPresetId from './api/raindrop/preset/[id]/route';
import * as raindropCharacter from './api/raindrop/character/route';
import * as raindropCharacterId from './api/raindrop/character/[id]/route';

const app = new Hono();
app.use('*', cors());

function adapt(handler?: (req: any, ctx?: any) => Promise<Response>) {
  return async (c: any) => {
    if (!handler) return c.json({ status: 'error', message: 'Not found' }, 404);
    const rawReq = c.req.raw;
    rawReq.nextUrl = new URL(rawReq.url);
    const params = c.req.param();
    try {
      const response = await handler(rawReq, { params: Promise.resolve(params) });
      return response;
    } catch (err: any) {
      console.error('API error:', err);
      return c.json({ status: 'error', message: err?.message || 'Internal Server Error' }, 500);
    }
  };
}

// Auth
app.get('/api/auth/config', adapt(authConfig.GET));
app.get('/api/auth/login', adapt(authLogin.GET));
app.post('/api/auth/callback', adapt(authCallback.POST));
app.post('/api/auth/refresh', adapt(authRefresh.POST));

// Files & Generation
app.get('/api/files/:fileId', adapt(files.GET));
app.post('/api/generate', adapt(generate.POST));
app.post('/api/upload-attachments', adapt(uploadAttachments.POST));
app.post('/api/workflows/upload', adapt(workflowsUpload.POST));
app.post('/api/workflows/batch-upload', adapt(workflowsBatchUpload.POST));

// Raindrop
app.post('/api/raindrop/fetch', adapt(raindropFetch.POST));
app.post('/api/raindrop/app-url', adapt(raindropAppUrl.POST));
app.post('/api/raindrop/preset', adapt(raindropPreset.POST));
app.delete('/api/raindrop/preset/:id', adapt((raindropPresetId as any).DELETE));
app.post('/api/raindrop/character', adapt(raindropCharacter.POST));
app.get('/api/raindrop/character/:id', adapt((raindropCharacterId as any).GET));
app.delete('/api/raindrop/character/:id', adapt((raindropCharacterId as any).DELETE));

// Serve static frontend in production
app.use('/*', serveStatic({ root: './dist' }));
app.get('/*', serveStatic({ path: './dist/index.html' }));

const port = Number(process.env.PORT) || 3001;
console.log(`Shower Studio API server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
