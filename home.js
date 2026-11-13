/* ════════════════════════════════════════════════════════════════════════
   HOME PAGE — credit init (ลดการพึ่งพา app.js)
   ══════════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const CFG = window.SITE_CONFIG || {};
  const owner = CFG.owner || {};
  const credit = CFG.credit || {};
  const socials = Array.isArray(CFG.socials) ? CFG.socials.filter((s) => s && s.url) : [];

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

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const nameEl = document.getElementById("homeCreditName");
  const handleEl = document.getElementById("homeCreditHandle");
  const taglineEl = document.getElementById("homeCreditTagline");
  const socialsEl = document.getElementById("homeCreditSocials");
  const noteEl = document.getElementById("homeCreditNote");
  const avatar = document.getElementById("homeAvatar");

  if (nameEl) nameEl.textContent = owner.name || "ชื่อของคุณ";
  if (handleEl) handleEl.textContent = owner.handle || "";
  if (taglineEl) taglineEl.textContent = owner.tagline || "";
  if (noteEl) noteEl.textContent = credit.note || "คลังคำตอบนี้จัดทำขึ้นเพื่อใช้ทบทวนและฝึกภาษาอังกฤษเท่านั้น";

  if (avatar) {
    avatar.src = owner.photo || "assets/profile.svg";
    avatar.onerror = () => {
      avatar.onerror = null;
      avatar.src = owner.fallbackPhoto || "assets/profile.svg";
    };
  }

  if (socialsEl) {
    if (socials.length) {
      socialsEl.innerHTML = socials
        .map(
          (s) =>
            `<a class="social-btn" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${
              SOCIAL_ICONS[s.icon] || SOCIAL_ICONS.globe
            }<span><strong>${esc(s.label || s.icon || "Link")}</strong><br><small>${esc(s.handle || s.url)}</small></span></a>`
        )
        .join("");
    } else {
      socialsEl.innerHTML =
        '<span class="muted">ยังไม่ได้ใส่ลิงก์โซเชียล — แก้ไขได้ใน config.js</span>';
    }
  }
})();
