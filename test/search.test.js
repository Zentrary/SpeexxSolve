const { test } = require('node:test');
const assert = require('node:assert/strict');
const search = require('../api/search');
const data = require('../server/data.json');
const { deduplicateLegacy } = require('../server/catalog');
const visibleItems = deduplicateLegacy(data.items).filter(item => item.answerType !== 'pronunciation');
function request(url, method = 'GET', address = 'test-default') {
  let code, body; const headers = {};
  const res = { setHeader: (k,v) => headers[k] = v, status: n => { code = n; return res; }, json: data => { body = data; return res; } };
  search({ url, method, socket: { remoteAddress: address } }, res);
  return { code, body, headers };
}
test('pagination preserves original order and caps results', () => {
  const first = request('/api/search'); const second = request('/api/search?page=2');
  assert.equal(first.code, 200); assert.equal(first.body.items.length, 20);
  assert.equal(first.body.total, visibleItems.length); assert.equal(first.body.totalItems, visibleItems.length); assert.equal(first.body.hasMore, true);
  assert.deepEqual([...first.body.items, ...second.body.items].map(i => i.id), visibleItems.slice(0,40).map(i => i.id));
  assert.equal(first.headers['Cache-Control'], 'no-store');
});
test('search and filters retain source order', () => {
  const result = request('/api/search?q=hello&chapter=A1');
  assert.ok(result.body.items.length > 0);
  assert.equal(result.body.totalItems, visibleItems.length);
  assert.ok(result.body.total < result.body.totalItems);
  assert.ok(result.body.items.every(i => i.chapter === 'A1'));
  const order = new Map(data.items.map((i, n) => [i.id, n]));
  const indices = result.body.items.map(i => order.get(i.id));
  assert.deepEqual(indices, [...indices].sort((a,b) => a-b));
  const photos = request('/api/search?images=1');
  assert.ok(photos.body.items.length && photos.body.items.every(i => i.images.length));
  const filteredType = request('/api/search?type=mark-text');
  assert.ok(filteredType.body.items.length && filteredType.body.items.every(i => i.answerType === 'mark-text'));
});
test('invalid parameters and methods are rejected', () => {
  assert.equal(request('/api/search?page=-1').code, 400);
  assert.equal(request('/api/search?q=' + 'x'.repeat(201)).code, 400);
  assert.equal(request('/api/search', 'POST').code, 405);
});

test('pronunciation is excluded from results, totals and type filters', () => {
  const result = request('/api/search?type=pronunciation');
  assert.equal(result.body.total, 0);
  assert.equal(result.body.items.length, 0);
  assert.ok(!result.body.types.some(([type]) => type === 'pronunciation'));
  assert.equal(result.body.totalItems, visibleItems.length);
});
test('search returns only fields used by the website', () => {
  const result = request('/api/search?images=1');
  const item = result.body.items[0];
  assert.deepEqual(Object.keys(item).sort(), ['id','chapter','exercise','page','prompt','title','body','answerType','answers','images'].sort());
  assert.ok(item.images.every(img => Object.keys(img).every(key => ['src','itemIdx'].includes(key))));
});

test('repeated requests receive 429 and a retry interval', () => {
  for (let i = 0; i < 30; i++) assert.equal(request('/api/search', 'GET', 'test-limit-client').code, 200);
  const limited = request('/api/search', 'GET', 'test-limit-client');
  assert.equal(limited.code, 429);
  assert.ok(Number(limited.headers['Retry-After']) > 0);
  assert.equal(request('/api/search', 'GET', 'other-client').code, 200);
});

test('lessons are scoped to the selected level and filter with search and type', () => {
  const all = request('/api/search');
  assert.deepEqual(all.body.lessons, []);
  const level = request('/api/search?chapter=A1');
  assert.ok(level.body.lessons.length > 0);
  assert.equal(new Set(level.body.lessons.map(l => l.id)).size, level.body.lessons.length);
  const lesson = level.body.lessons.find(l => l.name === 'A, B, C');
  assert.ok(lesson);
  const result = request('/api/search?chapter=A1&lesson=' + encodeURIComponent(lesson.id) + '&type=answer&q=names');
  assert.ok(result.body.items.length > 0);
  assert.ok(result.body.items.every(i => i.chapter === 'A1' && i.exercise === lesson.name && i.answerType === 'answer'));
  assert.deepEqual(result.body.lessons, level.body.lessons);
  assert.equal(request('/api/search?lesson=0').code, 400);
  assert.equal(request('/api/search?chapter=A1&lesson=9999').code, 400);
});
test('lesson pagination retains order and does not omit results', () => {
  const level = request('/api/search?chapter=C1.2');
  const legacy = level.body.lessons.find(l => l.name === 'ข้อมูลนำเข้า (ไม่ระบุบท)');
  assert.ok(legacy);
  const first = request('/api/search?chapter=C1.2&lesson=' + legacy.id);
  const second = request('/api/search?chapter=C1.2&lesson=' + legacy.id + '&page=2');
  const expected = visibleItems.filter(i => i.chapter === 'C1.2' && String(i.exerciseIndex) === legacy.id);
  assert.equal(first.body.total, expected.length);
  assert.equal(first.body.hasMore, true);
  assert.deepEqual([...first.body.items, ...second.body.items].map(i => i.id), expected.slice(0,40).map(i => i.id));
});
