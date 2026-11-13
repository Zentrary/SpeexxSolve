const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('home describes the answer site plainly without decorative slogans', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.match(html, /เว็บไซต์เฉลยแบบฝึกหัด Speexx/);
  assert.match(html, /ใช้งานฟรี ไม่มีค่าใช้จ่าย/);
  assert.match(html, /ไม่ได้เป็นเว็บไซต์ทางการของ Speexx/);
  for (const removed of ['พื้นที่เล็ก ๆ สำหรับการเรียนรู้ของคุณ', 'เรียนรู้ในแบบของคุณ', 'ONE STEP AT A TIME', 'SS / 01', 'เว็บไซต์นี้จัดทำเพื่อช่วยในการทบทวนและฝึกภาษาอังกฤษ', 'YOUR STUDY COMPANION']) {
    assert.ok(!html.includes(removed), removed);
  }
  assert.match(html, /href="\/vault\.html"/);
});
