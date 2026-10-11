// The admin dashboard's only door to the visit data. Every request must carry the password
// stored as the GAME_ADMIN_PASS secret — the tables are closed to the public key entirely.
const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PASS = Deno.env.get("GAME_ADMIN_PASS") || "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info, x-admin-pass",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" } });

function sameText(a: string, b: string) {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

async function all<T>(path: string, cap = 50000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}`, range: `${from}-${from + 999}`, "range-unit": "items" } });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    const page = await r.json() as T[]; out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

type Visit = { id: string; vid: string; nick: string | null; country: string | null; country_code: string | null; region: string | null; city: string | null;
  referrer: string | null; utm_source: string | null; utm_campaign: string | null; device: string | null; os: string | null; browser: string | null; lang: string | null;
  screen: string | null; is_return: boolean; started_at: string; last_seen: string; events: number };
type Ev = { visit_id: string; type: string; label: string | null; created_at: string };

const TZ = "Africa/Cairo";
const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const hourOf = (iso: string) => +new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)) % 24;
// a visit's length: last sign of life minus start, capped so a tab left open overnight doesn't skew the average
const durOf = (v: Visit) => Math.min(7200, Math.max(0, (Date.parse(v.last_seen) - Date.parse(v.started_at)) / 1000));

function tally<T>(rows: T[], key: (r: T) => string | null | undefined, top = 20) {
  const m = new Map<string, number>();
  for (const r of rows) { const k = key(r); if (!k) continue; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, n]) => ({ k, n }));
}
function refHost(r: string | null) {
  if (!r) return "مباشر";
  try { const h = new URL(r).hostname.replace(/^www\.|^m\.|^l\.|^lm\./, ""); return h || "مباشر"; } catch { return "مباشر"; }
}
function kpis(vs: Visit[]) {
  const uniq = new Set(vs.map(v => v.vid)).size;
  const durs = vs.map(durOf);
  const engaged = durs.filter(d => d >= 10).length;
  return {
    visits: vs.length, visitors: uniq,
    avgDur: vs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / vs.length) : 0,
    bounce: vs.length ? Math.round((1 - engaged / vs.length) * 100) : 0,
    returning: vs.length ? Math.round(vs.filter(v => v.is_return).length / vs.length * 100) : 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!PASS) return json({ error: "not_configured" }, 503);
  if (!sameText(req.headers.get("x-admin-pass") || "", PASS)) { await new Promise(r => setTimeout(r, 600)); return json({ error: "auth" }, 401); }
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* defaults */ }
  const days = [1, 7, 30, 90, 365].includes(Number(b.days)) ? Number(b.days) : (b.days === 0 ? 0 : 30);
  const now = Date.now();
  const since = days ? new Date(now - days * 864e5).toISOString() : null;
  const prevSince = days ? new Date(now - 2 * days * 864e5).toISOString() : null;
  try {
    const sel = "id,vid,nick,country,country_code,region,city,referrer,utm_source,utm_campaign,device,os,browser,lang,screen,is_return,started_at,last_seen,events";
    const vsAll = await all<Visit>(`game_visits?select=${sel}&order=started_at.desc${prevSince ? `&started_at=gte.${prevSince}` : ""}`);
    const vs = since ? vsAll.filter(v => v.started_at >= since) : vsAll;
    const prev = since ? vsAll.filter(v => v.started_at < since) : [];
    const evs = await all<Ev>(`game_events?select=visit_id,type,label,created_at&order=created_at.desc${since ? `&created_at=gte.${since}` : ""}`);

    // the daily series runs over the whole range, zero days included — a gap is information
    const span = days || Math.max(1, Math.ceil((now - Date.parse(vs.at(-1)?.started_at || new Date(now).toISOString())) / 864e5) + 1);
    const dayList: string[] = []; for (let i = Math.min(span, 400) - 1; i >= 0; i--) dayList.push(dayOf(new Date(now - i * 864e5).toISOString()));
    const perDay = new Map(dayList.map(d => [d, { d, visits: 0, visitors: new Set<string>() }]));
    for (const v of vs) { const e = perDay.get(dayOf(v.started_at)); if (e) { e.visits++; e.visitors.add(v.vid); } }
    const hours = Array.from({ length: 24 }, (_, h) => ({ h, n: 0 }));
    for (const v of vs) hours[hourOf(v.started_at)].n++;

    const byVisit = new Map<string, Ev[]>(); for (const e of evs) { const l = byVisit.get(e.visit_id) || []; l.push(e); byVisit.set(e.visit_id, l); }
    const visitsWith = (type: string) => vs.filter(v => (byVisit.get(v.id) || []).some(e => e.type === type)).length;
    const countries = new Map<string, { code: string | null; name: string; n: number; visitors: Set<string> }>();
    for (const v of vs) { const name = v.country || "غير معروف"; const c = countries.get(name) || { code: v.country_code, name, n: 0, visitors: new Set() }; c.n++; c.visitors.add(v.vid); countries.set(name, c); }
    const liveCut = new Date(now - 2 * 60e3).toISOString();

    return json({
      days, generatedAt: new Date(now).toISOString(), totalRows: vs.length, totalEvents: evs.length,
      kpi: kpis(vs), prevKpi: days ? kpis(prev) : null,
      live: vs.filter(v => v.last_seen >= liveCut).map(v => ({ nick: v.nick, country: v.country, city: v.city, device: v.device, since: v.started_at })),
      daily: [...perDay.values()].map(e => ({ d: e.d, visits: e.visits, visitors: e.visitors.size })),
      hours,
      countries: [...countries.values()].sort((a, b) => b.n - a.n).map(c => ({ code: c.code, name: c.name, n: c.n, visitors: c.visitors.size })),
      cities: tally(vs, v => v.city ? `${v.city}${v.country ? "، " + v.country : ""}` : null, 15),
      devices: tally(vs, v => v.device), os: tally(vs, v => v.os), browsers: tally(vs, v => v.browser), langs: tally(vs, v => v.lang),
      referrers: tally(vs, v => refHost(v.referrer), 15), utm: tally(vs, v => v.utm_source, 10),
      events: tally(evs, e => e.type, 30),
      exhibits: tally(evs.filter(e => e.type === "exhibit"), e => e.label, 20),
      worlds: tally(evs.filter(e => e.type === "world"), e => e.label, 15),
      buildings: tally(evs.filter(e => e.type === "building" || e.type === "office"), e => e.label || "المكتب", 15),
      funnel: [
        { k: "دخل الموقع", n: vs.length },
        { k: "بدأ الجولة", n: visitsWith("begin") },
        { k: "فتح عمل أو عميل", n: visitsWith("exhibit") },
        { k: "سلّم بريف", n: visitsWith("deliver") },
        { k: "ضغط واتساب", n: visitsWith("whatsapp") },
      ],
      recent: vs.slice(0, 300).map(v => ({ ...v, dur: Math.round(durOf(v)), trail: (byVisit.get(v.id) || []).slice().reverse().slice(0, 14).map(e => ({ t: e.type, l: e.label })) })),
    });
  } catch (e) {
    return json({ error: "read", detail: String(e).slice(0, 300) }, 502);
  }
});
