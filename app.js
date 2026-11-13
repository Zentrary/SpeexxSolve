/* ═══════════════════════════════════════════════════════════
   SPEXX ANSWER VAULT — app.js
   ═══════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const DATA = window.SPEXX_DATA;
  const CFG = window.SITE_CONFIG || {};
  const PAGE_SIZE = 30;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  if (!DATA || !Array.isArray(DATA.items)) {
    document.body.innerHTML =
      '<div style="padding:60px;font-family:sans-serif;color:#e9ebee;background:#08090b;min-height:100vh">' +
      "<h1>ไม่พบข้อมูล</h1><p>กรุณารัน <code>node scripts/build-data.mjs</code> เพื่อสร้าง data.js ก่อนเปิดเว็บ</p></div>";
    return;
  }

  /* ── helpers ─────────────────────────────────────────────── */
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
  const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fold = (s) =>
    String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const nf = new Intl.NumberFormat("en-US");
  const fmt = (n) => nf.format(n);

  function flatten(value, out = []) {
    if (value == null) return out;
    const t = typeof value;
    if (t === "string" || t === "number" || t === "boolean") {
      if (String(value) !== "") out.push(String(value));
      return out;
    }
    if (Array.isArray(value)) {
      for (const v of value) flatten(v, out);
      return out;
    }
    if (t === "object") {
      if (typeof value.text === "string") out.push(value.text);
      else for (const v of Object.values(value)) flatten(v, out);
    }
    return out;
  }

  const ITEMS = DATA.items.map((item, index) => {
    const hay = [
      item.chapter,
      item.exercise,
      item.title,
      item.prompt,
      item.body,
      item.answerText,
      item.typeLabel,
    ].join("\n");
    return Object.assign(item, {
      _index: index,
      _hay: hay,
      _hayFold: fold(hay),
      _titleFold: fold(`${item.title} ${item.exercise}`),
      _answerFold: fold(item.answerText),
    });
  });

  const CHAPTERS = DATA.chapters || [];
  const EXERCISE_COUNT = new Set(ITEMS.map((i) => `${i.chapter}|${i.exerciseIndex}`)).size;
  const IMAGE_COUNT = ITEMS.reduce((n, i) => n + (i.images ? i.images.length : 0), 0);

  /* ── search state ────────────────────────────────────────── */
  const state = {
    q: "",
    chapter: "all",
    type: "all",
    images: false,
    matchCase: false,
    wholeWord: false,
    regex: false,
    limit: PAGE_SIZE,
  };

  /* ── search matcher ──────────────────────────────────────── */
  function buildMatcher(query) {
    const raw = String(query || "").trim();
    if (!raw) return { tokens: [], regex: null, wordRegexes: null, invalid: false };

    if (state.regex) {
      try {
        return {
          tokens: [raw],
          wordRegexes: null,
          regex: new RegExp(raw, state.matchCase ? "g" : "gi"),
          invalid: false,
        };
      } catch {
        return { tokens: [], wordRegexes: null, regex: null, invalid: true };
      }
    }

    const tokens = (raw.match(/"[^"]*"|“[^”]*”|\S+/g) || [])
      .map((t) => t.replace(/^["“]|["”]$/g, "").trim())
      .filter(Boolean);
    if (!tokens.length) return { tokens: [], regex: null, invalid: false };

    const source = tokens
      .map((token) => {
        let part = escRe(token);
        if (state.wholeWord) {
          part = `(?<![\\p{L}\\p{N}_])${part}(?![\\p{L}\\p{N}_])`;
        }
        return part;
      })
      .join("|");

    let wordRegexes = null;
    if (state.wholeWord) {
      try {
        wordRegexes = tokens.map(
          (token) =>
            new RegExp(
              `(?<![\\p{L}\\p{N}_])${escRe(token)}(?![\\p{L}\\p{N}_])`,
              state.matchCase ? "u" : "iu"
            )
        );
      } catch {
        wordRegexes = null;
      }
    }

    try {
      return {
        tokens,
        wordRegexes,
        regex: new RegExp(source, state.matchCase ? "gu" : "giu"),
        invalid: false,
      };
    } catch {
      try {
        return {
          tokens,
          wordRegexes,
          regex: new RegExp(source, state.matchCase ? "g" : "gi"),
          invalid: false,
        };
      } catch {
        return { tokens: [], wordRegexes: null, regex: null, invalid: true };
      }
    }
  }

  function rawRegex(matcher) {
    if (!matcher || !matcher.regex) return null;
    const flags = matcher.regex.flags.includes("g") ? matcher.regex.flags : matcher.regex.flags + "g";
    return new RegExp(matcher.regex.source, flags);
  }

  function highlight(text, matcher) {
    const str = String(text ?? "");
    const re = matcher && matcher.regex ? rawRegex(matcher) : null;
    if (!re || !str) return esc(str);

    let out = "";
    let last = 0;
    let guard = 0;
    let m;
    while ((m = re.exec(str)) && guard++ < 800) {
      if (m[0] === "") {
        re.lastIndex += 1;
        continue;
      }
      out += esc(str.slice(last, m.index));
      out += `<mark class="hl">${esc(m[0])}</mark>`;
      last = m.index + m[0].length;
    }
    out += esc(str.slice(last));
    return out;
  }

  function matches(item, matcher) {
    if (!matcher.tokens.length && !matcher.regex) return true;

    if (state.regex) {
      const re = rawRegex(matcher);
      if (!re) return false;
      re.lastIndex = 0;
      return re.test(item._hay);
    }

    for (let i = 0; i < matcher.tokens.length; i++) {
      const token = matcher.tokens[i];
      if (matcher.wordRegexes) {
        const re = matcher.wordRegexes[i];
        re.lastIndex = 0;
        if (!re.test(item._hay)) return false;
      } else {
        const hay = state.matchCase ? item._hay : item._hayFold;
        const needle = state.matchCase ? token : fold(token);
        if (!hay.includes(needle)) return false;
      }
    }
    return true;
  }

  function score(item, matcher) {
    if (!matcher.tokens.length) return 0;
    let s = 0;
    for (const token of matcher.tokens) {
      const t = state.matchCase ? token : fold(token);
      const has = (str) => (state.matchCase ? str : fold(str)).includes(t);
      if (has(item.title)) s += 7;
      if (has(item.exercise)) s += 4;
      if (has(item.answerText)) s += 5;
      if (has(item.prompt)) s += 2;
      if (has(item.body)) s += 1;
    }
    return s;
  }

  function getFiltered() {
    const matcher = buildMatcher(state.q);
    if (matcher.invalid) return { items: [], matcher, invalid: true };

    const filtered = ITEMS.filter((item) => {
      if (state.chapter !== "all" && item.chapter !== state.chapter) return false;
      if (state.type !== "all" && item.answerType !== state.type) return false;
      if (state.images && (!item.images || !item.images.length)) return false;
      return matches(item, matcher);
    });

    if (state.q && matcher.tokens.length) {
      filtered.sort((a, b) => score(b, matcher) - score(a, matcher) || a._index - b._index);
    }
    return { items: filtered, matcher, invalid: false };
  }

  /* ── answer formatting ───────────────────────────────────── */
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

  function answerPlain(item) {
    const type = item.answerType;
    if (type === "mark-text") {
      const tokens = item.body.split(/\s+/).filter(Boolean);
      const positions = new Set(item.answers?.group_positions || item.answers?.all_positions || []);
      return tokens.filter((_, i) => positions.has(i)).join(", ");
    }
    if (type === "picture-choice") {
      const options = item.body.split("\n").map((s) => s.trim()).filter(Boolean);
      return item.images
        .slice()
        .sort((a, b) => a.itemIdx - b.itemIdx)
        .map((img) => `${img.itemIdx}. ${options[img.itemIdx] || "image"}`)
        .join(" | ");
    }
    if (type === "scrambled-sentence") {
      return (item.answers || []).map((g) => joinTokens(g)).join("\n");
    }
    if (type === "scrambled-table") {
      return (item.answers || [])
        .slice()
        .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0))
        .map((a) => a.text)
        .join(" | ");
    }
    return flatten(item.answers).join(" | ");
  }

  /* ── card rendering ──────────────────────────────────────── */
  const ICON_COPY = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none"><rect x="8.5" y="8.5" width="11" height="11" rx="2.2" stroke="currentColor" stroke-width="1.5"/><path d="M15.5 8.5V6.7A2.2 2.2 0 0 0 13.3 4.5H6.7a2.2 2.2 0 0 0-2.2 2.2v6.6a2.2 2.2 0 0 0 2.2 2.2h1.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  const ICON_LINK = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M10 14a4.2 4.2 0 0 0 6 0l2.2-2.2a4.2 4.2 0 0 0-6-6L11 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-2.2 2.2a4.2 4.2 0 0 0 6 6L13 17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

  function renderCard(item, matcher) {
    const title = item.title || item.exercise || "ไม่มีชื่อข้อ";
    const showExercise = item.exercise && item.exercise !== title;
    const canExpand = item.body.length > 360 || item.body.split("\n").length > 9;
    const pageLabel = item.page == null ? "—" : item.page;
    const hasImages = item.images && item.images.length > 0;

    const prompt =
      item.prompt && item.prompt !== item.title && item.prompt !== item.body
        ? `<p class="card-prompt">${highlight(item.prompt, matcher)}</p>`
        : "";

    const body = item.body
      ? `<div class="question-wrap${canExpand ? " is-collapsed" : ""}">
           <div class="question-body">${highlight(item.body, matcher)}</div>
           ${canExpand ? '<button class="expand-btn" type="button">แสดงข้อความเต็ม</button>' : ""}
         </div>`
      : "";

    return `<article class="card" id="item-${esc(item.id)}">
      <div class="card-top">
        <div class="badges">
          <span class="badge badge-chapter">${esc(item.chapter)}</span>
          <span class="badge badge-type">${esc(item.typeLabel)}</span>
          <span class="badge badge-page">หน้า ${esc(pageLabel)}</span>
          ${hasImages ? '<span class="badge badge-img">รูปภาพ</span>' : ""}
        </div>
        <div class="card-actions">
          <button class="icon-btn" type="button" data-copy="${esc(item.id)}" title="คัดลอกโจทย์และเฉลย" aria-label="คัดลอกโจทย์และเฉลย">${ICON_COPY}</button>
          <button class="icon-btn" type="button" data-link="${esc(item.id)}" title="คัดลอกลิงก์ข้อนี้" aria-label="คัดลอกลิงก์ข้อนี้">${ICON_LINK}</button>
        </div>
      </div>
      ${showExercise ? `<p class="card-exercise">${esc(item.exercise)}</p>` : ""}
      <h3 class="card-title">${highlight(title, matcher)}</h3>
      ${prompt}
      ${body}
      <div class="answer-panel">
        <div class="answer-head">
          <span class="pulse" aria-hidden="true"></span>
          <span>เฉลย</span>
          <span class="answer-kind">${esc(item.typeLabel)}</span>
        </div>
        ${renderAnswer(item, matcher)}
      </div>
    </article>`;
  }

  /* ── UI render ───────────────────────────────────────────── */
  const resultsEl = $("#results");
  const emptyEl = $("#emptyState");
  const countEl = $("#resultCount");
  const timeEl = $("#searchTime");
  const loadMoreEl = $("#loadMore");
  const activeFiltersEl = $("#activeFilters");
  const searchInput = $("#searchInput");
  const searchWrap = $("#searchWrap");
  const clearBtn = $("#clearBtn");

  let lastFiltered = [];
  let masonryTimer = 0;

  /* Masonry-ish packing: cards span 8px grid rows so tall cards don't
     leave large holes in the next row. */
  function layoutMasonry() {
    const cards = Array.from(resultsEl.children);
    if (!cards.length) {
      resultsEl.classList.remove("masonry");
      return;
    }
    resultsEl.classList.add("masonry");
    const gap = parseFloat(getComputedStyle(resultsEl).rowGap) || 20;
    for (const card of cards) card.style.gridRowEnd = "auto";
    void resultsEl.offsetHeight;
    const heights = cards.map((card) => card.getBoundingClientRect().height);
    if (heights.every((height) => height < 20)) {
      resultsEl.classList.remove("masonry");
      return;
    }
    cards.forEach((card, i) => {
      const span = Math.max(1, Math.ceil((heights[i] + gap) / (8 + gap)));
      card.style.gridRowEnd = `span ${span}`;
    });
  }

  function scheduleMasonry() {
    clearTimeout(masonryTimer);
    masonryTimer = setTimeout(layoutMasonry, 70);
  }

  function render() {
    const t0 = performance.now();
    const { items, matcher, invalid } = getFiltered();
    lastFiltered = items;

    searchWrap.classList.toggle("is-invalid", invalid);
    clearBtn.hidden = !searchInput.value;

    if (invalid) {
      resultsEl.innerHTML = "";
      resultsEl.classList.remove("masonry");
      emptyEl.hidden = false;
      emptyEl.querySelector("h2").textContent = "นิพจน์ค้นหาไม่ถูกต้อง";
      emptyEl.querySelector("p").textContent =
        "ลองตรวจสอบวงเล็บหรืออักขระพิเศษของ Regular Expression อีกครั้ง";
      countEl.textContent = "พบ 0 รายการ";
      timeEl.textContent = "";
      loadMoreEl.hidden = true;
      renderActiveFilters();
      return;
    }

    emptyEl.querySelector("h2").textContent = "ไม่พบคำตอบที่ตรงกัน";
    emptyEl.querySelector("p").textContent =
      "ลองพิมพ์คำสั้นลง เปลี่ยนตัวพิมพ์ หรือปิดตัวกรองบางตัวดูนะครับ";

    const slice = items.slice(0, state.limit);
    emptyEl.hidden = items.length > 0;
    resultsEl.hidden = items.length === 0;
    resultsEl.innerHTML = slice.map((item) => renderCard(item, matcher)).join("");
    layoutMasonry();
    resultsEl.querySelectorAll("img").forEach((img) => {
      img.addEventListener("load", scheduleMasonry, { once: true });
    });

    const hasQuery = Boolean(state.q.trim());
    countEl.innerHTML = hasQuery
      ? `พบ <strong>${fmt(items.length)}</strong> รายการ`
      : `<strong>${fmt(items.length)}</strong> คำตอบทั้งหมด`;
    const ms = Math.max(0.4, performance.now() - t0);
    timeEl.textContent = `· ${ms.toFixed(1)} ms`;

    const remaining = items.length - slice.length;
    loadMoreEl.hidden = remaining <= 0;
    if (remaining > 0) {
      loadMoreEl.textContent = `โหลดเพิ่มอีก ${fmt(Math.min(remaining, PAGE_SIZE))} รายการ (เหลือ ${fmt(remaining)})`;
    }

    renderActiveFilters();
  }

  function renderActiveFilters() {
    const parts = [];
    if (state.q.trim()) {
      parts.push(
        `<span class="active-filter">ค้นหา “${esc(state.q.trim())}”
          <button type="button" data-clear="q" aria-label="ล้างคำค้นหา">✕</button></span>`
      );
    }
    if (state.chapter !== "all") {
      parts.push(
        `<span class="active-filter">${esc(state.chapter)}
          <button type="button" data-clear="chapter" aria-label="ล้างตัวกรองระดับ">✕</button></span>`
      );
    }
    if (state.type !== "all") {
      const label = ITEMS.find((i) => i.answerType === state.type)?.typeLabel || state.type;
      parts.push(
        `<span class="active-filter">${esc(label)}
          <button type="button" data-clear="type" aria-label="ล้างตัวกรองประเภท">✕</button></span>`
      );
    }
    if (state.images) {
      parts.push(
        `<span class="active-filter">เฉพาะข้อที่มีรูป
          <button type="button" data-clear="images" aria-label="ล้างตัวกรองรูปภาพ">✕</button></span>`
      );
    }
    activeFiltersEl.innerHTML = parts.join("");
  }

  /* ── init controls ───────────────────────────────────────── */
  function initStats() {
    $("#heroStats").innerHTML = `
      <div class="stat"><b>${CHAPTERS.length}</b><span>Levels</span></div>
      <div class="stat"><b>${fmt(ITEMS.length)}</b><span>Answers</span></div>
      <div class="stat"><b>${fmt(EXERCISE_COUNT)}</b><span>Exercises</span></div>`;

    $("#footerStats").textContent = `${CHAPTERS.length} ระดับ · ${fmt(ITEMS.length)} คำตอบ · ${fmt(
      EXERCISE_COUNT
    )} บทเรียน · ${fmt(IMAGE_COUNT)} รูปภาพ`;
  }

  function initChapters() {
    const counts = new Map();
    for (const item of ITEMS) counts.set(item.chapter, (counts.get(item.chapter) || 0) + 1);
    const pills = [
      `<button type="button" class="chapter-pill active" data-chapter="all">ทั้งหมด <small>${fmt(
        ITEMS.length
      )}</small></button>`,
    ];
    for (const chapter of CHAPTERS) {
      const count = counts.get(chapter.id) || 0;
      pills.push(
        `<button type="button" class="chapter-pill" data-chapter="${esc(chapter.id)}">${esc(
          chapter.id
        )} <small>${fmt(count)}</small></button>`
      );
    }
    $("#chapterPills").innerHTML = pills.join("");
  }

  function initTypes() {
    const counts = new Map();
    for (const item of ITEMS) counts.set(item.answerType, (counts.get(item.answerType) || 0) + 1);
    const options = [`<option value="all">ทั้งหมด (${fmt(ITEMS.length)})</option>`];
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        const label = ITEMS.find((i) => i.answerType === type)?.typeLabel || type;
        options.push(`<option value="${esc(type)}">${esc(label)} (${fmt(count)})</option>`);
      });
    $("#typeFilter").innerHTML = options.join("");
  }

  /* ── toast / clipboard ───────────────────────────────────── */
  let toastTimer;
  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1900);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      area.remove();
      return ok;
    }
  }

  function copyItem(item) {
    const text = [
      `[${item.chapter}] ${item.exercise || ""} — หน้า ${item.page ?? "-"}`,
      item.title || "",
      item.prompt || "",
      "",
      item.body || "",
      "",
      "เฉลย:",
      answerPlain(item),
    ]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
    copyText(text).then((ok) =>
      toast(ok ? "คัดลอกโจทย์และเฉลยแล้ว" : "คัดลอกไม่สำเร็จ กรุณาลองใหม่")
    );
  }

  function copyLink(item) {
    const url = `${location.href.split("#")[0]}#${item.id}`;
    history.replaceState(null, "", `#${item.id}`);
    copyText(url).then((ok) => toast(ok ? "คัดลอกลิงก์ข้อนี้แล้ว" : "คัดลอกไม่สำเร็จ"));
  }

  function scrollToItem(id, flash = true) {
    requestAnimationFrame(() => {
      const el = document.getElementById(`item-${id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (flash) {
        el.classList.remove("is-flash");
        void el.offsetWidth;
        el.classList.add("is-flash");
      }
    });
  }

  function openFromHash() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!id) return;
    const item = ITEMS.find((i) => i.id === id);
    if (!item) return;

    state.q = "";
    searchInput.value = "";
    state.chapter = item.chapter;
    state.type = item.answerType;
    state.images = false;
    syncChapterPills();
    $("#typeFilter").value = item.answerType;

    const { items } = getFiltered();
    const at = items.findIndex((i) => i.id === id);
    if (at >= 0) state.limit = Math.max(PAGE_SIZE, at + 1);
    render();
    scrollToItem(id);
  }

  /* ── filters events ──────────────────────────────────────── */
  function syncChapterPills() {
    $$(".chapter-pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.chapter === state.chapter);
    });
  }

  function resetAll() {
    state.q = "";
    state.chapter = "all";
    state.type = "all";
    state.images = false;
    state.limit = PAGE_SIZE;
    searchInput.value = "";
    $("#typeFilter").value = "all";
    $("#imageToggle").setAttribute("aria-pressed", "false");
    syncChapterPills();
    render();
  }

  let inputTimer;
  searchInput.addEventListener("input", () => {
    clearBtn.hidden = !searchInput.value;
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      state.q = searchInput.value;
      state.limit = PAGE_SIZE;
      render();
    }, 140);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (searchInput.value) {
        searchInput.value = "";
        state.q = "";
        state.limit = PAGE_SIZE;
        render();
      } else {
        searchInput.blur();
      }
    }
    if (e.key === "Enter") {
      clearTimeout(inputTimer);
      state.q = searchInput.value;
      state.limit = PAGE_SIZE;
      render();
    }
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    state.q = "";
    state.limit = PAGE_SIZE;
    render();
    searchInput.focus();
  });

  $$(".search-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key =
        btn.dataset.opt === "case" ? "matchCase" : btn.dataset.opt === "word" ? "wholeWord" : "regex";
      state[key] = !state[key];
      btn.setAttribute("aria-pressed", String(state[key]));
      state.limit = PAGE_SIZE;
      render();
    });
  });

  $("#chapterPills").addEventListener("click", (e) => {
    const btn = e.target.closest(".chapter-pill");
    if (!btn) return;
    state.chapter = btn.dataset.chapter;
    state.limit = PAGE_SIZE;
    syncChapterPills();
    render();
  });

  $("#typeFilter").addEventListener("change", (e) => {
    state.type = e.target.value;
    state.limit = PAGE_SIZE;
    render();
  });

  $("#imageToggle").addEventListener("click", () => {
    state.images = !state.images;
    $("#imageToggle").setAttribute("aria-pressed", String(state.images));
    state.limit = PAGE_SIZE;
    render();
  });

  $("#resetFilters").addEventListener("click", resetAll);
  $("#emptyReset").addEventListener("click", resetAll);

  activeFiltersEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-clear]");
    if (!btn) return;
    const what = btn.dataset.clear;
    if (what === "q") {
      state.q = "";
      searchInput.value = "";
    } else if (what === "chapter") {
      state.chapter = "all";
      syncChapterPills();
    } else if (what === "type") {
      state.type = "all";
      $("#typeFilter").value = "all";
    } else if (what === "images") {
      state.images = false;
      $("#imageToggle").setAttribute("aria-pressed", "false");
    }
    state.limit = PAGE_SIZE;
    render();
  });

  loadMoreEl.addEventListener("click", () => {
    state.limit += PAGE_SIZE;
    render();
  });

  document.addEventListener("click", (e) => {
    const copyBtn = e.target.closest("[data-copy]");
    if (copyBtn) {
      const item = ITEMS.find((i) => i.id === copyBtn.dataset.copy);
      if (item) copyItem(item);
      return;
    }

    const linkBtn = e.target.closest("[data-link]");
    if (linkBtn) {
      const item = ITEMS.find((i) => i.id === linkBtn.dataset.link);
      if (item) copyLink(item);
      return;
    }

    const expandBtn = e.target.closest(".expand-btn");
    if (expandBtn) {
      const wrap = expandBtn.closest(".question-wrap");
      const expanded = wrap.classList.toggle("is-expanded");
      wrap.classList.toggle("is-collapsed", !expanded);
      expandBtn.textContent = expanded ? "ย่อข้อความ" : "แสดงข้อความเต็ม";
      scheduleMasonry();
    }
  });

  /* remote image fallback */
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (img && img.tagName === "IMG" && img.dataset.remote) {
        const remote = img.dataset.remote;
        img.removeAttribute("data-remote");
        if (remote && img.src !== remote) img.src = remote;
      }
    },
    true
  );

  /* keyboard */
  document.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key.toLowerCase() === "k" || (e.shiftKey && e.key.toLowerCase() === "f"))) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  window.addEventListener("resize", scheduleMasonry);

  /* ── random ──────────────────────────────────────────────── */
  $("#randomBtn").addEventListener("click", () => {
    const { items } = getFiltered();
    const pool = items.length ? items : ITEMS;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) return;

    state.q = pick.title || pick.exercise || "";
    state.chapter = pick.chapter;
    state.type = "all";
    state.images = false;
    state.limit = PAGE_SIZE;
    searchInput.value = state.q;
    $("#typeFilter").value = "all";
    $("#imageToggle").setAttribute("aria-pressed", "false");
    syncChapterPills();
    render();

    const at = lastFiltered.findIndex((i) => i.id === pick.id);
    if (at >= 0 && at >= state.limit) {
      state.limit = at + 1;
      render();
    }
    scrollToItem(pick.id);
    toast(`สุ่มให้แล้ว: ${pick.title || pick.exercise}`);
  });

  /* ── credit modal ────────────────────────────────────────── */
  const SOCIAL_ICONS = {
    facebook:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M13.6 21v-7h2.5l.4-2.9h-2.9V9.3c0-.8.2-1.4 1.5-1.4h1.5V5.3c-.3 0-1.2-.1-2.2-.1-2.2 0-3.6 1.3-3.6 3.7v2.2H8.3V14h2.5v7h2.8z"/></svg>',
    instagram:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="4.6"/><circle cx="12" cy="12" r="3.6"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/></svg>',
    github:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 3.6a8.4 8.4 0 0 0-2.7 16.4c.4.1.6-.2.6-.5v-1.7c-2.3.5-2.8-1-2.8-1-.4-1-1-1.2-1-1.2-.8-.5.1-.5.1-.5.9.1 1.3.9 1.3.9.8 1.4 2.1 1 2.6.8.1-.6.3-1 .6-1.2-1.9-.2-3.8-.9-3.8-4.1 0-.9.3-1.6.9-2.2-.1-.2-.4-1.1.1-2.2 0 0 .7-.2 2.3.8a7.9 7.9 0 0 1 4.1 0c1.6-1 2.3-.8 2.3-.8.5 1.1.2 2 .1 2.2.6.6.9 1.3.9 2.2 0 3.2-1.9 3.9-3.8 4.1.3.3.6.8.6 1.7v2.5c0 .3.2.6.6.5A8.4 8.4 0 0 0 12 3.6Z"/></svg>',
    youtube:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M21.3 8.1a2.5 2.5 0 0 0-1.7-1.8C18 5.9 12 5.9 12 5.9s-6 0-7.6.4A2.5 2.5 0 0 0 2.7 8.1 26 26 0 0 0 2.3 12c0 1.3.1 2.6.4 3.9a2.5 2.5 0 0 0 1.7 1.8c1.6.4 7.6.4 7.6.4s6 0 7.6-.4a2.5 2.5 0 0 0 1.7-1.8c.3-1.3.4-2.6.4-3.9s-.1-2.6-.4-3.9ZM10.2 15V9l5.1 3-5.1 3Z"/></svg>',
    discord:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19.5 6.4A16 16 0 0 0 15.6 5l-.4.8a13 13 0 0 1 3.4 1.1 11.5 11.5 0 0 0-4.3-1.4h-.1a11.8 11.8 0 0 0-4.4 0h-.1A11.5 11.5 0 0 0 5.4 7 13 13 0 0 1 8.8 5.8L8.4 5a16 16 0 0 0-3.9 1.4C2.3 9.5 1.6 12.5 2 15.4A16 16 0 0 0 6.9 18l.7-1.2c-.8-.3-1.6-.7-2.3-1.2l.6-.4a12 12 0 0 0 10.2 0l.6.4c-.7.5-1.5.9-2.3 1.2l.7 1.2a16 16 0 0 0 4.9-2.6c.5-3.4-.5-6.4-2.5-9ZM9 13.7c-.9 0-1.7-.9-1.7-1.9S8 9.8 9 9.8s1.7.9 1.7 2-.8 1.9-1.7 1.9Zm6 0c-.9 0-1.7-.9-1.7-1.9s.8-2 1.7-2 1.7.9 1.7 2-.8 1.9-1.7 1.9Z"/></svg>',
    globe:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8.4"/><path d="M3.8 12h16.4M12 3.6c2.2 2.3 3.3 5 3.3 8.4s-1.1 6.1-3.3 8.4c-2.2-2.3-3.3-5-3.3-8.4S9.8 5.9 12 3.6Z"/></svg>',
  };

  const modal = $("#creditModal");
  let lastFocused = null;

  function initCredit() {
    const owner = CFG.owner || {};
    const credit = CFG.credit || {};

    $("#creditKicker").textContent = credit.kicker || "CRAFTED WITH CARE";
    $("#creditTitle").textContent = owner.name || "ชื่อของคุณ";
    $("#creditHandle").textContent = owner.handle || "";
    $("#creditTagline").textContent = owner.tagline || "";
    $("#creditNote").textContent = credit.note || "";

    const avatar = $("#creditAvatar");
    avatar.src = owner.photo || "assets/profile.svg";
    avatar.onerror = () => {
      avatar.onerror = null;
      avatar.src = owner.fallbackPhoto || "assets/profile.svg";
    };

    $("#creditStats").innerHTML = `
      <div><b>${fmt(ITEMS.length)}</b><span>Answers</span></div>
      <div><b>${CHAPTERS.length}</b><span>Levels</span></div>
      <div><b>${fmt(IMAGE_COUNT)}</b><span>Images</span></div>`;

    const socials = Array.isArray(CFG.socials) ? CFG.socials.filter((s) => s && s.url) : [];
    $("#creditSocials").innerHTML = socials
      .map(
        (s) => `<a class="social-btn" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">
          ${SOCIAL_ICONS[s.icon] || SOCIAL_ICONS.globe}
          <span class="social-copy"><b>${esc(s.label || s.icon || "Link")}</b><span>${esc(
          s.handle || s.url
        )}</span></span>
        </a>`
      )
      .join("");

    noSocialFallback();
  }

  function noSocialFallback() {
    if (!$("#creditSocials").children.length) {
      $("#creditSocials").innerHTML =
        '<span class="answer-note" style="grid-column:1/-1">เพิ่มลิงก์ Facebook / Instagram ของคุณได้ใน config.js</span>';
    }
  }

  function openCredit() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    // Force a reflow so the opening transition always runs (even in background tabs).
    void modal.offsetWidth;
    modal.classList.add("is-open");
    $(".modal-close", modal)?.focus();
    document.body.style.overflow = "hidden";
  }

  function closeCredit() {
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
    setTimeout(() => {
      modal.hidden = true;
      if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    }, 280);
  }

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeCredit();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeCredit();
    if (e.key === "Tab" && !modal.hidden) {
      const focusables = $$(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        modal
      ).filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  $("#creditBtn").addEventListener("click", openCredit);
  $("#footerCredit").addEventListener("click", openCredit);

  /* ── boot ────────────────────────────────────────────────── */
  initStats();
  initChapters();
  initTypes();
  initCredit();

  const params = new URLSearchParams(location.search);
  if (params.get("q")) {
    state.q = params.get("q");
    searchInput.value = state.q;
  }
  if (params.get("chapter")) {
    state.chapter = params.get("chapter");
    syncChapterPills();
  }
  if (params.get("type")) {
    state.type = params.get("type");
    $("#typeFilter").value = state.type;
  }

  render();
  openFromHash();

  if (CFG.credit?.showOnLoad && params.get("credit") !== "0") {
    setTimeout(openCredit, 550);
  }
})();
