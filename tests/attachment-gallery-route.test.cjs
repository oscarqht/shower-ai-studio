const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('src/lib/raindropAttachments.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const uploadExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/uploadRaindropAttachment.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: uploadExports, URL });
const image = { _id: 123, type: 'image', file: { name: 'saved.png', type: 'image/png' },
  link: 'https://up.raindrop.io/original.png', cover: 'https://up.raindrop.io/thumb.png', collection: { $id: 76326590 } };
function harness(reply) {
  const exports = {};
  vm.runInNewContext(code, { exports, Response, URL, require: name => {
    assert.equal(name, './uploadRaindropAttachment');
    return uploadExports;
  } });
  const calls = [];
  return { calls, call: async (method = 'GET', body, page = '0', token = 'Bearer header-token', fallbackToken) => {
    const req = new Request(`https://studio.test/api/raindrop/attachments?page=${page}`, {
      method, headers: token ? { Authorization: token } : {}, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const service = method === 'GET' ? exports.listRaindropAttachments : exports.deleteRaindropAttachment;
    const response = await service(req, async (url, init) => {
      const call = { url, ...init }; calls.push(call);
      return reply ? reply(call, calls.length) : Response.json(init.method === 'DELETE' ? { result: true } : method === 'GET' ? { items: [image] } : { item: image });
    }, fallbackToken);
    return { status: response.status, data: await response.json() };
  } };
}
test('lists original uploaded image links, with paginated fixed collection request', async () => {
  const { call, calls } = harness();
  const result = await call('GET', undefined, '2');
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { status: 'success', attachments: [{ id: '123', name: 'saved.png', url: image.link, previewUrl: image.cover }], hasMore: false });
  assert.equal(calls[0].url, 'https://api.raindrop.io/rest/v1/raindrops/76326590?perpage=50&page=2&sort=-created');
  assert.equal(calls[0].headers.Authorization, 'Bearer header-token');
});
test('gallery filters bookmarks, non-images, invalid links and items outside collection', async () => {
  const { call } = harness(() => Response.json({ items: [image, { ...image, _id: 2, file: undefined },
    { ...image, _id: 3, type: 'document', file: { type: 'application/pdf' } }, { ...image, _id: 4, link: 'javascript:bad' },
    { ...image, _id: 5, collection: { $id: 9 } }, { ...image, _id: 6, link: undefined }] }));
  assert.equal((await call()).data.attachments.length, 1);
});
test('hasMore reflects raw page size even when page contains filtered items', async () => {
  const { call } = harness(() => Response.json({ items: Array.from({ length: 50 }, () => ({ ...image, file: undefined })) }));
  const result = await call();
  assert.deepEqual(result.data.attachments, []);
  assert.equal(result.data.hasMore, true);
});
test('invalid page and missing auth fail without upstream access; environment token is supported', async () => {
  const { call, calls } = harness();
  for (const page of ['-1', '1.5', 'abc', '9007199254740992']) assert.equal((await call('GET', undefined, page)).status, 400);
  assert.equal((await call('GET', undefined, '0', null)).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await call('GET', undefined, '0', null, ' env-token ')).status, 200);
  assert.equal(calls[0].headers.Authorization, 'Bearer env-token');
});
test('delete verifies exact item and collection before issuing delete', async () => {
  const { call, calls } = harness();
  assert.deepEqual((await call('DELETE', { id: '123' })).data, { status: 'success', id: '123' });
  assert.deepEqual(calls.map(c => c.method), ['GET', 'DELETE']);
  assert.equal(calls.every(c => c.url === 'https://api.raindrop.io/rest/v1/raindrop/123'), true);
});
test('refuses deletion outside collection, missing collection, wrong item, and non-uploaded images', async () => {
  for (const item of [{ ...image, collection: { $id: 9 } }, { ...image, collection: undefined },
    { ...image, _id: 999 }, { ...image, file: undefined }]) {
    const { call, calls } = harness(() => Response.json({ item }));
    assert.ok((await call('DELETE', { id: '123' })).status >= 400);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'GET');
  }
});
test('invalid delete IDs fail before upstream and body token cannot authorize deletion', async () => {
  const { call, calls } = harness();
  for (const id of [null, 0, -1, '123/evil', {}, '9007199254740992']) assert.equal((await call('DELETE', { id })).status, 400);
  assert.equal((await call('DELETE', { id: '123', token: 'body-token' }, '0', null)).status, 400);
  assert.equal(calls.length, 0);
});
test('upstream errors preserve status without leaking response details and never delete after failed read', async () => {
  for (const response of [new Response('private header-token', { status: 401 }),
    Response.json({ result: false, errorMessage: 'private header-token' }, { status: 403 })]) {
    const { call, calls } = harness(() => response);
    const result = await call('DELETE', { id: 123 });
    assert.ok([401, 403].includes(result.status));
    assert.equal(result.data.message.includes('header-token'), false);
    assert.equal(calls.length, 1);
  }
});
test('failed DELETE does not return success', async () => {
  const { call } = harness((_, n) => Response.json(n === 1 ? { item: image } : { result: false }, { status: n === 1 ? 200 : 429 }));
  const result = await call('DELETE', { id: 123 });
  assert.equal(result.status, 429);
  assert.equal(result.data.status, 'error');
});
test('route GET and DELETE delegate with environment token', async () => {
  const wrapper = ts.transpileModule(fs.readFileSync('src/app/api/raindrop/attachments/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const response = Response.json({ status: 'success' });
  const req = new Request('https://studio.test');
  const upstream = async () => {};
  const delegate = (input, transport, token) => {
    assert.equal(input, req); assert.equal(transport, upstream); assert.equal(token, 'env-token'); return response;
  };
  vm.runInNewContext(wrapper, { exports, fetch: upstream, process: { env: { RAINDROP_TOKEN: 'env-token' } }, require: name =>
    name === '@/lib/raindropAttachments' ? { listRaindropAttachments: delegate, deleteRaindropAttachment: delegate } : {} });
  assert.equal(await exports.GET(req), response);
  assert.equal(await exports.DELETE(req), response);
});

test('DELETE requires explicit upstream success confirmation', async () => {
  for (const reply of [{}, { item: image }]) {
    const { call } = harness((_, n) => Response.json(n === 1 ? { item: image } : reply));
    const result = await call('DELETE', { id: 123 });
    assert.equal(result.status, 502);
    assert.equal(result.data.status, 'error');
    assert.match(result.data.message, /did not confirm.*deletion/);
  }
});

test('gallery falls back from missing or invalid covers to media and original links', async () => {
  for (const [fields, expected] of [
    [{ cover: '', media: [{ link: 'https://files.test/media.png' }] }, 'https://files.test/media.png'],
    [{ cover: 'javascript:bad', media: [null, { link: 'https://token:secret@files.test/a.png' }] }, image.link],
    [{ cover: null, media: {} }, image.link],
  ]) {
    const { call } = harness(() => Response.json({ items: [{ ...image, ...fields }] }));
    const item = (await call()).data.attachments[0];
    assert.equal(item.url, image.link);
    assert.equal(item.previewUrl, expected);
  }
});
