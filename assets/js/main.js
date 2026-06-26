/* =========================================================
   Ryota — Portfolio interactions
   crosshair cursor · loader · drag track · reveals · clock
   ========================================================= */
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lerp = (a, b, n) => a + (b - a) * n;

  /* ---------- WebGL background: smoke + grain + cursor ripple ---------- */
  function initBackground() {
    const canvas = document.getElementById("bgfx");
    if (!canvas || reduce) { document.documentElement.style.background = "#000"; return; }
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
    if (!gl) { document.documentElement.style.background = "#000"; return; }

    const vert = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
    const frag = `
      precision highp float;
      uniform vec2  uRes;
      uniform float uTime;
      uniform vec2  uMouse;   // pixels (trailing)
      uniform float uStr;     // cursor influence 0..1

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        float a = hash(i), b = hash(i + vec2(1.,0.));
        float c = hash(i + vec2(0.,1.)), d = hash(i + vec2(1.,1.));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        for(int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.02; a *= 0.5; }
        return v;
      }
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes.xy;
        float aspect = uRes.x / uRes.y;
        vec2 m = uMouse / uRes.xy;

        // ripple distortion radiating from the cursor
        vec2 d = uv - m; d.x *= aspect;
        float dist = length(d);
        float ripple = sin(dist * 22.0 - uTime * 3.0) * exp(-dist * 6.0) * 0.03 * uStr;
        vec2 sp = uv + (d / (dist + 1e-4)) * ripple;

        // flowing smoke with domain warp (slow black/white movement)
        float t = uTime * 0.05;
        float w = fbm(sp * 3.0 + vec2(t, t * 0.7));
        float n = fbm(sp * 3.0 + w * 1.4 + vec2(-t * 0.8, t * 0.6));
        float base = mix(0.015, 0.19, n);

        // soft cursor light reveals the smoke
        float light = exp(-dist * 2.6) * 0.28 * uStr;
        // concentric brightness rings = the visible ripple
        float rings = sin(dist * 22.0 - uTime * 3.0) * exp(-dist * 4.5) * 0.06 * uStr;

        float c = base + light + rings;

        // film grain
        float g = hash(gl_FragCoord.xy + fract(uTime) * 100.0);
        c += (g - 0.5) * 0.05;

        gl_FragColor = vec4(vec3(clamp(c, 0.0, 1.0)), 1.0);
      }`;

    const compile = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, vert), fs = compile(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) { document.documentElement.style.background = "#000"; return; }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uMouse = gl.getUniformLocation(prog, "uMouse");
    const uStr = gl.getUniformLocation(prog, "uStr");

    const DPR = Math.min(devicePixelRatio || 1, 1.5);
    let W = 0, H = 0;
    const resize = () => {
      W = Math.floor(innerWidth * DPR); H = Math.floor(innerHeight * DPR);
      canvas.width = W; canvas.height = H;
      gl.viewport(0, 0, W, H);
    };
    resize(); addEventListener("resize", resize);

    // mouse: trailing position + influence that fades when still
    let tmx = innerWidth / 2 * DPR, tmy = innerHeight / 2 * DPR;
    let mx = tmx, my = tmy, str = 0, tStr = 0.5;
    addEventListener("mousemove", (e) => {
      tmx = e.clientX * DPR; tmy = (innerHeight - e.clientY) * DPR; // flip Y for GL
      tStr = 1.0;
    }, { passive: true });

    let start = null;
    const render = (now) => {
      if (start === null) start = now;
      const time = (now - start) / 1000;
      mx = lerp(mx, tmx, 0.1); my = lerp(my, tmy, 0.1);
      tStr = Math.max(0.5, tStr - 0.012); // decay influence toward idle floor
      str = lerp(str, tStr, 0.08);
      gl.uniform2f(uRes, W, H);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uMouse, mx, my);
      gl.uniform1f(uStr, str);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  /* ---------- crosshair cursor ---------- */
  function initCursor() {
    if (!fine) return;
    const cur = document.querySelector(".cursor");
    if (!cur) return;
    let mx = innerWidth / 2, my = innerHeight / 2, x = mx, y = my;

    addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    document.addEventListener("mouseleave", () => document.body.classList.add("cur-hide"));
    document.addEventListener("mouseenter", () => document.body.classList.remove("cur-hide"));

    (function raf() {
      x = lerp(x, mx, 0.2); y = lerp(y, my, 0.2);
      cur.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(raf);
    })();

    const set = (t) => {
      document.body.classList.toggle("cur-link", t === "" || t === "link");
      document.body.classList.toggle("cur-view", t === "view");
    };
    document.querySelectorAll("[data-cursor]").forEach((el) => {
      el.addEventListener("mouseenter", () => set(el.dataset.cursor));
      el.addEventListener("mouseleave", () => set(null));
    });
  }

  /* ---------- loader ---------- */
  function runLoader(done) {
    const loader = document.getElementById("loader");
    const num = document.getElementById("loaderNum");
    document.documentElement.classList.add("is-locked");

    const finish = () => {
      loader && loader.classList.add("done");
      document.documentElement.classList.remove("is-locked");
      document.body.classList.add("loaded");
      done && done();
    };
    if (!loader || reduce) { finish(); return; }

    let n = 0;
    (function tick() {
      n += Math.max(1, Math.round((100 - n) * 0.07));
      if (n >= 100) { n = 100; num.textContent = n; setTimeout(finish, 450); return; }
      num.textContent = n;
      setTimeout(tick, 70 + Math.random() * 70);
    })();
  }

  /* ---------- scroll reveal ---------- */
  function initReveal() {
    const items = document.querySelectorAll(".reveal, .about__lead");
    if (!("IntersectionObserver" in window) || reduce) {
      items.forEach((i) => i.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.2, rootMargin: "0px 0px -10% 0px" });
    items.forEach((i) => io.observe(i));

    // stagger words inside the about lead
    const lead = document.querySelector(".about__lead");
    if (lead) lead.querySelectorAll(".word").forEach((w, i) => {
      w.style.transitionDelay = (i * 0.03).toFixed(2) + "s";
    });
  }

  /* ---------- header hide on scroll ---------- */
  function initHeader() {
    const header = document.getElementById("header");
    if (!header) return;
    let last = 0;
    addEventListener("scroll", () => {
      const y = scrollY;
      header.style.transition = "transform .5s cubic-bezier(0.62,0.05,0.01,0.99)";
      header.style.transform = (y > last && y > 220) ? "translateY(-110%)" : "translateY(0)";
      last = y;
    }, { passive: true });
  }

  /* ---------- capabilities: click & drag + auto marquee ---------- */
  function initDragTrack() {
    const track = document.getElementById("capTrack");
    if (!track) return;
    const row = track.querySelector(".cap-row");
    if (!row) return;

    // duplicate content for seamless marquee
    row.innerHTML += row.innerHTML;

    let pos = 0, target = 0, vel = 0.4;
    let dragging = false, startX = 0, startPos = 0;
    let max = 0;
    const measure = () => { max = row.scrollWidth / 2; };
    measure(); addEventListener("resize", measure);

    track.addEventListener("pointerdown", (e) => {
      dragging = true; startX = e.clientX; startPos = pos;
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      pos = startPos + (e.clientX - startX);
    });
    const end = () => { dragging = false; };
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);

    (function loop() {
      if (!dragging && !reduce) pos -= vel;     // gentle auto-scroll
      // wrap seamlessly
      if (pos <= -max) pos += max;
      if (pos > 0) pos -= max;
      row.style.transform = `translateX(${pos}px)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- footer clock (Tokyo) ---------- */
  function initClock() {
    const el = document.getElementById("footClock");
    if (!el) return;
    const tick = () => {
      const t = new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
      });
      el.textContent = "Tokyo " + t;
    };
    tick(); setInterval(tick, 30000);
  }

  /* ---------- boot ---------- */
  addEventListener("DOMContentLoaded", () => {
    initBackground();
    initCursor();
    initHeader();
    initDragTrack();
    initClock();
    runLoader(initReveal);
    setTimeout(initReveal, 2600); // safety
  });
})();
