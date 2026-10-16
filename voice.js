/* ---------- Voiced dialogue (Web Speech) — Arabic with an Egyptian voice when the device has one, English otherwise ---------- */
const Voice = (() => {
  const ok = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let on = store.get('pm-voice') !== '0', voices = [];
  const load = () => { if (ok) voices = speechSynthesis.getVoices() || []; };
  if (ok){ load(); speechSynthesis.onvoiceschanged = load; }
  const score = (v, want) => {
    const l = (v.lang || '').toLowerCase().replace('_', '-'), n = (v.name || '').toLowerCase(); let s = 0;
    if (want === 'ar'){ if (!l.startsWith('ar')) return -1; if (l === 'ar-eg' || /egypt|مصر|salma|shakir/.test(n)) s += 50; else if (/ar-(sa|ae|jo|lb)/.test(l)) s += 10; }
    else { if (!l.startsWith('en')) return -1; if (l === 'en-us') s += 20; else if (l === 'en-gb') s += 15; }
    if (/natural|neural|online|premium|enhanced|google/.test(n)) s += 25;
    if (v.localService) s += 2; return s;
  };
  const pick = want => { let best = null, bs = -1; for (const v of voices){ const s = score(v, want); if (s > bs){ bs = s; best = v; } } return best; };
  const clean = s => String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/[★•·✓→←▶]/g, ' ').replace(/\s+/g, ' ').trim();
  const hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
  function stop(){ if (ok) try { speechSynthesis.cancel(); } catch (e) {} }
  function say(text, who){
    if (!ok || !on) return; stop(); const txt = clean(text); if (!txt) return;
    const want = /[؀-ۿ]/.test(txt) ? 'ar' : 'en', v = pick(want); if (!v) return;
    const u = new SpeechSynthesisUtterance(txt); u.voice = v; u.lang = v.lang;
    const h = hash(who || ''); u.pitch = 0.85 + (h % 7) * 0.06; u.rate = want === 'ar' ? 1.0 : 1.04; u.volume = 1;
    try { speechSynthesis.speak(u); } catch (e) {}
  }
  function paint(){ const b = $('voicebtn'); if (!b) return; b.textContent = on ? '🗣️' : '🤐'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
    const lbl = lang === 'ar' ? (on ? 'الحوار المسموع شغّال' : 'الحوار المسموع مقفول') : (on ? 'Voiced dialogue on' : 'Voiced dialogue off'); b.title = lbl; b.setAttribute('aria-label', lbl); }
  function toggle(){ on = !on; store.set('pm-voice', on ? '1' : '0'); if (!on) stop(); paint(); mini(lang === 'ar' ? (on ? '🗣️ الشخصيات هتتكلم بصوت' : '🤐 الحوار من غير صوت') : (on ? '🗣️ Characters will speak' : '🤐 Dialogue is silent')); }
  if (!ok){ const b = $('voicebtn'); if (b) b.hidden = true; }
  else { const b = $('voicebtn'); if (b) b.onclick = () => { Sfx.click(); toggle(); }; paint(); }
  addEventListener('pagehide', stop);
  return { say, stop, paint, get on(){ return on && ok; } };
})();
