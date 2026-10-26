const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function hooks(initial = []) {
  const state = [...initial];
  let index = 0;
  const effects = [];
  return {
    react: { ...React, useState: value => {
      const key = index++;
      if (!(key in state)) state[key] = value;
      return [state[key], update => { state[key] = typeof update === 'function' ? update(state[key]) : update; }];
    }, useEffect: effect => effects.push(effect), useCallback: callback => callback, useRef: value => ({ current: value }) },
    render(component, props) { index = 0; effects.length = 0; return component(props); }, effects,
  };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}
const item = { id: '123', name: 'saved.jpg', url: 'https://files.test/original.jpg', previewUrl: 'https://files.test/cover.jpg' };
function gallery() {
  const runner = hooks([[item], []]);
  let activeRunner = runner;
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/AttachmentUploader.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, require: name => {
    if (name === 'react') return new Proxy(runner.react, { get: (_, key) => activeRunner.react[key] });
    if (name === 'react/jsx-runtime') return require(name);
    return {};
  } });
  const changes = [];
  const props = { token: 'token', onChange: urls => changes.push([...urls]), onBusyChange() {} };
  const render = () => { activeRunner = runner; return runner.render(exports.AttachmentUploader, props); };
  return { runner, changes, render, previewRunner() { activeRunner = hooks(); return activeRunner; } };
}

test('gallery displays preview without a referrer and keeps original URLs in selected payloads', () => {
  const { runner, changes, render, previewRunner } = gallery();
  const tree = render();
  const preview = find(tree, node => node.props?.item === item);
  const imageRunner = previewRunner();
  const image = imageRunner.render(preview.type, preview.props);
  assert.equal(image.props.src, item.previewUrl);
  assert.equal(image.props.referrerPolicy, 'no-referrer');
  find(tree, node => node.type === 'input' && node.props.type === 'checkbox').props.onChange();
  render();
  runner.effects[1]();
  assert.deepEqual(changes, [[item.url]]);
});

test('failed thumbnail falls back once to original, then shows an unavailable message', () => {
  const { render, previewRunner } = gallery();
  const preview = find(render(), node => node.props?.item === item);
  const runner = previewRunner();
  let image = runner.render(preview.type, preview.props);
  image.props.onError();
  image = runner.render(preview.type, preview.props);
  assert.equal(image.props.src, item.url);
  image.props.onError();
  const unavailable = runner.render(preview.type, preview.props);
  assert.equal(unavailable.type, 'span');
  assert.equal(unavailable.props.children, 'Preview unavailable');
});

test('legacy attachments without a preview URL still display the original', () => {
  const { render, previewRunner } = gallery();
  const preview = find(render(), node => node.props?.item === item);
  const runner = previewRunner();
  const props = { item: { ...item, previewUrl: undefined } };
  const image = runner.render(preview.type, props);
  assert.equal(image.props.src, item.url);
  image.props.onError();
  assert.equal(runner.render(preview.type, props).props.children, 'Preview unavailable');
});
