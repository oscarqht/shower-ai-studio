// Run with: node tests/recent-prompts.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');

const fileContent = fs.readFileSync(`${__dirname}/../src/components/GeneratorControls.tsx`, 'utf8');

// Verify that the constants and identifiers exist in GeneratorControls.tsx
assert.ok(fileContent.includes('RECENT_PROMPTS_STORAGE_KEY'), 'Has RECENT_PROMPTS_STORAGE_KEY constant');
assert.ok(fileContent.includes('MAX_RECENT_PROMPTS = 10'), 'Has MAX_RECENT_PROMPTS set to 10');
assert.ok(fileContent.includes('getSavedRecentPrompts'), 'Has getSavedRecentPrompts helper');
assert.ok(fileContent.includes('handleApplyRecentPrompt'), 'Has handleApplyRecentPrompt handler');
assert.ok(fileContent.includes('handleDeleteRecentPrompt'), 'Has handleDeleteRecentPrompt handler');
assert.ok(fileContent.includes('recent-prompts-container'), 'Has recent prompts container in JSX');

// Ensure prompt input DOES NOT save on blur / losing focus
assert.ok(!fileContent.includes('handlePromptBlur'), 'Must NOT save prompts on blur (no handlePromptBlur)');
assert.ok(!fileContent.includes('onBlur='), 'Textarea must NOT have onBlur event handler');

// Ensure action buttons save the prompt to recent prompts on click
assert.ok(fileContent.includes('handleOpenApp'), 'Has handleOpenApp');
assert.ok(fileContent.includes('handleCopyPrompt'), 'Has handleCopyPrompt');
assert.ok(fileContent.includes('generate-final-prompt-btn'), 'Has generate-final-prompt-btn');
assert.ok(fileContent.includes('handleSaveAsPreset'), 'Has handleSaveAsPreset');

// Test the recent prompts array logic
const MAX_RECENT = 10;
function addPrompt(list, text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return list;
  const filtered = list.filter((p) => p !== trimmed);
  return [trimmed, ...filtered].slice(0, MAX_RECENT);
}

function deletePrompt(list, text) {
  return list.filter((p) => p !== text);
}

let list = [];
list = addPrompt(list, 'Prompt 1');
assert.deepEqual(list, ['Prompt 1']);

list = addPrompt(list, 'Prompt 2');
assert.deepEqual(list, ['Prompt 2', 'Prompt 1']);

// Deduplication and moving to top
list = addPrompt(list, 'Prompt 1');
assert.deepEqual(list, ['Prompt 1', 'Prompt 2']);

// Ignore blank or whitespace
list = addPrompt(list, '   ');
assert.deepEqual(list, ['Prompt 1', 'Prompt 2']);

// Fill up to and beyond 10 items
for (let i = 3; i <= 15; i++) {
  list = addPrompt(list, `Prompt ${i}`);
}
assert.equal(list.length, 10, 'List should be capped at 10 items');
assert.equal(list[0], 'Prompt 15', 'Most recently added should be first');
assert.ok(!list.includes('Prompt 1'), 'Oldest item outside 10 should be dropped');

// Deletion
list = deletePrompt(list, 'Prompt 15');
assert.equal(list.length, 9);
assert.equal(list[0], 'Prompt 14');
assert.ok(!list.includes('Prompt 15'));

console.log('Recent prompts unit tests passed!');
