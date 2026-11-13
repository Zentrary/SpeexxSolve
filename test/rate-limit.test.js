const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLimiter, clientKey } = require('../server/rate-limit');

test('best-effort limiter isolates clients and resets its time window', () => {
  let time = 0;
  const check = createLimiter({limit:2, windowMs:10000, now:() => time});
  assert.equal(check('a'), 0); assert.equal(check('a'), 0);
  assert.equal(check('a'), 10); assert.equal(check('b'), 0);
  time = 10000; assert.equal(check('a'), 0);
});
test('local client identification ignores forged proxy headers', () => {
  const was = process.env.VERCEL; delete process.env.VERCEL;
  try { assert.equal(clientKey({headers:{'x-vercel-forwarded-for':'forged'}, socket:{remoteAddress:'127.0.0.1'}}), '127.0.0.1'); }
  finally { if (was !== undefined) process.env.VERCEL = was; }
});
test('Vercel client identification uses its trusted header or a shared fallback', () => {
  const was = process.env.VERCEL; process.env.VERCEL = '1';
  try {
    assert.equal(clientKey({headers:{'x-vercel-forwarded-for':'192.0.2.1'}}), '192.0.2.1');
    assert.equal(clientKey({headers:{'x-forwarded-for':'forged'}}), 'unknown');
  } finally { if (was === undefined) delete process.env.VERCEL; else process.env.VERCEL = was; }
});
