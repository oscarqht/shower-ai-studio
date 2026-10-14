const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const { NextRequest } = require('next/server');

// Load the actual route using the project's existing TypeScript dependency.
const route = new Module(require.resolve('../src/app/api/upload-attachments/route.ts'), module);
route.filename = route.id;
route.paths = module.paths;
route._compile(ts.transpileModule(fs.readFileSync(route.filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, route.filename);

const bookmark = {
  title: 'Image generation app',
  link: 'https://ai.example/app/workflows/28292',
  note: JSON.stringify({ API_KEY: ' image-key ', WORKFLOW_ID: '999' }),
};
const decoy = { ...bookmark, title: 'Old image generation app', link: 'https://ai.example/app/workflows/123' };

async function upload({ pages = [[decoy, bookmark]], roots = [{ _id: 1, title: 'Shower' }], upstream, files = 1 } = {}) {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push(String(url));
    if (String(url).startsWith('https://api.raindrop.io/')) {
      assert.equal(options.headers.Authorization, 'Bearer raindrop-key');
      const items = String(url).endsWith('/collections') ? roots
        : String(url).endsWith('/childrens') ? [
          { _id: 2, title: 'Apps', parent: { $id: 1 } },
          { _id: 3, title: 'Shower', parent: { $id: 7 } },
          { _id: 4, title: 'Apps', parent: { $id: 3 } },
        ] : pages[Number(new URL(url).searchParams.get('page'))] || [];
      return Response.json({ items });
    }
    assert.equal(url, 'https://ai.example/api/workflows/28292/upload');
    assert.equal(options.method, 'POST');
    assert.deepEqual(options.headers, { Authorization: 'Bearer image-key' });
    assert.deepEqual([...options.body.keys()], ['file']);
    const file = options.body.get('file');
    assert.equal(file.name, 'reference.png');
    assert.equal(file.type, 'image/png');
    assert.equal(await file.text(), 'image contents');
    return upstream ? upstream() : Response.json({ data: { file_id: 'file-id' } });
  };
  try {
    const data = new FormData();
    data.append('token', 'raindrop-key');
    for (let i = 0; i < files; i++) {
      data.append('files', new Blob(['image contents'], { type: 'image/png' }), 'reference.png');
    }
    const response = await route.exports.POST(new NextRequest('http://localhost/api/upload-attachments', { method: 'POST', body: data }));
    return { status: response.status, body: await response.json(), calls };
  } finally {
    global.fetch = originalFetch;
  }
}

test('exact bookmark, URL workflow, note key, and one multipart request per file', async () => {
  const result = await upload({ files: 2 });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: 'success', file_ids: ['file-id', 'file-id'] });
  assert.equal(result.calls.filter(url => url.endsWith('/upload')).length, 2);
});

test('finds the exact bookmark after the first 50 items', async () => {
  const result = await upload({ pages: [Array(50).fill(decoy), [bookmark]] });
  assert.equal(result.status, 200);
  assert.ok(result.calls.includes('https://api.raindrop.io/rest/v1/raindrops/2?perpage=50&page=1'));
});

test('never substitutes a similarly named bookmark', async () => {
  const result = await upload({ pages: [[decoy]] });
  assert.equal(result.status, 404);
  assert.ok(result.calls.every(url => !url.endsWith('/upload')));
});

test('requires Shower to be a root collection', async () => {
  const result = await upload({ roots: [] });
  assert.equal(result.status, 404);
  assert.ok(result.calls.every(url => !url.includes('/raindrops/')));
});

test('rejects malformed workflow URLs and empty API keys before upload', async () => {
  for (const item of [
    { ...bookmark, link: 'https://ai.example/app/community/28292' },
    { ...bookmark, link: 'https://ai.example/app/workflows/0' },
    { ...bookmark, note: JSON.stringify({ API_KEY: ' ' }) },
    { ...bookmark, note: 'null' },
  ]) {
    const result = await upload({ pages: [[item]] });
    assert.equal(result.status, 400);
    assert.ok(result.calls.every(url => !url.endsWith('/upload')));
  }
});

test('reports nested 403 error and destination without returning the key', async () => {
  const result = await upload({ upstream: () => Response.json({ error: { code: 'ACCESS_DENIED', message: 'Access denied' } }, { status: 403 }) });
  assert.equal(result.status, 403);
  assert.equal(result.body.message, 'Upload API returned status 403 for workflow 28292: Access denied');
  assert.equal(result.body.upload_url, 'https://ai.example/api/workflows/28292/upload');
  assert.ok(!JSON.stringify(result.body).includes('image-key'));
});

test('requires data.file_id and surfaces API errors even on HTTP 200', async () => {
  const result = await upload({ upstream: () => Response.json({ error: { code: 'FILE_NOT_PRESENT', message: 'File is missing' } }) });
  assert.equal(result.status, 500);
  assert.equal(result.body.message, 'File is missing');
});
