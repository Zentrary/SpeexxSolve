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

  function tryFill(item, matcher) {
    const answers = flatten(item.answers);
    if (!answers.length || !item.body) return null;

    const strategies = [
      // All blank styles combined (best chance of matching every gap).
      /\.\.\.|_{2,}|:[ \t]*(?=\n|$)|[ \t]{2,}|[ \t]+(?=[,.!?;:])|(^|\n) (?=\S)|\t/g,
      /\.\.\./g,
      /_{2,}/g,
      /:[ \t]*(?=\n|$)/g,
      / {2,}/g,
      /(?<=[A-Za-z\u00C0-\u024F])[ \t]+(?=[,.!?;:])/g,
      /(^|\n) (?=\S)/g,
      /\t/g,
    ];

    for (const base of strategies) {
      const probe = new RegExp(base.source, base.flags);
      const count = (item.body.match(probe) || []).length;
      if (!count || count !== answers.length) continue;

      const re = new RegExp(base.source, base.flags);
      let out = "";
      let last = 0;
      let i = 0;
      let m;
      while ((m = re.exec(item.body))) {
        const atLineStart = m.index === 0 || item.body[m.index - 1] === "\n";
        out += esc(item.body.slice(last, m.index));
        const answer = answers[i++] || "";

        if (m[0].startsWith(":")) {
          out += `: <mark class="ans">${esc(answer)}</mark>`;
        } else if (m[0].startsWith("\n") || (atLineStart && m[0] === " ")) {
          out += (m[0].startsWith("\n") ? "\n" : "") + `<mark class="ans">${esc(answer)}</mark> `;
        } else {
          out += ` <mark class="ans">${esc(answer)}</mark> `;
        }

        last = m.index + m[0].length;
      }
      out += esc(item.body.slice(last));
      return out;
    }
    return null;
  }

  function renderDropTable(item, matcher) {
    if (item.type !== "type-drag-drop-table") return null;
    const answers = flatten(item.answers);
    const lines = item.body
      .split("\n")
      .map((line) => line.replace(/\t+$/g, "").trim())
      .filter(Boolean);

    if (!answers.length || lines.length !== answers.length) return null;
    if (lines.some((line) => line.length > 220)) return null;

    const rows = lines
      .map(
        (line, i) =>
          `<tr><td>${highlight(line, matcher)}</td><td>${highlight(answers[i], matcher)}</td></tr>`
      )
      .join("");
    return `<div class="answer-box"><table class="pair-table"><tbody>${rows}</tbody></table></div>
      <p class="answer-note">จับคู่คำตอบตามลำดับจากข้อมูลต้นฉบับ</p>`;
  }

  function renderTrueFalse(item, matcher) {
    const values = flatten(item.answers);
    if (!values.length || !values.every((v) => v === "0" || v === "1")) return null;
    if (!/true\s*\n\s*false/i.test(item.body)) return null;

    const re = /true\s*\n\s*false/gi;
    const lines = [];
    let last = 0;
    let m;
    while ((m = re.exec(item.body))) {
      lines.push(item.body.slice(last, m.index));
      last = m.index + m[0].length;
    }
    if (lines.length !== values.length) return null;

    const rows = lines.map((statement, i) => {
      const text = statement.replace(/^\s+|\s+$/g, "");
      const value = values[i] === "0" ? "True" : "False";
      return `<li><span class="sentence">${highlight(text, matcher)}</span> <span class="chip ans">${value}</span></li>`;
    });

    return `<ol class="answer-list">${rows.join("")}</ol>
      <p class="answer-note">0 = True · 1 = False (เรียงตามลำดับตัวเลือก True/False ในโจทย์)</p>`;
  }

  function renderChoices(item, matcher) {
    const groups = Array.isArray(item.answers) && Array.isArray(item.answers[0]) ? item.answers : null;
    const flat = flatten(item.answers);
    const tf = renderTrueFalse(item, matcher);

    if (tf) return `<div class="answer-box">${tf}</div>`;

    const optionLines = item.body
      .split("\n")
      .map((s) => s.replace(/\t+$/g, "").trim())
      .filter(Boolean);
    const showOptions = optionLines.length > 0 && optionLines.length <= 24;
    const compact =
      optionLines.length > 7 && optionLines.every((line) => line.length <= 52);
    const flatSet = new Set(flat.map((v) => Number(v)).filter((n) => Number.isFinite(n)));
    const markOptions = groups && groups.length === 1 && showOptions;

    let html = "";
    if (showOptions) {
      html += `<ol class="option-list${compact ? " compact" : ""}">${optionLines
        .map(
          (line, i) =>
            `<li class="option${markOptions && flatSet.has(i) ? " is-answer" : ""}">
               <span class="idx">${i}</span><span>${highlight(line, matcher)}</span>
             </li>`
        )
        .join("")}</ol>`;
    }

    if (groups) {
      html += groups
        .map((group, gi) => {
          const picks = group.map(String);
          const label = groups.length > 1 ? `ชุดที่ ${gi + 1}` : "ตัวเลือกที่เลือก";
          return `<div class="group-row"><span class="answer-key-label">${label}</span>${picks
            .map((p) => `<span class="chip ans"><span class="num">${esc(p)}</span></span>`)
            .join("")}</div>`;
        })
        .join("");
    } else {
      html += `<div class="answer-key"><span class="answer-key-label">คำตอบ</span>${chipList(flat, {
        ans: true,
        numbered: true,
      })}</div>`;
    }

    return `<div class="answer-box">${html}</div>
      <p class="answer-note">ตัวเลขคือดัชนีตัวเลือก (เริ่มที่ 0) เรียงตามตัวเลือกในโจทย์${
        !groups && flat.length && flat.every((v) => v === "0" || v === "1") && /true\s*\n\s*false/i.test(item.body)
          ? " · 0 = True, 1 = False"
          : ""
      }${flat.length ? "" : " · ข้อนี้ไม่มีข้อมูลเฉลยในไฟล์"}</p>`;
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

    if (answers.length && chunks.length === answers.length) {
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
    )}</div><p class="answer-note">จับคู่ตามลำดับจากข้อมูลต้นฉบับ</p>`;
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
          <img src="${esc(img.src)}" data-remote="${esc(img.remoteSrc || "")}" alt="${esc(label)}" loading="lazy" decoding="async">
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

    if (type === "answer" || type === "drag-drop") {
      const table = renderDropTable(item, matcher);
      if (table) return table;

      const filled = tryFill(item, matcher);
      if (filled) {
        return `<div class="answer-box"><div class="filled-text">${filled}</div></div>
          <div class="answer-key"><span class="answer-key-label">ลำดับคำตอบ</span>${chipList(flat, {
            ans: true,
            numbered: true,
            matcher,
          })}</div>
          <p class="answer-note">ช่องว่างถูกเติมด้วยเฉลยจากข้อมูล (เรียงตามลำดับช่อง)</p>`;
      }
      return `<div class="answer-box">${autoAnswerBlock(flat, matcher)}</div>
        <p class="answer-note">เฉลยเรียงตามลำดับช่องว่าง/คำตอบในข้อมูลต้นฉบับ</p>`;
    }

    if (type === "toggle-solution") {
      return `<div class="answer-box">${autoAnswerBlock(flat, matcher)}</div>
        <p class="answer-note">เฉลยเรียงตามลำดับจากข้อมูลต้นฉบับ</p>`;
    }

    if (type === "single-choice" || type === "multiple-choice") {
      return renderChoices(item, matcher);
    }

    if (type === "scrambled-sentence") {
      const sentences = (item.answers || []).map((group) => joinTokens(group));
      return `<div class="answer-box">${answerList(sentences, matcher)}</div>
        <p class="answer-note">ลำดับคำ/ประโยคตามข้อมูลที่บันทึกไว้</p>`;
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

  // Return copyable values in the same order as the source data.
  function copyValues(item) {
    const type = item.answerType;
    if (type === 'intro' || type === 'picture-choice') return [];
    if (type === 'mark-text') {
      const words = item.body.split(/\s+/).filter(Boolean);
      const positions = item.answers?.group_positions || item.answers?.all_positions || [];
      return positions.map(i => words[i]).filter(Boolean);
    }
    if (type === 'scrambled-sentence') return (item.answers || []).map(joinTokens).filter(Boolean);
    if (type === 'scrambled-table') return (item.answers || []).slice().sort((a,b) => (a.idx ?? 0) - (b.idx ?? 0)).map(a => a.text).filter(Boolean);
    const values = flatten(item.answers);
    if (type === 'single-choice' || type === 'multiple-choice') {
      if (values.length && values.every(v => v === '0' || v === '1') && /true\s*\n\s*false/i.test(item.body)) return values.map(v => v === '0' ? 'True' : 'False');
      const lines = item.body.split('\n').map(v => v.trim()).filter(Boolean);
      const groups = item.answers;
      if (Array.isArray(groups) && groups.length === 1 && Array.isArray(groups[0]) && lines.length <= 24 && values.every(v => /^\d+$/.test(v) && Number(v) < lines.length)) return values.map(v => lines[Number(v)]);
    }
    return values;
  }
  const results = $('#results'), status = $('#status'), more = $('#more');
  const search = $('#search'), chapter = $('#chapter'), type = $('#type'), images = $('#images');
  let page = 1, currentItems = [], requestNumber = 0, controller, timer, filtersReady = false;
  function card(item) {
    const values = copyValues(item);
    const indexNote = (item.answerType === 'single-choice' || item.answerType === 'multiple-choice') && values.some(value => /^\d+$/.test(value)) ? '<p class="answer-note">ตัวเลขที่แสดงเป็นดัชนีตัวเลือกจากข้อมูลต้นฉบับ ตรวจสอบตัวเลือกก่อนนำไปใช้</p>' : '';
    const copyArea = values.length ? `<div class="copy-area"><div class="copy-area-head"><strong>คัดลอกคำตอบ</strong><button class="copy-all" type="button" data-copy-all="${esc(item.id)}">คัดลอกทั้งหมด</button></div>${indexNote}<div class="copy-list">${values.map((value, index) => `<div class="copy-row"><span class="copy-number">${index + 1}</span><span class="copy-value">${esc(value)}</span><button class="copy-one" type="button" data-copy-id="${esc(item.id)}" data-copy-index="${index}" aria-label="คัดลอกคำตอบข้อ ${index + 1}">คัดลอก</button></div>`).join('')}</div></div>` : '';
    const prompt = item.prompt && item.prompt !== item.title && item.prompt !== item.body ? `<p class="card-prompt">${esc(item.prompt)}</p>` : '';
    return `<article class="card"><div class="badges"><span>${esc(item.chapter)}</span><span>${esc(item.typeLabel)}</span><span>หน้า ${esc(item.page ?? '—')}</span></div>${item.exercise && item.exercise !== item.title ? `<p class="card-exercise">${esc(item.exercise)}</p>` : ''}<h3>${esc(item.title || item.exercise || 'ไม่มีชื่อข้อ')}</h3>${prompt}${item.body ? `<div class="question-body">${esc(item.body)}</div>` : ''}<div class="answer-panel"><div class="answer-head">เฉลย</div>${renderAnswer(item, null)}</div>${copyArea}</article>`;
  }
  async function load(append = false) {
    if (controller) controller.abort();
    controller = new AbortController();
    const number = ++requestNumber;
    if (!append) { page = 1; currentItems = []; results.innerHTML = ''; }
    more.hidden = true; status.textContent = 'กำลังค้นหา…';
    const params = new URLSearchParams({q: search.value.trim(), chapter: chapter.value, type: type.value, images: images.checked ? '1' : '0', page: String(page)});
    try {
      const response = await fetch('/api/search?' + params, {signal: controller.signal});
      if (!response.ok) throw new Error('Request failed');
      const data = await response.json();
      if (number !== requestNumber) return;
      if (!filtersReady) {
        for (const value of data.chapters) chapter.add(new Option(value, value));
        for (const [value, label] of data.types) type.add(new Option(label, value));
        filtersReady = true;
      }
      currentItems.push(...data.items);
      results.insertAdjacentHTML('beforeend', data.items.map(card).join(''));
      status.textContent = `พบ ${data.total.toLocaleString('th-TH')} รายการ · แสดง ${currentItems.length.toLocaleString('th-TH')} รายการ`;
      if (!data.total) results.innerHTML = '<div class="empty"><strong>ไม่พบคำตอบที่ตรงกัน</strong><p>ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง</p></div>';
      delete more.dataset.retry; more.textContent = 'แสดงเพิ่มเติม';
      more.hidden = !data.hasMore;
    } catch (error) {
      if (error.name === 'AbortError' || number !== requestNumber) return;
      status.textContent = 'โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง';
      more.textContent = 'ลองอีกครั้ง'; more.hidden = false;
      // Retry the same page on failure, rather than skipping it.
      more.dataset.retry = '1';
    }
  }
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => load(), 250); });
  for (const filter of [chapter, type, images]) filter.addEventListener('change', () => { clearTimeout(timer); load(); });
  $('#reset').addEventListener('click', () => { clearTimeout(timer); search.value = ''; chapter.value = 'all'; type.value = 'all'; images.checked = false; load(); });
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
