/* =========================================================
   Ryota — Portfolio interactions
   crosshair cursor · loader · drag track · reveals · clock
   ========================================================= */
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lerp = (a, b, n) => a + (b - a) * n;

  /* ---------- WebGL background: smoke + grain + water-drop ripples ---------- */
  function initBackground() {
    const canvas = document.getElementById("bgfx");
    if (!canvas || reduce) { document.documentElement.style.background = "#000"; return; }
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
    if (!gl) { document.documentElement.style.background = "#000"; return; }

    const N = 14; // max concurrent ripples

    const vert = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
    const frag = `
      precision highp float;
      uniform vec2  uRes;
      uniform float uTime;
      uniform vec2  uMouse;     // trailing cursor, pixels
      uniform float uStr;       // cursor influence
      uniform float uRadius;    // attraction radius (fraction of viewport height = 2cm)
      uniform vec3  uDrops[${N}]; // x,y pixels ; z = age in seconds (<0 = inactive)

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
        vec2 frag = gl_FragCoord.xy;
        vec2 uv = frag / uRes.xy;
        float aspect = uRes.x / uRes.y;

        float t = uTime * 0.025;
        vec2 p = uv; p.x *= aspect;               // aspect-correct space

        // domain-warped fbm -> a soft, irregular organic blob
        vec2 q = vec2(fbm(p * 1.0 + vec2(0.0, t)),
                      fbm(p * 1.0 + vec2(3.2, 1.3) - t * 0.7));
        float n = fbm(p * 1.15 + q * 1.5 + vec2(t * 0.3, -t * 0.2));

        // pure black, with only the top of the noise emerging as a faint white blob
        float blob = smoothstep(0.55, 0.96, n);

        vec3 col = vec3(0.0);                      // true black
        col += vec3(1.0) * blob * 0.11;           // faint white haze
        col += vec3(1.0) * pow(blob, 2.6) * 0.07; // slightly brighter soft core

        // whisper of dither so the faint gradient never bands
        col += (hash(frag) - 0.5) * 0.008;

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
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
    const uRadius = gl.getUniformLocation(prog, "uRadius");
    const uDrops = gl.getUniformLocation(prog, "uDrops");

    const CM_PX = 37.795; // 1cm in CSS pixels (96dpi)

    const DPR = Math.min(devicePixelRatio || 1, 1.5);
    let W = 0, H = 0;
    const resize = () => {
      W = Math.floor(innerWidth * DPR); H = Math.floor(innerHeight * DPR);
      canvas.width = W; canvas.height = H;
      gl.viewport(0, 0, W, H);
    };
    resize(); addEventListener("resize", resize);

    // ripple drops (ring buffer) — each spawns where the cursor passes
    const LIFE = 2.4;                       // seconds before a ripple fully fades
    const drops = new Float32Array(N * 3);  // x, y, age
    const dropT0 = new Float32Array(N).fill(-100);
    for (let i = 0; i < N; i++) drops[i * 3 + 2] = -1;
    let di = 0, lastSX = -1e9, lastSY = -1e9, nowT = 0;

    const spawn = (x, y) => {
      drops[di * 3] = x; drops[di * 3 + 1] = y;
      dropT0[di] = nowT;
      di = (di + 1) % N;
      lastSX = x; lastSY = y;
    };

    // cursor light follow
    let tmx = innerWidth / 2 * DPR, tmy = innerHeight / 2 * DPR;
    let mx = tmx, my = tmy, str = 0, tStr = 0.45;

    addEventListener("mousemove", (e) => {
      const x = e.clientX * DPR, y = (innerHeight - e.clientY) * DPR; // GL Y is flipped
      tmx = x; tmy = y; tStr = 1.0;
      // drop a new ripple once the cursor has travelled far enough
      if (Math.hypot(x - lastSX, y - lastSY) > 26 * DPR) spawn(x, y);
    }, { passive: true });
    // a deliberate click = a bigger single drop
    addEventListener("pointerdown", (e) => {
      spawn(e.clientX * DPR, (innerHeight - e.clientY) * DPR);
    }, { passive: true });
    // dev demo: auto-pulse ripples from centre (visit with ?demo)
    if (location.search.indexOf("demo") !== -1) {
      setInterval(() => spawn(W / 2, H * 0.28), 1700);
    }

    let start = null;
    const render = (now) => {
      if (start === null) start = now;
      nowT = (now - start) / 1000;
      mx = lerp(mx, tmx, 0.1); my = lerp(my, tmy, 0.1);
      tStr = Math.max(0.45, tStr - 0.012);
      str = lerp(str, tStr, 0.08);

      for (let i = 0; i < N; i++) {
        const age = nowT - dropT0[i];
        drops[i * 3 + 2] = (age >= 0 && age < LIFE) ? age : -1;
      }

      gl.uniform2f(uRes, W, H);
      gl.uniform1f(uTime, nowT);
      gl.uniform2f(uMouse, mx, my);
      gl.uniform1f(uStr, str);
      gl.uniform1f(uRadius, (4.0 * CM_PX) / innerHeight); // 4cm as fraction of height
      gl.uniform3fv(uDrops, drops);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  /* ---------- crosshair cursor ---------- */
  function initCursor() {
    if (!fine) return;
    const cur = document.querySelector(".zcursor");
    if (!cur) return;

    const BASE = 13, RAD = 7;             // resting size / radius
    let mx = innerWidth / 2, my = innerHeight / 2;
    let x = mx, y = my, px = x, py = y;   // rendered position (+ previous)
    let w = BASE, h = BASE, rad = RAD;    // current size
    let target = null;                    // hovered element to wrap, or null
    let firstMove = false;

    addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      if (!firstMove) { firstMove = true; cur.classList.add("ready"); }
    }, { passive: true });
    document.addEventListener("mouseleave", () => document.body.classList.add("cur-hide"));
    document.addEventListener("mouseenter", () => document.body.classList.remove("cur-hide"));

    // links / interactive text → the block snaps to and wraps the element
    document.querySelectorAll('a, [data-cursor], button').forEach((el) => {
      el.addEventListener("mouseenter", () => { target = el; });
      el.addEventListener("mouseleave", () => { target = null; });
    });

    (function raf() {
      if (target) {
        // wrap the hovered element in a rounded block
        const r = target.getBoundingClientRect();
        const padX = 14, padY = 8;
        const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
        x = lerp(x, tx, 0.22); y = lerp(y, ty, 0.22);
        w = lerp(w, r.width + padX * 2, 0.22);
        h = lerp(h, r.height + padY * 2, 0.22);
        rad = lerp(rad, 6, 0.22);
        px = x; py = y;
        cur.style.width = w + "px";
        cur.style.height = h + "px";
        cur.style.borderRadius = rad + "px";
        cur.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      } else {
        // free: small rounded block that stretches in its direction of travel
        x = lerp(x, mx, 0.2); y = lerp(y, my, 0.2);
        const vx = x - px, vy = y - py;
        const speed = Math.min(Math.hypot(vx, vy), 80);
        const stretch = Math.min(speed * 0.012, 0.5);
        const ang = Math.atan2(vy, vx);
        w = lerp(w, BASE, 0.3); h = lerp(h, BASE, 0.3); rad = lerp(rad, RAD, 0.3);
        px = x; py = y;
        cur.style.width = w + "px";
        cur.style.height = h + "px";
        cur.style.borderRadius = rad + "px";
        cur.style.transform =
          `translate(${x}px, ${y}px) translate(-50%, -50%) ` +
          `rotate(${ang}rad) scale(${(1 + stretch).toFixed(3)}, ${(1 - stretch * 0.65).toFixed(3)})`;
      }
      requestAnimationFrame(raf);
    })();
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

  /* ---------- headline: letters become blocks that shift near the cursor ---------- */
  function initHeadlineBlocks() {
    if (!fine) return;
    const h1 = document.querySelector(".kinetic");
    const main = document.querySelector(".kinetic__layer--main");
    if (!h1 || !main) return;

    // split each line into per-character spans
    main.querySelectorAll(":scope > span").forEach((line) => {
      const text = line.textContent;
      line.textContent = "";
      [...text].forEach((ch) => {
        const s = document.createElement("span");
        s.className = "char";
        s.textContent = ch === " " ? " " : ch;
        line.appendChild(s);
      });
    });
    const chars = [...main.querySelectorAll(".char")];
    // deterministic per-letter shift direction
    const dir = chars.map((_, i) => {
      const r = Math.sin(i * 12.9898) * 43758.5453;
      const a = (r - Math.floor(r)) * Math.PI * 2;
      return [Math.cos(a), Math.sin(a)];
    });

    let mx = 0, my = 0, raf = null;
    const apply = () => {
      raf = null;
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        const b = c.getBoundingClientRect();
        const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        const f = Math.max(0, 1 - Math.hypot(mx - cx, my - cy) / 170);
        const amt = f * f;
        if (amt > 0) {
          c.style.transform = `translate(${(dir[i][0] * amt * 24).toFixed(1)}px, ${(dir[i][1] * amt * 24).toFixed(1)}px)`;
          c.classList.toggle("shift", amt > 0.18);
        } else {
          c.style.transform = "";
          c.classList.remove("shift");
        }
      }
    };
    h1.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    h1.addEventListener("mouseleave", () => {
      chars.forEach((c) => { c.style.transform = ""; c.classList.remove("shift"); });
    });
  }

  /* ---------- eased smooth scroll for in-page anchors ---------- */
  function initSmoothScroll() {
    if (reduce) return;
    const easeInOutCubic = (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (!id || id === "#") return;
        const target = id === "#top" ? document.body : document.querySelector(id);
        if (!target) return;
        e.preventDefault();

        const startY = scrollY;
        const endY = id === "#top"
          ? 0
          : target.getBoundingClientRect().top + scrollY;
        const dist = endY - startY;
        if (Math.abs(dist) < 2) return;

        // duration scales with distance, but stays smooth & calm
        const dur = Math.min(1600, Math.max(850, Math.abs(dist) * 0.7));
        let start = null;
        const step = (ts) => {
          if (start === null) start = ts;
          const p = Math.min(1, (ts - start) / dur);
          scrollTo(0, startY + dist * easeInOutCubic(p));
          if (p < 1) requestAnimationFrame(step);
          else history.replaceState(null, "", id);
        };
        requestAnimationFrame(step);
      });
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
    initHeadlineBlocks();
    initHeader();
    initSmoothScroll();
    initDragTrack();
    initClock();
    runLoader(initReveal);
    setTimeout(initReveal, 2600); // safety
  });
})();
