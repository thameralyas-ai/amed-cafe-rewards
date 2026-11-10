/*
 * Circular Carousel for "The space" gallery: vanilla port of React Bits CircularCarousel (JS-CSS, cylinder preset,
 * flat cards) used as part of this website only.
 * React Bits (https://github.com/DavidHDev/react-bits): Copyright (c) 2026 David Haz. MIT + Commons Clause License
 * Condition v1.0 (full notice in js/motion.js). You may not sell, sublicense, or redistribute the components themselves.
 *
 * Photos are black and white; a photo gets its colour back while the mouse is over it (computer) or once it is
 * tapped (phone). Tapping/clicking a photo brings it to the front; tapping the front photo again opens it full screen.
 */
(() => {
  const TO_RAD = Math.PI / 180, SPRING = 118, SETTLE = 9, DRAG = 5;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
  const rotX = (p, d) => { const r = d * TO_RAD, c = Math.cos(r), s = Math.sin(r); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };
  const rotY = (p, d) => { const r = d * TO_RAD, c = Math.cos(r), s = Math.sin(r); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };

  function circularCarousel(root, items, o = {}) {
    const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const s = Object.assign({ cardW: 160, aspect: 3 / 4, gap: 22, tilt: -5, perspective: 2500, speed: 10, momentum: 0.6, depthFade: 0.55, innerShade: 0.6, onOpen: () => {}, label: "Gallery", sideOverflow: 1 }, o);
    const count = items.length, step = 360 / count, cardH = s.cardW / s.aspect;
    const radius = Math.max((s.cardW + s.gap) / (2 * Math.sin(Math.PI / Math.max(count, 3))), s.cardW * 0.6);

    root.textContent = "";
    root.className = "cc";
    root.setAttribute("role", "region"); root.setAttribute("aria-roledescription", "carousel"); root.setAttribute("aria-label", s.label); root.tabIndex = 0;
    const view = document.createElement("div"); view.className = "cc-view";
    const stage = document.createElement("div"); stage.className = "cc-stage";
    const camera = document.createElement("div"); camera.className = "cc-camera";
    const ring = document.createElement("div"); ring.className = "cc-ring";
    camera.append(ring); stage.append(camera); view.append(stage); root.append(view);

    const cards = items.map((it, i) => {
      const card = document.createElement("div");
      card.className = "cc-card"; card.dataset.i = i;
      card.setAttribute("role", "group"); card.setAttribute("aria-roledescription", "slide"); card.setAttribute("aria-label", `${it.alt}, ${i + 1} / ${count}`);
      for (const back of [false, true]) {
        const face = document.createElement("div");
        face.className = "cc-face" + (back ? " cc-back" : "");
        face.style.cssText = `left:${-s.cardW / 2}px;top:${-cardH / 2}px;width:${s.cardW}px;height:${cardH}px` + (back ? ";transform:rotateY(180deg)" : "");
        const img = document.createElement("img");
        img.src = it.src; img.alt = back ? "" : it.alt; img.draggable = false; img.decoding = "async"; img.loading = "lazy";
        face.append(img);
        if (it.video && !back) { const pl = document.createElement("span"); pl.className = "cc-play"; face.append(pl); }
        if (back) { const inner = document.createElement("div"); inner.className = "cc-inner"; inner.style.opacity = (1 - s.innerShade).toFixed(2); face.append(inner); }
        const shade = document.createElement("div"); shade.className = "cc-shade"; face.append(shade);
        card.append(face);
      }
      ring.append(card);
      return card;
    });

    const st = { angle: 0, velocity: 0, target: null, dir: -1, press: null, drag: false, hover: false, hold: 0, fit: 1, last: 0, suppress: false };
    let raf = 0, visible = true, active = 0;
    const nearest = (a) => Math.round(a / step) * step;

    const measure = () => {
      const rc = root.getBoundingClientRect(); if (!rc.width || !rc.height) return;
      const W = rc.width * 0.96, H = rc.height * 0.94, P = s.perspective;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      const corners = [[-s.cardW / 2, -cardH / 2], [s.cardW / 2, -cardH / 2], [-s.cardW / 2, cardH / 2], [s.cardW / 2, cardH / 2]];
      for (let a = -180; a <= 180; a += 7.5) for (const [cx, cy] of corners) {
        let p = rotX(rotY([cx, cy, radius], a), s.tilt); p = [p[0], p[1], p[2] - radius];
        if (p[2] >= P * 0.95) continue;
        const k = P / (P - p[2]);
        minX = Math.min(minX, p[0] * k); maxX = Math.max(maxX, p[0] * k); minY = Math.min(minY, p[1] * k); maxY = Math.max(maxY, p[1] * k);
      }
      // The side cards may run off the edges (sideOverflow), so the front photos stay large on a phone.
      st.fit = Math.min(1.25, (W * s.sideOverflow) / Math.max(maxX - minX, 1), H / Math.max(maxY - minY, 1));
      stage.style.perspective = P + "px";
      stage.style.transform = `translate3d(0, ${-((minY + maxY) / 2) * st.fit}px, 0) scale(${st.fit})`;
    };

    const advance = (dt, now) => {
      const paused = st.hover || st.drag || now < st.hold;
      const cruise = !REDUCED && !paused ? s.speed * st.dir : 0;
      let busy = st.drag;
      if (st.drag) { /* angle follows the finger */ }
      else if (st.target !== null) {
        let rem = dt; const damp = 2 * Math.sqrt(SPRING);
        while (rem > 0) { const h = Math.min(rem, 1 / 240); st.velocity += (SPRING * (st.target - st.angle) - damp * st.velocity) * h; st.angle += st.velocity * h; rem -= h; }
        if (Math.abs(st.target - st.angle) < 0.004 && Math.abs(st.velocity) < 0.03) { st.angle = st.target; st.velocity = 0; st.target = null; }
        busy = true;
      } else {
        const tau = 0.18 + s.momentum * 1.5;
        st.velocity += (cruise - st.velocity) * (1 - Math.exp(-dt / tau));
        st.angle += st.velocity * dt;
        if (cruise === 0 && Math.abs(st.velocity) < SETTLE) st.target = nearest(st.angle);
        busy = busy || cruise !== 0 || Math.abs(st.velocity) > 0.01 || st.target !== null;
      }
      return busy || now < st.hold;
    };

    const render = () => {
      camera.style.transform = `translate3d(0, 0, ${-radius}px) rotateX(${s.tilt}deg)`;
      ring.style.transform = `rotateY(${st.angle}deg)`;
      cards.forEach((card, i) => {
        const base = i * step;
        card.style.transform = `rotateY(${base}deg) translateZ(${radius}px)`;
        const facing = Math.cos(wrap(base + st.angle) * TO_RAD);
        card.style.setProperty("--cc-depth", (s.depthFade * Math.pow((1 - facing) / 2, 1.25)).toFixed(3));
      });
      active = ((Math.round(-st.angle / step) % count) + count) % count || 0;
    };

    const frame = (now) => {
      raf = 0;
      const dt = st.last ? Math.min((now - st.last) / 1000, 0.05) : 1 / 60; st.last = now;
      const busy = advance(dt, now); render();
      if (busy && visible && !document.hidden) raf = requestAnimationFrame(frame); else st.last = 0;
    };
    const wake = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };

    const focus = (i) => { let t = -i * step; t += 360 * Math.round((st.angle - t) / 360); st.target = t; st.hold = performance.now() + 2800; wake(); };
    const color = (i) => cards.forEach((c, k) => c.classList.toggle("on", k === i));

    // Pointer: drag to turn (with momentum), tap to bring forward / colour / open.
    root.addEventListener("pointerdown", (e) => {
      st.suppress = false;
      if (e.button !== 0) return;
      st.press = { id: e.pointerId, x: e.clientX, y: e.clientY, angle: st.angle, moved: false, origin: 0, samples: [{ t: performance.now(), a: st.angle }] };
    });
    root.addEventListener("pointermove", (e) => {
      const p = st.press; if (!p || p.id !== e.pointerId) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (!p.moved) {
        if (Math.abs(dx) < DRAG) return;
        if (Math.abs(dy) > Math.abs(dx) * 1.2 && e.pointerType !== "mouse") { st.press = null; return; } // vertical swipe: let the page scroll
        p.moved = true; p.origin = dx; st.drag = true; st.target = null; st.velocity = 0; root.dataset.dragging = "";
        try { root.setPointerCapture(e.pointerId); } catch (_) {}
      }
      st.angle = p.angle + (dx - p.origin) * (180 / (Math.PI * radius * st.fit));
      const now = performance.now(); p.samples.push({ t: now, a: st.angle });
      while (p.samples.length > 2 && now - p.samples[0].t > 110) p.samples.shift();
      wake();
    });
    const release = (e) => {
      const p = st.press; if (!p || p.id !== e.pointerId) return;
      st.press = null; if (!p.moved) return;
      st.drag = false; delete root.dataset.dragging; st.suppress = true;
      const a = p.samples[0], b = p.samples[p.samples.length - 1], span = (b.t - a.t) / 1000;
      const v = span > 0.008 ? clamp((b.a - a.a) / span, -1400, 1400) : 0;
      st.velocity = v; if (Math.abs(v) > 60) st.dir = Math.sign(v);
      if (REDUCED || (st.hover && e.pointerType === "mouse")) st.target = Math.round((st.angle + v * (0.18 + s.momentum * 1.5) * 0.55) / step) * step;
      wake();
    };
    root.addEventListener("pointerup", release); root.addEventListener("pointercancel", release);
    root.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { st.hover = true; wake(); } });
    root.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { st.hover = false; color(-1); wake(); } });
    // Computer: colour follows the mouse (CSS :hover). Phone: the tapped photo keeps its colour.
    root.addEventListener("click", (e) => {
      if (st.suppress) { st.suppress = false; return; }
      const card = e.target.closest(".cc-card"); if (!card) return;
      const i = +card.dataset.i;
      if (i === active && card.classList.contains("on")) { s.onOpen(items[i], i); return; }
      color(i); focus(i);
    });
    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") focus(active + 1); else if (e.key === "ArrowLeft") focus(active - 1);
      else if (e.key === "Enter" || e.key === " ") s.onOpen(items[active], active); else return;
      e.preventDefault();
    });

    new ResizeObserver(() => { measure(); wake(); }).observe(root);
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) wake(); else { cancelAnimationFrame(raf); raf = 0; st.last = 0; } }).observe(root);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
    measure(); render(); wake();
    requestAnimationFrame(() => root.dataset.ready = "");
  }

  window.circularCarousel = circularCarousel;
})();
