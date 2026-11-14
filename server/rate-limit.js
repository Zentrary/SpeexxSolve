'use strict';
function createLimiter({ limit = 30, windowMs = 60_000, maxKeys = 10_000, now = Date.now } = {}) {
  const buckets = new Map();
  return function check(key) {
    const time = now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.until <= time) {
      if (!bucket && buckets.size >= maxKeys) {
        for (const [k, v] of buckets) if (v.until <= time) buckets.delete(k);
        if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value);
      }
      bucket = { count: 0, until: time + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;
    return bucket.count > limit ? Math.max(1, Math.ceil((bucket.until - time) / 1000)) : 0;
  };
}
function clientKey(req) {
  if (process.env.VERCEL === '1') return String(req.headers?.['x-vercel-forwarded-for'] || 'unknown').split(',')[0].trim() || 'unknown';
  return req.socket?.remoteAddress || 'unknown';
}
module.exports = { createLimiter, clientKey };
