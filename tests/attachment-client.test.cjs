const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { File } = require('node:buffer');
function load(transport, direct) {
  const output = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/uploadAttachment.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: output, Request, Response, FormData, fetch: transport,
    require: () => ({ uploadRaindropAttachment: direct }) });
  return output.uploadAttachment;
}
const ok = () => Response.json({ status: 'success', url: 'https://up.raindrop.io/original.png', id: '1' });
test('small file goes to Raindrop proxy with original bytes and token', async () => {
  const upload = load(async (url, init) => {
    assert.equal(url, '/api/raindrop/attachments');
    assert.equal(init.body.get('file').size, 3);
    assert.equal(init.body.get('token'), 'test-token');
    return ok();
  });
  assert.equal(await upload(new File(['abc'], 'a.png', {type:'image/png'}), 'test-token'), 'https://up.raindrop.io/original.png');
});
test('large file bypasses hosting body limit; environment-only auth gives useful error', async () => {
  const file = new File([new Uint8Array(4_000_000)], 'a.png', { type: 'image/png' });
  const upload = load(() => assert.fail('must bypass proxy'), async request => {
    const form = await request.formData();
    assert.equal(form.get('file').size, file.size);
    assert.equal(form.get('token'), 'test-token');
    return ok();
  });
  assert.equal(await upload(file, 'test-token'), 'https://up.raindrop.io/original.png');
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
