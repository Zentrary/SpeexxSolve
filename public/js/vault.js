(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const highlight = value => esc(value);
  function flatten(value, out = []) {
    if (value == null) return out;
    if (Array.isArray(value)) value.forEach(v => flatten(v, out));
    else if (typeof value === 'object') {
      if (typeof value.text === 'string') out.push(value.text);
      else Object.values(value).forEach(v => flatten(v, out));
    } else if (String(value) !== '') out.push(String(value));
    return out;
  }
  const PUNCT_START = /^[.,!?;:%)\]}”’»]/;
  const OPEN_END = /[(\[{“‘«]$/;

  function joinTokens(tokens) {
    if (typeof tokens === "string") return tokens;
    const list = Array.isArray(tokens) ? tokens : [tokens];
    let out = "";
    for (const token of list) {
      const t = String(token);
      if (!out) out = t;
      else if (PUNCT_START.test(t)) out += t;
      else if (OPEN_END.test(out)) out += t;
      else out += ` ${t}`;
    }
    return out.replace(/\s+([.,!?;:%])/g, "$1");
  }

  function chipList(values, opts = {}) {
    const list = (values || []).filter((v) => String(v).trim() !== "");
    if (!list.length) return '<span class="muted">—</span>';
    return `<div class="chips">${list
      .map(
        (v, i) =>
          `<span class="chip ${opts.ans ? "ans" : ""}">${
            opts.numbered ? `<span class="num">${i + 1}</span>` : ""
          }${opts.matcher ? highlight(String(v), opts.matcher) : esc(v)}</span>`
      )
      .join("")}</div>`;
  }

  function answerList(values, matcher) {
    return `<ol class="answer-list">${(values || [])
      .map((v) => `<li><span class="sentence">${highlight(String(v), matcher)}</span></li>`)
      .join("")}</ol>`;
  }

  function autoAnswerBlock(values, matcher) {
    const list = (values || []).map(String).filter((v) => v.trim() !== "");
    if (!list.length) return '<span class="muted">—</span>';
    const long = list.some((v) => v.length > 70) || list.reduce((n, v) => n + v.length, 0) / list.length > 42;
    return long ? answerList(list, matcher) : chipList(list, { ans: true, matcher });
  }

  function renderChoices(item) {
    const parsed = Exercises.selectionGroups(item);
    if (parsed) {
      return `<div class="choice-groups">${parsed.map((group, index) => {
        const selected = group.selected.map(optionIndex => group.options[optionIndex]);
        const heading = group.question ? `<div class="choice-question"><span>ข้อ ${index + 1}</span><strong>${esc(group.question)}</strong></div>` : (parsed.length > 1 ? `<div class="choice-question"><span>ข้อ ${index + 1}</span></div>` : '');
        const selectedList = selected.length ? `<ul class="selected-list">${selected.map(value => `<li>${esc(value)}</li>`).join('')}</ul>` : '<strong>ไม่ได้เลือกตัวเลือก</strong>';
        return `<section class="choice-group">${heading}<div class="selected-answer"><span>คำตอบ</span>${selectedList}</div></section>`;
      }).join('')}</div>`;
    }
    const raw = Array.isArray(item.answers) ? item.answers : [];
    const groups = raw.map(value => Array.isArray(value) ? value : [value]);
    if (!groups.length) return '<p class="answer-note">ข้อนี้ยังไม่มีคำตอบในข้อมูล</p>';
    return `<p class="choice-warning">เลือกตัวเลือกตามลำดับด้านล่างในแบบฝึกหัด ตัวอย่าง: ตัวเลือกที่ 1 คือข้อแรก</p><ol class="simple-answer-list">${groups.map((group, index) => `<li><span class="simple-answer-number">${index + 1}</span><span class="simple-answer-text">${group.length ? group.map(value => `<span class="fallback-pick">${Number.isInteger(value) && value >= 0 ? `เลือกตัวเลือกที่ ${value + 1}` : esc(value)}</span>`).join('') : 'ไม่มีคำตอบในข้อมูล'}</span></li>`).join('')}</ol><p class="answer-note">ข้อมูลต้นฉบับไม่ระบุว่าตัวเลือกใดอยู่คู่กับแต่ละข้อ จึงแสดงเป็นลำดับตัวเลือกแทน</p>`;
  }

  function renderOrderedAnswers(item) {
    const values = Exercises.orderedValues(item);
    if (!values.some(value => value.trim())) return '<p class="answer-note">ข้อนี้ยังไม่มีคำตอบในข้อมูล</p>';
    const copyable = Exercises.describe(item).copyable;
    const copyAll = copyable ? `<button class="copy-all" type="button" data-copy-all="${esc(item.id)}">คัดลอกทั้งหมด</button>` : '';
    return `<div class="answer-list-heading"><p>เรียงตามลำดับข้อในแบบฝึกหัด</p>${copyAll}</div><ol class="simple-answer-list">${values.map((value, index) => `<li><span class="simple-answer-number">${index + 1}</span><span class="simple-answer-text${value.trim() ? '' : ' missing-answer'}">${value.trim() ? esc(value) : 'ไม่มีคำตอบในข้อมูล'}</span>${copyable && value.trim() ? `<button class="copy-one" type="button" data-copy-id="${esc(item.id)}" data-copy-index="${index}" aria-label="คัดลอกคำตอบข้อ ${index + 1}">คัดลอก</button>` : ''}</li>`).join('')}</ol>`;
  }

  function renderScrambledTable(item, matcher) {
    const answers = (item.answers || [])
      .filter((a) => a && typeof a === "object" && typeof a.text === "string")
      .slice()
      .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));

    const chunks = item.body
      .split(/\n{2,}/)
      .map((c) => c.trim())
      .filter(Boolean);

    if (answers.length && chunks.length === answers.length && chunks.every((chunk, i) => chunk.split("\n").slice(1).join("\n").includes(answers[i].text))) {
      const rows = answers
        .map((a, i) => {
          const left = chunks[i].split("\n")[0].replace(/\t+$/g, "").trim();
          return `<tr><td>${highlight(left, matcher)}</td><td>${highlight(a.text, matcher)}</td></tr>`;
        })
        .join("");
      return `<div class="answer-box"><table class="pair-table"><tbody>${rows}</tbody></table></div>`;
    }

    return `<div class="answer-box">${autoAnswerBlock(
      answers.map((a) => a.text),
      matcher
    )}</div><p class="answer-note">ตรวจสอบคู่คำตอบกับแบบฝึกหัด เนื่องจากข้อมูลต้นฉบับแบ่งคู่ไว้ไม่ชัดเจน</p>`;
  }

  function renderMarkText(item, matcher) {
    const tokens = item.body.split(/\s+/).filter(Boolean);
    const positions = new Set(item.answers?.group_positions || item.answers?.all_positions || []);
    const highlighted = [];

    const body = tokens
      .map((token, i) => {
        if (!positions.has(i)) return esc(token);
        highlighted.push(token);
        return `<mark class="txt">${esc(token)}</mark>`;
      })
      .join(" ");

    return `<div class="answer-box"><p class="mark-text">${body}</p></div>
      ${highlighted.length ? `<div class="answer-key"><span class="answer-key-label">คำที่ไฮไลต์</span>${chipList(highlighted, { ans: true })}</div>` : ""}
      <p class="answer-note">ไฮไลต์ตามตำแหน่งคำ (group_positions) ในข้อความต้นฉบับ</p>`;
  }

  function renderPictures(item) {
    if (!item.images.length) return '<span class="muted">ไม่พบรูปภาพ</span>';
    const options = item.body
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const cards = item.images
      .slice()
      .sort((a, b) => a.itemIdx - b.itemIdx)
      .map((img) => {
        const label = options[img.itemIdx] || `ภาพที่ ${img.itemIdx + 1}`;
        return `<a class="img-card" href="${esc(img.src)}" target="_blank" rel="noopener" title="เปิดรูปขนาดเต็ม">
          <img src="${esc(img.src)}" alt="${esc(label)}" loading="lazy" decoding="async">
          <figcaption><b>${img.itemIdx}</b><span>${esc(label)}</span></figcaption>
        </a>`;
      })
      .join("");
    return `<div class="img-grid">${cards}</div>
      <p class="answer-note">จับคู่รูปภาพกับคำศัพท์ตามหมายเลข (index) จากข้อมูลต้นฉบับ</p>`;
  }

  function renderPronunciations(item, matcher) {
    const sentences = flatten(item.answers).map((s) => s.replace(/\s+([.,!?;:])/g, "$1"));
    return `<div class="answer-box">${answerList(sentences, matcher)}</div>`;
  }

  function renderAnswer(item, matcher) {
    const type = item.answerType;
    const flat = flatten(item.answers);
    const noAnswerTypes = new Set([
      "single-choice",
      "multiple-choice",
      "mark-text",
      "picture-choice",
      "intro",
      "scrambled-table",
      "scrambled-sentence",
    ]);

    if (!flat.length && !noAnswerTypes.has(type)) {
      return `<div class="answer-box"><span class="muted">— ไม่มีข้อมูลเฉลย —</span></div>
        <p class="answer-note">ข้อนี้ไม่มีคำตอบบันทึกไว้ในไฟล์ข้อมูล (โจทย์อาจมีคำตอบฝังอยู่ด้านบน)</p>`;
    }

    if (type === "answer" || type === "drag-drop" || type === "toggle-solution") {
      return renderOrderedAnswers(item);
    }

    if (type === "single-choice" || type === "multiple-choice") {
      return renderChoices(item, matcher);
    }

    if (type === "scrambled-sentence") {
      const sentences = (item.answers || []).map((group) => joinTokens(group));
      return `<p class="answer-note">คำที่บันทึกไว้อาจยังไม่เรียงเป็นประโยค โปรดตรวจสอบลำดับกับแบบฝึกหัด</p><div class="answer-box">${answerList(sentences, matcher)}</div>`;
    }

    if (type === "scrambled-table") {
      return renderScrambledTable(item, matcher);
    }

    if (type === "mark-text") {
      return renderMarkText(item, matcher);
    }

    if (type === "picture-choice") {
      return renderPictures(item);
    }

    if (type === "pronunciation") {
      return renderPronunciations(item, matcher);
    }

    if (type === "intro") {
      return '<p class="answer-note">หน้านี้เป็นบทนำ ไม่มีคำตอบ</p>';
    }

    return `<div class="answer-box">${autoAnswerBlock(flat, matcher)}</div>`;
  }
  function copyValues(item) {
    return Exercises.describe(item).copyable ? Exercises.orderedValues(item) : [];
  }
  const results = $('#results'), status = $('#status'), more = $('#more');
  const search = $('#search'), type = $('#type'), levels = $('#levels'), clearSearch = $('#clear-search');
  const filterSummary = $('#filter-summary'), lesson = $('#lesson'), lessonFilter = $('#lesson-filter');
  let selectedChapter = 'all', selectedLesson = 'all';
  let page = 1, currentItems = [], requestNumber = 0, controller, timer, filtersReady = false;
  function syncFilters() {
    levels.querySelectorAll('[data-level]').forEach(button => {
      const active = button.dataset.level === selectedChapter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const typeLabel = type.options[type.selectedIndex]?.textContent || 'ทุกประเภท';
    const lessonLabel = selectedLesson !== 'all' ? lesson.options[lesson.selectedIndex]?.textContent : '';
    filterSummary.textContent = [selectedChapter === 'all' ? 'ทุกระดับ' : selectedChapter, lessonLabel, typeLabel].filter(Boolean).join(' · ');
    lessonFilter.hidden = selectedChapter === 'all';
    clearSearch.hidden = !search.value;
  }
  function card(item, position) {
    const details = Exercises.describe(item);
    const prompt = item.prompt && item.prompt !== item.title && item.prompt !== item.body ? `<p class="card-prompt">${esc(item.prompt)}</p>` : '';
    const isChoice = ['single-choice', 'multiple-choice'].includes(details.kind);
    const parsed = isChoice && Exercises.selectionGroups(item);
    const longBody = item.body && (item.body.length > 350 || item.body.split('\n').length > 6);
    const optionLines = item.body ? item.body.split('\n').map(line => line.trim()).filter(Boolean) : [];
    const letterOptions = !parsed && isChoice && optionLines.length > 1 && optionLines.every(line => /^[A-Za-z]$/.test(line));
    const question = !parsed && details.kind !== 'mark-text' && item.body ? (letterOptions
      ? `<div class="question-block"><div class="block-label">ตัวเลือกตามข้อมูลต้นฉบับ</div><div class="letter-options">${optionLines.map(value => `<span>${esc(value)}</span>`).join('')}</div></div>`
      : longBody
        ? `<details class="question-block question-details" open><summary><span class="block-label">โจทย์</span><span>ซ่อน / แสดงโจทย์ <span class="details-arrow" aria-hidden="true">↓</span></span></summary><div class="question-body">${esc(item.body)}</div></details>`
        : `<div class="question-block"><div class="block-label">โจทย์</div><div class="question-body">${esc(item.body)}</div></div>`) : '';
    const answer = isChoice ? renderChoices(item) : renderAnswer({ ...item, answerType: details.kind }, null);
    return `<article class="card"><div class="card-topline"><div class="badges"><span>${esc(item.chapter)}</span><span>${esc(details.label)}</span><span>หน้า ${esc(item.page ?? '—')}</span></div><span class="card-number" aria-label="ผลลัพธ์ลำดับที่ ${position}">#${String(position).padStart(2, '0')}</span></div>${item.exercise && item.exercise !== item.title ? `<p class="card-exercise">${esc(item.exercise === 'Imported answers (legacy)' ? 'ข้อมูลนำเข้า (ไม่ระบุบท)' : item.exercise)}</p>` : ''}<h3>${esc(item.title || item.exercise || 'ไม่มีชื่อข้อ')}</h3>${prompt}<div class="how-to"><strong>วิธีทำ</strong><span>${esc(details.instruction)}</span></div>${question}<div class="answer-panel"><div class="answer-head"><span class="answer-indicator" aria-hidden="true">✳</span>${parsed ? 'โจทย์และคำตอบ' : 'คำตอบ'}</div>${answer}</div></article>`;
  }
  async function load(append = false) {
    if (controller) controller.abort();
    controller = new AbortController();
    const number = ++requestNumber;
    if (!append) { page = 1; currentItems = []; results.innerHTML = ''; }
    more.hidden = true; status.textContent = 'กำลังค้นหา…';
    lesson.disabled = true;
    syncFilters();
    const params = new URLSearchParams({q: search.value.trim(), chapter: selectedChapter, lesson: selectedLesson, type: type.value, page: String(page)});
    try {
      const response = await fetch('/api/search?' + params, {signal: controller.signal});
      if (response.status === 429) throw new Error('rate-limited');
      if (!response.ok) throw new Error('Request failed');
      const data = await response.json();
      if (number !== requestNumber) return;
      if (!filtersReady) {
        for (const value of data.chapters) { const button = document.createElement('button'); button.type = 'button'; button.className = 'level-button'; button.dataset.level = value; button.textContent = value; button.setAttribute('aria-pressed', 'false'); levels.append(button); }
        $('#total-answers').textContent = data.totalItems.toLocaleString('th-TH');
        $('#total-levels').textContent = data.chapters.length.toLocaleString('th-TH');
        for (const [value, label] of data.types) type.add(new Option(label, value));
        filtersReady = true;
      }
      if (selectedChapter !== 'all') {
        lesson.replaceChildren(new Option('ทุกบทเรียน', 'all'));
        for (const entry of data.lessons || []) lesson.add(new Option(entry.name, entry.id));
        lesson.value = selectedLesson;
        lesson.disabled = false;
      }
      const start = currentItems.length;
      currentItems.push(...data.items);
      results.insertAdjacentHTML('beforeend', data.items.map((item, index) => card(item, start + index + 1)).join(''));
      syncFilters();
      status.textContent = `พบ ${data.total.toLocaleString('th-TH')} รายการ · แสดง ${currentItems.length.toLocaleString('th-TH')} รายการ`;
      if (!data.total) results.innerHTML = '<div class="empty"><strong>ไม่พบคำตอบที่ตรงกัน</strong><p>ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง</p></div>';
      delete more.dataset.retry; more.textContent = 'แสดงเพิ่มเติม';
      more.hidden = !data.hasMore;
    } catch (error) {
      if (error.name === 'AbortError' || number !== requestNumber) return;
      status.textContent = error.message === 'rate-limited' ? 'ค้นหาบ่อยเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง' : 'โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง';
      more.textContent = 'ลองอีกครั้ง'; more.hidden = false;
      more.dataset.retry = '1';
    }
  }
  search.addEventListener('input', () => { clearTimeout(timer); syncFilters(); timer = setTimeout(() => load(), 250); });
  clearSearch.addEventListener('click', () => { clearTimeout(timer); search.value = ''; syncFilters(); search.focus(); load(); });
  levels.addEventListener('click', event => {
    const button = event.target.closest('[data-level]');
    if (!button || !levels.contains(button)) return;
    clearTimeout(timer); selectedChapter = button.dataset.level; selectedLesson = 'all';
    lesson.replaceChildren(new Option('ทุกบทเรียน', 'all')); lesson.value = 'all'; syncFilters(); load();
  });
  lesson.addEventListener('change', () => { clearTimeout(timer); selectedLesson = lesson.value; syncFilters(); load(); });
  type.addEventListener('change', () => { clearTimeout(timer); syncFilters(); load(); });
  $('#reset').addEventListener('click', () => { clearTimeout(timer); search.value = ''; selectedChapter = 'all'; selectedLesson = 'all'; lesson.replaceChildren(new Option('ทุกบทเรียน', 'all')); lesson.value = 'all'; type.value = 'all'; syncFilters(); load(); });
  more.addEventListener('click', () => { if (!more.dataset.retry) page++; delete more.dataset.retry; more.textContent = 'แสดงเพิ่มเติม'; load(page > 1); });
  const toast = $('#toast'); let toastTimer;
  function notify(message) { toast.textContent = message; toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500); }
  async function copy(text) {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const textarea = document.createElement('textarea'); textarea.value = text; textarea.style.position = 'fixed'; textarea.style.left = '-9999px'; document.body.append(textarea); textarea.select();
        const ok = document.execCommand('copy'); textarea.remove(); if (!ok) throw new Error('copy failed');
      }
      notify('คัดลอกคำตอบแล้ว');
    } catch { notify('คัดลอกไม่สำเร็จ กรุณาลองอีกครั้ง'); }
  }
  results.addEventListener('click', event => {
    const one = event.target.closest('[data-copy-id]');
    const all = event.target.closest('[data-copy-all]');
    if (!one && !all) return;
    const item = currentItems.find(item => item.id === (one ? one.dataset.copyId : all.dataset.copyAll));
    if (!item) return;
    const values = copyValues(item);
    copy(one ? values[Number(one.dataset.copyIndex)] : values.join('\n'));
  });
  document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); search.focus(); } });
  load();
})();
