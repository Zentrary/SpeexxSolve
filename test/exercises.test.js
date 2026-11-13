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
  assert.equal(exercises.selectionGroups({...find('A1-0-0'), id:'other'}), null);
  assert.equal(exercises.selectionGroups({...find('A1-0-0'), body:'A\nK\nE\nI'}), null);
  assert.equal(exercises.selectionGroups(find('B1.2-7-1')), null);
  assert.equal(exercises.selectionGroups({answerType:'single-choice', body:'Which one?A\nB', answers:[9]}), null);
  assert.equal(exercises.selectionGroups({answerType:'single-choice', body:'intro\nWhich one?A\nB', answers:[1]}), null);
});
test('multiple choice preserves all selected options', () => {
  const groups = exercises.selectionGroups(find('A1-8-3'));
  assert.equal(groups.length, 4);
  assert.deepEqual(groups[0].selected, [0, 1]);
  assert.deepEqual(groups[0].selected.map(i => groups[0].options[i]), ['MRI machines.', 'Compound microscopes.']);
});

test('explicit tab-separated choice columns map to the correct statement', () => {
  const groups = exercises.selectionGroups(find('A1-5-3'));
  assert.equal(groups.length, 6);
  assert.equal(groups[0].question, 'Hello?');
  assert.equal(groups[0].options[groups[0].selected[0]], 'Personal');
  assert.equal(groups[1].options[groups[1].selected[0]], 'Business');
});
test('empty answer positions are preserved instead of renumbering later answers', () => {
  assert.deepEqual(exercises.orderedValues({answers: ['first', '', 'third']}), ['first', '', 'third']);
  assert.deepEqual(exercises.orderedValues({answers: []}), []);
});

test('the photographed letter exercise uses the confirmed pairs in row order', () => {
  const groups = exercises.selectionGroups(find('A1-0-0'));
  assert.deepEqual(groups.map(g => g.options), [['A','K'], ['E','I'], ['G','J'], ['T','B'], ['I','Y'], ['W','V']]);
  assert.deepEqual(groups.map(g => g.options[g.selected[0]]), ['A','I','G','T','Y','V']);
});
test('clearly delimited checkbox lists show the selected text vertically', () => {
  const group = exercises.selectionGroups(find('A2-1-1'))[0];
  assert.deepEqual(group.selected.map(n => group.options[n]), [
    'Jonathan is reading a Stephen King novel.',
    'Anjali wants to learn more about American life.',
    "Anjali hasn't used her e-reader yet."
  ]);
  const health = exercises.selectionGroups(find('B1.1-6-0'))[0];
  assert.deepEqual(health.selected.map(n => health.options[n]), ['eating fatty foods', 'drinking lots of alcohol', 'stress', 'smoking']);
  assert.equal(exercises.selectionGroups({...find('B1.1-6-0'), id:'different'}), null);
});
test('multiple-choice true/false records keep statements and choices together', () => {
  const groups = exercises.selectionGroups(find('A2-26-2'));
  assert.equal(groups.length, 5);
  assert.equal(groups[0].question, 'Alicia is finished with her training.');
  assert.equal(groups[0].options[groups[0].selected[0]], 'False');
});
test('truncated or mixed checkbox bodies do not produce invented choices', () => {
  const sample = find('A2-1-1');
  assert.equal(exercises.selectionGroups({...sample, body:'First sentence.\nCut off', answers:[[0,1]]}), null);
  assert.equal(exercises.selectionGroups({...sample, body:'First sentence.\nSecond sentence.', answers:[[2]]}), null);
  assert.equal(exercises.selectionGroups({...sample, body:'What is this? First answer.\nSecond answer.', answers:[[0]]}), null);
});
