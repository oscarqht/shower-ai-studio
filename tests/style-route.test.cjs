const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { File } = require('node:buffer');

const sourceCode = ts.transpileModule(fs.readFileSync('src/lib/saveRaindropStyle.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const collections = [{ _id: 1, title: 'Shower' }, { _id: 2, title: 'Styles', parent: { $id: 1 } },
  { _id: 3, title: 'More styles', parent: { $id: 1 } }, { _id: 4, title: 'Original', parent: { $id: 2 } }];
const preview = { _id: 10, title: 'preview.png', excerpt: 'Old', note: 'Keep', link: 'https://images.test/preview', cover: 'https://images.test/cover', tags: ['original'] };
const reference = { _id: 11, title: 'reference-1.png', link: 'https://images.test/reference', cover: 'https://images.test/ref-cover' };
function harness(overrides = {}) {
  const calls = [];
  let nextId = 100;
  const exports = {};
  const fetch = async (url, init) => {
    const path = url.replace('https://api.raindrop.io/rest/v1', '');
    const call = { path, method: init.method, headers: init.headers, body: init.body instanceof FormData ? init.body : init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    const customResponse = overrides.response?.(call, calls);
    if (customResponse) return customResponse;
    let data = overrides.reply?.(call, calls);
    if (data === undefined) {
      if (path === '/collections') data = { items: collections };
      else if (path === '/collections/childrens') data = { items: [] };
      else if (path.startsWith('/raindrops/4?')) data = { items: [preview, reference] };
      else if (path.startsWith('/raindrops/3?')) data = { items: [{ ...preview, _id: 30, title: 'Loose', collection: { $id: 3 } }] };
      else if (path === '/raindrop/file') data = { result: true, item: { _id: nextId++, link: 'https://images.test/upload', cover: 'https://images.test/upload', collection: { $id: Number(call.body.get('collectionId')) } } };
      else if (call.method === 'POST' || call.method === 'PUT') data = { result: true, item: { _id: call.method === 'PUT' ? Number(path.split('/').pop()) : nextId++, ...call.body } };
      else if (call.method === 'DELETE') data = { result: true };
      else throw new Error(`Unexpected request ${path}`);
    }
    return { ok: !data.httpError, status: data.httpError || 200, json: async () => data };
  };
  vm.runInNewContext(sourceCode, { exports, fetch: () => { throw new Error('Use injected fetch'); }, FormData, URL, Response, console });
  return { calls, save: async (fields = {}, uploads) => {
    const body = {
      token: 'test-only', source: { id: 4, style_prompt_raindrop_id: 10 }, mode: 'copy',
      title: 'Changed', style_prompt: 'New', extra_style_instruction: '', ...fields,
    };
    let form;
    if (uploads) {
      form = new FormData();
      form.set('payload', JSON.stringify(body));
      for (const [key, file] of Object.entries(uploads)) form.set(key, file);
    }
    const req = new Request('https://studio.test/api/raindrop/style', {
      method: 'POST', body: form || JSON.stringify(body),
      ...(!form ? { headers: { 'Content-Type': 'application/json' } } : {}),
    });
    const response = await exports.saveRaindropStyle(req, fetch, overrides.fallbackToken);
    return { status: response.status, data: await response.json() };
  } };
}

test('copy creates independent bookmarks and retains references and preview metadata', async () => {
  const { save, calls } = harness();
  const result = await save();
  assert.equal(result.status, 200);
  assert.equal(result.data.style.id, 100);
  assert.equal(result.data.style.style_prompt_raindrop_id, '101');
  assert.equal(result.data.style.preview_cover, preview.cover);
  assert.deepEqual(Array.from(result.data.style.style_reference_links), [reference.cover]);
  const writes = calls.filter(call => call.method !== 'GET');
  assert.equal(writes.length, 3);
  assert.equal(writes.every(call => call.method === 'POST'), true);
  assert.equal(writes[1].body.excerpt, 'New');
  assert.equal(writes[1].body.note, '');
  assert.deepEqual(writes[1].body.tags, ['original']);
  assert.equal(writes[2].body.cover, reference.cover);
  assert.equal(writes[1].body.collection.$id, 100);
});

test('copy fetches all pages before writing', async () => {
  const firstPage = Array.from({ length: 50 }, (_, i) => ({ ...reference, _id: 10 + i, title: i ? `reference-${i}.png` : 'preview' }));
  const { save, calls } = harness({ reply: call => call.path.startsWith('/raindrops/4?')
    ? { items: call.path.endsWith('page=0') ? firstPage : [reference] } : undefined });
  assert.equal((await save()).status, 200);
  assert.equal(calls.filter(call => call.path === '/raindrop' && call.method === 'POST').length, 51);
  assert.equal(calls.some(call => call.path.endsWith('page=1')), true);
});

test('rejects arbitrary collection IDs before any mutation', async () => {
  const { save, calls } = harness();
  assert.equal((await save({ source: { id: 999 } })).status, 404);
  assert.equal(calls.every(call => call.method === 'GET'), true);
});

test('legacy loose style edit changes bookmark, not a collection', async () => {
  const { save, calls } = harness();
  const result = await save({ mode: 'edit', source: { id: 30 } });
  assert.equal(result.status, 200);
  assert.equal(result.data.style.id, 30);
  assert.deepEqual(calls.filter(call => call.method !== 'GET').map(call => call.path), ['/raindrop/30']);
});

test('failed copy is reported and its new collection is cleaned up', async () => {
  const { save, calls } = harness({ reply: call => call.path === '/raindrop' ? { result: false, httpError: 429 } : undefined });
  const result = await save();
  assert.equal(result.status, 429);
  assert.equal(result.data.retrySafe, false);
  assert.equal(calls.some(call => call.path === '/collection/100' && call.method === 'DELETE'), true);
});

test('empty collection edit creates a preview and retains cleared extra instructions', async () => {
  const { save, calls } = harness({ reply: call => call.path.startsWith('/raindrops/4?') ? { items: [] } : undefined });
  const result = await save({ mode: 'edit', extra_style_instruction: '' });
  assert.equal(result.status, 200);
  assert.equal(result.data.style.extra_style_instruction, '');
  assert.equal(calls.some(call => call.path === '/raindrop' && call.body.title === 'preview'), true);
});

test('edit updates the original preview and collection without cloning references', async () => {
  const { save, calls } = harness();
  const result = await save({ mode: 'edit' });
  assert.equal(result.status, 200);
  assert.equal(result.data.style.id, 4);
  assert.equal(result.data.style.style_prompt_raindrop_id, '10');
  assert.deepEqual(Array.from(result.data.style.style_reference_links), [reference.cover]);
  assert.deepEqual(calls.filter(call => call.method !== 'GET').map(call => [call.path, call.method]),
    [['/raindrop/10', 'PUT'], ['/collection/4', 'PUT']]);
});

test('rejects blank prompt and oversized name before accessing Raindrop', async () => {
  const { save, calls } = harness();
  assert.equal((await save({ style_prompt: '  ' })).status, 400);
  assert.equal((await save({ title: 'x'.repeat(256) })).status, 400);
  assert.equal(calls.length, 0);
});

const png = () => new File([Buffer.from([137, 80, 78, 71])], 'cover.png', { type: 'image/png' });

test('cover upload is saved before original preview deletion and preserves prompt and tags', async () => {
  const { save, calls } = harness();
  const result = await save({ mode: 'edit', cover: { fileKey: 'coverFile' } }, { coverFile: png() });
  assert.equal(result.status, 200);
  assert.equal(result.data.style.style_prompt_raindrop_id, '100');
  assert.equal(result.data.style.preview_cover, 'https://images.test/upload');
  assert.deepEqual(Array.from(result.data.style.style_reference_links), [reference.cover]);
  const uploadIndex = calls.findIndex(call => call.path === '/raindrop/file');
  const metadataIndex = calls.findIndex(call => call.path === '/raindrop/100');
  const deleteIndex = calls.findIndex(call => call.path === '/raindrop/10' && call.method === 'DELETE');
  assert.ok(uploadIndex >= 0 && metadataIndex > uploadIndex && deleteIndex > metadataIndex);
  assert.equal(calls[uploadIndex].body.get('collectionId'), '4');
  assert.deepEqual(calls[metadataIndex].body.tags, ['original']);
  assert.equal(calls[metadataIndex].body.excerpt, 'New');
});

test('cover removal persists marker and clears cover and media while retaining references', async () => {
  const { save, calls } = harness();
  const result = await save({ mode: 'edit', cover: null });
  assert.equal(result.status, 200);
  assert.equal(result.data.style.preview_cover, '');
  assert.deepEqual(Array.from(result.data.style.style_reference_links), [reference.cover]);
  const metadata = calls.find(call => call.path === '/raindrop/10').body;
  assert.deepEqual(metadata.tags, ['original', 'shower:no-cover']);
  assert.equal(metadata.cover, '');
  assert.deepEqual(metadata.media, []);
});

test('URL cover replacement clears no-cover marker and preserves other tags', async () => {
  const { save, calls } = harness({ reply: call => call.path.startsWith('/raindrops/4?')
    ? { items: [{ ...preview, tags: ['original', 'shower:no-cover'] }, reference] } : undefined });
  const result = await save({ mode: 'edit', cover: 'https://images.test/replaced' });
  assert.equal(result.status, 200);
  assert.equal(result.data.style.preview_cover, 'https://images.test/replaced');
  assert.deepEqual(calls.find(call => call.path === '/raindrop/10').body.tags, ['original']);
});

test('reference replacement retains matched bookmark and uploads before deleting removed bookmark', async () => {
  const secondRef = { ...reference, _id: 12, title: 'reference-2.jpg', cover: 'https://images.test/second' };
  const { save, calls } = harness({ reply: call => call.path.startsWith('/raindrops/4?')
    ? { items: [preview, reference, secondRef] } : undefined });
  const result = await save({ mode: 'edit', references: [secondRef.cover, { fileKey: 'added' }] }, { added: png() });
  assert.equal(result.status, 200);
  assert.deepEqual(Array.from(result.data.style.style_reference_links), [secondRef.cover, 'https://images.test/upload']);
  assert.ok(calls.findIndex(call => call.path === '/raindrop/file') < calls.findIndex(call => call.path === '/raindrop/11' && call.method === 'DELETE'));
  assert.equal(calls.some(call => call.path === '/raindrop/12' && call.method === 'DELETE'), false);
  assert.equal(calls.find(call => call.path === '/raindrop/12').body.title, 'reference-1.jpg');
});

test('clearing references deletes references but preserves unrelated bookmarks and preview', async () => {
  const { save, calls } = harness({ reply: call => call.path.startsWith('/raindrops/4?')
    ? { items: [preview, reference, { _id: 13, title: 'Extra context', link: 'https://context.test' }] } : undefined });
  const result = await save({ mode: 'edit', references: [] });
  assert.equal(result.status, 200);
  assert.deepEqual(Array.from(result.data.style.style_reference_links), []);
  assert.deepEqual(calls.filter(call => call.method === 'DELETE').map(call => call.path), ['/raindrop/11']);
});

test('copy with uploaded cover and references never updates or deletes source bookmarks', async () => {
  const { save, calls } = harness();
  const result = await save({ cover: { fileKey: 'coverFile' }, references: [{ fileKey: 'refFile' }] },
    { coverFile: png(), refFile: png() });
  assert.equal(result.status, 200);
  assert.equal(result.data.style.id, 100);
  assert.equal(calls.some(call => ['/raindrop/10', '/raindrop/11', '/collection/4'].includes(call.path) && call.method !== 'GET'), false);
  assert.equal(calls.filter(call => call.path === '/raindrop/file').every(call => call.body.get('collectionId') === '100'), true);
});

test('failed upload leaves original cover and references intact', async () => {
  const { save, calls } = harness({ reply: call => call.path === '/raindrop/file'
    ? { result: false, httpError: 429 } : undefined });
  const result = await save({ mode: 'edit', cover: { fileKey: 'coverFile' }, references: [] }, { coverFile: png() });
  assert.equal(result.status, 429);
  assert.equal(calls.some(call => call.method === 'DELETE'), false);
  assert.equal(calls.some(call => ['/raindrop/10', '/raindrop/11'].includes(call.path)), false);
});

test('invalid image input is refused before any external requests', async () => {
  const { save, calls } = harness();
  assert.equal((await save({ references: [null] })).status, 400);
  assert.equal((await save({ cover: 'data:image/png;base64,bad' })).status, 400);
  assert.equal((await save({ cover: { fileKey: 'missing' } }, {})).status, 400);
  assert.equal((await save({ cover: { fileKey: 'bad' } }, { bad: new File(['x'], 'text.txt', { type: 'text/plain' }) })).status, 400);
  assert.equal((await save({ references: Array(51).fill('https://images.test/ref') })).status, 400);
  assert.equal(calls.length, 0);
});

test('legacy reference edit converts into collection and deletes loose item only after completed writes', async () => {
  const { save, calls } = harness();
  const result = await save({ mode: 'edit', source: { id: 30 }, references: ['https://images.test/new-reference'] });
  assert.equal(result.status, 200);
  assert.equal(result.data.style.id, 100);
  assert.equal(result.data.style.style_prompt_raindrop_id, '101');
  assert.deepEqual(Array.from(result.data.style.style_reference_links), ['https://images.test/new-reference']);
  assert.equal(calls.find(call => call.path === '/collection').body.parent.$id, 3);
  assert.equal(calls.at(-1).method, 'DELETE');
  assert.equal(calls.at(-1).path, '/raindrop/30');
});

test('fallback reference-as-preview remains a reference when replacing the cover', async () => {
  const { save, calls } = harness({ reply: call => call.path.startsWith('/raindrops/4?')
    ? { items: [reference] } : undefined });
  const result = await save({ mode: 'edit', cover: { fileKey: 'coverFile' }, source: { id: 4 } }, { coverFile: png() });
  assert.equal(result.status, 200);
  assert.deepEqual(Array.from(result.data.style.style_reference_links), [reference.cover]);
  assert.equal(calls.some(call => call.path === '/raindrop/11' && call.method === 'DELETE'), false);
});

test('fallback reference-as-preview can be removed without recreating a removed reference', async () => {
  const { save, calls } = harness({ reply: call => call.path.startsWith('/raindrops/4?')
    ? { items: [reference] } : undefined });
  const result = await save({ mode: 'edit', references: [], source: { id: 4 } });
  assert.equal(result.status, 200);
  assert.deepEqual(Array.from(result.data.style.style_reference_links), []);
  assert.equal(calls.find(call => call.path === '/raindrop' && call.method === 'POST').body.title, 'preview');
  assert.equal(calls.some(call => call.path === '/raindrop/11' && call.method === 'DELETE'), true);
});

test('copy preserves fallback reference-as-preview as independent reference when cover is replaced', async () => {
  const { save, calls } = harness({ reply: call => call.path.startsWith('/raindrops/4?')
    ? { items: [reference] } : undefined });
  const result = await save({ cover: { fileKey: 'coverFile' }, source: { id: 4 } }, { coverFile: png() });
  assert.equal(result.status, 200);
  assert.deepEqual(Array.from(result.data.style.style_reference_links), [reference.cover]);
  assert.equal(calls.some(call => call.path === '/raindrop/11' && call.method !== 'GET'), false);
});

test('oversized uploads are refused before external requests', async () => {
  const { save, calls } = harness();
  const result = await save({ cover: { fileKey: 'large' } }, {
    large: new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
  });
  assert.equal(result.status, 400);
  assert.equal(calls.length, 0);
});

test('later reference upload failure cleans staged cover without deleting original images', async () => {
  let uploadCount = 0;
  const { save, calls } = harness({ reply: call => call.path === '/raindrop/file' && ++uploadCount === 2
    ? { result: false, httpError: 429 } : undefined });
  const result = await save({ mode: 'edit', cover: { fileKey: 'coverFile' }, references: [{ fileKey: 'refFile' }] },
    { coverFile: png(), refFile: png() });
  assert.equal(result.status, 429);
  assert.deepEqual(calls.filter(call => call.method === 'DELETE').map(call => call.path), ['/raindrop/100']);
  assert.equal(calls.some(call => ['/raindrop/10', '/raindrop/11', '/collection/4'].includes(call.path) && call.method !== 'GET'), false);
});

test('loose cover file edit returns new bookmark ID and removes old only after save', async () => {
  const { save, calls } = harness();
  const result = await save({ mode: 'edit', source: { id: 30 }, cover: { fileKey: 'coverFile' } }, { coverFile: png() });
  assert.equal(result.status, 200);
  assert.equal(result.data.style.id, 100);
  assert.equal(calls.find(call => call.path === '/raindrop/file').body.get('collectionId'), '3');
  assert.equal(calls.at(-1).path, '/raindrop/30');
  assert.equal(calls.at(-1).method, 'DELETE');
  assert.equal(calls.some(call => call.path === '/collection'), false);
});

test('failed legacy conversion retains old loose bookmark and cleans only new collection', async () => {
  const { save, calls } = harness({ reply: call => call.path === '/raindrop' && call.body.title.startsWith('reference-')
    ? { result: false, httpError: 429 } : undefined });
  const result = await save({ mode: 'edit', source: { id: 30 }, references: ['https://images.test/new-reference'] });
  assert.equal(result.status, 429);
  assert.deepEqual(calls.filter(call => call.method === 'DELETE').map(call => call.path), ['/collection/100']);
});

test('universal service uploads 6 MB image through injected upstream fetch without framework globals', async () => {
  const { save, calls } = harness();
  const coverFile = new File([new Uint8Array(6 * 1024 * 1024)], 'large.png', { type: 'image/png' });
  const result = await save({ mode: 'edit', cover: { fileKey: 'large' } }, { large: coverFile });
  assert.equal(result.status, 200);
  const upload = calls.find(call => call.path === '/raindrop/file');
  assert.equal(upload.body.get('file').size, coverFile.size);
  assert.equal(upload.headers.Authorization, 'Bearer test-only');
});

test('explicit fallback token supports server requests without body token', async () => {
  const { save, calls } = harness({ fallbackToken: ' server-token ' });
  assert.equal((await save({ token: undefined, mode: 'edit' })).status, 200);
  assert.equal(calls.every(call => call.headers.Authorization === 'Bearer server-token'), true);
});

test('browser service without a token returns actionable error before upstream fetch', async () => {
  const { save, calls } = harness();
  const result = await save({ token: undefined });
  assert.equal(result.status, 400);
  assert.match(result.data.message, /token is missing/i);
  assert.equal(calls.length, 0);
});

test('authorization failure before mutation retains status and safe token refresh retry', async () => {
  const { save, calls } = harness({ reply: call => call.path === '/collections'
    ? { result: false, httpError: 401, errorMessage: 'Do not echo secret test-only' } : undefined });
  const result = await save();
  assert.equal(result.status, 401);
  assert.equal(result.data.retrySafe, true);
  assert.equal(calls.every(call => call.method === 'GET'), true);
  assert.equal(result.data.message.includes('test-only'), false);
});

test('server route passes request, fetch and environment token to universal service', async () => {
  const wrapperCode = ts.transpileModule(fs.readFileSync('src/app/api/raindrop/style/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const req = new Request('https://studio.test/api/raindrop/style', { method: 'POST', body: '{}' });
  const upstream = async () => { throw new Error('Unused'); };
  const response = Response.json({ status: 'success' });
  vm.runInNewContext(wrapperCode, { exports, fetch: upstream, process: { env: { RAINDROP_TOKEN: 'server-only' } },
    require: name => {
      assert.equal(name, '@/lib/saveRaindropStyle');
      return { saveRaindropStyle: (input, injectedFetch, fallbackToken) => {
        assert.equal(input, req);
        assert.equal(injectedFetch, upstream);
        assert.equal(fallbackToken, 'server-only');
        return response;
      } };
    } });
  assert.equal(await exports.POST(req), response);
});

test('plain text 413 upload error preserves status and gives clear message without source mutation', async () => {
  const { save, calls } = harness({ response: call => call.path === '/raindrop/file'
    ? new Response('Request Entity Too Large: private upstream details', { status: 413 }) : undefined });
  const result = await save({ mode: 'edit', cover: { fileKey: 'coverFile' } }, { coverFile: png() });
  assert.equal(result.status, 413);
  assert.equal(result.data.message, 'Raindrop rejected this image upload as too large.');
  assert.equal(result.data.retrySafe, false);
  assert.equal(calls.some(call => call.method === 'DELETE'), false);
  assert.equal(calls.some(call => ['/raindrop/10', '/raindrop/11'].includes(call.path)), false);
});

test('plain text unauthorized response allows refresh before any mutation without echoing response text', async () => {
  const { save } = harness({ response: call => call.path === '/collections'
    ? new Response('Unauthorized token test-only', { status: 401 }) : undefined });
  const result = await save();
  assert.equal(result.status, 401);
  assert.equal(result.data.retrySafe, true);
  assert.equal(result.data.message.includes('test-only'), false);
});

test('HTML success response is rejected with generic 502 error and no HTML or secret text', async () => {
  const { save } = harness({ response: call => call.path === '/collections'
    ? new Response('<html>private upstream token test-only</html>', { status: 200 }) : undefined });
  const result = await save();
  assert.equal(result.status, 502);
  assert.equal(result.data.retrySafe, true);
  assert.equal(result.data.message.includes('test-only'), false);
  assert.equal(result.data.message.includes('<html>'), false);
});
