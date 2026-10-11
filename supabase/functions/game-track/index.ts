// Records visits to the Planet game site. The browser never writes to the tables directly:
// this function adds the visitor's country and city from their IP (looked up here, never
// stored) and writes with the service role. Raw IP addresses are not saved.
const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
};
const EVENT_TYPES = new Set(["exhibit", "world", "building", "office", "deliver", "whatsapp", "link", "game", "car", "wall", "mission", "chat", "photo", "begin"]);
const MAX_EVENTS = 400;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "") || null;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

async function rest(path: string, init: RequestInit = {}) {
  return fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json", ...(init.headers || {}) } });
}

function clientIp(req: Request): string | null {
  const xf = req.headers.get("x-forwarded-for");
  const ip = (xf ? xf.split(",")[0] : req.headers.get("x-real-ip") || "").trim();
  return ip || null;
}

type Geo = { country: string | null; country_code: string | null; region: string | null; city: string | null };
async function geoOf(ip: string | null, req: Request): Promise<Geo> {
  const empty: Geo = { country: null, country_code: req.headers.get("cf-ipcountry"), region: null, city: null };
  if (!ip) return empty;
  const tries: Array<() => Promise<Geo | null>> = [
    async () => {
      const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,country_code,region,city`, { signal: AbortSignal.timeout(2500) });
      const j = await r.json(); if (!j.success) return null;
      return { country: j.country || null, country_code: j.country_code || null, region: j.region || null, city: j.city || null };
    },
    async () => {
      const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city`, { signal: AbortSignal.timeout(2500) });
      const j = await r.json(); if (j.status !== "success") return null;
      return { country: j.country || null, country_code: j.countryCode || null, region: j.regionName || null, city: j.city || null };
    },
  ];
  for (const t of tries) { try { const g = await t(); if (g) return g; } catch { /* next */ } }
  return empty;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  if (b.a === "start") {
    const vid = str(b.vid, 40); if (!vid) return json({ error: "vid" }, 400);
    const geo = await geoOf(clientIp(req), req);
    let isReturn = false;
    try { const r = await rest(`game_visits?select=id&vid=eq.${encodeURIComponent(vid)}&limit=1`); isReturn = (await r.json()).length > 0; } catch { /* fine */ }
    const row = {
      vid, nick: str(b.nick, 24), ...geo,
      referrer: str(b.ref, 300), utm_source: str(b.utm_source, 80), utm_campaign: str(b.utm_campaign, 80),
      device: str(b.device, 20), os: str(b.os, 30), browser: str(b.browser, 30), lang: str(b.lang, 10), screen: str(b.screen, 20),
      is_return: isReturn,
    };
    const r = await rest("game_visits?select=id", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify(row) });
    if (!r.ok) return json({ error: "insert", detail: await r.text() }, 502);
    const [v] = await r.json();
    return json({ id: v.id, country: geo.country_code });
  }

  const id = str(b.id, 40); if (!id || !UUID.test(id)) return json({ error: "id" }, 400);

  if (b.a === "ping") {
    const patch: Record<string, unknown> = { last_seen: new Date().toISOString() };
    const nick = str(b.nick, 24); if (nick) patch.nick = nick;
    // a visit lasts at most 12 hours — an old id can't be kept alive forever
    const since = new Date(Date.now() - 12 * 3600e3).toISOString();
    const r = await rest(`game_visits?id=eq.${id}&started_at=gte.${since}`, { method: "PATCH", body: JSON.stringify(patch) });
    return json({ ok: r.ok });
  }

  if (b.a === "ev") {
    const type = str(b.type, 20); if (!type || !EVENT_TYPES.has(type)) return json({ error: "type" }, 400);
    const r0 = await rest(`game_visits?select=events&id=eq.${id}`); const rows = r0.ok ? await r0.json() : [];
    if (!rows.length) return json({ error: "visit" }, 404);
    if (rows[0].events >= MAX_EVENTS) return json({ ok: false, capped: true });
    const r = await rest("game_events", { method: "POST", body: JSON.stringify({ visit_id: id, type, label: str(b.label, 80) }) });
    await rest(`game_visits?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ events: rows[0].events + 1, last_seen: new Date().toISOString() }) });
    return json({ ok: r.ok });
  }

  return json({ error: "action" }, 400);
});
