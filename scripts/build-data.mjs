import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "solve data");
const IMAGE_DIR = path.join(ROOT, "public", "assets", "images");

const CHAPTER_ORDER = [
  "A1",
  "A2",
  "B1.1",
  "B1.2",
  "B2.1",
  "B2.2",
  "C1.1",
  "C1.2",
  "Excellence",
];

const TYPE_LABELS = {
  answer: "เติมคำในช่องว่าง",
  "drag-drop": "ลากคำลงช่องว่าง",
  "toggle-solution": "เลือกคำในช่องว่าง",
  "single-choice": "เลือกคำตอบ",
  "multiple-choice": "เลือกหลายคำตอบ",
  "scrambled-sentence": "เรียงประโยค",
  "scrambled-table": "จับคู่ตาราง",
  "mark-text": "ไฮไลต์ข้อความ",
  "picture-choice": "จับคู่รูปภาพ",
  pronunciation: "ออกเสียง",
  intro: "บทนำ",
};

const clean = (s) => (typeof s === "string" ? s.replace(/\r\n/g, "\n").trim() : "");

function splitQuestion(question) {
  const parts = String(question || "").split(" | ");
  if (parts.length === 1) {
    return { instruction: "", title: "", body: clean(parts[0]) };
  }
  return {
    instruction: clean(parts[0]),
    title: clean(parts[1]),
    body: clean(parts.slice(2).join(" | ")),
  };
}

function flatten(value, out = []) {
  if (value == null) return out;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") {
    out.push(String(value));
    return out;
  }
  if (Array.isArray(value)) {
    for (const v of value) flatten(v, out);
    return out;
  }
  if (t === "object") {
    if (typeof value.text === "string") {
      out.push(value.text);
    } else {
      for (const v of Object.values(value)) flatten(v, out);
    }
  }
  return out;
}

function answerText(answer) {
  if (!answer) return "";
  if (answer.type === "mark-text") {
    return "ไฮไลต์ข้อความ";
  }
  return flatten(answer.answers).join("  •  ");
}

async function downloadImage(src, name) {
  const target = path.join(IMAGE_DIR, name);
  try {
    const stat = await fs.stat(target);
    if (stat.size > 500) return `assets/images/${name}`;
  } catch {
  }
  try {
    const res = await fetch(src, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) throw new Error(`too small (${buf.length} bytes)`);
    await fs.writeFile(target, buf);
    return `assets/images/${name}`;
  } catch (err) {
    console.warn(`  ! image failed: ${name} (${err.message}) — keeping remote URL`);
    return src;
  }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  await fs.mkdir(IMAGE_DIR, { recursive: true });

  const files = (await fs.readdir(DATA_DIR)).filter((f) => /^answers_.*\.json$/i.test(f));
  const chapters = [];
  const items = [];
  const imageJobs = new Map();

  for (const file of files) {
    const raw = JSON.parse(await fs.readFile(path.join(DATA_DIR, file), "utf8"));
    const chapterName = raw.chapter?.name || file.replace(/^answers_|\.json$/gi, "");
    const chapterId = String(raw.chapter?.cid ?? chapterName);

    const chapter = {
      id: chapterName,
      cid: chapterId,
      updatedAt: raw.chapter?.updated_at || "",
      summary: raw.chapter?.summary || {},
      catalog: Array.isArray(raw.chapter?.catalog)
        ? raw.chapter.catalog.map((c) => ({
            title: clean(c.title),
            pagesTotal: Number(c.pages_total) || 0,
          }))
        : [],
      exerciseCount: 0,
      pageCount: 0,
      imageCount: 0,
    };

    (raw.exercises || []).forEach((exercise, exerciseIndex) => {
      chapter.exerciseCount += 1;
      const exerciseTitle = clean(exercise.title);
      const pages = Array.isArray(exercise.pages) ? exercise.pages : [];

      pages.forEach((page, pageIndex) => {
        const answer = page.answer || {};
        const type = page.type || answer.type || "unknown";
        const parsed = splitQuestion(page.question);
        const prompt = clean(page.prompt) || parsed.instruction;
        const images = [];

        if (answer.type === "picture-choice" && Array.isArray(answer.answers)) {
          for (const pic of answer.answers) {
            if (!pic || !pic.src) continue;
            const name = String(pic.src).split("/").pop().split("?")[0] || `image-${images.length}.jpg`;
            if (!imageJobs.has(pic.src)) imageJobs.set(pic.src, name);
            images.push({
              src: pic.src,
              remoteSrc: pic.src,
              itemIdx: Number.isFinite(pic.item_idx) ? pic.item_idx : images.length,
              dragId: pic.drag_id || "",
            });
          }
          chapter.imageCount += images.length;
        }

        const id = `${chapterName}-${exerciseIndex}-${pageIndex}`;
        const isMarkText = answer.type === "mark-text";
        const positions = isMarkText
          ? {
              group_positions: Array.isArray(answer.group_positions) ? answer.group_positions : [],
              all_positions: Array.isArray(answer.all_positions)
                ? answer.all_positions
                : Array.isArray(answer.group_positions)
                  ? answer.group_positions
                  : [],
            }
          : null;
        const markedWords =
          isMarkText && positions
            ? parsed.body
                .split(/\s+/)
                .filter(Boolean)
                .filter((_, i) => positions.group_positions.includes(i))
                .join(", ")
            : "";

        items.push({
          id,
          chapter: chapterName,
          chapterId,
          exercise: exerciseTitle,
          exerciseIndex,
          exercisePages: Number(exercise.pages_total) || pages.length,
          page: page.page ?? null,
          pageIndex,
          type,
          typeLabel: TYPE_LABELS[answer.type] || TYPE_LABELS[type] || type,
          prompt,
          instruction: parsed.instruction,
          title: parsed.title || exerciseTitle,
          body: parsed.body,
          question: clean(page.question),
          answerType: answer.type || type,
          answers: positions || (answer.answers ?? []),
          answerText: isMarkText ? markedWords : answerText(answer),
          images,
          answerTimestamp: answer.timestamp || "",
          updatedAt: page.updated_at || "",
        });
      });
      chapter.pageCount = items.filter((i) => i.chapter === chapterName).length;
    });

    chapters.push(chapter);
    console.log(`${chapterName}: ${chapter.exerciseCount} exercises, ${chapter.pageCount} answered pages`);
  }
  chapters.sort((a, b) => {
    const ai = CHAPTER_ORDER.indexOf(a.id);
    const bi = CHAPTER_ORDER.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const order = new Map(chapters.map((c, i) => [c.id, i]));
  items.sort((a, b) => {
    const c = (order.get(a.chapter) ?? 99) - (order.get(b.chapter) ?? 99);
    if (c) return c;
    if (a.exerciseIndex !== b.exerciseIndex) return a.exerciseIndex - b.exerciseIndex;
    return a.pageIndex - b.pageIndex;
  });
  const jobs = [...imageJobs.entries()];
  console.log(`\nDownloading ${jobs.length} images to assets/images ...`);
  const localPaths = await mapLimit(jobs, 8, ([src, name]) => downloadImage(src, name));
  const imageMap = new Map(jobs.map(([src], i) => [src, localPaths[i]]));
  for (const item of items) {
    item.images = item.images.map((img) => ({
      ...img,
      src: imageMap.get(img.src) || img.src,
    }));
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: "solve data/*.json",
    chapters,
    items,
  };

  const json = JSON.stringify(output);
  await fs.mkdir(path.join(ROOT, "server"), { recursive: true });
  await fs.writeFile(path.join(ROOT, "server", "data.json"), json, "utf8");

  const size = (Buffer.byteLength(json) / 1024 / 1024).toFixed(2);
  console.log(`\nWrote server/data.json (${size} MB): ${chapters.length} chapters, ${items.length} pages.`);
  console.log(`Images: ${jobs.length} files in assets/images.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
