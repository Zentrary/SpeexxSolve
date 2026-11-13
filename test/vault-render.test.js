const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const Exercises = require('../public/js/exercises');
const data = require('../server/data.json');

test('vault renders choice text vertically without copy buttons, alongside typed answers', async () => {
  class Element {
    constructor() { this.value = ''; this.dataset = {}; this.innerHTML = ''; this.textContent = ''; this.options = [{textContent:'ทุกประเภท'}]; this.selectedIndex = 0; this.classList = {toggle(){}, add(){}, remove(){}}; this.listeners = {}; }
    querySelectorAll() { return []; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    setAttribute() {}
    append() {}
    add() {}
    insertAdjacentHTML(_, html) { this.innerHTML += html; }
  }
  const elements = new Map();
  const document = { querySelector(key) { if (!elements.has(key)) elements.set(key, new Element()); return elements.get(key); }, createElement() { return new Element(); }, addEventListener() {} };
  const ids = ['A1-0-0', 'A2-1-1', 'B1.2-7-1', 'A1-0-1'];
  const items = ids.map(id => data.items.find(item => item.id === id));
  const context = { document, Exercises, AbortController, URLSearchParams, setTimeout, clearTimeout, navigator: {}, window: {}, Option: function(){}, fetch: async () => ({ok:true, json: async () => ({items, chapters:[], types:[], totalItems:items.length, total:items.length, hasMore:false})}) };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/vault.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  const html = elements.get('#results').innerHTML;
  const cards = html.split('<article class="card">').slice(1);
  assert.equal(cards.length, 4);
  assert.doesNotMatch(html, /ดูตัวเลือกทั้งหมด|choice-details/);
  assert.deepEqual([...cards[0].matchAll(/<ul class="selected-list"><li>(.*?)<\/li><\/ul>/g)].map(m => m[1]), ['A','I','G','T','Y','V']);
  assert.match(cards[1], /<ul class="selected-list"><li>Jonathan is reading a Stephen King novel\.<\/li><li>Anjali wants to learn more about American life\.<\/li>/);
  assert.doesNotMatch(cards.slice(0,3).join(''), /data-copy-(id|all)/);
  assert.match(cards[2], /ข้อมูลต้นฉบับไม่ระบุ/);
  assert.match(cards[3], /data-copy-all="A1-0-1"/);
});

test('a rate-limited request offers a useful retry message', async () => {
  class Element {
    constructor() { this.value = ''; this.dataset = {}; this.options = [{textContent:'ทุกประเภท'}]; this.selectedIndex = 0; this.classList = {toggle(){},add(){},remove(){}}; }
    querySelectorAll() { return []; } addEventListener() {} setAttribute() {} append() {} add() {}
  }
  const elements = new Map();
  const document = {querySelector(key) { if (!elements.has(key)) elements.set(key, new Element()); return elements.get(key); }, addEventListener(){}};
  const context = {document, Exercises, AbortController, URLSearchParams, setTimeout, clearTimeout, navigator:{}, window:{}, Option:function(){}, fetch:async () => ({ok:false,status:429})};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/vault.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(elements.get('#status').textContent, /ค้นหาบ่อยเกินไป/);
  assert.equal(elements.get('#more').hidden, false);
  assert.equal(elements.get('#more').dataset.retry, '1');
});
