/* =========================================================
   Ryota — Portfolio interactions
   crosshair cursor · loader · drag track · reveals · clock
   ========================================================= */
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lerp = (a, b, n) => a + (b - a) * n;

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
    initCursor();
    initHeader();
    initDragTrack();
    initClock();
    runLoader(initReveal);
    setTimeout(initReveal, 2600); // safety
  });
})();
