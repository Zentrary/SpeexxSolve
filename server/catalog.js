'use strict';

// Legacy imports are sometimes truncated copies of pages already present in a
// named lesson. Only suppress a copy when the match is unique and the prompt,
// title, answer type, answers and a substantial body prefix all agree. Preserve
// the named lesson's identity and use the more complete body. Never deduplicate
// across levels or merely by title/answer; similar exercises can be distinct.
function deduplicateLegacy(items) {
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  const identity = item => JSON.stringify([item.chapter, item.title, item.prompt, item.answerType, item.answers]);
  const canonical = new Map();
  for (const item of items) {
    if (item.exercise === 'Imported answers (legacy)') continue;
    const key = identity(item);
    if (!canonical.has(key)) canonical.set(key, []);
    canonical.get(key).push(item);
  }
  const suppressed = new Set();
  const fullerBodies = new Map();
  for (const legacy of items) {
    if (legacy.exercise !== 'Imported answers (legacy)') continue;
    const legacyBody = normalize(legacy.body);
    if (legacyBody.length < 20) continue;
    const matches = (canonical.get(identity(legacy)) || []).filter(item => {
      const body = normalize(item.body);
      return body.length >= 20 && (body.startsWith(legacyBody) || legacyBody.startsWith(body));
    });
    if (matches.length !== 1) continue;
    const match = matches[0];
    suppressed.add(legacy);
    const existing = fullerBodies.get(match) || match.body;
    if (legacyBody.length > normalize(existing).length) fullerBodies.set(match, legacy.body);
  }
  return items.filter(item => !suppressed.has(item)).map(item => fullerBodies.has(item) ? { ...item, body: fullerBodies.get(item) } : item);
}
module.exports = { deduplicateLegacy };
