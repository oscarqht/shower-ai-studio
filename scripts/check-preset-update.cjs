// Run with: node scripts/check-preset-update.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const filename = require('node:path').resolve('src/app/api/raindrop/preset/[id]/route.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const route = new Module(filename, module);
route.filename = filename;
route.paths = module.paths;
route._compile(compiled, filename);
const { PUT } = route.exports;
const originalFetch = global.fetch;
const originalToken = process.env.RAINDROP_TOKEN;
delete process.env.RAINDROP_TOKEN;
const calls = [];
const existing = { _id: 123, collection: { $id: 456 }, title: 'Original', cover: 'https://example.com/old.png', note: JSON.stringify({ extra: 'keep', character_names: ['Old cast'] }) };
let failUpload = false;
let failUpdate = false;
global.fetch = async (url, options) => {
  calls.push({ url, ...options });
  if (url.endsWith('/cover')) {
    assert.ok(options.body.get('cover') instanceof File);
    return Response.json(failUpload ? { result: false } : { result: true, item: { cover: 'https://example.com/new.png' } }, { status: failUpload ? 400 : 200 });
  }
  if (options.method === 'PUT') {
    return Response.json(failUpdate ? { result: false } : { result: true, item: { ...existing, ...JSON.parse(options.body) } });
  }
  return Response.json({ result: true, item: existing });
};
async function update(fields = {}, image = false, id = '123') {
  const form = new FormData();
  for (const [key, value] of Object.entries({ token: 'test-token', title: 'Edited', prompt: '', model: 'GPT 2.5 Flare', aspectRatio: '16:9', textLanguage: 'English', stylePackName: '', characterNames: '[]', ...fields })) form.append(key, value);
  if (image) form.append('imageFile', new File(['image'], 'cover.png', { type: 'image/png' }));
  const response = await PUT(new NextRequest('http://localhost/api/raindrop/preset/' + id, { method: 'PUT', body: form }), { params: Promise.resolve({ id }) });
  return { status: response.status, data: await response.json() };
}
(async () => {
  let result = await update();
  assert.equal(result.status, 200);
  assert.equal(result.data.preset.id, 123);
  assert.equal(result.data.preset.collection_id, 456);
  assert.equal(result.data.preset.preview_image, existing.cover);
  assert.equal(result.data.preset.prompt, '');
  assert.equal(result.data.preset.style_pack_name, '');
  assert.deepEqual(result.data.preset.character_names, []);
  assert.equal(JSON.parse(result.data.preset.raw_note).extra, 'keep');
  assert.equal(result.data.preset.model, 'GPT 2.5 Flare');
  assert.equal(result.data.preset.aspect_ratio, '16:9');
  assert.equal(result.data.preset.text_language, 'English');
  result = await update({}, true);
  assert.equal(result.data.preset.id, 123);
  assert.equal(result.data.preset.preview_image, 'https://example.com/new.png');
  assert.ok(calls.every((call) => call.url.startsWith('https://api.raindrop.io/rest/v1/raindrop/123')));
  assert.ok(calls.every((call) => !['POST', 'DELETE'].includes(call.method)));
  failUpload = true;
  result = await update({}, true);
  assert.equal(result.status, 400);
  assert.match(result.data.message, /Recipe changes were saved.*thumbnail upload failed/);
  failUpdate = true;
  result = await update();
  assert.equal(result.status, 502);
  const count = calls.length;
  assert.equal((await update({ token: '' })).status, 400);
  assert.equal((await update({ title: ' ' })).status, 400);
  assert.equal((await update({ characterNames: 'broken' })).status, 400);
  assert.equal((await update({ characterNames: '[1]' })).status, 400);
  assert.equal((await update({}, false, 'not-an-id')).status, 400);
  assert.equal(calls.length, count);
  console.log('Preset update checks passed: fields, clearing options, metadata preservation, stable ID, thumbnail upload, and failures.');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = originalFetch;
  if (originalToken !== undefined) process.env.RAINDROP_TOKEN = originalToken;
});
