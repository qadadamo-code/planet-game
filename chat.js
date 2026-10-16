/* ---------- A better planet chat: messenger-style bubbles with a coloured avatar, time and grouping,
   reactions on any message, "… is typing", private messages (tap someone's name), @mentions that ping you,
   and quick emoji that float up over your head. Everything rides on the existing 'chat' broadcast, so older
   visitors simply ignore what they don't understand. ---------- */
let chatSeq = 0, dmTo = null, lastTypingSent = 0;
const typingNow = new Map();   // peer id → { who, until, dm }
const REACTS = ['❤️', '😂', '👍', '🔥', '😮'];
const midOf = () => netId.slice(0, 6) + '-' + Date.now().toString(36) + '-' + (chatSeq++);
const hhmm = ts => { const d = new Date(ts); return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'); };
const chatSend = payload => { if (!netChan || !netLive) return false; netChan.send({ type: 'broadcast', event: 'chat', payload: Object.assign({ i: netId, n: netNum, c: netColor, k: myNick() }, payload) }); return true; };
const peerName = id => { const pr = peers.get(id); return pr ? t(visitorName(pr.num, pr.nick || '')) : '…'; };

/* floating emoji over a head */
const emoteFx = [];
function emoteBurst(target, emo){
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); x.font = '96px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(emo, 64, 70);
  const tx = new THREE.CanvasTexture(cv);
  for (let k = 0; k < 4; k++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false })); s.renderOrder = 9; s.scale.setScalar(0.55);
    const host = target ? target.g : player; host.add(s); s.position.set((Math.random() - 0.5) * 0.8, 2.4, (Math.random() - 0.5) * 0.4);
    emoteFx.push({ s, host, t: 0, delay: k * 0.18, vx: (Math.random() - 0.5) * 0.5 }); }
}
(function emoteLoop(){ requestAnimationFrame(emoteLoop); const dt = 1 / 60;
  for (let i = emoteFx.length - 1; i >= 0; i--){ const e = emoteFx[i]; if ((e.delay -= dt) > 0){ e.s.visible = false; continue; } e.s.visible = true; e.t += dt;
    e.s.position.y += dt * 1.1; e.s.position.x += e.vx * dt; e.s.material.opacity = 1 - Math.max(0, e.t - 0.9) / 0.7; e.s.scale.setScalar(0.4 + Math.min(e.t * 2, 0.35));
    if (e.t > 1.6){ e.host.remove(e.s); e.s.material.dispose(); emoteFx.splice(i, 1); } } })();
const isEmoji = s => /^\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*$/u.test(s);

/* ---------- sending ---------- */
sendChat = function(text){
  text = cleanText(text); if (!text || !netLive) return false;
  if (performance.now() - lastChatSent < 900){ mini(lang === 'ar' ? '⏳ استنى ثانية' : '⏳ One sec'); return false; }
  lastChatSent = performance.now();
  const mid = midOf(), to = dmTo;
  chatSend({ m: text, mid, to: to || undefined });
  addLog(null, text, { mid, dm: to });
  if (!to){ if (isEmoji(text)) emoteBurst(null, text); else sayOver(null, text, true); }
  lastTypingSent = 0; return true;
};
/* ---------- receiving ---------- */
const plainOnChat = onChat;
onChat = function(p){
  if (!p || p.i === netId) return;
  if (p.sys === 'typing'){ if (p.to && p.to !== netId) return; typingNow.set(p.i, { who: t(visitorName(p.n, p.k)), until: performance.now() + 3500, dm: !!p.to }); paintTyping(); return; }
  if (p.sys === 'react'){ const l = chatLog.find(x => x.mid === p.mid); if (!l) return; l.reacts = l.reacts || {}; const set = (l.reacts[p.e] = l.reacts[p.e] || new Set());
    if (p.off) set.delete(p.i); else set.add(p.i); renderLog(); if (l.me && !p.off){ Sfx.blip(); mini(`${p.e} ${t(visitorName(p.n, p.k))}`); } return; }
  if (p.sys) return plainOnChat(p);
  if (p.to && p.to !== netId) return;           // a private message for someone else
  const text = cleanText(p.m); if (!text) return;
  typingNow.delete(p.i); paintTyping();
  const peer = peers.get(p.i);
  if (peer){ if (isEmoji(text)) emoteBurst(peer, text); else if (!p.to) sayOver(peer, text); }
  const mention = myNick() && new RegExp('@' + myNick().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text);
  addLog(p, text, { mid: p.mid, dm: p.to ? p.i : null, mention });
  Sfx.blip();
  if (p.to || mention) mini((p.to ? '🔒 ' : '📣 ') + t(visitorName(p.n, p.k)) + ': ' + text.slice(0, 50));
  if (!chatOpen){ chatUnread++; paintChatBtn(); }
};
addLog = function(p, text, x = {}){
  chatLog.push({ mid: x.mid || null, me: !p, pid: p ? p.i : netId, who: p ? t(visitorName(p.n, p.k)) : (lang === 'ar' ? 'إنت' : 'You'), color: p ? p.c : netColor, text, ts: Date.now(), dm: x.dm || null, mention: !!x.mention, reacts: {} });
  if (chatLog.length > 60) chatLog.shift(); renderLog();
};
function react(l, e){
  if (!l.mid) return; l.reacts = l.reacts || {}; const set = (l.reacts[e] = l.reacts[e] || new Set()), off = set.has(netId);
  if (off) set.delete(netId); else set.add(netId); chatSend({ sys: 'react', mid: l.mid, e, off: off || undefined }); renderLog(); Sfx.click();
}
/* ---------- drawing the log ---------- */
renderLog = function(){
  const box = document.getElementById('chatlog'); if (!box) return; const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 40; box.textContent = '';
  let prev = null;
  for (const l of chatLog){
    const grouped = prev && prev.pid === l.pid && prev.dm === l.dm && l.ts - prev.ts < 120000;
    const row = document.createElement('div'); row.className = 'cm' + (l.me ? ' me' : '') + (grouped ? ' grp' : '') + (l.dm ? ' dm' : '') + (l.mention ? ' ment' : '');
    const col = '#' + new THREE.Color(l.color).getHexString();
    if (!grouped){ const av = document.createElement('i'); av.className = 'cm-av'; av.style.background = col; av.textContent = [...(l.who || '?')][0]; row.appendChild(av); }
    const body = document.createElement('div'); body.className = 'cm-b';
    if (!grouped){ const hd = document.createElement('div'); hd.className = 'cm-h';
      const nm = document.createElement('b'); nm.textContent = l.dm ? (l.me ? (lang === 'ar' ? `🔒 إلى ${peerName(l.dm)}` : `🔒 to ${peerName(l.dm)}`) : `🔒 ${l.who}`) : l.who; nm.style.color = col;
      if (!l.me){ nm.className = 'cm-name'; nm.title = lang === 'ar' ? 'ابعتله رسالة خاصة' : 'Send a private message'; nm.onclick = () => setDm(l.pid); }
      const tm = document.createElement('small'); tm.textContent = hhmm(l.ts); hd.append(nm, tm); body.appendChild(hd); }
    const bub = document.createElement('div'); bub.className = 'cm-t' + (isEmoji(l.text) ? ' emo' : ''); bub.textContent = l.text; bub.dir = 'auto'; body.appendChild(bub);
    // reactions: what's there, and a little bar to add yours
    const rs = Object.entries(l.reacts || {}).filter(([, s]) => s.size);
    if (rs.length){ const rr = document.createElement('div'); rr.className = 'cm-rs'; rs.forEach(([e, s]) => { const c = document.createElement('button'); c.type = 'button'; c.className = 'cm-r' + (s.has(netId) ? ' on' : ''); c.textContent = `${e} ${s.size}`; c.onclick = () => react(l, e); rr.appendChild(c); }); body.appendChild(rr); }
    if (l.mid){ const bar = document.createElement('div'); bar.className = 'cm-bar'; REACTS.forEach(e => { const c = document.createElement('button'); c.type = 'button'; c.textContent = e; c.onclick = () => react(l, e); bar.appendChild(c); }); body.appendChild(bar); }
    row.appendChild(body); box.appendChild(row); prev = l;
  }
  if (!chatLog.length){ const e = document.createElement('div'); e.className = 'cl empty'; e.textContent = lang === 'ar' ? 'قول أهلاً للي على الكوكب 👋 — دوس على اسم حد عشان تكلمه لوحده' : 'Say hi to everyone 👋 — tap a name to message them privately'; box.appendChild(e); }
  if (atEnd || chatLog.length && chatLog[chatLog.length - 1].me) box.scrollTop = box.scrollHeight;
};
function paintTyping(){
  const el = document.getElementById('chtyping'); if (!el) return; const now = performance.now();
  for (const [k, v] of typingNow) if (v.until < now) typingNow.delete(k);
  const names = [...typingNow.values()].map(v => v.who);
  el.textContent = names.length ? (lang === 'ar' ? `✍️ ${names.slice(0, 2).join('، ')} ${names.length > 1 ? 'بيكتبوا' : 'بيكتب'}…` : `✍️ ${names.slice(0, 2).join(', ')} ${names.length > 1 ? 'are' : 'is'} typing…`) : '';
}
setInterval(paintTyping, 1000);
function setDm(id){
  dmTo = id && peers.has(id) ? id : null; const chip = document.getElementById('chdm'); if (!chip) return;
  chip.hidden = !dmTo; if (dmTo) chip.querySelector('span').textContent = (lang === 'ar' ? '🔒 رسالة خاصة لـ ' : '🔒 Private to ') + peerName(dmTo);
  const inp = document.getElementById('chatin'); if (inp) inp.focus();
}
/* ---------- the box gets a private-message chip, a typing line, and a few more emoji ---------- */
const plainBuildChat = buildChatUi;
buildChatUi = function(){
  const had = !!document.getElementById('chatbox'); plainBuildChat();
  const box = document.getElementById('chatbox'); if (!box || had || box.dataset.v2) return; box.dataset.v2 = '1';
  const form = box.querySelector('form');
  const ty = document.createElement('div'); ty.id = 'chtyping'; ty.className = 'ch-typing'; form.before(ty);
  const chip = document.createElement('div'); chip.id = 'chdm'; chip.className = 'ch-dm'; chip.hidden = true; chip.innerHTML = '<span></span><button type="button" aria-label="Cancel">✕</button>'; form.before(chip);
  chip.querySelector('button').onclick = () => setDm(null);
  const inp = box.querySelector('#chatin');
  inp.addEventListener('input', () => { const now = performance.now(); if (inp.value && now - lastTypingSent > 2500){ lastTypingSent = now; chatSend({ sys: 'typing', to: dmTo || undefined }); } });
  // longer quick list: the old row plus a few more expressions
  const q = box.querySelector('.ch-quick'); ['😍', '🙏', '👏', '😎'].forEach(e => { const b = document.createElement('button'); b.type = 'button'; b.dataset.q = e; b.textContent = e; b.onclick = () => sendChat(e); q.appendChild(b); });
};
if (document.getElementById('chatbox')){ const b = document.getElementById('chatbox'); b.remove(); const c = document.getElementById('chatbtn'); if (c) c.remove(); buildChatUi(); }
/* the people list: tap someone to message them privately */
document.addEventListener('click', e => { const pp = e.target.closest && e.target.closest('.pp[data-id]'); if (!pp) return; const id = pp.dataset.id; if (!peers.has(id)) return;
  ['peoplebox', 'pplbox'].forEach(x => { try { closeX(x); } catch (er) {} }); const btn = document.getElementById('chatbtn'); if (btn && !chatOpen) btn.click(); setTimeout(() => setDm(id), 80); });
