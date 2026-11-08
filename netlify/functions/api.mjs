// API an'ny site : /api/login, /api/me, /api/progress, /api/chat, /api/vocab, /api/admin/...
import { store, json, hashPw, checkPw, signToken, readToken, normId, rateLimit, gemini, env, todayStr } from "../lib/core.mjs";
import { profSystem, vocabPrompt, VOCAB_SCHEMA } from "../lib/prompts.mjs";
import { COURSES } from "../lib/courses.mjs";

const LEVELS = ["A1", "A2", "B1", "B2"];
const DAY = 864e5;

const publicStudent = (s) => ({ id: s.id, name: s.name || "", level: s.level, expires: s.expires || null });

async function getStudent(id) { return id ? await store("students").get(normId(id), { type: "json" }) : null; }
function expired(s) { return s.expires && todayStr() > s.expires; }

async function auth(req) {
  const h = req.headers.get("authorization") || "";
  const p = readToken(h.replace(/^Bearer\s+/i, ""));
  if (!p) return null;
  const s = await getStudent(p.id);
  if (!s || s.disabled || expired(s)) return null;
  return s;
}
function isAdmin(req) {
  const k = env("ADMIN_PASSWORD");
  return !!k && k.length >= 8 && req.headers.get("x-admin-key") === k;
}
async function body(req) { try { return await req.json(); } catch (e) { return {}; } }

/* ---------- Mpianatra ---------- */
async function login(req) {
  const b = await body(req);
  const id = normId(b.id);
  if (!id || !b.password) return json({ error: "Ampidiro ny ID sy ny teny miafina." }, 400);
  if (!(await rateLimit("login/" + id, 20))) return json({ error: "Andrana betsaka loatra. Miverena rahampitso." }, 429);
  const s = await getStudent(id);
  if (!s || !checkPw(b.password, s.pw)) return json({ error: "Diso ny ID na ny teny miafina." }, 401);
  if (s.disabled) return json({ error: "Nofoanana ity kaonty ity. Mifandraisa amin'ny H-conseil et Formations." }, 403);
  if (expired(s)) return json({ error: "Tapitra ny fe-potoana fidiranao (" + s.expires + "). Mifandraisa amin'ny H-conseil et Formations." }, 403);
  const token = signToken({ id: s.id, exp: Date.now() + 30 * DAY });
  const progress = await store("progress").get(s.id, { type: "json" });
  s.lastLogin = new Date().toISOString();
  await store("students").setJSON(s.id, s);
  return json({ token, student: publicStudent(s), progress });
}
async function me(req) {
  const s = await auth(req);
  if (!s) return json({ error: "Midira indray." }, 401);
  return json({ student: publicStudent(s), progress: await store("progress").get(s.id, { type: "json" }) });
}
async function saveProgress(req) {
  const s = await auth(req);
  if (!s) return json({ error: "Midira indray." }, 401);
  const b = await body(req);
  const p = b.progress;
  if (!p || typeof p !== "object") return json({ error: "Tsy misy angona" }, 400);
  if (JSON.stringify(p).length > 120000) return json({ error: "Lehibe loatra" }, 413);
  p.level = s.level; // ny ambaratonga voasoratra ihany
  p.savedAt = new Date().toISOString();
  await store("progress").setJSON(s.id, p);
  return json({ ok: true });
}

/* ---------- Prof Hery ---------- */
function cleanCtx(c, level) {
  c = c || {};
  const cur = c.current && typeof c.current === "object" ? { k: +c.current.k, s: +c.current.s, title: String(c.current.title || "").slice(0, 120), kapitel: String(c.current.kapitel || "").slice(0, 120) } : null;
  return { level, current: cur, done: +c.done || 0, total: +c.total || 0, streak: +c.streak || 0, scores: String(c.scores || "").slice(0, 300) };
}
function cleanMsgs(list) {
  const msgs = (Array.isArray(list) ? list : []).slice(-12)
    .map((m) => ({ role: m.role === "me" ? "user" : "model", text: String(m.text || "").slice(0, 1500) }))
    .filter((m) => m.text);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}
async function chat(req, context) {
  const b = await body(req);
  let student = null, level, demo = false;
  if (b.demo) {
    demo = true;
    level = LEVELS.includes(b.ctx?.level) ? b.ctx.level : "A1";
    const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "x";
    if (!(await rateLimit("demo/" + ip, +env("DEMO_CHAT_LIMIT", "15")))) return json({ reply: "Tapitra ny hafatra azo alefa anio mandritra ny fanandramana. Misoratra anarana mba hahafahako manaraka anao isan'andro ! 🙂" });
  } else {
    student = await auth(req);
    if (!student) return json({ error: "Midira indray." }, 401);
    level = student.level;
    if (!(await rateLimit("chat/" + student.id, +env("CHAT_LIMIT", "80")))) return json({ reply: "Efa betsaka ny fanontanianao anio 😊 Miala sasatra kely, ary miverena rahampitso. Ataovy aloha ny fanazaran-tena ao amin'ny PDF." });
  }
  const msgs = cleanMsgs(b.messages);
  if (!msgs.length) return json({ error: "Hafatra foana" }, 400);
  const ctx = cleanCtx(b.ctx, level);
  if (demo && ctx.current && ctx.current.k !== 1) ctx.current = null;
  try {
    const reply = await gemini({ system: profSystem({ student, ctx, demo }), messages: msgs, maxTokens: 900 });
    return json({ reply });
  } catch (e) {
    console.error(e);
    return json({ reply: "Miala tsiny, tsy afaka mamaly aho izao (olana ara-teknika). Andramo indray afaka kelikely." });
  }
}

/* ---------- Voambolana ---------- */
async function vocab(req) {
  const u = new URL(req.url);
  const level = u.searchParams.get("level"), k = +u.searchParams.get("k"), s = +u.searchParams.get("s");
  if (!LEVELS.includes(level) || !k || !s) return json({ error: "Diso ny fangatahana" }, 400);
  const K = COURSES[level].find((x) => x.k === k);
  if (!K || !K.sess.find((x) => x.s === s)) return json({ error: "Tsy hita" }, 404);
  const demo = u.searchParams.get("demo") === "1";
  if (demo) { if (k !== 1) return json({ error: "Tsy misokatra" }, 403); }
  else { const st = await auth(req); if (!st) return json({ error: "Midira indray." }, 401); }
  const id = `${level}-${k}-${s}`;
  const vs = store("vocab");
  let words = await vs.get(id, { type: "json" });
  if (words && words.length) return json({ words });
  if (!(await rateLimit("vocabgen", +env("VOCAB_GEN_LIMIT", "200")))) return json({ words: [] });
  try {
    const p = vocabPrompt(level, k, s);
    const txt = await gemini({ system: p.system, messages: [{ role: "user", text: p.user }], json: true, schema: VOCAB_SCHEMA, temperature: 0.4, maxTokens: 1500 });
    words = JSON.parse(txt).filter((w) => w && w.de && w.mg).slice(0, 8);
    if (words.length) await vs.setJSON(id, words);
    return json({ words });
  } catch (e) {
    console.error(e);
    return json({ words: [] });
  }
}

/* ---------- Mpitantana ---------- */
async function admin(req, path) {
  if (!isAdmin(req)) return json({ error: "Diso ny teny miafin'ny mpitantana." }, 401);
  const u = new URL(req.url);
  const st = store("students"), pg = store("progress");
  if (path === "admin/students" && req.method === "GET") {
    const { blobs } = await st.list();
    const out = [];
    for (const bl of blobs) {
      const s = await st.get(bl.key, { type: "json" }); if (!s) continue;
      const p = await pg.get(bl.key, { type: "json" });
      const total = COURSES[s.level].reduce((a, K) => a + K.sess.length, 0);
      const done = p ? Object.keys(p.done || {}).length + Object.keys(p.skip || {}).length : 0;
      let cur = null;
      if (p) for (const K of COURSES[s.level]) { const x = K.sess.find((x) => !(p.done || {})[K.k + "-" + x.s] && !(p.skip || {})[K.k + "-" + x.s]); if (x) { cur = "K" + K.k + " · " + x.t; break; } }
      const sc = p ? Object.values(p.scores || {}).flatMap((o) => Object.values(o)) : [];
      out.push({ ...publicStudent(s), disabled: !!s.disabled, created: s.created, lastLogin: s.lastLogin || null, lastDay: p?.lastDay || null, done, total, current: cur, streak: p?.streak || 0, xp: p?.xp || 0, avgScore: sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null });
    }
    out.sort((a, b) => a.id.localeCompare(b.id));
    return json({ students: out });
  }
  if (path === "admin/students" && req.method === "POST") {
    const b = await body(req);
    const id = normId(b.id);
    if (!/^[A-Z0-9_-]{3,30}$/.test(id)) return json({ error: "ID : litera, isa, - na _ (3–30)." }, 400);
    if (!LEVELS.includes(b.level)) return json({ error: "Ambaratonga tsy mety." }, 400);
    const old = await st.get(id, { type: "json" });
    if (!old && !b.password) return json({ error: "Ilaina ny teny miafina ho an'ny mpianatra vaovao." }, 400);
    if (b.password && String(b.password).length < 4) return json({ error: "Teny miafina : 4 litera farafahakeliny." }, 400);
    const s = { ...(old || { created: new Date().toISOString() }), id, name: String(b.name || "").slice(0, 60), level: b.level, expires: b.expires || null, disabled: !!b.disabled };
    if (b.password) s.pw = hashPw(b.password);
    if (old && old.level !== b.level) { const p = await pg.get(id, { type: "json" }); if (p) { await pg.setJSON(id + "@" + old.level, p); await pg.delete(id); } }
    await st.setJSON(id, s);
    return json({ ok: true, student: publicStudent(s) });
  }
  if (path === "admin/students" && req.method === "DELETE") {
    const id = normId(u.searchParams.get("id"));
    await st.delete(id); await pg.delete(id);
    return json({ ok: true });
  }
  if (path === "admin/reset" && req.method === "POST") {
    const id = normId((await body(req)).id);
    await pg.delete(id);
    return json({ ok: true });
  }
  if (path === "admin/vocab") {
    const vs = store("vocab");
    if (req.method === "GET") {
      const id = u.searchParams.get("id");
      return json({ words: (await vs.get(id, { type: "json" })) || [] });
    }
    if (req.method === "POST") {
      const b = await body(req);
      if (!/^(A1|A2|B1|B2)-\d+-\d+$/.test(b.id || "")) return json({ error: "ID tsy mety" }, 400);
      if (b.delete) { await vs.delete(b.id); return json({ ok: true }); }
      const words = (Array.isArray(b.words) ? b.words : []).filter((w) => w && w.de && w.mg).map((w) => ({ de: String(w.de), mg: String(w.mg), fr: String(w.fr || ""), ex: String(w.ex || "") }));
      await vs.setJSON(b.id, words);
      return json({ ok: true, count: words.length });
    }
  }
  return json({ error: "Tsy hita" }, 404);
}

/* ---------- Fizarana ---------- */
export default async (req, context) => {
  const path = new URL(req.url).pathname.replace(/^\/api\//, "").replace(/\/$/, "");
  try {
    if (path === "login" && req.method === "POST") return await login(req);
    if (path === "me") return await me(req);
    if (path === "progress" && req.method === "POST") return await saveProgress(req);
    if (path === "chat" && req.method === "POST") return await chat(req, context);
    if (path === "vocab") return await vocab(req);
    if (path.startsWith("admin/")) return await admin(req, path);
    return json({ error: "Tsy hita" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Olana ara-teknika : " + e.message }, 500);
  }
};

export const config = { path: "/api/*" };
