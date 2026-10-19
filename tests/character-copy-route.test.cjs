const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { File } = require('node:buffer');
const transpile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sourceCode = transpile('src/app/api/raindrop/character/route.ts');
const noteModule = { exports: {} };
vm.runInNewContext(transpile('src/lib/characterNote.ts'), { exports: noteModule.exports });
const original = { _id: 30, title: 'Original', excerpt: 'Identity',
  note: '{ "tags": "cat", "add_ons": ["hat"], "unknown": {"keep": true} }',
  tags: ['cat', 'private'], link: 'https://images.test/original-file', cover: 'https://images.test/cover',
  media: [{ link: 'https://images.test/cover' }, { link: 'https://images.test/second' }], type: 'image',
  important: true, collection: { $id: 2 } };
const collections = [{ _id: 1, title: 'Shower' }, { _id: 2, title: 'Characters', parent: { $id: 1 } }];
function harness(overrides = {}) {
  const calls = [];
  const records = new Map([[30, structuredClone({ ...original, ...overrides.source })]]);
  let nextId = 100;
  const exports = {};
  const fetch = async (url, init) => {
    const path = url.replace('https://api.raindrop.io/rest/v1', '');
    const call = { path, method: init.method || 'GET', body: init.body instanceof FormData ? init.body : init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    let data = overrides.reply?.(call);
    if (data === undefined) {
      if (path === '/collections') data = { result: true, items: collections };
      else if (path === '/collections/childrens') data = { result: true, items: [] };
      else if (path === '/raindrop/file') {
        const item = { _id: nextId++, link: 'https://images.test/uploaded', cover: 'https://images.test/uploaded', type: 'image',
          collection: { $id: Number(call.body.get('collectionId')) } };
        records.set(item._id, item);
        data = { result: true, item };
      } else if (path === '/raindrop' && call.method === 'POST') {
        // Simulate a provider that upserts when creating the exact same link.
        const duplicate = [...records.values()].find(item => item.link === call.body.link);
        const item = { ...(duplicate || { _id: nextId++ }), ...call.body };
        records.set(item._id, item);
        data = { result: true, item };
      } else if (path.startsWith('/raindrop/')) {
        const id = Number(path.split('/').pop());
        if (call.method === 'GET') data = records.has(id) ? { result: true, item: records.get(id) } : { result: false, httpError: 404 };
        else if (call.method === 'PUT') {
          assert.notEqual(id, 30, 'Source must never be updated');
          const item = { ...records.get(id), ...call.body };
          records.set(id, item);
          data = { result: true, item };
        } else if (call.method === 'DELETE') {
          assert.notEqual(id, 30, 'Source must never be deleted');
          records.delete(id);
          data = { result: true };
        }
      } else throw new Error(`Unexpected request ${call.method} ${path}`);
    }
    return { ok: !data.httpError, status: data.httpError || 200,
      json: async () => structuredClone(data), text: async () => JSON.stringify(data) };
  };
  vm.runInNewContext(sourceCode, { exports, require: name => {
    if (name === '@/lib/characterNote') return noteModule.exports;
    if (name === 'node:crypto') return require(name);
    assert.equal(name, 'next/server');
    return { NextResponse: { json: (data, options = {}) => ({ data, status: options.status || 200 }) } };
  }, fetch, FormData, process: { env: {} }, console });
  return { calls, records, save: async (fields = {}, uploads) => {
    const body = { token: 'test-only', sourceId: 30, ...fields };
    let form;
    if (uploads) {
      form = new FormData();
      for (const [key, value] of Object.entries(body)) if (value !== undefined) form.set(key, String(value));
      for (const [key, file] of Object.entries(uploads)) form.set(key, file);
    }
    return exports.POST({ json: async () => body, formData: async () => form,
      headers: new Headers(form ? { 'content-type': 'multipart/form-data; boundary=test' } : {}) });
  } };
}

test('copy inherits full source images, link, tags, raw note and independent ID even with duplicate-upsert provider', async () => {
  const { save, records, calls } = harness();
  const result = await save({ title: 'My copy' });
  assert.equal(result.status, 200);
  assert.equal(result.data.character.id, 100);
  assert.equal(result.data.character.link, original.link);
  assert.equal(result.data.character.note, original.note);
  assert.equal(result.data.character.cover, original.cover);
  assert.deepEqual(records.get(100).media, original.media);
  assert.deepEqual(records.get(100).tags, original.tags);
  assert.equal(records.get(100).important, true);
  assert.deepEqual(records.get(30), original);
  assert.notEqual(calls.find(call => call.path === '/raindrop' && call.method === 'POST').body.link, original.link);
});

test('edited tags and add-ons merge with unknown source note metadata', async () => {
  const { save, records } = harness();
  const result = await save({ title: 'Modified', excerpt: '', note: JSON.stringify({ tags: '', add_ons: ['scarf'] }) });
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(result.data.character.note), { tags: '', add_ons: ['scarf'], unknown: { keep: true } });
  assert.deepEqual(records.get(100).tags, []);
  assert.equal(result.data.character.excerpt, '');
  assert.deepEqual(Array.from(result.data.character.addOns), ['scarf']);
  assert.deepEqual(records.get(30), original);
});

test('multipart file replacement saves uploaded image and preserves source without fallback creation', async () => {
  const { save, records, calls } = harness();
  const imageFile = new File([Buffer.from([137, 80, 78, 71])], 'new.png', { type: 'image/png' });
  const result = await save({ title: 'New image', note: JSON.stringify({ tags: 'dog', add_ons: [] }) }, { imageFile });
  assert.equal(result.status, 200);
  assert.equal(result.data.character.cover, 'https://images.test/uploaded');
  assert.equal(result.data.character.link, 'https://images.test/uploaded');
  assert.deepEqual(records.get(100).tags, ['dog']);
  assert.deepEqual(records.get(30), original);
  assert.equal(calls.some(call => call.path === '/raindrop' && call.method === 'POST'), false);
});

test('unchanged submitted cover retains source media collection and original link', async () => {
  const { save, records } = harness();
  assert.equal((await save({ cover: original.cover })).status, 200);
  assert.deepEqual(records.get(100).media, original.media);
  assert.equal(records.get(100).link, original.link);
});

test('replacement cover URL changes cover and media while retaining source link', async () => {
  const { save, records } = harness();
  assert.equal((await save({ cover: 'https://images.test/new-cover' })).status, 200);
  assert.equal(records.get(100).cover, 'https://images.test/new-cover');
  assert.deepEqual(records.get(100).media, [{ link: 'https://images.test/new-cover' }]);
  assert.equal(records.get(100).link, original.link);
});

test('missing and out-of-scope source are refused before mutations', async () => {
  const missing = harness();
  assert.equal((await missing.save({ sourceId: 999 })).status, 404);
  assert.equal(missing.calls.every(call => call.method === 'GET'), true);
  const outside = harness({ source: { collection: { $id: 999 } } });
  assert.equal((await outside.save()).status, 404);
  assert.equal(outside.calls.every(call => call.method === 'GET'), true);
});

test('failed upload never falls back to another bookmark create', async () => {
  const { save, calls, records } = harness({ reply: call => call.path === '/raindrop/file' ? { result: false, httpError: 429 } : undefined });
  const imageFile = new File(['data'], 'new.png', { type: 'image/png' });
  const result = await save({}, { imageFile });
  assert.equal(result.status, 429);
  assert.equal(result.data.retrySafe, false);
  assert.equal(calls.some(call => call.path === '/raindrop'), false);
  assert.deepEqual(records.get(30), original);
});

test('failed metadata update cleans only staged new upload and returns an error', async () => {
  const { save, calls, records } = harness({ reply: call => call.path === '/raindrop/100' && call.method === 'PUT'
    ? { result: false, httpError: 401 } : undefined });
  const imageFile = new File(['data'], 'new.png', { type: 'image/png' });
  const result = await save({}, { imageFile });
  assert.equal(result.status, 401);
  assert.deepEqual(calls.filter(call => call.method === 'DELETE').map(call => call.path), ['/raindrop/100']);
  assert.equal(records.has(100), false);
  assert.deepEqual(records.get(30), original);
});

test('invalid source ID and image type are refused before requests', async () => {
  const { save, calls } = harness();
  assert.equal((await save({ sourceId: '../30' })).status, 400);
  assert.equal((await save({}, { imageFile: new File(['x'], 'x.txt', { type: 'text/plain' }) })).status, 400);
  assert.equal(calls.length, 0);
});

test('regular add without sourceId retains existing create behavior', async () => {
  const { save, calls } = harness();
  const result = await save({ sourceId: undefined, title: 'Fresh character', excerpt: 'New identity',
    note: JSON.stringify({ tags: 'new', add_ons: [] }), cover: 'https://images.test/fresh' });
  assert.equal(result.status, 200);
  assert.equal(result.data.character.title, 'Fresh character');
  assert.equal(calls.filter(call => call.path === '/raindrop' && call.method === 'POST').length, 1);
  assert.equal(calls.some(call => call.path === '/raindrop/30'), false);
  assert.equal(calls.some(call => call.method === 'PUT'), false);
});
