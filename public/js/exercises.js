(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Exercises = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const descriptions = {
    'answer': ['พิมพ์คำตอบ', 'พิมพ์หรือวางคำตอบลงในช่องของแบบฝึกหัดตามลำดับ'],
    'drag-drop': ['ลากไปวาง', 'ลากคำตอบไปวางในช่องที่ตรงกันตามลำดับ'],
    'toggle-solution': ['กดเลือกในช่อง', 'กดที่ช่องคำตอบในแบบฝึกหัดจนกว่าจะตรงกับเฉลย'],
    'single-choice': ['เลือกคำตอบเดียว', 'เลือกคำตอบหนึ่งข้อในแต่ละคำถามของแบบฝึกหัด'],
    'multiple-choice': ['เลือกได้หลายคำตอบ', 'เลือกทุกตัวเลือกที่ระบุไว้ในแต่ละคำถาม'],
    'picture-choice': ['จับคู่รูปภาพ', 'ลากหรือเลือกภาพให้ตรงกับข้อความในแบบฝึกหัด'],
    'scrambled-table': ['จับคู่ข้อความ', 'จับคู่ข้อความทางซ้ายกับคำตอบที่ตรงกัน'],
    'scrambled-sentence': ['เรียงประโยค', 'เรียงคำตามโจทย์ ตรวจสอบลำดับกับแบบฝึกหัด'],
    'mark-text': ['ทำเครื่องหมายข้อความ', 'กดหรือไฮไลต์คำที่ระบุไว้ในข้อความ'],
    'pronunciation': ['ฝึกออกเสียง', 'ฟังและพูดตามข้อความในแบบฝึกหัด'],
    'intro': ['บทนำ', 'อ่านรายละเอียดก่อนเริ่มแบบฝึกหัด']
  };
  function describe(item) {
    // answerType and answer payload describe how the solution is stored;
    // the raw page type can disagree (for example B1.1-56-0).
    const kind = item.answerType;
    return { kind, label: (descriptions[kind] || ['แบบฝึกหัด', 'ตรวจสอบวิธีทำจากคำสั่งในโจทย์'])[0], instruction: (descriptions[kind] || ['แบบฝึกหัด', 'ตรวจสอบวิธีทำจากคำสั่งในโจทย์'])[1], copyable: kind === 'answer' };
  }
  function selectionGroups(item) {
    if (!['single-choice', 'multiple-choice'].includes(item.answerType) || typeof item.body !== 'string') return null;
    const raw = Array.isArray(item.answers) ? item.answers : [];
    const picks = raw.map(group => Array.isArray(group) ? group : [group]);
    if (!picks.length || picks.some(group => !group.length || group.some(n => !Number.isInteger(n) || n < 0))) return null;
    // True/False records have each statement immediately followed by True\nFalse.
    if (item.answerType === 'single-choice' && picks.every(group => group.length === 1 && group[0] <= 1)) {
      const pattern = /true\s*\n\s*false/ig;
      const groups = []; let last = 0, match;
      while ((match = pattern.exec(item.body))) {
        groups.push({ question: item.body.slice(last, match.index).trim(), options: ['True', 'False'] });
        last = pattern.lastIndex;
      }
      if (groups.length === picks.length && !item.body.slice(last).trim() && groups.every(g => g.question)) {
        return groups.map((g, i) => ({ ...g, selected: picks[i] }));
      }
    }
    // Only map indexed options when the question/option boundaries are unambiguous.
    const groups = []; let current = null;
    for (const rawLine of item.body.split('\n')) {
      const line = rawLine.trim(); if (!line) continue;
      const match = line.match(/^([^?]+\?)(.*)$/);
      if (match) {
        current = { question: match[1].trim(), options: [] }; groups.push(current);
        if (match[2].trim()) current.options.push(match[2].trim());
      } else if (current) current.options.push(line);
      else return null;
    }
    if (groups.length !== picks.length || groups.some((g, i) => !g.options.length || picks[i].some(n => n >= g.options.length))) return null;
    return groups.map((g, i) => ({ ...g, selected: picks[i] }));
  }
  return { descriptions, describe, selectionGroups };
});
