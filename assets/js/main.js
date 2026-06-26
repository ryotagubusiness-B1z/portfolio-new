/* =========================================================
   Ryota — Portfolio interactions
   cursor lerp · magnetic · loader · reveals · marquee thumbs
   ========================================================= */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lerp = (a, b, n) => a + (b - a) * n;

  /* ---------- loader ---------- */
  const loader = document.getElementById("loader");
  const numEl = document.getElementById("loaderNum");
  document.documentElement.classList.add("is-loading");

  function runLoader(done) {
    if (!loader || reduceMotion) { finish(); return; }
    let n = 0;
    const tick = () => {
      n += Math.max(1, Math.round((100 - n) * 0.08));
      if (n >= 100) { n = 100; numEl.textContent = n; setTimeout(finish, 350); return; }
      numEl.textContent = n;
      setTimeout(tick, 80 + Math.random() * 60);
    };
    tick();
    function finish() {
      loader && loader.classList.add("done");
      document.documentElement.classList.remove("is-loading");
      document.body.classList.add("loaded");
      done && done();
    }
  }

  /* ---------- custom cursor ---------- */
  function initCursor() {
    if (!fine) return;
    const dot = document.querySelector(".cursor-dot");
    const ring = document.querySelector(".cursor-ring");
    if (!dot || !ring) return;

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let dx = mx, dy = my, rx = mx, ry = my;

    window.addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    document.addEventListener("mouseleave", () => document.body.classList.add("cur-hide"));
    document.addEventListener("mouseenter", () => document.body.classList.remove("cur-hide"));

    (function render() {
      dx = lerp(dx, mx, 0.85); dy = lerp(dy, my, 0.85);
      rx = lerp(rx, mx, 0.18); ry = lerp(ry, my, 0.18);
      dot.style.transform = `translate3d(${dx}px,${dy}px,0) translate(-50%,-50%)`;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%)`;
      requestAnimationFrame(render);
    })();

    // hover states via delegation
    const setState = (type) => {
      document.body.classList.toggle("cur-link", type === "link");
      document.body.classList.toggle("cur-view", type === "view");
    };
    document.querySelectorAll("[data-cursor]").forEach((el) => {
      el.addEventListener("mouseenter", () => setState(el.dataset.cursor));
      el.addEventListener("mouseleave", () => setState(null));
    });
  }

  /* ---------- magnetic elements ---------- */
  function initMagnetic() {
    if (!fine) return;
    document.querySelectorAll(".magnetic").forEach((el) => {
      const inner = el.querySelector(".magnetic__inner") || el;
      const strength = 0.4;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
        inner.style.transform = `translate(${x * strength * 0.4}px, ${y * strength * 0.4}px)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "translate(0,0)";
        inner.style.transform = "translate(0,0)";
      });
    });
  }

  /* ---------- project hover thumbnails follow cursor ---------- */
  function initProjectThumbs() {
    if (!fine) return;
    document.querySelectorAll(".project").forEach((proj) => {
      const thumb = proj.querySelector(".project__thumb");
      if (!thumb) return;
      proj.addEventListener("mouseenter", () => proj.classList.add("show-thumb"));
      proj.addEventListener("mouseleave", () => proj.classList.remove("show-thumb"));
      proj.addEventListener("mousemove", (e) => {
        thumb.style.left = e.clientX + "px";
        thumb.style.top = e.clientY + "px";
      });
    });
  }

  /* ---------- scroll reveal ---------- */
  function initReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach((i) => i.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add("in"), i * 70);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    items.forEach((i) => io.observe(i));
  }

  /* ---------- nav hide on scroll down ---------- */
  function initNav() {
    const nav = document.getElementById("nav");
    if (!nav) return;
    let last = 0;
    window.addEventListener("scroll", () => {
      const y = window.scrollY;
      nav.style.transform = (y > last && y > 200) ? "translateY(-110%)" : "translateY(0)";
      nav.style.transition = "transform .5s cubic-bezier(0.16,1,0.3,1)";
      last = y;
    }, { passive: true });
  }

  /* ---------- clock (JST) ---------- */
  function initClock() {
    const el = document.getElementById("clock");
    if (!el) return;
    const tick = () => {
      const t = new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
      });
      el.textContent = t;
    };
    tick(); setInterval(tick, 1000 * 30);
  }

  /* ---------- boot ---------- */
  window.addEventListener("DOMContentLoaded", () => {
    initCursor();
    initMagnetic();
    initProjectThumbs();
    initNav();
    initClock();
    runLoader(() => initReveal());
    // safety: reveal anyway if loader skipped
    setTimeout(initReveal, 2500);
  });
})();
