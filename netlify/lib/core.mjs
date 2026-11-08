// Fitaovana iombonana : fitehirizana, teny miafina, token, Gemini
import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

export const env = (k, d = "") => (globalThis.Netlify?.env?.get?.(k) ?? process.env[k] ?? d);

export function store(name) {
  if (globalThis.__TEST_STORES) return globalThis.__TEST_STORES(name);
  return getStore({ name, consistency: "strong" });
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

/* ---------- Teny miafina ---------- */
export function hashPw(pw, salt = crypto.randomBytes(16).toString("hex")) {
  const h = crypto.scryptSync(String(pw), salt, 32).toString("hex");
  return salt + ":" + h;
}
export function checkPw(pw, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, h] = stored.split(":");
  const t = crypto.scryptSync(String(pw), salt, 32);
  const hb = Buffer.from(h, "hex");
  return hb.length === t.length && crypto.timingSafeEqual(hb, t);
}

/* ---------- Token ---------- */
function secret() {
  const s = env("SESSION_SECRET");
  if (!s || s.length < 16) throw new Error("SESSION_SECRET tsy voafaritra (Netlify â†’ Environment variables)");
  return s;
}
const b64 = (s) => Buffer.from(s).toString("base64url");
export function signToken(payload) {
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return body + "." + sig;
}
export function readToken(tok) {
  if (!tok || !tok.includes(".")) return null;
  const [body, sig] = tok.split(".");
  const good = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString());
  if (p.exp && Date.now() > p.exp) return null;
  return p;
}

export const normId = (id) => String(id || "").trim().toUpperCase().replace(/\s+/g, "");
export const todayStr = () => new Date().toISOString().slice(0, 10);

/* ---------- Fetra isan'andro ---------- */
export async function rateLimit(bucket, limit) {
  const st = store("ratelimit");
  const k = todayStr() + "/" + bucket;
  const n = ((await st.get(k, { type: "json" })) || 0) + 1;
  await st.setJSON(k, n);
  return n <= limit;
}

/* ---------- Gemini ---------- */
export async function gemini({ system, messages, json: wantJson = false, schema, maxTokens = 900, temperature = 0.7 }) {
  const key = env("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY tsy voafaritra");
  const model = env("GEMINI_MODEL", "gemini-3.5-flash");
  const generationConfig = { temperature, maxOutputTokens: maxTokens + 2000 };
  if (/2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  else if (/gemini-[3-9]/.test(model)) generationConfig.thinkingConfig = { thinkingLevel: "low" };
  if (wantJson) { generationConfig.responseMimeType = "application/json"; if (schema) generationConfig.responseSchema = schema; }
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })),
    generationConfig
  };
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = "Gemini " + r.status + " (" + model + "): " + (d.error?.message || "olana");
    console.error(msg);
    throw new Error(msg);
  }
  const text = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!text) throw new Error("Gemini: valiny foana");
  return text;
}
