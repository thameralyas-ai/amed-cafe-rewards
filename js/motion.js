/*
 * Amed Cafe motion layer: GSAP + ScrollTrigger + Lenis, and vanilla ports of four React Bits effects
 * (Blur Text, Light Rays, Star Border, Count Up), used as part of this website only.
 *
 * React Bits (https://github.com/DavidHDev/react-bits): Copyright (c) 2026 David Haz.
 * MIT + Commons Clause License Condition v1.0. Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation files (the "Software"), to deal in the
 * Software without restriction, including without limitation the rights to use, copy, modify, merge, publish,
 * and distribute the Software as part of an application, website, or product, subject to the following
 * conditions: The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software. Commons Clause: you may not sell, sublicense, or redistribute the
 * components themselves, whether alone, in a bundle, or as a ported version.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 *
 * Keep it calm. With Reduce Motion: no smooth scroll, no sliding or blurring, numbers appear at once,
 * the rays drift slowly and the star border stays still.
 */
(() => {
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = !!window.gsap;
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  // ---------- Lenis smooth scroll, driven by GSAP's ticker so both run on the same frame ----------
  let lenis = null;
  if (!REDUCED && hasGsap && window.Lenis) {
    lenis = new Lenis({ lerp: 0.12, anchors: { offset: 0 }, autoRaf: false });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // ---------- Blur Text: words fade in from a soft blur, one after another ----------
  // Words (not letters), so Arabic and Badini letters stay joined.
  function blurText(nodes, { delay = 0.2, step = 0.35, distance = 18, blur = 10, start = 0.2 } = {}) {
    if (!hasGsap || !nodes.length) return;
    if (REDUCED) { gsap.fromTo(nodes, { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: 0.12, delay: start }); return; }
    nodes.forEach((n, i) => {
      gsap.timeline({ delay: start + i * delay })
        .fromTo(n, { filter: `blur(${blur}px)`, opacity: 0, y: -distance }, { filter: `blur(${blur / 2}px)`, opacity: 0.5, y: distance / 10, duration: step, ease: "none" })
        .to(n, { filter: "blur(0px)", opacity: 1, y: 0, duration: step, ease: "power2.out", clearProps: "filter,transform" });
    });
  }

  // ---------- Count Up: numbers count from zero when they scroll into view (once) ----------
  const played = new WeakSet(), live = new WeakMap();
  function countUp(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts = []; for (let t; (t = walker.nextNode());) if (/\d/.test(t.nodeValue)) texts.push(t);
    const spans = [];
    for (const t of texts) {
      const frag = document.createDocumentFragment();
      t.nodeValue.split(/(\d[\d,]*)/).forEach((part, i) => {
        if (i % 2) { const s = document.createElement("span"); s.className = "cu"; s.dataset.to = part.replace(/,/g, ""); s.textContent = part; frag.append(s); spans.push(s); }
        else if (part) frag.append(part);
      });
      t.replaceWith(frag);
    }
    // Re-rendered (language change, data loaded): drop the old tweens; once a count has played, show plain numbers.
    (live.get(root) || []).forEach((t) => { if (t.scrollTrigger) t.scrollTrigger.kill(); t.kill(); }); live.delete(root);
    if (!hasGsap || REDUCED || played.has(root) || !window.ScrollTrigger) return;
    live.set(root, spans.map((s) => {
      const to = +s.dataset.to, comma = to >= 1000, obj = { v: 0 };
      s.textContent = "0";
      return gsap.to(obj, { v: to, duration: 1.6, ease: "power2.out", scrollTrigger: { trigger: root, start: "top 88%", once: true },
        onStart: () => played.add(root),
        onUpdate: () => { const v = Math.round(obj.v); s.textContent = comma ? v.toLocaleString("en-US") : String(v); } });
    }));
  }

  // ---------- Sections: soft fade-up as they scroll into view ----------
  function reveal(nodes) {
    if (!hasGsap || !window.ScrollTrigger) return false;
    gsap.set(nodes, { opacity: 0, y: REDUCED ? 0 : 28 });
    ScrollTrigger.batch(nodes, { start: "top 90%", once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: REDUCED ? 0.6 : 0.9, ease: "power2.out", stagger: 0.08, overwrite: true, clearProps: "transform" }) });
    return true;
  }

  // ---------- Light Rays (WebGL2): warm rays falling from above the hero ----------
  const MAX_PULSES = 4;
  const VERTEX = `#version 300 es
const vec2 corners[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(corners[gl_VertexID], 0.0, 1.0); }`;
  const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution; uniform float uScale; uniform float uTime; uniform vec2 uSource; uniform vec2 uAim; uniform float uReach;
uniform vec3 uColor; uniform float uSpread; uniform float uLength; uniform float uFade; uniform float uSaturation; uniform float uPulsating;
uniform float uNoise; uniform float uDistortion; uniform float uDensity; uniform float uSharpness; uniform float uGlow; uniform float uHaze;
uniform float uAtmosphere; uniform float uIntensity; uniform vec4 uShadow; uniform vec4 uPulses[${MAX_PULSES}]; uniform vec2 uIntro;
uniform float uLight; uniform float uOpacity;
out vec4 fragColor;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float valueNoise(vec2 p) { vec2 i = floor(p); vec2 f = p - i; vec2 w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), w.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), w.x), w.y); }
float shape(float strength, float width) { float edge = max(mix(0.5, 0.08, uSharpness), width);
  return mix(strength, smoothstep(0.62 - edge, 0.62 + edge, strength), uSharpness); }
void main() {
  vec2 coord = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uScale;
  vec2 delta = coord - uSource; float distance = length(delta); vec2 dir = delta / max(distance, 1e-4);
  float cosAngle = dot(dir, uAim); float angle = cosAngle + uDistortion * sin(uTime * 2.0 + distance * 0.02) * 0.2;
  float slope = fwidth(angle); float depth = distance / uReach;
  float source = exp(-depth * depth * 9.0) * 0.9 + exp(-depth * 3.2) * 0.25;
  float glowLight = uGlow * source * smoothstep(-0.2, 0.6, cosAngle);
  float spread = pow(max(angle, 0.0), 1.0 / uSpread);
  float lengthFalloff = clamp(1.0 - distance / (uReach * uLength), 0.0, 1.0);
  float fadeFalloff = clamp(1.0 - distance / (uReach * uFade), 0.5, 1.0);
  float envelope = spread * lengthFalloff * fadeFalloff;
  float reveal = uIntensity * uIntro.y * (1.0 - smoothstep(uIntro.x - 0.35, uIntro.x, depth));
  if ((envelope * 1.6 + glowLight) * reveal < 0.0015) { fragColor = vec4(0.0); return; }
  float phaseA = angle * 36.2214 * uDensity + uTime * 1.5; float phaseB = -angle * 21.11349 * uDensity + uTime * 1.5;
  float phaseC = angle * 22.3991 * uDensity + uTime * 1.1; float phaseD = -angle * 18.0234 * uDensity + uTime * 1.1;
  float strengthA = clamp(0.75 + 0.15 * sin(phaseA) + 0.2 * cos(phaseB), 0.0, 1.0);
  float strengthB = clamp(0.75 + 0.15 * sin(phaseC) + 0.2 * cos(phaseD), 0.0, 1.0);
  float widthA = abs(0.15 * 36.2214 * cos(phaseA) + 0.2 * 21.11349 * sin(phaseB)) * uDensity * slope;
  float widthB = abs(0.15 * 22.3991 * cos(phaseC) + 0.2 * 18.0234 * sin(phaseD)) * uDensity * slope;
  float pulseA = uPulsating > 0.5 ? 0.8 + 0.2 * sin(uTime * 4.5) : 1.0; float pulseB = uPulsating > 0.5 ? 0.8 + 0.2 * sin(uTime * 3.3) : 1.0;
  float rayLight = envelope * (0.5 * shape(strengthA, widthA) * pulseA + 0.4 * shape(strengthB, widthB) * pulseB);
  if (uHaze > 0.0) { float around = atan(uAim.x * dir.y - uAim.y * dir.x, cosAngle);
    vec2 drift = vec2(around * 2.2 + uTime * 0.035, depth * 2.6 - uTime * 0.11);
    float fog = 0.65 * valueNoise(drift * vec2(3.0, 1.0)) + 0.35 * valueNoise(drift * vec2(7.0, 2.3) + 4.1);
    rayLight *= mix(1.0, 0.25 + 1.2 * fog, uHaze); }
  float light = (rayLight + glowLight) * reveal;
  if (uNoise > 0.0) { float n = fract(sin(dot(coord * 0.02 + uTime * 0.1, vec2(12.9898, 78.233))) * 43758.5453123); light *= 1.0 - uNoise + uNoise * n; }
  float near = clamp(1.2 - distance / (uResolution.y / uScale), 0.0, 1.0);
  vec3 tint = mix(vec3(0.9), vec3(0.1, 0.3, 0.5) + near * vec3(0.8, 0.6, 0.5), uAtmosphere);
  float gray = dot(tint, vec3(0.299, 0.587, 0.114));
  vec3 hue = max(mix(vec3(gray), tint, uSaturation), 0.0) * uColor;
  float grain = (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  float level = light < 0.75 ? light : 0.75 + 0.25 * (1.0 - exp(-(light - 0.75) / 0.25));
  float top = max(hue.r, max(hue.g, hue.b));
  hue = mix(hue, vec3(top), smoothstep(0.8, 1.0, level) * 0.45);
  vec3 shown = clamp(hue * level, 0.0, 1.0) * level;
  fragColor = vec4(clamp(shown + grain, 0.0, level) * uOpacity, level * uOpacity);
}`;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const hex = (h) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16) / 255);

  function lightRays(container, o = {}) {
    const s = Object.assign({ color: "#E3B27D", anchorX: () => 0.5, speed: 0.6, spread: 0.6, length: 1.6, density: 1, sharpness: 0.35,
      glow: 0.6, haze: 0.3, atmosphere: 0.25, intensity: 1, fade: 1, saturation: 1, opacity: 1 }, o);
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return false;
    const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return gl.getShaderParameter(x, gl.COMPILE_STATUS) ? x : null; };
    const vs = sh(gl.VERTEX_SHADER, VERTEX), fs = sh(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return false;
    const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    const u = {}; for (let i = 0, n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS); i < n; i++) { const inf = gl.getActiveUniform(prog, i); u[inf.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(prog, inf.name); }
    const vao = gl.createVertexArray(), color = hex(s.color), zeros = new Float32Array(MAX_PULSES * 4);
    container.append(canvas);
    const size = { w: 1, h: 1, r: 1 };
    const measure = () => {
      const rc = container.getBoundingClientRect(), w = Math.max(1, rc.width), h = Math.max(1, rc.height);
      const r = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(1.6e6 / (w * h)));
      canvas.width = Math.round(w * r); canvas.height = Math.round(h * r); size.w = w; size.h = h; size.r = canvas.width / w;
    };
    measure(); new ResizeObserver(measure).observe(container);
    let time = 0, opening = 0, last = performance.now(), raf = 0, visible = true;
    const frame = (now) => {
      raf = 0;
      const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
      time += dt * s.speed * (REDUCED ? 0.35 : 1);
      if (opening < 1) opening = Math.min(1, opening + dt / (REDUCED ? 1 : 2.2));
      const eased = 1 - Math.pow(1 - opening, 3), sm = (t) => { const x = clamp(t, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog); gl.bindVertexArray(vao);
      gl.uniform2f(u.uResolution, canvas.width, canvas.height); gl.uniform1f(u.uScale, size.r); gl.uniform1f(u.uTime, time);
      gl.uniform2f(u.uSource, s.anchorX() * size.w, -0.2 * size.h); gl.uniform2f(u.uAim, 0, 1); gl.uniform1f(u.uReach, Math.max(size.w, size.h));
      gl.uniform3f(u.uColor, color[0], color[1], color[2]); gl.uniform1f(u.uSpread, s.spread); gl.uniform1f(u.uLength, s.length);
      gl.uniform1f(u.uFade, s.fade); gl.uniform1f(u.uSaturation, s.saturation); gl.uniform1f(u.uPulsating, 0); gl.uniform1f(u.uNoise, 0);
      gl.uniform1f(u.uDistortion, 0); gl.uniform1f(u.uDensity, s.density); gl.uniform1f(u.uSharpness, s.sharpness); gl.uniform1f(u.uGlow, s.glow);
      gl.uniform1f(u.uHaze, s.haze); gl.uniform1f(u.uAtmosphere, s.atmosphere); gl.uniform1f(u.uIntensity, s.intensity);
      gl.uniform4f(u.uShadow, 0, 0, 0, 16); gl.uniform4fv(u.uPulses, zeros); gl.uniform2f(u.uIntro, eased * 2.6, sm(opening / 0.5));
      gl.uniform1f(u.uLight, 0); gl.uniform1f(u.uOpacity, s.opacity);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); wake(); }).observe(container);
    document.addEventListener("visibilitychange", wake);
    wake();
    return true;
  }

  // ---------- Star Border: a small light travels around the main button's edge ----------
  const BLEED = 40, TAU = Math.PI * 2;
  function starBorder(root, o = {}) {
    const s = Object.assign({ color: "#FFE9C7", duration: 5, thickness: 1.5, trail: 0.3, glow: 0.6 }, o);
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.className = "star-border__light"; canvas.setAttribute("aria-hidden", "true");
    root.classList.add("star-border"); root.prepend(canvas);
    const rgb = hex(s.color).map((v) => v * 255), rgba = (a) => `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${clamp(a, 0, 1).toFixed(3)})`;
    let W = 0, H = 0, dpr = 1, R = 0, segs = [], total = 1;
    const measure = () => {
      W = root.offsetWidth; H = root.offsetHeight; dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round((W + BLEED * 2) * dpr); canvas.height = Math.round((H + BLEED * 2) * dpr);
      const w = W - s.thickness, h = H - s.thickness, r = Math.max(0, Math.min(parseFloat(getComputedStyle(root).borderTopLeftRadius) || 0, w / 2, h / 2) - s.thickness / 2);
      const arc = (Math.PI * r) / 2, across = Math.max(0, w - 2 * r), down = Math.max(0, h - 2 * r);
      R = r; segs = [
        { l: across, x: r, y: 0, dx: 1, dy: 0, a: null }, { l: arc, x: w - r, y: r, a: -Math.PI / 2 },
        { l: down, x: w, y: r, dx: 0, dy: 1, a: null }, { l: arc, x: w - r, y: h - r, a: 0 },
        { l: across, x: w - r, y: h, dx: -1, dy: 0, a: null }, { l: arc, x: r, y: h - r, a: Math.PI / 2 },
        { l: down, x: 0, y: h - r, dx: 0, dy: -1, a: null }, { l: arc, x: r, y: r, a: Math.PI }];
      total = Math.max(1, segs.reduce((a, g) => a + g.l, 0));
    };
    const at = (d) => {
      let t = ((d % total) + total) % total;
      for (const g of segs) {
        if (g.l > 0 && t <= g.l) {
          if (g.a === null) return [g.x + g.dx * t, g.y + g.dy * t];
          const a = g.a + t / R; return [g.x + Math.cos(a) * R, g.y + Math.sin(a) * R];
        }
        t -= g.l;
      }
      return [0, 0];
    };
    let phase = 0, last = performance.now(), raf = 0, visible = true;
    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      const off = (BLEED + s.thickness / 2) * dpr; ctx.setTransform(dpr, 0, 0, dpr, off, off);
      ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
      const len = REDUCED ? 0 : Math.min(total * s.trail, total * 0.6), steps = Math.max(2, Math.ceil(len / 2));
      let [px, py] = at(phase);
      for (let i = 1; i <= steps && len > 0; i++) {
        const [x, y] = at(phase - len * (i / steps)), k = 1 - (i - 0.5) / steps, f = k * k;
        ctx.lineWidth = 2 + 6 * s.glow; ctx.strokeStyle = rgba(f * 0.2 * s.glow); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
        ctx.lineWidth = s.thickness; ctx.strokeStyle = rgba(f); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
        px = x; py = y;
      }
      const [hx, hy] = at(phase), reach = 12 + 40 * s.glow, g = ctx.createRadialGradient(hx, hy, 0, hx, hy, reach), k = 0.4 * s.glow;
      g.addColorStop(0, rgba(k)); g.addColorStop(0.2, rgba(k * 0.4)); g.addColorStop(0.5, rgba(k * 0.1)); g.addColorStop(1, rgba(0));
      ctx.fillStyle = g; ctx.fillRect(hx - reach, hy - reach, reach * 2, reach * 2);
    };
    const frame = (now) => {
      raf = 0; const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!REDUCED) phase = (phase + (total / s.duration) * dt) % total;
      draw();
      if (visible && !REDUCED) raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    new ResizeObserver(() => { measure(); wake(); }).observe(root);
    new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); wake(); }).observe(root);
    measure(); wake();
  }

  window.AmedMotion = { REDUCED, lenis, blurText, countUp, reveal, lightRays, starBorder,
    stop: () => lenis && lenis.stop(), start: () => lenis && lenis.start() };
})();
