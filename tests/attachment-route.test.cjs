const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { File } = require('node:buffer');
const code = ts.transpileModule(fs.readFileSync('src/lib/uploadRaindropAttachment.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const png = () => new File(['image bytes'], 'reference.png', { type: 'image/png' });
function harness(reply = () => Response.json({ result: true, item: {
  _id: 123, link: 'https://files.test/original.png', cover: 'https://files.test/thumbnail.png', collection: { $id: 76326590 },
} })) {
  const exports = {};
  vm.runInNewContext(code, { exports, Response, Request, FormData, URL });
  const calls = [];
  return { calls, upload: async ({ file = png(), token = 'test-token', authorization, fallbackToken } = {}) => {
    const form = new FormData();
    if (file !== null) form.append('file', file);
    if (token !== null) form.set('token', token);
    const req = new Request('https://studio.test/api/raindrop/attachments', {
      method: 'POST', body: form, headers: authorization ? { Authorization: authorization } : {},
    });
    const response = await exports.uploadRaindropAttachment(req, async (url, init) => {
      calls.push({ url, ...init });
      return reply(calls.at(-1));
    }, fallbackToken);
    return { status: response.status, data: await response.json() };
  }, service: exports.uploadRaindropAttachment };
}

test('uploads original file into fixed collection and returns original public link, not thumbnail', async () => {
  const { upload, calls } = harness();
  const result = await upload();
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { status: 'success', url: 'https://files.test/original.png', id: '123' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.raindrop.io/rest/v1/raindrop/file');
  assert.equal(calls[0].method, 'PUT');
  assert.deepEqual({ ...calls[0].headers }, { Authorization: 'Bearer test-token' });
  assert.deepEqual(Array.from(calls[0].body.keys()), ['collectionId', 'file']);
  assert.equal(calls[0].body.get('collectionId'), '76326590');
  assert.equal(await calls[0].body.get('file').text(), 'image bytes');
  assert.equal(calls[0].body.get('file').name, 'reference.png');
});

test('rejects missing, empty, non-image, and over-limit files before contacting Raindrop', async () => {
  const { upload, calls } = harness();
  for (const file of [null, '', new File([], 'empty.png', { type: 'image/png' }),
    new File(['text'], 'text.txt', { type: 'text/plain' }),
    new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })]) {
    assert.equal((await upload({ file })).status, 400);
  }
  assert.equal(calls.length, 0);
});

test('shared service supports a large file directly without framework globals', async () => {
  const { upload, calls } = harness();
  const file = new File([new Uint8Array(6 * 1024 * 1024)], 'large.webp', { type: 'image/webp' });
  assert.equal((await upload({ file })).status, 200);
  assert.equal(calls[0].body.get('file').size, file.size);
});

test('missing token is actionable and body, bearer and environment tokens follow priority', async () => {
  const { upload, calls } = harness();
  const missing = await upload({ token: null });
  assert.equal(missing.status, 400);
  assert.match(missing.data.message, /token is missing/i);
  assert.equal(calls.length, 0);
  await upload({ token: ' body-token ', authorization: 'Bearer header-token', fallbackToken: 'env-token' });
  await upload({ token: null, authorization: 'Bearer header-token', fallbackToken: 'env-token' });
  await upload({ token: null, fallbackToken: ' env-token ' });
  assert.deepEqual(calls.map(call => call.headers.Authorization), ['Bearer body-token', 'Bearer header-token', 'Bearer env-token']);
});

test('authorization rejection allows refresh and never exposes upstream response text', async () => {
  for (const reply of [() => new Response('private test-token', { status: 401 }),
    () => Response.json({ result: false, errorMessage: 'private test-token' }, { status: 401 })]) {
    const result = await harness(reply).upload();
    assert.equal(result.status, 401);
    assert.equal(result.data.retrySafe, true);
    assert.equal(result.data.message.includes('test-token'), false);
  }
});

test('plain 413 is reported without leaking upstream details', async () => {
  const result = await harness(() => new Response('private upstream details', { status: 413 })).upload();
  assert.equal(result.status, 413);
  assert.equal(result.data.message, 'Raindrop rejected this image upload as too large.');
});

test('rejects missing download URL, unsafe URLs, and unexpected destination instead of using cover', async () => {
  for (const item of [
    { _id: 1, cover: 'https://files.test/thumbnail.png' },
    { _id: 1, link: 'data:image/png;base64,bad' },
    { _id: 1, link: 'https://token:secret@files.test/image.png' },
    { link: 'https://files.test/image.png' },
    { _id: 1, link: 'https://files.test/image.png', collection: { $id: 9 } },
  ]) {
    const result = await harness(() => Response.json({ result: true, item })).upload();
    assert.equal(result.status, 502);
    assert.equal(result.data.retrySafe, false);
    assert.equal(result.data.url, undefined);
  }
});

test('ambiguous network and invalid success failures avoid claiming a safe upload retry', async () => {
  for (const reply of [() => { throw new Error('private token test-token'); },
    () => new Response('<html>private token test-token</html>'),
    () => Response.json({ result: false })]) {
    const result = await harness(reply).upload();
    assert.equal(result.status, 502);
    assert.equal(result.data.retrySafe, false);
    assert.equal(result.data.message.includes('test-token'), false);
  }
});

test('non-multipart requests are rejected before external requests', async () => {
  const { service } = harness();
  const response = await service(new Request('https://studio.test', { method: 'POST', body: '{}' }),
    async () => { throw new Error('Must not request Raindrop'); });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).retrySafe, true);
});

test('server route injects upstream transport and environment token', async () => {
  const wrapper = ts.transpileModule(fs.readFileSync('src/app/api/raindrop/attachments/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const req = new Request('https://studio.test', { method: 'POST' });
  const response = Response.json({ status: 'success' });
  const upstream = async () => { throw new Error('Unused'); };
  vm.runInNewContext(wrapper, { exports, fetch: upstream, process: { env: { RAINDROP_TOKEN: 'server-only' } }, require: name => {
    assert.equal(name, '@/lib/uploadRaindropAttachment');
    return { uploadRaindropAttachment: (input, injectedFetch, fallbackToken) => {
      assert.equal(input, req);
      assert.equal(injectedFetch, upstream);
      assert.equal(fallbackToken, 'server-only');
      return response;
    } };
  } });
  assert.equal(await exports.POST(req), response);
});
