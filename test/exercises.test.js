const { test } = require('node:test');
const assert = require('node:assert/strict');
const exercises = require('../public/js/exercises');
const data = require('../server/data.json');
const find = id => data.items.find(item => item.id === id);
test('copy controls are reserved for actual typed answers', () => {
  assert.equal(exercises.describe(find('A1-0-1')).copyable, true);
  for (const id of ['A1-0-0', 'A1-0-2', 'A1-1-0', 'A1-1-1', 'A1-2-2', 'A1-3-3', 'A1-4-0', 'A2-3-0']) {
    assert.equal(exercises.describe(find(id)).copyable, false, id);
  }
  const anomalous = data.items.find(item => item.type === 'type-scrambled-sentence' && item.answerType === 'answer');
  assert.equal(exercises.describe(anomalous).kind, 'answer');
  assert.equal(exercises.describe(anomalous).copyable, true);
});
test('choice questions are separated and zero-based answers map to the correct visible options', () => {
  const groups = exercises.selectionGroups(find('A1-2-3'));
  assert.equal(groups.length, 5);
  assert.equal(groups[0].question, 'Which statement best describes the primary focus of defense procurement?');
  assert.deepEqual(groups.map(g => g.options[g.selected[0]]), ['Statement 1', 'Statement 5', 'Statement 2', 'Statement 4', 'Statement 3']);
});
test('true or false questions are mapped without losing the statements', () => {
  const groups = exercises.selectionGroups(find('A1-2-4'));
  assert.ok(groups.length > 1);
  assert.match(groups[0].question, /intelligence gathering/);
  assert.equal(groups[0].options[groups[0].selected[0]], 'False');
});
test('ambiguous or invalid choices are not guessed', () => {
  assert.equal(exercises.selectionGroups(find('A1-0-0')), null);
  assert.equal(exercises.selectionGroups({answerType:'single-choice', body:'Which one?A\nB', answers:[9]}), null);
  assert.equal(exercises.selectionGroups({answerType:'single-choice', body:'intro\nWhich one?A\nB', answers:[1]}), null);
});
test('multiple choice preserves all selected options', () => {
  const groups = exercises.selectionGroups(find('A1-8-3'));
  assert.equal(groups.length, 4);
  assert.deepEqual(groups[0].selected, [0, 1]);
  assert.deepEqual(groups[0].selected.map(i => groups[0].options[i]), ['MRI machines.', 'Compound microscopes.']);
});
