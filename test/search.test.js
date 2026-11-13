const { test } = require('node:test');
const assert = require('node:assert/strict');
const search = require('../api/search');
const data = require('../server/data.json');
function request(url, method = 'GET') {
  let code, body; const headers = {};
  const res = { setHeader: (k,v) => headers[k] = v, status: n => { code = n; return res; }, json: data => { body = data; return res; } };
  search({ url, method }, res);
  return { code, body, headers };
}
test('pagination preserves original order and caps results', () => {
  const first = request('/api/search'); const second = request('/api/search?page=2');
  assert.equal(first.code, 200); assert.equal(first.body.items.length, 20);
  assert.equal(first.body.total, data.items.length); assert.equal(first.body.hasMore, true);
  assert.deepEqual([...first.body.items, ...second.body.items].map(i => i.id), data.items.slice(0,40).map(i => i.id));
  assert.equal(first.headers['Cache-Control'], 'no-store');
});
test('search and filters retain source order', () => {
  const result = request('/api/search?q=hello&chapter=A1');
  assert.ok(result.body.items.length > 0);
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
