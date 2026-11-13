const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Exercises = require('../public/js/exercises');
const handler = require('../api/search');

test('lesson selector appears only for a level, filters results, and resets when changing level', async () => {
  class Option { constructor(text, value) { this.textContent = text; this.value = value; } }
  class Element {
    constructor(id = '') { this.id = id; this.dataset = {}; this.listeners = {}; this.children = []; this.innerHTML = ''; this.textContent = ''; this.options = []; this._value = ''; this.hidden = false; this.classList = {toggle(){}, add(){}, remove(){}}; }
    get value() { return this._value; }
    set value(v) { this._value = v; }
    get selectedIndex() { return this.options.findIndex(option => option.value === this.value); }
    add(option) { this.options.push(option); }
    replaceChildren(...options) { this.options = [...options]; this.value = options[0]?.value || ''; }
    append(child) { this.children.push(child); }
    contains(child) { return this.children.includes(child); }
    querySelectorAll() { return this.children; }
    setAttribute() {}
    addEventListener(name, handler) { this.listeners[name] = handler; }
    insertAdjacentHTML(_, value) { this.innerHTML += value; }
    focus() {}
    trigger(name, event = {}) { this.listeners[name](event); }
  }
  const elements = new Map();
  const get = key => { if (!elements.has(key)) elements.set(key, new Element(key)); return elements.get(key); };
  get('#type').replaceChildren(new Option('ทุกประเภท','all'));
  get('#lesson').replaceChildren(new Option('ทุกบทเรียน','all'));
  const all = new Element(); all.dataset.level = 'all'; get('#levels').append(all);
  const document = {querySelector:get, createElement:() => new Element(), addEventListener(){}};
  const calls = [];
  const fetch = async url => {
    calls.push(url);
    let code, body;
    const res = {setHeader(){}, status(n){ code=n; return this; }, json(value){body=value; return this;}};
    handler({url, method:'GET', socket:{remoteAddress:'ui-test'}}, res);
    return {ok:code===200, status:code, json:async()=>body};
  };
  const context = {document, Exercises, AbortController, URLSearchParams, setTimeout, clearTimeout, navigator:{}, window:{}, Option, fetch};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/js/vault.js'), 'utf8'), context);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  await settle();
  assert.equal(get('#lesson-filter').hidden, true);
  const a1 = get('#levels').children.find(x => x.dataset.level === 'A1');
  get('#levels').trigger('click', {target:{closest:() => a1}});
  await settle();
  assert.equal(get('#lesson-filter').hidden, false);
  assert.equal(get('#lesson').disabled, false);
  const abc = get('#lesson').options.find(o => o.textContent === 'A, B, C');
  assert.ok(abc);
  get('#lesson').value = abc.value;
  get('#lesson').trigger('change'); await settle();
  assert.equal(new URL(calls.at(-1), 'http://test').searchParams.get('lesson'), abc.value);
  assert.match(get('#filter-summary').textContent, /A, B, C/);
  assert.match(get('#results').innerHTML, /Which letter/);
  const a2 = get('#levels').children.find(x => x.dataset.level === 'A2');
  get('#levels').trigger('click', {target:{closest:() => a2}}); await settle();
  assert.equal(get('#lesson').value, 'all');
  assert.equal(new URL(calls.at(-1), 'http://test').searchParams.get('lesson'), 'all');
  get('#levels').trigger('click', {target:{closest:() => all}}); await settle();
  assert.equal(get('#lesson-filter').hidden, true);
  get('#levels').trigger('click', {target:{closest:() => a1}}); await settle();
  get('#lesson').value = abc.value; get('#lesson').trigger('change'); await settle();
  get('#reset').trigger('click'); await settle();
  assert.equal(get('#lesson-filter').hidden, true);
  assert.equal(get('#lesson').value, 'all');
});
