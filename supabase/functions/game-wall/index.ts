// Removes messages from the planet's walls. The public key can write a message but never delete:
// the author proves ownership with the random key their browser kept when posting, and the
// admin dashboard uses the GAME_ADMIN_PASS secret. The delete key itself is never readable.
const URL_ = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PASS = Deno.env.get("GAME_ADMIN_PASS") || "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info, x-admin-pass",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" } });
const rest = (path: string, init: RequestInit = {}) => fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json", ...(init.headers || {}) } });
function sameText(a: string, b: string) {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
const isAdmin = (req: Request) => !!PASS && sameText(req.headers.get("x-admin-pass") || "", PASS);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const id = Number(b.id);

  // the author deletes their own message
  if (b.a === "del") {
    const key = typeof b.key === "string" ? b.key : "";
    if (!Number.isInteger(id) || key.length < 16 || key.length > 64) return json({ error: "bad" }, 400);
    const r = await rest(`game_wall?id=eq.${id}&del_key=eq.${encodeURIComponent(key)}`, { method: "DELETE", headers: { prefer: "return=representation" } });
    const rows = r.ok ? await r.json() : [];
    return json({ ok: rows.length > 0 });
  }

  // admin: list every message (with age), delete any, or clear everything older than N days
  if (!isAdmin(req)) { await new Promise(r => setTimeout(r, 600)); return json({ error: PASS ? "auth" : "not_configured" }, PASS ? 401 : 503); }
  if (b.a === "list") {
    const r = await rest("game_wall?select=id,nick,msg,wall,created_at&order=created_at.desc&limit=500");
    return json({ rows: r.ok ? await r.json() : [] });
  }
  if (b.a === "adel") {
    if (!Number.isInteger(id)) return json({ error: "bad" }, 400);
    const r = await rest(`game_wall?id=eq.${id}`, { method: "DELETE" });
    return json({ ok: r.ok });
  }
  if (b.a === "purge") {
    const days = Math.max(1, Math.min(365, Number(b.days) || 21));
    const r = await rest(`game_wall?created_at=lt.${new Date(Date.now() - days * 864e5).toISOString()}`, { method: "DELETE" });
    return json({ ok: r.ok });
  }
  return json({ error: "action" }, 400);
});
