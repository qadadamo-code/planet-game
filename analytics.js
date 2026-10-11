/* Visit analytics for the admin dashboard (admin.html). Each page load is one visit; the
   game-track function looks the country and city up from the request on the server, so the
   browser never sees or sends an IP. Nothing here affects play: every call is fire-and-forget. */
const AN = {
  url: NET.url + '/functions/v1/game-track',
  id: null, sent: new Map(), lastWorld: null, lastDelivered: -1,
  // admins mark their own devices from the dashboard, and local test servers never count
  off: (() => { try { return localStorage.getItem('pm-notrack') === '1' || (/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname) && !/[?&]track=1/.test(location.search)); } catch (e) { return false; } })(),
};
function anPost(body, keepalive){
  return fetch(AN.url, { method: 'POST', keepalive: !!keepalive, headers: { 'content-type': 'application/json', apikey: NET.key }, body: JSON.stringify(body) })
    .then(r => r.json()).catch(() => null);
}
function anDevice(){
  const ua = navigator.userAgent;
  const tablet = /iPad|Tablet/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const device = tablet ? 'tablet' : /Mobi|Android|iPhone/.test(ua) ? 'mobile' : 'desktop';
  const os = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
  const browser = /FBAN|FBAV/.test(ua) ? 'Facebook' : /Instagram/.test(ua) ? 'Instagram' : /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  return { device, os, browser };
}
function anNick(){ try { return typeof myNick === 'function' ? myNick() : ''; } catch (e) { return ''; } }
function anStart(){
  if (AN.off) return;
  const q = new URLSearchParams(location.search);
  const ref = document.referrer && !document.referrer.includes(location.hostname) ? document.referrer : '';
  anPost({ a: 'start', vid: typeof netId === 'string' ? netId.slice(0, 40) : 'anon', nick: anNick(), ref, utm_source: q.get('utm_source') || '', utm_campaign: q.get('utm_campaign') || '',
    ...anDevice(), lang: (typeof lang === 'string' ? lang : navigator.language || '').slice(0, 10), screen: `${screen.width}x${screen.height}` })
    .then(r => { if (r && r.id){ AN.id = r.id; AN.queue.forEach(e => anEvent(e[0], e[1])); AN.queue.length = 0; } });
}
AN.queue = [];
// one event per type+label per 20 s — opening the same piece twice in a row is one look, not two
function anEvent(type, label){
  if (AN.off) return;
  if (!AN.id){ if (AN.queue.length < 20) AN.queue.push([type, label]); return; }
  // one WhatsApp tap fires twice (the button, then the link it opens) — count the act, not the path
  const k = type === 'whatsapp' ? type : type + '|' + (label || ''), now = Date.now();
  if (now - (AN.sent.get(k) || 0) < 20000) return;
  AN.sent.set(k, now);
  anPost({ a: 'ev', id: AN.id, type, label: label ? String(label).slice(0, 80) : '' });
}
const anName = o => o ? (o.ar || o.en || '') : '';
function anLabelFor(kind, arg){
  let name = '';
  if (typeof arg === 'string'){
    const pools = [typeof WORK !== 'undefined' ? WORK : [], typeof CLIENTS !== 'undefined' ? CLIENTS : []];
    for (const pool of pools) for (const x of pool){ if (x && !Array.isArray(x) && (x.id === arg || x.logo === arg)){ name = anName(x.name) || x.id; break; } if (Array.isArray(x) && (x[2] === arg || x[4] === arg)){ name = x[1] || x[0]; break; } }
    if (!name && typeof POIS !== 'undefined'){ const p = POIS.find(p => p.id === arg); if (p) name = anName(p.name); }
    if (!name) name = arg;
  }
  return name ? `${kind}: ${name}` : kind;
}

/* ---------- hooks into the game ---------- */
if (typeof openExhibit === 'function'){ const plain = openExhibit; openExhibit = function(kind, arg, after){ if (kind !== 'install') anEvent('exhibit', anLabelFor(kind, arg)); return plain.apply(this, arguments); }; }
if (typeof enterBuilding === 'function'){ const plain = enterBuilding; enterBuilding = function(p){ anEvent('building', p && p.name ? anName(p.name) : ''); return plain.apply(this, arguments); }; }
if (typeof enterOffice === 'function'){ const plain = enterOffice; enterOffice = function(){ anEvent('office', 'مقر Planet'); return plain.apply(this, arguments); }; }
if (typeof mountCar === 'function'){ const plain = mountCar; mountCar = function(){ anEvent('car', ''); return plain.apply(this, arguments); }; }
if (typeof sgStart === 'function'){ const plain = sgStart; sgStart = function(){ anEvent('game', 'صيد النجوم'); return plain.apply(this, arguments); }; }
if (typeof startRace === 'function'){ const plain = startRace; startRace = function(){ anEvent('game', 'السباق'); return plain.apply(this, arguments); }; }
{ const plainOpen = window.open; window.open = function(url){ const u = String(url || '');
    if (/wa\.me|whatsapp/i.test(u)) anEvent('whatsapp', 'رابط'); else { try { anEvent('link', new URL(u, location.href).hostname); } catch (e) {} }
    return plainOpen.apply(window, arguments); }; }
document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('#wa, #begin, a[href]'); if (!el) return;
  if (el.id === 'wa') anEvent('whatsapp', 'الزرار العائم');
  else if (el.id === 'begin') anEvent('begin', '');
  else { const h = el.getAttribute('href') || ''; if (/wa\.me|whatsapp/i.test(h)) anEvent('whatsapp', 'رابط'); else if (/^https?:/.test(h)) { try { anEvent('link', new URL(h).hostname); } catch (e2) {} } }
}, true);
// things that are states rather than calls: the world you orbit, briefs delivered
setInterval(() => {
  if (!AN.id) return;
  if (typeof cur !== 'undefined' && cur && cur !== AN.lastWorld){ AN.lastWorld = cur; anEvent('world', anName(cur.name) || cur.id); }
  if (typeof cur !== 'undefined' && !cur) AN.lastWorld = null;
  if (typeof save !== 'undefined' && save.d){ if (AN.lastDelivered >= 0 && save.d.length > AN.lastDelivered) anEvent('deliver', `${save.d.length}/8`); AN.lastDelivered = save.d.length; }
}, 1500);
// heartbeat: only while the tab is visible, so a forgotten tab doesn't count as an hour on the site
setInterval(() => { if (AN.id && document.visibilityState === 'visible') anPost({ a: 'ping', id: AN.id, nick: anNick() }); }, 30000);
document.addEventListener('visibilitychange', () => { if (AN.id && document.visibilityState === 'hidden') anPost({ a: 'ping', id: AN.id, nick: anNick() }, true); });
anStart();
