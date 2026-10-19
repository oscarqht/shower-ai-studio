const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { File } = require('node:buffer');
const exportsObject = {};
const source = { id: 4, title: 'Original', style_prompt_raindrop_id: '10', preview_cover: 'https://images.test/cover', style_reference_links: ['https://images.test/ref'] };
const fields = { title: 'Edited', style_prompt: 'Prompt', extra_style_instruction: '' };
const saved = { ...source, ...fields };
const ok = () => Response.json({ status: 'success', style: saved });
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/saveStyle.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject, Request, Response, FormData, Blob, fetch, require: name => {
  assert.equal(name, './saveRaindropStyle');
  return { saveRaindropStyle: () => { throw new Error('Unexpected default direct save'); } };
} });
const { saveStyle, readStyleSaveResponse } = exportsObject;
const file = (size) => new File([new Uint8Array(size)], 'reference.png', { type: 'image/png' });

test('plain Request Entity Too Large response produces an actionable error, not a JSON parser exception', async () => {
  const response = await readStyleSaveResponse(new Response('Request Entity Too Large', { status: 413 }));
  assert.match(response.message, /too large/i);
  assert.equal(response.payloadRejected, true);
});

test('HTML gateway errors include HTTP status without exposing HTML', async () => {
  await assert.rejects(readStyleSaveResponse(new Response('<html>Bad Gateway</html>', { status: 502 })), /HTTP 502.*invalid response/);
});

test('small save uses proxy and sends only source identifiers', async () => {
  let calls = 0;
  const result = await saveStyle(source, 'edit', fields, { token: 'test-only', transport: async (url, init) => {
    calls++;
    assert.equal(url, '/api/raindrop/style');
    const body = JSON.parse(init.body);
    assert.deepEqual(body.source, { id: 4, style_prompt_raindrop_id: '10' });
    assert.equal(body.mode, 'edit');
    return ok();
  } });
  assert.equal(result.title, 'Edited');
  assert.equal(calls, 1);
});

test('combined image size bypasses hosting proxy without changing image bytes', async () => {
  let directCalls = 0;
  const uploads = { first: file(2_000_000), second: file(2_000_000) };
  await saveStyle(source, 'edit', { ...fields, references: [{ fileKey: 'first' }, { fileKey: 'second' }], imageFiles: uploads }, {
    token: 'test-only', transport: async () => { throw new Error('Image request must not hit hosting proxy'); },
    directSave: async (request) => {
      directCalls++;
      const form = await request.formData();
      assert.equal(form.get('first').size, 2_000_000);
      assert.equal(form.get('second').size, 2_000_000);
      assert.equal(JSON.parse(form.get('payload')).token, 'test-only');
      return ok();
    },
  });
  assert.equal(directCalls, 1);
});

test('large saves with only a server token fail before sending image bytes', async () => {
  await assert.rejects(saveStyle(source, 'edit', { ...fields, cover: { fileKey: 'cover' }, imageFiles: { cover: file(5_000_000) } }, {
    token: '', transport: async () => { throw new Error('Must not send oversized proxy request'); },
  }), /Connect Raindrop in Settings/);
});

test('plain proxy 413 retries once through direct save when a browser token is available', async () => {
  let proxy = 0, direct = 0;
  await saveStyle(source, 'edit', fields, { token: 'test-only',
    transport: async () => { proxy++; return new Response('Request Entity Too Large', { status: 413 }); },
    directSave: async () => { direct++; return ok(); },
  });
  assert.equal(proxy, 1);
  assert.equal(direct, 1);
});

test('upstream JSON 413 with partial mutations is never retried', async () => {
  let direct = 0;
  await assert.rejects(saveStyle(source, 'edit', fields, { token: 'test-only',
    transport: async () => Response.json({ status: 'error', retrySafe: false, message: 'Raindrop upload too large' }, { status: 413 }),
    directSave: async () => { direct++; return ok(); },
  }), /Raindrop upload too large/);
  assert.equal(direct, 0);
});

test('safe expired-token failure refreshes once and resends with new token', async () => {
  const tokens = [];
  await saveStyle(source, 'edit', fields, { token: 'expired-test', refreshToken: async () => 'refreshed-test',
    transport: async (_url, init) => {
      const token = JSON.parse(init.body).token;
      tokens.push(token);
      return token === 'expired-test' ? Response.json({ status: 'error', retrySafe: true }, { status: 401 }) : ok();
    },
  });
  assert.deepEqual(tokens, ['expired-test', 'refreshed-test']);
});

test('unsafe expired-token failure does not refresh or repeat a save', async () => {
  let refresh = 0;
  await assert.rejects(saveStyle(source, 'edit', fields, { token: 'test-only', refreshToken: async () => { refresh++; return 'new-test'; },
    transport: async () => Response.json({ status: 'error', retrySafe: false, message: 'Partial save' }, { status: 401 }),
  }), /Partial save/);
  assert.equal(refresh, 0);
});

test('invalid success response cannot be mistaken for saved changes', async () => {
  await assert.rejects(saveStyle(source, 'edit', fields, { token: 'test-only', transport: async () => Response.json({ status: 'success' }) }), /Could not save style/);
});
