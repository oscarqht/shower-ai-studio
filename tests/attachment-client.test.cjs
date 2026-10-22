const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { File } = require('node:buffer');
function load(transport, direct, exported = 'uploadAttachment') {
  const output = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/uploadAttachment.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: output, Request, Response, FormData, fetch: transport,
    require: () => ({ uploadRaindropAttachment: direct }) });
  return output[exported];
}
const ok = () => Response.json({ status: 'success', url: 'https://up.raindrop.io/original.png', id: '1' });
test('small file goes to Raindrop proxy with original bytes and token', async () => {
  const upload = load(async (url, init) => {
    assert.equal(url, '/api/raindrop/attachments');
    assert.equal(init.body.get('file').size, 3);
    assert.equal(init.body.get('token'), 'test-token');
    return ok();
  });
  assert.deepEqual(JSON.parse(JSON.stringify(await upload(new File(['abc'], 'a.png', {type:'image/png'}), 'test-token'))), {id:'1',name:'a.png',url:'https://up.raindrop.io/original.png'});
});
test('large file bypasses hosting body limit; environment-only auth gives useful error', async () => {
  const file = new File([new Uint8Array(4_000_000)], 'a.png', { type: 'image/png' });
  const upload = load(() => assert.fail('must bypass proxy'), async request => {
    const form = await request.formData();
    assert.equal(form.get('file').size, file.size);
    assert.equal(form.get('token'), 'test-token');
    return ok();
  });
  assert.equal((await upload(file, 'test-token')).url, 'https://up.raindrop.io/original.png');
  await assert.rejects(upload(file, ''), /Connect Raindrop/);
});
test('safe 401 refreshes once; ambiguous failure is never retried', async () => {
  let calls = 0;
  const upload = load(async (_url, init) => {
    calls++;
    if (calls === 1) return Response.json({message:'expired', retrySafe:true}, {status:401});
    assert.equal(init.body.get('token'), 'renewed');
    return ok();
  });
  await upload(new File(['abc'], 'a.png'), 'old', async () => 'renewed');
  assert.equal(calls, 2);
  const fail = load(async () => Response.json({message:'unknown outcome', retrySafe:false}, {status:502}));
  await assert.rejects(fail(new File(['abc'], 'a.png'), 'old', () => assert.fail('no refresh')), /unknown outcome/);
});

test('gallery pagination uses header auth and safe token refresh', async () => {
  let calls = 0;
  const request = load(async (url, init) => {
    calls++;
    assert.equal(url, '/api/raindrop/attachments?page=2');
    assert.equal(init.method, 'GET');
    assert.equal(init.cache, 'no-store');
    if (calls === 1) return Response.json({status:'error'}, {status:401});
    assert.equal(init.headers.Authorization, 'Bearer renewed');
    return Response.json({status:'success',attachments:[{id:'1',name:'a.png',url:'https://files.test/a.png'}],hasMore:true});
  }, undefined, 'attachmentLibraryRequest');
  const data = await request('old', {page:2}, async () => 'renewed');
  assert.equal(data.attachments.length, 1);
  assert.equal(data.hasMore, true);
  assert.equal(calls, 2);
});
test('gallery deletion sends ID only and reports failed deletion', async () => {
  const request = load(async (url, init) => {
    assert.equal(url, '/api/raindrop/attachments');
    assert.equal(init.method, 'DELETE');
    assert.deepEqual(JSON.parse(init.body), {id:'123'});
    assert.equal(init.headers.Authorization, undefined);
    return Response.json({status:'error',message:'Deletion failed'}, {status:502});
  }, undefined, 'attachmentLibraryRequest');
  await assert.rejects(request('', {id:'123'}), /Deletion failed/);
});
