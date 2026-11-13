const data = require('../server/data.json');
const PAGE_SIZE = 20;
const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const items = data.items.map(item => ({
  item,
  haystack: fold([item.chapter, item.exercise, item.title, item.prompt, item.body, item.answerText, item.typeLabel].join('\n'))
}));
const types = [...new Map(data.items.map(item => [item.answerType, item.typeLabel])).entries()]
  .sort((a, b) => a[1].localeCompare(b[1], 'th'));

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const params = new URL(req.url, 'http://localhost').searchParams;
  const q = (params.get('q') || '').trim();
  const chapter = params.get('chapter') || 'all';
  const type = params.get('type') || 'all';
  const images = params.get('images') === '1';
  const pageString = params.get('page') || '1';
  if (q.length > 200 || !/^\d{1,5}$/.test(pageString) || Number(pageString) < 1) {
    return res.status(400).json({ error: 'Invalid search parameters' });
  }
  const tokens = fold(q).split(/\s+/).filter(Boolean);
  const filtered = items.filter(({item, haystack}) =>
    (chapter === 'all' || item.chapter === chapter) &&
    (type === 'all' || item.answerType === type) &&
    (!images || item.images?.length) && tokens.every(token => haystack.includes(token)));
  const page = Number(pageString);
  const start = (page - 1) * PAGE_SIZE;
  return res.status(200).json({
    items: filtered.slice(start, start + PAGE_SIZE).map(entry => entry.item),
    total: filtered.length, page, hasMore: start + PAGE_SIZE < filtered.length,
    chapters: data.chapters.map(chapter => chapter.id), types
  });
};
