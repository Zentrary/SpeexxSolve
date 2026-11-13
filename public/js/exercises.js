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
    const lines = item.body.split('\n').map(line => line.trim()).filter(Boolean);
    // This exact exercise's two-option groups and their order are confirmed by
    // the original exercise screen. Do not infer pairs for other exercises.
    if (item.id === 'A1-0-0' && item.answerType === 'single-choice' &&
        lines.join('\n') === 'A\nK\nE\nI\nG\nJ\nT\nB\nI\nY\nW\nV' &&
        raw.length === 6 && raw.every(n => Number.isInteger(n) && n >= 0 && n <= 1)) {
      return raw.map((n, i) => ({ question: '', options: lines.slice(i * 2, i * 2 + 2), selected: [n] }));
    }
    // Here each line has its own checkbox: [0] means checked, [] unchecked.
    if (item.id === 'B1.1-6-0' && item.answerType === 'multiple-choice' &&
        lines.join('\n') === 'relaxing\neating fatty foods\ndrinking lots of alcohol\nstress\nsmoking\nsports' &&
        raw.length === lines.length && raw.every(a => Array.isArray(a) && (a.length === 0 || (a.length === 1 && a[0] === 0)))) {
      return [{ question: '', options: lines, selected: raw.flatMap((a, i) => a.length ? [i] : []) }];
    }
    const picks = raw.map(group => Array.isArray(group) ? group : [group]);
    if (!picks.length || picks.some(group => !group.length || group.some(n => !Number.isInteger(n) || n < 0))) return null;
    // Tab-separated rows explicitly contain a statement followed by its options.
    if (item.answerType === 'single-choice' && lines.length === picks.length) {
      const rows = lines.map(line => line.split('\t').map(value => value.trim()).filter(Boolean));
      if (rows.every((row, i) => row.length >= 3 && picks[i].length === 1 && picks[i][0] < row.length - 1)) {
        return rows.map((row, i) => ({ question: row[0], options: row.slice(1), selected: picks[i] }));
      }
    }
    // True/False records have each statement immediately followed by True\nFalse.
    if (picks.every(group => group.length === 1 && group[0] <= 1)) {
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
    // A single set of selected indices and an explicit instruction to mark
    // sentences/words can describe one option per line. Refuse truncated or
    // mixed question-and-option bodies rather than inventing a mapping.
    const listPrompt = /\b(?:mark|check|select|choose)\b[^.]{0,100}\b(?:sentences|statements|things|animals|instruments|words|options)\b/i;
    const completeLine = line => /[.!?][\"']?$/.test(line) || /^[a-z]+(?:[ -][a-z]+){0,3}$/.test(line);
    if (item.answerType === 'multiple-choice' && raw.length === 1 && Array.isArray(raw[0]) &&
        listPrompt.test(item.prompt || '') && lines.some(line => /\?\s*\S/.test(line))) return null;
    if (item.answerType === 'multiple-choice' && raw.length === 1 && Array.isArray(raw[0]) &&
        listPrompt.test(item.prompt || '') && lines.length > 1 && lines.every(completeLine) &&
        picks[0].every(n => n < lines.length)) {
      return [{ question: '', options: lines, selected: picks[0] }];
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
  // Keep empty positions so answer numbers and clipboard buttons do not shift.
  function orderedValues(item) {
    if (!Array.isArray(item.answers)) return [];
    return item.answers.map(value => typeof value === 'string' ? value : value == null ? '' : String(value));
  }
  return { descriptions, describe, selectionGroups, orderedValues };
});
