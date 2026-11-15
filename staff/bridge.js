/* Amed Cafe staff page — bridge to Firebase.
   Gives the staff tool the same small database / user / downloads interface it had inside Claude
   (window.claude.use("db" | "user" | "downloads")), backed by Firestore + Google sign-in.
   It also keeps each member's public card (cards/<secret key>) and the public cafe info (public/meta)
   up to date, so customers' phones update instantly. */
(() => {
  "use strict";
  const FB = window.AmedFB;
  const CONFIG = {
    apiKey: "AIzaSyBL1jUUtB8uQ26jTj3aoBjOJrRWHJuErVI",
    authDomain: "amed-cafe.firebaseapp.com",
    projectId: "amed-cafe",
    storageBucket: "amed-cafe.firebasestorage.app",
    messagingSenderId: "1005235134584",
    appId: "1:1005235134584:web:f977d4b29ad2ddcc234d8d",
  };
  const STAFF_LINK = "https://amedcaferest.com/staff/";
  const CUSTOMER_LINK = "https://amedcaferest.com/card/";
  const qs = new URLSearchParams(location.search);
  const EMU = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && qs.has("emu");

  const app = FB.initializeApp(CONFIG);
  const auth = FB.getAuth(app);
  let fs;
  try { fs = FB.initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: FB.persistentLocalCache({ tabManager: FB.persistentMultipleTabManager() }) }); }
  catch (_) { fs = FB.initializeFirestore(app, { ignoreUndefinedProperties: true }); }
  if (EMU) { FB.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); FB.connectFirestoreEmulator(fs, "127.0.0.1", 8080); }

  /* ---------- errors and snapshots in the staff tool's shape ---------- */
  const CODE = { "permission-denied": "invalid_argument", unauthenticated: "invalid_argument", unavailable: "unavailable", "resource-exhausted": "quota_exceeded", "deadline-exceeded": "unavailable" };
  const wrapErr = (e) => { const x = new Error((e && e.message) || "error"); x.code = CODE[e && e.code] || (e && e.code) || "unknown"; return x; };
  const meta = (m) => ({ fromCache: !!m.fromCache, hasPendingWrites: !!m.hasPendingWrites });
  const dsnap = (s) => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: meta(s.metadata) });
  const qsnap = (q) => ({ docs: q.docs.map(dsnap), size: q.size, empty: q.empty, metadata: meta(q.metadata), docChanges: () => q.docChanges().map((c) => ({ type: c.type, doc: dsnap(c.doc) })) });
  // Offline, Firestore keeps the write and sends it later; don't keep the tool waiting.
  const settle = (p) => { const g = p.catch((e) => { throw wrapErr(e); }); if (navigator.onLine === false) { g.catch(() => {}); return Promise.resolve(); } return g; };
  const plain = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
  // "update" merges nested fields (like the old database), so flatten objects into field paths.
  function flat(obj, pre, out) {
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue;
      const p = pre.concat(k);
      if (plain(v) && v.__delete__ === true) out.push([p, FB.deleteField()]);
      else if (plain(v) && Object.keys(v).length) flat(v, p, out);
      else out.push([p, v]);
    }
    return out;
  }

  /* ---------- database interface ---------- */
  const CUST = /^customers\/([^/]+)$/, SETTINGS = "settings/card";
  function docRef(path) {
    const r = FB.doc(fs, path), m = path.match(CUST);
    const after = (p) => p.then((v) => { if (m) mirror(m[1]); if (path === SETTINGS) publishMeta(); return v; });
    return {
      id: r.id, path,
      get: () => FB.getDoc(r).then(dsnap, (e) => { throw wrapErr(e); }),
      set: (d) => after(settle(FB.setDoc(r, d))),
      update: (d) => {
        const pairs = flat(d || {}, [], []); if (!pairs.length) return Promise.resolve();
        const args = []; for (const [p, v] of pairs) args.push(new FB.FieldPath(...p), v);
        return after(settle(FB.updateDoc(r, ...args)));
      },
      delete: async () => { let old = null; if (m) old = await readLocal(path); await settle(FB.deleteDoc(r)); if (m) unpublish(m[1], old); },
      onSnapshot: (next, err) => FB.onSnapshot(r, { includeMetadataChanges: true }, (s) => next(dsnap(s)), (e) => err && err(wrapErr(e))),
    };
  }
  function query(path, cons) {
    const base = FB.collection(fs, path), q = () => (cons.length ? FB.query(base, ...cons) : base);
    return {
      where: (f, op, v) => query(path, cons.concat(FB.where(f, op, v))),
      orderBy: (f, d) => query(path, cons.concat(FB.orderBy(f, d))),
      limit: (n) => query(path, cons.concat(FB.limit(n))),
      get: () => FB.getDocs(q()).then(qsnap, (e) => { throw wrapErr(e); }),
      onSnapshot: (next, err) => FB.onSnapshot(q(), { includeMetadataChanges: true }, (s) => next(qsnap(s)), (e) => err && err(wrapErr(e))),
      doc: (id) => docRef(path + "/" + (id || FB.doc(base).id)),
    };
  }
  const db = { doc: docRef, collection: (c) => query(c, []) };
  async function readLocal(path) {
    const r = FB.doc(fs, path);
    try { const s = await FB.getDocFromCache(r); if (s.exists()) return s.data(); } catch (_) {}
    try { const s = await FB.getDoc(r); if (s.exists()) return s.data(); } catch (_) {}
    return null;
  }

  /* ---------- public cards: what a customer's phone reads, keyed by PBKDF2(PIN, phone) ---------- */
  let settings = null;
  const I18N = { drinks: { name_ar: "المشروبات", reward_ar: "مشروب مجاني", name_ku: "ڤەخوارن", reward_ku: "ڤەخوارنەکا بێ بەرامبەر" },
    shisha: { name_ar: "الأركيلة", reward_ar: "أركيلة مجانية", name_ku: "نێرگەلە", reward_ku: "نێرگەلەکا بێ بەرامبەر" } };
  const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
  function normPhone(raw) {
    let d = String(raw || "").replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2);
    const cc = String((settings && settings.countryCode) || "964").replace(/\D/g, "");
    if (cc && d.startsWith(cc) && d.length > 10) d = d.slice(cc.length);
    return d.replace(/^0+/, "");
  }
  const keyCache = new Map();
  async function cardKey(id, pin) {
    pin = String(pin || "").replace(/\D/g, ""); if (pin.length !== 4) return null;
    const ck = id + "|" + pin + "|" + ((settings && settings.countryCode) || ""); if (keyCache.has(ck)) return keyCache.get(ck);
    const enc = new TextEncoder(), k = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
    const key = hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode("amed-cafe:" + normPhone(id)), iterations: 100000 }, k, 128));
    keyCache.set(ck, key); return key;
  }
  function cardEntry(c) {
    const st = settings || {}, progs = st.programs || [{ id: "drinks", target: 7 }], expiry = Number(st.expiryDays) || 0, now = Date.now(), DAY = 864e5;
    const ids = c.enrolled || progs.map((p) => p.id), log = c.log || [];
    const e = { fn: String(c.name || "").split(" ")[0].slice(0, 24), code: c.code || null, v: Number.isInteger(c.visits) ? c.visits : log.filter((x) => x.type === "stamp").length,
      yv: c.yearVisits || {}, lv: c.lastVisit || null, p: {}, u: now };
    for (const p of progs) {
      if (!ids.includes(p.id)) continue;
      const k = (c.cards || {})[p.id] || {}, n = k.rewards || 0;
      let times = Array.isArray(k.rewardTimes) && k.rewardTimes.length === n ? k.rewardTimes : Array(n).fill(k.readySince || c.lastVisit || now);
      times = times.filter((t) => !expiry || t + expiry * DAY > now).sort((a, b) => a - b);
      e.p[p.id] = [k.stamps || 0, times.length, k.redeemed || 0, k.totalStamps || 0, times.length && expiry ? Math.round(times[0] + expiry * DAY) : 0];
    }
    const last = log[0];   // newest first: lets the customer's phone celebrate a fresh stamp
    if (last && (last.type === "stamp" || last.type === "bonus") && now - (last.t || 0) < 10 * 60e3) e.ev = { t: last.t, p: last.program, n: (last.n || 0) + (last.x || 0), e: last.earned || 0 };
    return e;
  }
  const pending = new Map();
  function mirror(id) {   // debounce per member
    clearTimeout(pending.get(id)); pending.set(id, setTimeout(() => { pending.delete(id); publishCard(id).catch((e) => console.warn("card", e)); }, 150));
  }
  async function publishCard(id) {
    const c = await readLocal("customers/" + id); if (!c) return;
    const key = await cardKey(id, c.pin);
    if (c.cardKey && c.cardKey !== key) FB.deleteDoc(FB.doc(fs, "cards/" + c.cardKey)).catch(() => {});
    if (!key) { if (c.cardKey) FB.updateDoc(FB.doc(fs, "customers/" + id), { cardKey: FB.deleteField() }).catch(() => {}); return; }
    await settle(FB.setDoc(FB.doc(fs, "cards/" + key), cardEntry(c)));
    if (c.cardKey !== key) FB.updateDoc(FB.doc(fs, "customers/" + id), { cardKey: key }).catch(() => {});
  }
  async function unpublish(id, old) {
    let key = old && old.cardKey; if (!key && old) key = await cardKey(id, old.pin);
    if (key) FB.deleteDoc(FB.doc(fs, "cards/" + key)).catch(() => {});
  }
  function metaOf(s) {
    const cc = String(s.countryCode || "").replace(/\D/g, ""), progs = s.programs || [], expiry = Number(s.expiryDays) || 0;
    const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
    const wa = String(s.cafeWhatsApp || "").replace(/\D/g, "");
    return {
      updated: Date.now(), cafe: s.cafe || "Amed Cafe", countryCode: cc, staffLink: STAFF_LINK, expiryDays: expiry,
      programs: progs.map((p) => { const o = { ...(I18N[p.id] || {}) }; for (const k of ["id", "name", "target", "reward", "name_ar", "reward_ar", "name_ku", "reward_ku"]) if (k in p) o[k] = p[k]; return o; }),
      showPerks: !!s.showPerks,
      levels: (s.levels || []).map((l) => ({ name: l.name, visits: l.visits, stamps: l.stamps || 0, perk: l.perk || "", perk_ar: l.perk_ar || "", perk_ku: l.perk_ku || "" })),
      rules: { limits: Object.fromEntries(progs.map((p) => [p.id, Number(p.dailyLimit) || 0])), expiryDays: expiry,
        referral: { enabled: !!(s.referral || {}).enabled, bonus: (s.referral || {}).bonus || 1 },
        birthday: { enabled: !!(s.birthday || {}).enabled, program: (s.birthday || {}).program || "drinks" } },
      offers: (s.offers || []).filter((o) => o.enabled).map((o) => ({ name: o.name || "", multiplier: o.multiplier || 1, days: o.days || [], from: o.from || "", to: o.to || "", programs: o.programs || [] })),
      events: (s.events || []).filter((e) => (e.date || "") >= today).map((e) => ({ title: e.title || "", date: e.date || "", from: e.from || "", to: e.to || "", multiplier: e.multiplier || 1, details: e.details || "" }))
        .sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from)).slice(0, 6),
      contact: { wa: wa.startsWith("0") && cc ? cc + wa.slice(1) : wa, join: !!s.joinEnabled },
    };
  }
  let isOwnerCached = null;
  async function publishMeta() {
    if (!(await ownerCheck())) return;
    const s = await readLocal(SETTINGS); if (!s) return; settings = s;
    await settle(FB.setDoc(FB.doc(fs, "public/meta"), metaOf(s)));
  }
  async function ownerCheck() {
    if (isOwnerCached !== null) return isOwnerCached;
    for (let i = 0; i < 8 && isOwnerCached === null; i++) {   // the connection may still be starting: retry briefly
      try { await FB.getDoc(FB.doc(fs, "private/owner")); isOwnerCached = true; }
      catch (e) { if (e && e.code === "permission-denied") isOwnerCached = false; else await new Promise((r) => setTimeout(r, 800)); }
    }
    return !!isOwnerCached;
  }

  /* ---------- sign-in ---------- */
  let resolveReady; const ready = new Promise((r) => (resolveReady = r));
  const user = {
    id: async () => (auth.currentUser ? auth.currentUser.uid : null),
    me: async () => ({ name: (auth.currentUser && auth.currentUser.displayName) || "", email: (auth.currentUser && auth.currentUser.email) || "" }),
    can: async () => null,
    canEdit: () => ownerCheck(),
    isOwner: () => ownerCheck(),
    profiles: async (ids) => Object.fromEntries(ids.map((i) => [i, { name: auth.currentUser && i === auth.currentUser.uid ? auth.currentUser.displayName || "" : "" }])),
  };
  const downloads = {
    save: async ({ filename, data }) => {
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.csv$/i.test(filename) ? "text/csv" : "application/octet-stream" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename || "download"; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    },
  };
  window.claude = { use: (name) => ready.then(() => (name === "db" ? db : name === "user" ? user : name === "downloads" ? downloads : null)) };

  const T = {
    en: { title: "Staff sign-in", sub: "Sign in with Google to open the counter tool.", btn: "Sign in with Google", out: "Sign out", wait: "Opening…", fail: "Sign-in didn't work. Try again.", popup: "Allow pop-ups for amedcaferest.com, then try again." },
    ar: { title: "تسجيل دخول الموظفين", sub: "سجّل الدخول بحساب Google لفتح أداة الكاونتر.", btn: "تسجيل الدخول عبر Google", out: "تسجيل الخروج", wait: "جارٍ الفتح…", fail: "لم ينجح تسجيل الدخول. حاول مرة أخرى.", popup: "اسمح بالنوافذ المنبثقة لموقع amedcaferest.com ثم حاول مرة أخرى." },
    ku: { title: "چوونا ژوور یا کارمەندان", sub: "ب هەژمارا Google بچە ژوور دا ئامرازێ کاونتەری ڤەکەی.", btn: "ب Google بچە ژوور", out: "دەرکەفتن", wait: "ڤەدبیت…", fail: "چوونا ژوور سەرنەکەفت. دووبارە هەول بدە.", popup: "ڕێ بدە پەنجەرێن پۆپئەپ بۆ amedcaferest.com، پاشان دووبارە هەول بدە." },
  };
  let L = "en"; try { L = localStorage.getItem("amed-ui-lang") || ""; } catch (_) {}
  if (!T[L]) L = /^ar/i.test(navigator.language) ? "ar" : /^en/i.test(navigator.language) ? "en" : "ku";
  const tr = (k) => T[L][k];

  const css = document.createElement("style");
  css.textContent = `
  #fbGate{position:fixed;inset:0;z-index:5000;display:grid;place-items:center;padding:24px;background:var(--bg,#F3EADF);color:var(--ink,#22170F);font-family:Figtree,"Noto Sans Arabic",system-ui,sans-serif}
  #fbGate .box{width:min(100%,380px);display:grid;gap:14px;text-align:center}
  #fbGate img{width:180px;margin:0 auto 6px;filter:var(--logo-filter,none)}
  #fbGate h1{margin:0;font-size:1.5rem}#fbGate p{margin:0;color:var(--muted,#6B5B4E)}
  #fbGate button{min-height:52px;border-radius:14px;border:0;background:var(--accent,#6F4E37);color:var(--accent-ink,#fff);font:inherit;font-weight:700;font-size:1.05rem;cursor:pointer}
  #fbGate .err{color:#B3261E;font-weight:600}
  #fbAcct{position:fixed;inset-inline-start:10px;bottom:10px;z-index:40;display:flex;gap:8px;align-items:center;font:600 12px/1 Figtree,system-ui,sans-serif;color:var(--muted,#6B5B4E);background:var(--surface,#fff);border:1px solid var(--line,#ddd);border-radius:999px;padding:6px 6px 6px 12px;opacity:.85}
  #fbAcct button{border:0;background:var(--bg,#eee);color:inherit;border-radius:999px;padding:6px 10px;font:inherit;cursor:pointer}`;
  document.head.append(css);
  function gate(show, msg, isErr) {
    let g = document.getElementById("fbGate");
    if (!show) { if (g) g.remove(); return; }
    if (!g) {
      g = document.createElement("div"); g.id = "fbGate"; g.dir = L === "en" ? "ltr" : "rtl";
      g.innerHTML = '<div class="box"><img src="../logo.png" alt="Amed Cafe"><h1></h1><p class="sub"></p><button type="button"></button><p class="msg" role="status"></p></div>';
      g.querySelector("h1").textContent = tr("title"); g.querySelector(".sub").textContent = tr("sub"); g.querySelector("button").textContent = tr("btn");
      g.querySelector("button").addEventListener("click", signIn);
      document.body.append(g);
    }
    const m = g.querySelector(".msg"); m.textContent = msg || ""; m.className = "msg" + (isErr ? " err" : "");
  }
  async function signIn() {
    gate(true, tr("wait"));
    try { const p = new FB.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" }); await FB.signInWithPopup(auth, p); }
    catch (e) { const c = (e && e.code) || ""; if (/popup-closed|cancelled-popup/.test(c)) { gate(true, ""); return; } gate(true, (/popup-blocked/.test(c) ? tr("popup") : tr("fail")) + (c ? " (" + c.replace("auth/", "") + ")" : ""), true); }
  }
  function acct(u) {
    let a = document.getElementById("fbAcct"); if (a) a.remove(); if (!u) return;
    a = document.createElement("div"); a.id = "fbAcct";
    const s = document.createElement("span"); s.textContent = u.email || u.displayName || "";
    const b = document.createElement("button"); b.type = "button"; b.textContent = tr("out");
    b.addEventListener("click", async () => { await FB.signOut(auth); location.reload(); });
    a.append(s, b); document.body.append(a);
  }
  let started = false;
  FB.onAuthStateChanged(auth, async (u) => {
    if (!u) { if (started) location.reload(); const show = () => gate(true); document.body ? show() : addEventListener("DOMContentLoaded", show); return; }
    gate(false); acct(u);
    if (started) return; started = true;
    FB.onSnapshot(FB.doc(fs, SETTINGS), (s) => { if (s.exists()) settings = s.data(); }, () => {});
    resolveReady();
    if (await ownerCheck()) { setTimeout(() => publishMeta().catch(() => {}), 3000); if (qs.has("import")) importPanel(); }
  });
  if (EMU) window.__amedTestSignIn = (email, name) => FB.signInWithCredential(auth, FB.GoogleAuthProvider.credential(JSON.stringify({ sub: "uid-" + email.replace(/\W/g, ""), email, email_verified: true, name: name || email })));

  /* ---------- one-time import of the old staff tool's data (owner only: /staff/?import) ---------- */
  function importPanel() {
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;inset:auto 12px 60px 12px;z-index:4500;max-width:520px;margin:0 auto;background:var(--surface,#fff);color:var(--ink,#222);border:2px solid var(--accent,#6F4E37);border-radius:16px;padding:16px;display:grid;gap:10px;font-family:Figtree,system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.25)";
    box.innerHTML = '<b style="font-size:1.1rem">Import members from the old staff tool</b><span>Choose the file <code>amed-import.json</code> that Claude sent you.</span><input id="impFile" type="file" accept=".json,application/json"><div id="impMsg" role="status"></div>';
    document.body.append(box);
    box.querySelector("#impFile").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return; const msg = box.querySelector("#impMsg");
      try { msg.textContent = "Reading…"; const data = JSON.parse(await f.text()); await runImport(data, (t) => (msg.textContent = t)); }
      catch (x) { msg.textContent = "Import failed: " + ((x && x.message) || x); msg.style.color = "#B3261E"; }
    });
  }
  async function runImport(data, say) {
    const cols = ["settings", "invites", "customers", "activity"]; let n = 0;
    for (const col of cols) {
      const docs = Object.entries(data[col] || {});
      for (let i = 0; i < docs.length; i += 400) {
        const b = FB.writeBatch(fs);
        for (const [id, d] of docs.slice(i, i + 400)) b.set(FB.doc(fs, col + "/" + id), d);
        await b.commit(); n += Math.min(400, docs.length - i); say("Imported " + n + " records…");
      }
    }
    settings = await readLocal(SETTINGS);
    await publishMeta();
    const ids = Object.keys(data.customers || {}); let k = 0;
    for (const id of ids) { await publishCard(id); say("Publishing customer cards: " + (++k) + " of " + ids.length); }
    say("Done ✓ " + ids.length + " members, " + Object.keys(data.invites || {}).length + " staff codes, settings and history imported. Reload the page.");
  }
  window.__amedPublishAll = async () => { settings = await readLocal(SETTINGS); const s = await FB.getDocs(FB.collection(fs, "customers")); for (const d of s.docs) await publishCard(d.id); await publishMeta(); return s.size; };
})();
