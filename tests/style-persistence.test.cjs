const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { File } = require('node:buffer');

const sourceCode = ts.transpileModule(fs.readFileSync('src/lib/saveRaindropStyle.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

/** Model persisted state separately from successful write responses, never by request echo alone. */
function persistenceHarness({ forceUnsortedUpload = false, ignoreUploadMetadata = false, ignoreUploadMove = false, omitUploadCover = false, hideUploadsFromListing = false, ignoreCloneWrites = false } = {}) {
  const collections = new Map([
    [1, { _id: 1, title: 'Shower' }],
    [2, { _id: 2, title: 'Styles', parent: { $id: 1 } }],
    [4, { _id: 4, title: 'Copied style', parent: { $id: 2 } }],
  ]);
  const preview = { _id: 10, title: 'preview.png', excerpt: 'Old prompt', note: 'Old instructions',
    link: 'https://images.test/old-preview', cover: 'https://images.test/old-preview', collection: { $id: 4 } };
  const reference = { _id: 11, title: 'reference-1.png', link: 'https://images.test/old-reference',
    cover: 'https://images.test/old-reference', collection: { $id: 4 } };
  const bookmarks = new Map([[10, structuredClone(preview)], [11, structuredClone(reference)]]);
  const uploads = new Set();
  const initialUploadCollections = [];
  const calls = [];
  let nextId = 100;
  const upstreamFetch = async (url, init = {}) => {
    const path = url.replace('https://api.raindrop.io/rest/v1', '');
    const method = init.method || 'GET';
    const payload = init.body instanceof FormData ? init.body : init.body ? JSON.parse(init.body) : undefined;
    calls.push({ path, method, payload });
    const json = value => Response.json(structuredClone(value));
    if (path === '/collections' || path === '/collections/childrens') return json({ result: true,
      items: [...collections.values()].filter(item => path === '/collections' ? !item.parent : item.parent) });
    if (path.startsWith('/raindrops/') && method === 'GET') {
      const parsed = new URL(url);
      const collectionId = Number(parsed.pathname.split('/').pop());
      const page = Number(parsed.searchParams.get('page') || 0);
      return json({ result: true, items: [...bookmarks.values()].filter(item => item.collection.$id === collectionId && !(hideUploadsFromListing && uploads.has(item._id))).slice(page * 50, page * 50 + 50) });
    }
    if (path === '/raindrop/file' && method === 'PUT') {
      const id = nextId++;
      // Live Raindrop parser observes destination fields only before the file stream.
      let destination = -1;
      for (const [key, value] of payload.entries()) {
        if (key === 'file') break;
        if (key === 'collectionId') destination = Number(value);
      }
      if (forceUnsortedUpload) destination = -1;
      initialUploadCollections.push(destination);
      const item = { _id: id, title: payload.get('file').name, type: 'image', collection: { $id: destination },
        link: `https://images.test/upload-${id}`, cover: `https://images.test/upload-${id}` };
      if (omitUploadCover) delete item.cover;
      bookmarks.set(id, item);
      uploads.add(id);
      return json({ result: true, item });
    }
    if (path === '/raindrop' && method === 'POST') {
      const id = nextId++;
      const item = ignoreCloneWrites
        ? { _id: id, title: 'Ignored metadata', collection: { $id: -1 }, link: payload.link }
        : { _id: id, ...payload };
      bookmarks.set(id, item);
      // Some APIs acknowledge requested values even if persistence did not apply them.
      return json({ result: true, item: { ...item, ...payload } });
    }
    if (path.startsWith('/raindrop/')) {
      const id = Number(path.split('/').pop());
      const item = bookmarks.get(id);
      if (method === 'GET') return item ? json({ result: true, item }) : new Response('', { status: 404 });
      if (method === 'PUT') {
        const persisted = ignoreUploadMetadata && uploads.has(id)
          ? { ...item, ...(payload.collection ? { collection: payload.collection } : {}) }
          : { ...item, ...payload };
        if (ignoreUploadMove && uploads.has(id)) persisted.collection = item.collection;
        bookmarks.set(id, persisted);
        return json({ result: true, item: { ...persisted, ...payload } });
      }
      if (method === 'DELETE') { bookmarks.delete(id); return json({ result: true }); }
    }
    if (path === '/collection' && method === 'POST') {
      const item = { _id: nextId++, ...payload };
      collections.set(item._id, item);
      return json({ result: true, item });
    }
    if (path.startsWith('/collection/')) {
      const id = Number(path.split('/').pop());
      if (method === 'GET') return json({ result: true, item: collections.get(id) });
      if (method === 'PUT') {
        const item = { ...collections.get(id), ...payload };
        collections.set(id, item);
        return json({ result: true, item });
      }
      if (method === 'DELETE') {
        collections.delete(id);
        for (const [key, item] of bookmarks) if (item.collection.$id === id) bookmarks.delete(key);
        return json({ result: true });
      }
    }
    throw new Error(`Unhandled stateful request: ${method} ${path}`);
  };
  const exports = {};
  vm.runInNewContext(sourceCode, { exports, FormData, URL, Response, console,
    fetch: () => { throw new Error('Use injected upstream fetch'); } });
  const save = async (mode = 'edit') => {
    const form = new FormData();
    form.set('payload', JSON.stringify({ token: 'test-only', source: { id: 4, style_prompt_raindrop_id: 10 }, mode,
      title: 'Updated copy', style_prompt: 'New prompt', extra_style_instruction: 'New instructions',
      ...(mode === 'edit' ? { cover: { fileKey: 'coverFile' }, references: [{ fileKey: 'referenceFile' }] } : {}) }));
    if (mode === 'edit') {
      form.set('coverFile', new File(['cover image'], 'uploaded-cover.png', { type: 'image/png' }));
      form.set('referenceFile', new File(['reference image'], 'uploaded-reference.png', { type: 'image/png' }));
    }
    const response = await exports.saveRaindropStyle(new Request('https://studio.test/api/raindrop/style', {
      method: 'POST', body: form,
    }), upstreamFetch);
    return { status: response.status, data: await response.json() };
  };
  return { save, calls, bookmarks, collections, uploads, initialUploadCollections, preview, reference };
}

test('uploaded preview and reference must actually persist in copied style collection when upload starts in Unsorted', async () => {
  const { save, bookmarks, uploads } = persistenceHarness({ forceUnsortedUpload: true });
  const result = await save();
  assert.equal(result.status, 200, result.data.message);
  const persistedUploads = [...bookmarks.values()].filter(item => uploads.has(item._id) && item.collection.$id === 4);
  assert.equal(persistedUploads.length, 2, 'Reported success while uploaded images remain outside the style collection');
  assert.deepEqual(persistedUploads.map(item => item.title).sort(), ['preview.png', 'reference-1.png']);
});

test('success echoes cannot substitute for persisted upload metadata; original images must remain on verification failure', async () => {
  const { save, bookmarks, preview, reference } = persistenceHarness({ ignoreUploadMetadata: true });
  const result = await save();
  assert.notEqual(result.status, 200, 'Must reject success when read-back shows uploaded names were not saved');
  assert.deepEqual(bookmarks.get(10), preview);
  assert.deepEqual(bookmarks.get(11), reference);
});

test('copy cannot report success for echoed bookmark metadata absent from actual destination collection', async () => {
  const { save, bookmarks, preview, reference } = persistenceHarness({ ignoreCloneWrites: true });
  const result = await save('copy');
  assert.notEqual(result.status, 200, 'Copy success requires authoritative destination membership');
  assert.deepEqual(bookmarks.get(10), preview);
  assert.deepEqual(bookmarks.get(11), reference);
});

test('ignored collection move despite echoed success rejects save and retains existing images', async () => {
  const { save, bookmarks, preview, reference, uploads } = persistenceHarness({ forceUnsortedUpload: true, ignoreUploadMove: true });
  const result = await save();
  assert.equal(result.status, 502);
  assert.match(result.data.message, /style collection/);
  assert.deepEqual(bookmarks.get(10), preview);
  assert.deepEqual(bookmarks.get(11), reference);
  assert.equal([...uploads].some(id => bookmarks.has(id)), false, 'Only staged uploads should be cleaned up');
});

test('documented upload response with link but no cover persists cover and references for later re-sync', async () => {
  const { save, bookmarks } = persistenceHarness({ omitUploadCover: true });
  const result = await save();
  assert.equal(result.status, 200, result.data.message);
  assert.equal(result.data.style.preview_cover, 'https://images.test/upload-100');
  assert.deepEqual(Array.from(result.data.style.style_reference_links), ['https://images.test/upload-101']);
  assert.equal(bookmarks.get(100).cover, bookmarks.get(100).link);
  assert.equal(bookmarks.get(101).cover, bookmarks.get(101).link);
});

test('uploads absent from collection listing reject success before original images are removed', async () => {
  const { save, bookmarks, preview, reference } = persistenceHarness({ hideUploadsFromListing: true });
  const result = await save();
  assert.equal(result.status, 502);
  assert.deepEqual(bookmarks.get(10), preview);
  assert.deepEqual(bookmarks.get(11), reference);
});

test('upload sends collectionId before file so live Raindrop streaming parser places images in destination immediately', async () => {
  const { save, calls, initialUploadCollections } = persistenceHarness();
  const result = await save();
  assert.equal(result.status, 200, result.data.message);
  const uploadCalls = calls.filter(call => call.path === '/raindrop/file');
  assert.equal(uploadCalls.length, 2);
  for (const call of uploadCalls) assert.deepEqual([...call.payload.keys()], ['collectionId', 'file']);
  assert.deepEqual(initialUploadCollections, [4, 4], 'Both files must start in their target collection, before metadata PUT');
});
