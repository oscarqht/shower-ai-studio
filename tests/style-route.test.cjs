const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const sourceCode = ts.transpileModule(fs.readFileSync('src/app/api/raindrop/style/route.ts', 'utf8'), {
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
    const call = { path, method: init.method, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    let data = overrides.reply?.(call, calls);
    if (data === undefined) {
      if (path === '/collections') data = { items: collections };
      else if (path === '/collections/childrens') data = { items: [] };
      else if (path.startsWith('/raindrops/4?')) data = { items: [preview, reference] };
      else if (path.startsWith('/raindrops/3?')) data = { items: [{ ...preview, _id: 30, title: 'Loose', collection: { $id: 3 } }] };
      else if (call.method === 'POST' || call.method === 'PUT') data = { result: true, item: { _id: call.method === 'PUT' ? Number(path.split('/').pop()) : nextId++, ...call.body } };
      else if (call.method === 'DELETE') data = { result: true };
      else throw new Error(`Unexpected request ${path}`);
    }
    return { ok: !data.httpError, status: data.httpError || 200, json: async () => data };
  };
  vm.runInNewContext(sourceCode, { exports, require: name => {
    assert.equal(name, 'next/server');
    return { NextResponse: { json: (data, options = {}) => ({ data, status: options.status || 200 }) } };
  }, fetch, process: { env: {} }, console });
  return { calls, save: async (fields = {}) => exports.POST({ json: async () => ({
    token: 'test-only', source: { id: 4, style_prompt_raindrop_id: 10 }, mode: 'copy',
    title: 'Changed', style_prompt: 'New', extra_style_instruction: '', ...fields,
  }), headers: new Headers() }) };
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
