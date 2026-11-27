/* Amed Cafe — inspection deterrent for /card/ and /staff/.
 *
 * IMPORTANT: this is a UX deterrence layer only, NOT a security control. Everything a browser downloads
 * from GitHub Pages (HTML, JavaScript, images) and every request it makes to Firestore can still be seen
 * with a proxy, a network capture, "curl", a browser extension, or simply by turning JavaScript off.
 * Determined people will always get past this.
 *
 * Real data security comes from:
 *   1. data.json being removed (no customer records are published as files any more);
 *   2. Firestore Security Rules (firestore.rules): default deny, no listing of cards, staff-only writes
 *      with schema and bounds checks, staff identified by Firebase Authentication;
 *   3. Firebase App Check (see SECURITY.md) so only the real website/app can call the database.
 *
 * What it does: blocks the right-click menu (except in text fields, so staff can still paste), blocks the
 * usual inspection shortcuts (F12, Ctrl+Shift+I/J/C/K, Ctrl+U, Cmd+Option+I/J/C/U), and, on computers,
 * covers the page with a notice while the browser's Developer Tools appear to be open.
 */
(() => {
  "use strict";
  const MSG = "Inspection of this system has been disabled.";

  // ---- right-click / long-press menu ----
  const editable = (t) => !!(t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], img.st-img'));
  document.addEventListener("contextmenu", (e) => { if (!editable(e.target)) e.preventDefault(); }, { capture: true });

  // ---- keyboard shortcuts ----
  document.addEventListener("keydown", (e) => {
    const k = String(e.key || "").toUpperCase(), code = e.code || "";
    const ctrlShift = e.ctrlKey && e.shiftKey && ["I", "J", "C", "K"].includes(k);
    const macDev = e.metaKey && e.altKey && (["KeyI", "KeyJ", "KeyC", "KeyU"].includes(code) || ["I", "J", "C", "U"].includes(k));
    const viewSource = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && k === "U";
    if (k === "F12" || ctrlShift || macDev || viewSource) { e.preventDefault(); e.stopPropagation(); notice(true, true); }
  }, { capture: true });

  // ---- notice ----
  let box = null, flashTimer = 0;
  function notice(on, flash) {
    if (on && !box) {
      box = document.createElement("div");
      box.id = "amedGuard"; box.setAttribute("role", "alertdialog"); box.setAttribute("aria-live", "assertive"); box.dir = "ltr";
      box.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;" +
        "background:rgba(18,14,12,.96);color:#F3EADF;font:600 1.15rem/1.5 Figtree,system-ui,sans-serif;text-align:center";
      const p = document.createElement("p"); p.textContent = MSG; p.style.margin = "0"; box.append(p);
      (document.body || document.documentElement).append(box);
    }
    if (!on && box) { box.remove(); box = null; }
    clearTimeout(flashTimer); flashTimer = 0;
    if (on && flash) flashTimer = setTimeout(() => { flashTimer = 0; if (!devtoolsOpen()) notice(false); }, 2500);
  }

  // ---- Developer Tools detection (computers only, to avoid false alarms on phones and tablets) ----
  // Docked DevTools take space from the page; the gap between the window and the page grows far beyond the
  // normal toolbars. Phones, tablets, zoomed pages and tiny windows are skipped.
  const desktop = () => matchMedia("(pointer: fine)").matches && !("ontouchstart" in window) && navigator.maxTouchPoints === 0;
  function devtoolsOpen() {
    if (!desktop() || !window.outerWidth || !window.outerHeight) return false;
    if (window.visualViewport && Math.abs(window.visualViewport.scale - 1) > 0.01) return false;
    const zoom = window.devicePixelRatio && window.outerWidth / window.innerWidth;
    if (zoom && (zoom > 1.6 || zoom < 0.6)) return false;   // browser zoom changes these numbers: don't guess
    const w = window.outerWidth - window.innerWidth, h = window.outerHeight - window.innerHeight;
    return w > 220 || h > 280;
  }
  const check = () => { const open = devtoolsOpen(); if (open && !box) notice(true); else if (!open && box && !flashTimer) notice(false); };
  const start = () => { check(); setInterval(check, 1000); addEventListener("resize", check); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
