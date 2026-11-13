const config = window.SITE_CONFIG || {};
const owner = config.owner || {};
document.querySelector('#ownerName').textContent = owner.name || 'ผู้จัดทำ';
document.querySelector('#ownerTagline').textContent = owner.tagline || '';
const photo = document.querySelector('#ownerPhoto');
if (owner.photo) photo.src = owner.photo;
photo.onerror = () => { photo.onerror = null; photo.src = '/assets/profile.svg'; };
const links = document.querySelector('#ownerLinks');
for (const social of config.socials || []) {
  let url;
  try { url = new URL(social.url); } catch { /* The owner has not supplied a URL yet. */ }
  if (url && ['https:', 'http:'].includes(url.protocol)) {
    const link = document.createElement('a'); link.href = url.href; link.textContent = social.label || url.hostname;
    link.target = '_blank'; link.rel = 'noopener noreferrer'; links.append(link);
  } else {
    const label = document.createElement('span'); label.className = 'social-placeholder';
    label.textContent = (social.label || 'Social') + ' · ยังไม่ได้เพิ่มลิงก์'; links.append(label);
  }
}
