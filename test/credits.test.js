const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('home credits use the supplied Facebook and Instagram profiles', () => {
  const nodes = new Map();
  const document = {
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, { children: [], append(child) { this.children.push(child); } });
      return nodes.get(selector);
    },
    createElement(tag) { return { tagName: tag.toUpperCase() }; }
  };
  const context = vm.createContext({ window: {}, document, URL });
  const root = path.join(__dirname, '..', 'public', 'js');
  vm.runInContext(fs.readFileSync(path.join(root, 'config.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'home.js'), 'utf8'), context);
  const links = nodes.get('#ownerLinks').children;
  assert.equal(nodes.get('#ownerName').textContent, 'Chier · เชียร์');
  assert.deepEqual(Array.from(links, link => link.href), [
    'https://www.facebook.com/Timmy.org/',
    'https://www.instagram.com/chier.pl/'
  ]);
  assert.equal(links[1].textContent, 'Instagram · @chier.pl');
  assert.ok(links.every(link => link.target === '_blank' && link.rel === 'noopener noreferrer'));
});
