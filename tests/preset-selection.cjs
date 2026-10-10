// Run with: node tests/preset-selection.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.createSourceFile('page.tsx', fs.readFileSync(`${__dirname}/../src/app/page.tsx`, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handleSelectPreset') handler = node.initializer.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(handler, 'Preset selection handler exists');
const code = ts.transpile(`const select = ${handler};`, { target: ts.ScriptTarget.ES2022 });

function select(preset, selectedPresetId = 'old') {
  const state = { selectedPresetId, compositionPrompt: 'Old prompt', model: 'Old model', aspectRatio: 'Old ratio', textLanguage: 'Old language', selectedCharacterIds: [2], selectedAddOnsByCharacterId: { 1: ['Hat'], 2: ['Coat'] }, selectedStyleId: 10 };
  const context = {
    selectedPresetId,
    characters: [{ id: 1, title: 'Alice' }, { id: 2, title: 'Bob' }],
    styles: [{ id: 10, title: 'Watercolor' }],
    moreStyles: [{ id: 11, title: 'Ink' }],
  };
  for (const key of Object.keys(state)) context[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value) => { state[key] = value; };
  vm.runInNewContext(`${code}\nselect(${JSON.stringify(preset)});`, context);
  return JSON.parse(JSON.stringify(state));
}

const empty = { selectedPresetId: null, compositionPrompt: '', model: 'GPT 2.5 Sunburst', aspectRatio: 'Auto', textLanguage: 'Auto', selectedCharacterIds: [], selectedAddOnsByCharacterId: {}, selectedStyleId: null };
assert.deepEqual(select({ id: 'empty', prompt: '' }), { ...empty, selectedPresetId: 'empty' });
assert.deepEqual(select(null), empty);
assert.deepEqual(select({ id: 'old', prompt: 'Ignored' }), empty);
assert.deepEqual(select({ id: 'full', prompt: 'New prompt', model: 'Gemini 3.1 Flash', aspect_ratio: '16:9', text_language: 'English', character_names: [' alice ', 'Alice'], style_pack_name: ' ink ' }), {
  selectedPresetId: 'full', compositionPrompt: 'New prompt', model: 'Gemini 3.1 Flash', aspectRatio: '16:9', textLanguage: 'English', selectedCharacterIds: [1], selectedAddOnsByCharacterId: {}, selectedStyleId: 11,
});
assert.deepEqual(select({ id: 'missing', prompt: '', character_names: ['Missing'], style_pack_name: 'Missing' }), { ...empty, selectedPresetId: 'missing' });
assert.deepEqual(select({ id: 'blank', prompt: '', character_names: [' '], style_pack_name: ' ' }), { ...empty, selectedPresetId: 'blank' });
console.log('Preset selection checks passed');
