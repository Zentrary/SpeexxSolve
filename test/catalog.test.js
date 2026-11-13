const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deduplicateLegacy } = require('../server/catalog');
const data = require('../server/data.json');

test('duplicate legacy imports are suppressed while the richer original content is preserved', () => {
  const items = deduplicateLegacy(data.items);
  assert.equal(new Set(data.items.map(i => i.id)).size, data.items.length);
  assert.equal(data.items.length - items.length, 133);
  assert.ok(!items.some(i => i.id === 'C1.2-72-7'));
  assert.ok(items.some(i => i.id === 'C1.2-66-2'));
  assert.ok(!items.some(i => i.id === 'C1.1-72-46'));
  assert.equal(items.find(i => i.id === 'C1.1-63-0').body, data.items.find(i => i.id === 'C1.1-72-46').body);
  assert.ok(items.some(i => i.id === 'A1-17-0')); // Unmatched legacy entries remain searchable.
});
test('similar but ambiguous or conflicting pages are never removed', () => {
  const item = {chapter:'A1', title:'Title', prompt:'Prompt', answerType:'answer', answers:['one'], body:'A sufficiently long body for matching', exercise:'Lesson'};
  const legacy = {...item, id:'legacy', exercise:'Imported answers (legacy)', body:'A sufficiently long body'};
  assert.equal(deduplicateLegacy([item, legacy]).length, 1);
  assert.equal(deduplicateLegacy([item, {...legacy, answers:['different']}]).length, 2);
  assert.equal(deduplicateLegacy([item, {...legacy, chapter:'A2'}]).length, 2);
  assert.equal(deduplicateLegacy([item, {...legacy, body:'short'}]).length, 2);
  assert.equal(deduplicateLegacy([item, {...item}, legacy]).length, 3);
});
