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
      uniform float uStr;       // cursor light influence
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

        // ---- ripple as a radial PUSH of the particle field ----
        // each drop nudges the fine grain outward in an expanding ring; the
        // ripple is only visible through the displaced grain, never as glow.
        vec2 push = vec2(0.0);
        for (int i = 0; i < ${N}; i++) {
          vec3 dp = uDrops[i];
          if (dp.z < 0.0) continue;
          vec2 rel = (frag - dp.xy) / uRes.y;      // aspect-correct, normalized by height
          float r = length(rel);
          float age = dp.z;
          float front = age * 0.09;                // quarter-size expansion
          float band = r - front;
          // ease in slowly so a freshly-born ripple starts almost invisible
          float fade = smoothstep(0.0, 0.55, age) * exp(-age * 1.4);
          // bipolar wavelet -> particles bunch at the wavefront (a compression ring)
          float ring = (-band) * exp(-band * band * 16000.0) * 300.0 * fade;
          push += (rel / (r + 1e-4)) * ring;
        }
        push *= 0.004;                             // super-subtle ripple displacement

        // ---- gentle attraction: smoke + grain are drawn toward the cursor ----
        vec2 m = uMouse / uRes.xy;
        vec2 dM = uv - m; dM.x *= aspect;
        float distM = length(dM);
        // sampling farther out near the cursor pulls the particles inward (gather)
        vec2 attract = (uv - m) * exp(-distM * 4.2) * 0.16 * (0.55 + 0.45 * uStr);

        vec2 total = push + attract;

        // ---- flowing smoke (slow black/white movement) ----
        vec2 sp = uv + total * 0.7;
        float t = uTime * 0.05;
        float w = fbm(sp * 3.0 + vec2(t, t * 0.7));
        float n = fbm(sp * 3.0 + w * 1.4 + vec2(-t * 0.8, t * 0.6));
        float base = mix(0.015, 0.19, n);

        float c = base;                            // no glow — purely displacement

        // film grain — fine particles dragged toward the cursor
        vec2 gp = frag + total * uRes.y;           // displace grain sampling (pixels)
        float g = hash(floor(gp) + floor(uTime * 8.0) * vec2(1.3, 1.7));
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
    const uDrops = gl.getUniformLocation(prog, "uDrops");

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
      gl.uniform3fv(uDrops, drops);
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
