const config = window.SITE_CONFIG || {};
const owner = config.owner || {};
document.querySelector('#ownerName').textContent = owner.name || 'ผู้จัดทำ';
document.querySelector('#ownerTagline').textContent = owner.tagline || '';
const photo = document.querySelector('#ownerPhoto');
if (owner.photo) photo.src = owner.photo;
photo.onerror = () => { photo.onerror = null; photo.src = '/assets/profile.svg'; };
for (const social of config.socials || []) {
  try {
    const url = new URL(social.url);
    if (!['https:', 'http:'].includes(url.protocol)) continue;
    const link = document.createElement('a'); link.href = url.href; link.textContent = social.label || url.hostname;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    document.querySelector('#ownerLinks').append(link);
  } catch { /* Ignore invalid links in config. */ }
}
