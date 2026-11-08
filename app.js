/* H-conseil et Formations — Fianarana alemana A1–B2 */
(function () {
  "use strict";
  const C = window.COURSES, SITE = window.SITE || {};
  const LEVELS = ["A1", "A2", "B1", "B2"];
  const LV_INFO = { A1: "Fanombohana", A2: "Fototra", B1: "Antonony", B2: "Mandroso" };
  const DAYS = ["Alh", "Alt", "Tal", "Alr", "Alk", "Zom", "Sab"]; // getDay(): 0 = Alahady
  const DAYS_LONG = ["Alahady", "Alatsinainy", "Talata", "Alarobia", "Alakamisy", "Zoma", "Sabotsy"];
  const $ = (s, r = document) => r.querySelector(s);
  const app = $("#app");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ---------------- Toetra ---------------- */
  const S = { mode: null, token: null, student: null, p: null, view: "today", open: {}, chat: [], card: 0, flip: false, vocab: {}, apiOk: null };

  function newProgress(level) {
    return { level, done: {}, skip: {}, steps: {}, scores: {}, known: {}, xp: 0, streak: 0, best: 0, lastDay: null, days: [1, 3, 5], start: today(), chats: 0 };
  }
  function today(d = new Date()) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dayDiff(a, b) { return Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 864e5); }
  const key = (k, s) => k + "-" + s;

  /* ---------------- Fampitaovana API ---------------- */
  async function api(path, opts = {}) {
    const h = { "Content-Type": "application/json" };
    if (S.token) h.Authorization = "Bearer " + S.token;
    const r = await fetch("/api/" + path, { method: opts.body ? "POST" : "GET", headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined });
    let data = null;
    try { data = await r.json(); } catch (e) { const err = new Error("offline"); err.offline = true; throw err; }
    if (!r.ok) { const err = new Error(data && data.error || "Nisy olana"); err.status = r.status; throw err; }
    return data;
  }

  /* ---------------- Fampianarana ---------------- */
  const level = () => S.p.level;
  const kaps = () => C[level()];
  const isDemo = () => S.mode === "demo";
  const demoK = () => SITE.demoKapitel || 1;
  const kapOpen = (k) => !isDemo() || k === demoK();
  function flat() { const out = []; kaps().forEach((K) => K.sess.forEach((x) => out.push({ K, x, key: key(K.k, x.s) }))); return out; }
  const isDone = (kk) => !!S.p.done[kk] || !!S.p.skip[kk];
  function current() {
    const list = flat().filter((i) => kapOpen(i.K.k));
    return list.find((i) => !isDone(i.key)) || null;
  }
  function kapStats(K) {
    const n = K.sess.length, d = K.sess.filter((x) => isDone(key(K.k, x.s))).length;
    return { n, d, pct: Math.round((d / n) * 100) };
  }
  function levelStats() {
    const f = flat(); const d = f.filter((i) => isDone(i.key)).length;
    return { n: f.length, d, pct: f.length ? d / f.length : 0 };
  }
  const pdfUrl = (id) => "https://drive.google.com/file/d/" + id + "/preview";
  const pdfOpenUrl = (id) => "https://drive.google.com/file/d/" + id + "/view";

  /* ---------------- Fitahirizana ---------------- */
  let saveT = null;
  function save() {
    if (isDemo()) { store.set("hcf_demo_" + level(), S.p); return; }
    store.set("hcf_p_" + S.student.id, S.p);
    clearTimeout(saveT);
    saveT = setTimeout(() => api("progress", { body: { progress: S.p } }).catch(() => toast("Tsy tafiditra ny fandrosoana — hamarino ny Internet")), 800);
  }
  function touch(xp) {
    const t = today();
    if (S.p.lastDay !== t) {
      S.p.streak = S.p.lastDay && dayDiff(S.p.lastDay, t) === 1 ? S.p.streak + 1 : 1;
      S.p.best = Math.max(S.p.best || 0, S.p.streak);
      S.p.lastDay = t;
    }
    S.p.xp += xp || 0;
  }
  function stepOk(kk, st) { return !!(S.p.steps[kk] && S.p.steps[kk][st]); }
  function setStep(kk, st, xp) {
    S.p.steps[kk] = S.p.steps[kk] || {};
    if (S.p.steps[kk][st]) return;
    S.p.steps[kk][st] = 1; touch(xp); save();
  }

  /* ---------------- Fandaharana ---------------- */
  function plan() {
    const days = S.p.days && S.p.days.length ? S.p.days : [1, 3, 5];
    const rest = flat().filter((i) => kapOpen(i.K.k) && !isDone(i.key)).length;
    const d = new Date(); let n = rest, guard = 0;
    if (!n) return { rest: 0, end: null, perWeek: days.length };
    while (n > 0 && guard < 1500) { if (days.includes(d.getDay())) n--; if (n > 0) d.setDate(d.getDate() + 1); guard++; }
    return { rest, end: d, perWeek: days.length };
  }
  const isStudyDay = () => (S.p.days || []).includes(new Date().getDay());
  const fmtDate = (d) => d.getDate() + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();

  /* ---------------- Voambolana ---------------- */
  async function loadVocab(kk) {
    const id = level() + "-" + kk;
    if (S.vocab[id]) return S.vocab[id];
    const demo = (window.VOCAB_DEMO || {})[id];
    if (demo) return (S.vocab[id] = demo);
    const [k, s] = kk.split("-");
    try {
      const r = await api("vocab?level=" + level() + "&k=" + k + "&s=" + s + (isDemo() ? "&demo=1" : ""));
      if (r.words && r.words.length) return (S.vocab[id] = r.words);
    } catch (e) {}
    return (S.vocab[id] = []);
  }
  function speak(t) {
    try { const u = new SpeechSynthesisUtterance(t.replace(/\(.*?\)|…/g, "")); u.lang = "de-DE"; u.rate = 0.85; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
  }

  /* ---------------- Fanehoana ---------------- */
  function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), 2600); }
  function celebrate() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = document.createElement("div"); c.className = "cele";
    const cols = ["#F4B400", "#0E8A63", "#D9402B", "#123B4A"];
    for (let i = 0; i < 46; i++) { const b = document.createElement("i"); b.style.left = Math.random() * 100 + "%"; b.style.background = cols[i % 4]; b.style.animationDelay = Math.random() * 0.5 + "s"; c.appendChild(b); }
    document.body.appendChild(c); setTimeout(() => c.remove(), 2400);
  }
  function sheet(html, cls = "") {
    closeSheet();
    const bg = document.createElement("div"); bg.className = "sheet-bg"; bg.id = "sheet";
    bg.innerHTML = '<div class="sheet ' + cls + '" role="dialog" aria-modal="true"><button class="sheet-x" data-act="close" aria-label="Hidio">✕</button>' + html + "</div>";
    bg.addEventListener("click", (e) => { if (e.target === bg) closeSheet(); });
    document.body.appendChild(bg);
    const f = bg.querySelector("input,select,.btn"); if (f) setTimeout(() => f.focus(), 60);
  }
  function closeSheet() { const s = $("#sheet"); if (s) s.remove(); }

  function trip(pct, opts = {}) {
    const ks = 8, here = Math.min(ks - 1, Math.floor(pct * ks));
    let dots = "", labels = "";
    for (let i = 0; i < ks; i++) {
      const x = (i / (ks - 1)) * 100;
      const cls = opts.anim ? "" : i < here ? "on" : i === here ? "here" : "";
      dots += '<span class="trip-dot ' + cls + '" style="left:' + x + '%"></span>';
      if (opts.labels) labels += '<span class="trip-k" style="left:' + x + '%">K' + (i + 1) + "</span>";
    }
    const pos = Math.max(2, Math.min(98, pct * 100));
    return '<div class="trip" aria-label="Fandrosoana ' + Math.round(pct * 100) + '%"><div class="trip-line"><div class="trip-fill" style="width:' + (opts.anim ? 0 : pos) + '%"></div>' + dots +
      '<span class="trip-plane" style="left:' + (opts.anim ? 2 : pos) + '%" aria-hidden="true">✈️</span></div>' + labels +
      '<div class="trip-ends"><span>Antananarivo<small>' + (opts.from || "Fanombohana") + '</small></span><span>Berlin<small>' + (opts.to || "Tanjona") + "</small></span></div></div>";
  }

  /* ---------- Pejy voalohany ---------- */
  function renderLanding() {
    app.innerHTML =
      '<div class="landing"><div class="wrap">' +
      '<header class="l-top"><span class="brand"><span class="brand-dot">DE</span>' + esc(SITE.brand) + '</span><button class="btn btn-ghost btn-sm" data-act="login">Hiditra</button></header>' +
      '<section class="hero"><h1>Mianara alemana, dingana tsirairay, isan\'andro.</h1>' +
      '<p class="lead">Lesona A1 hatramin\'ny B2 amin\'ny teny malagasy, fanazaran-tena, voambolana isan\'andro, ary Prof Hery manaraka anao hatrany.</p>' +
      trip(0.62, { anim: true, from: "Ianao anio", to: "Ny nofinao" }) +
      '<div class="hero-actions"><button class="btn btn-gold btn-block" data-act="demo">Andramo maimaim-poana</button>' +
      '<button class="btn btn-main btn-block" data-act="login">Efa mpianatra aho — Hiditra</button></div></section>' +
      '<ol class="how">' +
      "<li><div><b>Mianara voambolana 8</b><span>Karatra mihodina misy teny alemana, malagasy ary frantsay, miaraka amin'ny feo.</span></div></li>" +
      "<li><div><b>Vakio ny lesonan'ny andro</b><span>PDF iray isaky ny Kapitel, voalamina lesona isaky ny lesona.</span></div></li>" +
      "<li><div><b>Ataovy ny fanazaran-tena</b><span>Quiz an-tserasera mahafinaritra, hitanao avy hatrany ny valiny.</span></div></li>" +
      "<li><div><b>Manontania an'i Prof Hery</b><span>Mpampianatra virtoaly manazava, manitsy ary mitarika anao.</span></div></li>" +
      "</ol>" +
      '<footer class="l-foot">© ' + new Date().getFullYear() + " " + esc(SITE.brand) + " · Fampiharana am-bava ao amin'ny club Tsiazotafo</footer>" +
      "</div></div>";
    requestAnimationFrame(() => setTimeout(() => {
      const f = $(".trip-fill"), pl = $(".trip-plane");
      if (f) { f.style.transition = "width 1.6s cubic-bezier(.3,.7,.2,1)"; f.style.width = "62%"; pl.style.left = "62%"; }
      document.querySelectorAll(".trip-dot").forEach((d, i) => setTimeout(() => d.classList.add(i < 4 ? "on" : i === 4 ? "here" : "x"), 200 * i));
    }, 250));
  }

  function loginSheet(err) {
    sheet('<h2>Hiditra</h2><p class="sub">Ampidiro ny ID sy ny teny miafina nomen\'ny ' + esc(SITE.brand) + ".</p>" +
      (err ? '<div class="err">' + esc(err) + "</div>" : "") +
      '<form data-form="login"><label class="field"><span>ID-nao</span><input name="id" autocomplete="username" autocapitalize="characters" required></label>' +
      '<label class="field"><span>Teny miafina</span><input name="pw" type="password" autocomplete="current-password" required></label>' +
      '<button class="btn btn-main btn-block" type="submit">Hiditra</button></form>' +
      '<p class="muted" style="margin-top:14px">Mbola tsy manana kaonty ? <button class="link" data-act="demo">Andramo maimaim-poana aloha</button></p>');
  }
  function demoSheet() {
    let html = '<h2>Safidio ny ambaratonga</h2><p class="sub">Misokatra ho anao manontolo ny Kapitel ' + demoK() + " : lesona, fanazaran-tena, voambolana ary Prof Hery.</p><div class=\"levels\">";
    LEVELS.forEach((l) => { html += '<button class="lv-pick" data-act="demo-go" data-lv="' + l + '"><b>' + l + "</b><small>" + LV_INFO[l] + "</small></button>"; });
    sheet(html + '</div><p class="muted">Tsy fantatrao ny ambaratonganao ? Atombohy amin\'ny A1, na anontanio i Prof Hery.</p>');
  }

  /* ---------- Fampiharana ---------- */
  function renderApp() {
    const st = levelStats();
    const name = isDemo() ? "Mpanandrana" : S.student.name || S.student.id;
    const tabs = [["today", "🗓️", "Anio"], ["route", "🧭", "Lalana"], ["vocab", "🃏", "Voambolana"], ["prof", "💬", "Prof Hery"]];
    let h = "";
    if (isDemo()) h += '<div class="demo-band"><div class="wrap"><span>Fanandramana · ' + level() + " · Kapitel " + demoK() + "</span>" + (SITE.whatsapp ? '<button data-act="join">Hisoratra anarana</button>' : '<button data-act="exit">Hivoaka</button>') + "</div></div>";
    h += '<div class="app"><header class="topbar"><div class="wrap"><div class="who"><b>Salama, ' + esc(name) + " !</b><small>Ambaratonga " + level() + " · " + Math.round(st.pct * 100) + "% vita</small></div>" +
      '<span class="chip fire" title="Andro misesy">🔥 ' + (S.p.streak || 0) + '</span><span class="chip" title="Isa">⭐ ' + S.p.xp + "</span></div></header>" +
      '<main class="wrap" id="view"></main></div>' +
      '<nav class="tabs" aria-label="Fizarana"><div class="wrap">' + tabs.map((t) => '<button class="tab" data-act="tab" data-v="' + t[0] + '"' + (S.view === t[0] ? ' aria-current="page"' : "") + "><i>" + t[1] + "</i>" + t[2] + "</button>").join("") + "</div></nav>";
    app.innerHTML = h;
    ({ today: viewToday, route: viewRoute, vocab: viewVocab, prof: viewProf })[S.view]();
  }

  /* Anio */
  function viewToday() {
    const v = $("#view"), cur = current(), pl = plan(), st = levelStats();
    let h = trip(st.pct, { from: level() + " · Kapitel 1", to: level() + " · Kapitel 8" });
    if (!cur) {
      h += '<div class="today rest"><span class="kicker">Arahabaina !</span><h2>' + (isDemo() ? "Vitanao ny Kapitel " + demoK() : "Vitanao ny ambaratonga " + level()) + " 🎉</h2>" +
        '<p class="muted" style="color:#DFF3EA">' + (isDemo() ? "Raha te hanohy ianao dia misoratra anarana mba hisokatra ireo Kapitel 7 sisa." : "Resaho amin'i Prof Hery ny dingana manaraka (fanadinana, ambaratonga manaraka).") + "</p>" +
        (isDemo() && SITE.whatsapp ? '<button class="btn btn-gold" style="margin-top:14px" data-act="join">Hisoratra anarana</button>' : "") + "</div>";
    } else {
      const { K, x } = cur, kk = cur.key, idx = K.sess.indexOf(x) + 1;
      const rest = !isStudyDay() && !stepOk(kk, "v");
      h += '<section class="today' + (rest ? " rest" : "") + '"><span class="kicker">' + (rest ? "Andro fitsaharana — azonao atao ihany anefa ny mianatra" : "Ny lesonanao anio") + "</span>" +
        "<h2>" + esc(x.t) + "</h2><p class=\"muted\">Kapitel " + K.k + " · " + esc(K.t) + " · Lesona " + idx + "/" + K.sess.length + (x.fac ? ' <span class="tag">azo dinganina</span>' : "") + "</p></section>";
      const exos = x.ex || [];
      const steps = [
        ["v", "Voambolana 8 anio", "Jereo ny karatra, henoy ny feo, ary marihy izay fantatrao.", '<button class="btn btn-soft btn-sm" data-act="tab" data-v="vocab">Hianatra voambolana</button>'],
        ["l", "Vakio ny lesona", "Sokafy ny PDF an'ny Kapitel " + K.k + " ary tadiavo ny « Séance " + x.s + " »" + (x.p ? " (pejy " + x.p + ")" : "") + ".", '<button class="btn btn-soft btn-sm" data-act="pdf" data-k="' + K.k + '" data-s="' + x.s + '">📖 Sokafy ny lesona</button>'],
        ["e", "Fanazaran-tena", exos.length ? "Ataovy ny " + (exos.length > 1 ? exos.length + " fanazaran-tena" : "quiz") + ", avy eo soraty ny naoty azonao." : "Tsy misy quiz ity lesona ity : ataovy ny fanazaran-tena ao amin'ny PDF.", exoList(kk, exos)],
        ["d", "Vita ny lesona ?", "Rehefa vita ny dingana rehetra dia tsindrio ity bokotra ity mba handrosoanao.", '<button class="btn btn-main btn-sm" data-act="finish" data-kk="' + kk + '">✓ Vita ny lesona</button>' + (x.fac ? ' <button class="btn btn-ghost btn-sm" data-act="skip" data-kk="' + kk + '">Dinganina</button>' : "")]
      ];
      const firstOpen = steps.findIndex((s) => !stepOk(kk, s[0]));
      h += '<ol class="steps">' + steps.map((s, i) => '<li class="step' + (stepOk(kk, s[0]) ? " ok" : "") + (i === firstOpen ? " now" : "") + '"><span class="step-n" aria-hidden="true"></span><div><b>' + s[1] + "</b><p>" + s[2] + '</p><div class="acts">' + s[3] + "</div></div></li>").join("") + "</ol>";
      h += '<p class="muted" style="margin-top:12px">Misy tsy azonao ? <button class="link" data-act="tab" data-v="prof">Anontanio i Prof Hery</button></p>';
    }
    // Fandaharana
    h += '<section class="sec"><div class="sec-h"><h2>Ny fandaharanao</h2></div><div class="plan"><p class="muted">Andro ianarana isan-kerinandro :</p><div class="week">' +
      [1, 2, 3, 4, 5, 6, 0].map((d) => '<button class="day" data-act="day" data-d="' + d + '" aria-pressed="' + (S.p.days || []).includes(d) + '" title="' + DAYS_LONG[d] + '">' + DAYS[d] + "</button>").join("") + "</div>" +
      '<p style="margin-top:12px">' + (pl.end ? "Lesona " + pl.rest + " sisa · " + pl.perWeek + " isan-kerinandro → vita eo ho eo amin'ny <b>" + fmtDate(pl.end) + "</b>" : "Vita ny lesona rehetra !") + "</p>" +
      '<p class="muted" style="margin-top:4px">Ny fahamaivanana no tsara kokoa noho ny hafainganana.</p></div></section>';
    // Antontanisa
    const words = Object.keys(S.p.known || {}).length, doneN = Object.keys(S.p.done).length;
    h += '<section class="sec"><div class="stats"><div class="stat"><b>' + doneN + "</b><span>lesona vita</span></div><div class=\"stat\"><b>" + words + "</b><span>teny fantatra</span></div><div class=\"stat\"><b>" + (S.p.best || 0) + "</b><span>andro misesy indrindra</span></div></div></section>";
    h += '<section class="sec"><div class="sec-h"><h2>Mari-pankasitrahana</h2></div><div class="badges">' + badges().map((b) => '<span class="badge' + (b[2] ? "" : " off") + '"><i>' + b[0] + "</i>" + b[1] + "</span>").join("") + "</div></section>";
    if (!isDemo()) h += '<p style="margin:26px 0 8px;text-align:center"><button class="link" data-act="logout">Hivoaka</button></p>';
    else h += '<p style="margin:26px 0 8px;text-align:center"><button class="link" data-act="exit">Hiala amin\'ny fanandramana</button></p>';
    v.innerHTML = h;
  }
  function exoList(kk, exos) {
    if (!exos.length) return '<button class="btn btn-soft btn-sm" data-act="exo-none" data-kk="' + kk + '">Vita ao amin\'ny PDF</button>';
    const sc = S.p.scores[kk] || {};
    return '<div class="exo-list" style="width:100%">' + exos.map((e, i) => '<a class="exo' + (sc[i] != null ? " ok" : "") + '" href="' + esc(e.u) + '" target="_blank" rel="noopener" data-act="exo" data-kk="' + kk + '" data-i="' + i + '"><span class="tick">' + (sc[i] != null ? "✓" : "") + "</span>" + esc(exos.length > 1 ? i + 1 + ". " + e.t : "Quiz an-tserasera") + (sc[i] != null ? '<span class="sc">' + sc[i] + "%</span>" : "") + "</a>").join("") + "</div>";
  }
  function badges() {
    const doneN = Object.keys(S.p.done).length, words = Object.keys(S.p.known || {}).length;
    const kDone = kaps().some((K) => kapStats(K).d === K.sess.length);
    return [["🌱", "Lesona voalohany", doneN >= 1], ["🔥", "Andro 3 misesy", (S.p.best || 0) >= 3], ["📚", "Teny 50", words >= 50], ["🏅", "Kapitel vita", kDone], ["🚀", "Andro 7 misesy", (S.p.best || 0) >= 7], ["🎓", "Teny 200", words >= 200]];
  }

  /* Lalana */
  function viewRoute() {
    const v = $("#view"), cur = current();
    let h = '<div class="sec-h" style="margin-top:6px"><h2>Ny lalanao ' + level() + '</h2><span class="muted">' + Math.round(levelStats().pct * 100) + "%</span></div><div class=\"route\">";
    kaps().forEach((K) => {
      const s = kapStats(K), open = kapOpen(K.k), isCur = cur && cur.K.k === K.k;
      const expanded = S.open[K.k] != null ? S.open[K.k] : isCur;
      h += '<div class="kap' + (s.d === s.n ? " done" : "") + (isCur ? " cur" : "") + (open ? "" : " locked") + '"><span class="kap-node">' + (s.d === s.n ? "✓" : open ? K.k : "🔒") + '</span><div class="kap-card">' +
        '<button class="kap-head" data-act="kap" data-k="' + K.k + '" aria-expanded="' + !!expanded + '"><h3>Kapitel ' + K.k + "</h3><span class=\"muted\">" + esc(K.t) + " · lesona " + s.d + "/" + s.n + '</span><div class="bar"><i style="width:' + s.pct + '%"></i></div></button>';
      if (expanded) {
        if (!open) h += '<p class="muted" style="padding:0 16px 14px 22px">Hisokatra rehefa misoratra anarana ianao.' + (SITE.whatsapp ? ' <button class="link" data-act="join">Hisoratra anarana</button>' : "") + "</p>";
        else {
          h += '<div style="padding:0 14px 8px 22px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-soft btn-sm" data-act="pdf" data-k="' + K.k + '">📖 PDF Kapitel ' + K.k + "</button>" +
            (K.eval && K.eval.u ? '<a class="btn btn-ghost btn-sm" href="' + esc(K.eval.u) + '" target="_blank" rel="noopener">🏁 Fanombanana farany</a>' : "") + '</div><ul class="sess-list">';
          K.sess.forEach((x, i) => {
            const kk = key(K.k, x.s), ok = isDone(kk), c = cur && cur.key === kk;
            h += '<li class="sess' + (ok ? " ok" : "") + (c ? " cur" : "") + '"><span class="sess-st">' + (S.p.skip[kk] ? "»" : ok ? "✓" : i + 1) + '</span><span class="sess-t">' + esc(x.t) + (x.fac ? '<span class="tag">azo dinganina</span>' : "") +
              "<small>Lesona " + (i + 1) + (x.p ? " · pejy " + x.p : "") + ((x.ex || []).length ? " · " + x.ex.length + " fanazaran-tena" : "") + "</small></span>" +
              (ok ? '<button class="btn btn-ghost btn-sm" data-act="undo" data-kk="' + kk + '" title="Averina">↺</button>' : c ? '<button class="btn btn-main btn-sm" data-act="tab" data-v="today">Anio</button>' : '<button class="btn btn-soft btn-sm" data-act="pdf" data-k="' + K.k + '" data-s="' + x.s + '">📖</button>') + "</li>";
          });
          h += "</ul>";
        }
      }
      h += "</div></div>";
    });
    v.innerHTML = h + "</div>";
  }

  /* Voambolana */
  async function viewVocab() {
    const v = $("#view"), cur = current();
    if (!cur) { v.innerHTML = '<p class="muted" style="margin-top:20px">Vita ny lesona rehetra. Avereno jerena ny teny fantatrao ao amin\'ny lisitra.</p>' + knownList(); return; }
    v.innerHTML = '<p class="muted" style="margin-top:20px">Maka ny voambolana…</p>';
    const words = await loadVocab(cur.key);
    if (S.view !== "vocab") return;
    if (!words.length) {
      v.innerHTML = '<div class="sec"><h2>Voambolana · ' + esc(cur.x.t) + '</h2><p class="note" style="margin-top:12px">Tsy azo nalaina ny voambolana amin\'izao fotoana izao. Ao amin\'ny PDF an\'ny lesona dia misy lisitry ny voambolana ; azonao atao koa ny manontany an\'i Prof Hery : « Omeo voambolana 8 ho an\'ity lesona ity ».</p><button class="btn btn-soft" style="margin-top:12px" data-act="vocab-done">Vita ny voambolana</button></div>' + knownList();
      return;
    }
    if (S.card >= words.length) S.card = 0;
    const w = words[S.card], id = level() + "-" + cur.key + "-" + S.card;
    let h = '<div class="sec-h" style="margin-top:6px"><h2>Voambolana anio</h2><span class="muted">' + (S.card + 1) + "/" + words.length + "</span></div>" +
      '<p class="muted" style="margin-bottom:12px">' + esc(cur.x.t) + "</p>" +
      '<div class="flash-wrap"><button class="flash' + (S.flip ? " flip" : "") + '" data-act="flip" aria-label="Avadiho ny karatra">' +
      '<div class="face front"><span class="w">' + esc(w.de) + '</span><span class="say" data-act="say">🔊 Henoy</span><span class="hint">Tsindrio raha hijery ny dikany</span></div>' +
      '<div class="face back"><span class="mg">' + esc(w.mg) + '</span><span class="fr">' + esc(w.fr) + "</span>" + (w.ex ? '<span class="ex">' + esc(w.ex) + "</span>" : "") + "</div></button></div>" +
      '<div class="flash-nav"><button class="btn btn-ghost" data-act="card-no">Mbola tsy fantatro</button><button class="btn btn-main" data-act="card-yes">Fantatro ✓</button></div>' +
      '<div class="dots">' + words.map((_, i) => '<i class="' + (i === S.card ? "on" : S.p.known[level() + "-" + cur.key + "-" + i] ? "k" : "") + '"></i>').join("") + "</div>";
    if (stepOk(cur.key, "v")) h += '<p class="note" style="margin-top:16px">✓ Vita ny voambolana anio. <button class="link" data-act="tab" data-v="today">Hiverina amin\'ny dingana manaraka</button></p>';
    v.innerHTML = h + '<div class="sec"><h2 style="font-size:20px;margin-bottom:8px">Ireo teny anio</h2><div class="wordlist">' + words.map((x) => "<div><b>" + esc(x.de) + "</b><span>" + esc(x.mg) + "</span></div>").join("") + "</div></div>";
    S._words = words; S._wid = id;
  }
  function knownList() { return ""; }

  /* Prof Hery */
  function viewProf() {
    const v = $("#view"), cur = current();
    const hello = { role: "prof", text: "Salama ! Izaho i Prof Hery 👋\nAfaka manazava ny fitsipi-pitenenana, manome fanazaran-tena, manitsy ny fehezanteninao, na manampy anao handamina ny fianaranao aho.\n" + (cur ? "Ankehitriny ianao dia ao amin'ny « " + cur.x.t + " » (Kapitel " + cur.K.k + "). Inona no tianao hatao ?" : "Inona no tianao hatao ?") };
    const log = [hello].concat(S.chat);
    const quick = ["Hazavao ity lesona ity", "Omeo fanazaran-tena aho", "Ahitsio ity fehezanteny ity :", "Ahoana no hanatsarako ny fianarako ?"];
    v.innerHTML = '<div class="chat"><div class="prof-head"><span class="avatar">H</span><div><b style="font-family:var(--display);font-size:18px">Prof Hery</b><br><span class="muted">Mpampianatra virtoaly · ' + level() + "</span></div></div>" +
      '<div class="chat-log" id="log">' + log.map((m) => '<div class="msg ' + m.role + '">' + fmt(m.text) + "</div>").join("") + "</div>" +
      '<div class="quick">' + quick.map((q) => '<button data-act="quick">' + esc(q) + "</button>").join("") + "</div>" +
      '<form class="chat-form" data-form="chat"><input name="q" placeholder="Soraty eto ny fanontanianao…" autocomplete="off" aria-label="Hafatra ho an\'i Prof Hery"><button class="btn btn-main" type="submit">Alefa</button></form></div>';
    const l = $("#log"); l.scrollTop = l.scrollHeight;
  }
  const fmt = (t) => esc(t).replace(/\*([^*\n]+)\*/g, "<b>$1</b>");
  async function sendChat(text) {
    text = text.trim(); if (!text) return;
    if (isDemo() && (S.p.chats || 0) >= (SITE.demoChatLimit || 12)) {
      S.chat.push({ role: "me", text }, { role: "prof", text: "Tapitra ny hafatra azo alefa mandritra ny fanandramana. Misoratra anarana mba hahafahako manaraka anao isan'andro mandra-pahavitan'ny ambaratongao ! 🙂" });
      viewProf(); return;
    }
    S.chat.push({ role: "me", text }); viewProf();
    const l = $("#log"); const t = document.createElement("div"); t.className = "msg prof typing"; t.textContent = "Prof Hery manoratra…"; l.appendChild(t); l.scrollTop = l.scrollHeight;
    const cur = current();
    const ctx = { level: level(), current: cur ? { k: cur.K.k, s: cur.x.s, title: cur.x.t, kapitel: cur.K.t } : null, done: Object.keys(S.p.done).length, total: flat().length, streak: S.p.streak, days: S.p.days, scores: lastScores(), demo: isDemo() };
    let reply;
    try {
      const r = await api("chat", { body: { messages: S.chat.slice(-12), ctx, demo: isDemo() } });
      reply = r.reply;
    } catch (e) {
      reply = e.offline ? "Mbola tsy mandeha eto aho satria tsy mbola napetraka amin'ny Netlify ny site. Rehefa an-tserasera ny site dia hamaly anao tokoa aho. 🙂" : e.message || "Nisy olana, andramo indray.";
    }
    S.chat.push({ role: "prof", text: reply });
    S.p.chats = (S.p.chats || 0) + 1; touch(2); save();
    if (!isDemo()) store.set("hcf_chat_" + S.student.id, S.chat.slice(-30));
    if (S.view === "prof") viewProf();
  }
  function lastScores() {
    const out = [];
    Object.keys(S.p.scores).slice(-6).forEach((kk) => { const v = Object.values(S.p.scores[kk]); if (v.length) out.push(kk + ": " + v.join("/") + "%"); });
    return out.join(", ");
  }

  /* ---------- PDF ---------- */
  function openPdf(k, s) {
    const K = kaps().find((x) => x.k === +k); if (!K) return;
    const x = s ? K.sess.find((y) => y.s === +s) : null;
    sheet('<h2>Kapitel ' + K.k + " · " + esc(K.t) + "</h2>" + (x ? '<p class="note" style="margin-top:8px">Tadiavo ny <b>« Séance ' + x.s + " »</b> : " + esc(x.t) + (x.p ? " — pejy " + x.p : "") + "</p>" : "") +
      '<iframe src="' + pdfUrl(K.pdf) + '" title="PDF Kapitel ' + K.k + '" allow="autoplay"></iframe>' +
      '<p style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-soft btn-sm" href="' + pdfOpenUrl(K.pdf) + '" target="_blank" rel="noopener">Sokafy amin\'ny takelaka vaovao</a>' +
      (x ? '<button class="btn btn-main btn-sm" data-act="read-ok" data-kk="' + key(K.k, x.s) + '">✓ Vita ny famakiana</button>' : "") + "</p>", "pdf-sheet");
  }
  function scoreSheet(kk, i) {
    sheet('<h2>Vita ve ny fanazaran-tena ?</h2><p class="sub">Soraty ny naoty azonao (isan-jato). Hampiasain\'i Prof Hery izany hanoroana anao.</p>' +
      '<form data-form="score" data-kk="' + kk + '" data-i="' + i + '"><label class="field"><span>Naoty (0–100)</span><input name="sc" type="number" min="0" max="100" inputmode="numeric" required></label>' +
      '<button class="btn btn-main btn-block" type="submit">Raiketo</button></form><p style="margin-top:10px;text-align:center"><button class="link" data-act="close">Mbola tsy vita</button></p>');
  }

  /* ---------- Hetsika ---------- */
  document.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    const a = el.dataset.act;
    if (a === "exo") { S._pendingExo = [el.dataset.kk, el.dataset.i]; setTimeout(() => scoreSheet(el.dataset.kk, el.dataset.i), 400); return; }
    if (el.tagName === "A") return;
    e.preventDefault();
    switch (a) {
      case "close": closeSheet(); break;
      case "login": loginSheet(); break;
      case "demo": demoSheet(); break;
      case "demo-go": startDemo(el.dataset.lv); break;
      case "join": if (SITE.whatsapp) window.open("https://wa.me/" + SITE.whatsapp + "?text=" + encodeURIComponent("Salama ! Te hisoratra amin'ny fianarana alemana " + (S.p ? level() : "") + " aho."), "_blank"); break;
      case "exit": S.mode = null; S.chat = []; renderLanding(); break;
      case "logout": store.del("hcf_tok"); S.token = null; S.mode = null; S.chat = []; renderLanding(); break;
      case "tab": S.view = el.dataset.v; S.card = 0; S.flip = false; closeSheet(); renderApp(); window.scrollTo(0, 0); break;
      case "kap": { const k = +el.dataset.k; const cur = current(); const was = S.open[k] != null ? S.open[k] : cur && cur.K.k === k; S.open[k] = !was; viewRoute(); break; }
      case "pdf": openPdf(el.dataset.k, el.dataset.s); break;
      case "read-ok": setStep(el.dataset.kk, "l", 5); closeSheet(); toast("Tsara be ! +5 ⭐"); renderApp(); break;
      case "exo-none": setStep(el.dataset.kk, "e", 10); renderApp(); break;
      case "finish": finish(el.dataset.kk); break;
      case "finish-force": finish(el.dataset.kk, true); break;
      case "skip": S.p.skip[el.dataset.kk] = today(); save(); toast("Nodinganina ny lesona fanampiny"); renderApp(); break;
      case "undo": delete S.p.done[el.dataset.kk]; delete S.p.skip[el.dataset.kk]; save(); viewRoute(); break;
      case "day": { const d = +el.dataset.d; const set = new Set(S.p.days || []); set.has(d) ? set.delete(d) : set.add(d); if (!set.size) { toast("Safidio andro iray farafahakeliny"); return; } S.p.days = [...set]; save(); viewToday(); break; }
      case "flip": if (e.target.closest("[data-act=say]")) { speak(S._words[S.card].de); return; } S.flip = !S.flip; el.classList.toggle("flip"); break;
      case "say": speak(S._words[S.card].de); break;
      case "card-yes": case "card-no": {
        const cur = current(); if (!cur || !S._words) return;
        if (a === "card-yes") S.p.known[level() + "-" + cur.key + "-" + S.card] = 1;
        else delete S.p.known[level() + "-" + cur.key + "-" + S.card];
        S.flip = false;
        if (S.card + 1 >= S._words.length) { if (!stepOk(cur.key, "v")) { setStep(cur.key, "v", 10); toast("Vita ny voambolana ! +10 ⭐"); } S.card = 0; save(); renderApp(); }
        else { S.card++; save(); viewVocab(); }
        break;
      }
      case "vocab-done": { const cur = current(); if (cur) { setStep(cur.key, "v", 10); renderApp(); } break; }
      case "quick": { const inp = $("[data-form=chat] input"); inp.value = el.textContent + (el.textContent.endsWith(":") ? " " : ""); inp.focus(); if (!el.textContent.endsWith(":")) $("[data-form=chat]").requestSubmit(); break; }
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-form]"); if (!f) return; e.preventDefault();
    const fd = new FormData(f);
    if (f.dataset.form === "login") {
      const btn = f.querySelector("button"); btn.disabled = true; btn.textContent = "Miandry…";
      try {
        const r = await api("login", { body: { id: String(fd.get("id")).trim(), password: fd.get("pw") } });
        S.token = r.token; store.set("hcf_tok", r.token); enterStudent(r.student, r.progress); closeSheet();
      } catch (err) {
        loginSheet(err.offline ? "Mbola tsy mandeha ny fidirana : tsy mbola napetraka amin'ny Netlify ny site. Andramo ny fanandramana maimaim-poana." : err.status === 401 ? "Diso ny ID na ny teny miafina." : err.message);
      }
    }
    if (f.dataset.form === "chat") { const q = fd.get("q"); f.reset(); sendChat(String(q || "")); }
    if (f.dataset.form === "score") {
      const kk = f.dataset.kk, i = f.dataset.i, sc = Math.max(0, Math.min(100, +fd.get("sc")));
      S.p.scores[kk] = S.p.scores[kk] || {}; S.p.scores[kk][i] = sc;
      const cur = flat().find((x) => x.key === kk);
      const all = cur && (cur.x.ex || []).every((_, j) => S.p.scores[kk][j] != null);
      touch(5); if (all) setStep(kk, "e", 10); save(); closeSheet();
      toast(sc >= 80 ? "Tena tsara ! " + sc + "% 🎯" : sc >= 50 ? "Tsara ! " + sc + "% — afaka manandrana indray ianao" : sc + "% — anontanio i Prof Hery hanazava"); renderApp();
    }
  });

  function finish(kk, force) {
    const missing = ["v", "l", "e"].filter((s) => !stepOk(kk, s));
    if (missing.length && !force) {
      const names = { v: "ny voambolana", l: "ny famakiana", e: "ny fanazaran-tena" };
      sheet("<h2>Mbola misy dingana tsy vita</h2><p class=\"sub\">Mbola tsy voamarika ho vita : " + missing.map((m) => names[m]).join(", ") + ".</p>" +
        '<button class="btn btn-main btn-block" data-act="close">Hiverina hamita azy</button><p style="margin-top:12px;text-align:center"><button class="link" data-act="finish-force" data-kk="' + kk + '">Hamarana ihany ny lesona</button></p>');
      return;
    }
    closeSheet();
    S.p.done[kk] = today(); touch(20); save(); celebrate();
    const nxt = current();
    toast(nxt ? "Arahabaina ! +20 ⭐ — Lesona manaraka : " + nxt.x.t : "Arahabaina ! Vita daholo 🎉");
    S.card = 0; renderApp(); window.scrollTo(0, 0);
  }

  /* ---------- Fidirana ---------- */
  function startDemo(lv) {
    S.mode = "demo"; S.student = null; S.token = null; S.chat = []; S.view = "today"; S.open = {}; S.card = 0;
    S.p = Object.assign(newProgress(lv), store.get("hcf_demo_" + lv, {}));
    closeSheet(); renderApp(); window.scrollTo(0, 0);
  }
  function enterStudent(student, progress) {
    S.mode = "student"; S.student = student; S.view = "today"; S.open = {}; S.card = 0;
    const local = store.get("hcf_p_" + student.id, null);
    let p = progress && progress.level ? progress : local && local.level === student.level ? local : newProgress(student.level);
    if (local && progress && local.level === student.level && Object.keys(local.done || {}).length > Object.keys(progress.done || {}).length) p = local;
    p.level = student.level;
    S.p = Object.assign(newProgress(student.level), p);
    S.chat = store.get("hcf_chat_" + student.id, []);
    renderApp();
  }
  async function boot() {
    const tok = store.get("hcf_tok", null);
    if (tok) {
      S.token = tok;
      try { const r = await api("me"); enterStudent(r.student, r.progress); return; }
      catch (e) { if (!e.offline) store.del("hcf_tok"); S.token = null; }
    }
    renderLanding();
    if (location.hash === "#andramo") demoSheet();
    if (location.hash === "#hiditra") loginSheet();
  }
  boot();
})();
