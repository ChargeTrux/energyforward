/* ─────────────────────────────────────────────
   v6 cinematic enhancements
   Lenis smooth scroll + GSAP scroll-triggers
   + animated counter tickers
   layered ON TOP of existing app.js
   ───────────────────────────────────────────── */
(function () {
  'use strict';

  // ── 1. Scrolling ─────────────────────────────
  // Lenis smooth-scroll removed: it conflicted with the page's native
  // `scroll-behavior: smooth` and could freeze scrolling entirely.
  // Native scrolling (already smooth via CSS) drives everything now.

  // ── 2. Hero video ready fade-in ──────────────
  const heroVid = document.querySelector('.hero-video');
  if (heroVid) {
    const ready = () => heroVid.classList.add('is-ready');
    if (heroVid.readyState >= 2) ready();
    else heroVid.addEventListener('loadeddata', ready, { once: true });
    // ensure autoplay in case browser deferred
    const tryPlay = () => heroVid.play().catch(() => {});
    tryPlay();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tryPlay(); });
  }

  // ── 3. GSAP: reveals + hero parallax ─────────
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    // mark section blocks for reveal (skip .hero-content — app.js already handles it)
    document.querySelectorAll('.section-inner, .thesis-inner').forEach((el) => {
      el.classList.add('cin-reveal');
      ScrollTrigger.create({
        trigger: el,
        start: 'top 82%',
        onEnter: () => el.classList.add('is-in'),
        once: true,
      });
    });

    // hero video gentle scale as you scroll past (no y-shift — a vertical
    // offset larger than the scale buffer exposed a dark gap at the top)
    if (heroVid) {
      gsap.to(heroVid, {
        scale: 1.1,
        transformOrigin: 'center center',
        ease: 'none',
        scrollTrigger: {
          trigger: '#cover',
          start: 'top top',
          end: 'bottom top',
          scrub: 0.6,
        }
      });
      // gentle upward drift on hero text (no fade — leave opacity to existing app.js)
      gsap.to('.hero-content', {
        y: -40,
        ease: 'none',
        scrollTrigger: {
          trigger: '#cover',
          start: 'top top',
          end: 'bottom top',
          scrub: 0.8,
        }
      });
    }

    // generic cinematic section video parallax
    document.querySelectorAll('.section--cinematic').forEach((sec) => {
      const vid = sec.querySelector('.section-video');
      if (!vid) return;
      gsap.to(vid, {
        y: -60, scale: 1.08, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
      });
    });

    // thesis video subtle parallax
    const thesisVid = document.querySelector('.thesis-video');
    if (thesisVid) {
      gsap.to(thesisVid, {
        y: -80,
        scale: 1.05,
        ease: 'none',
        scrollTrigger: {
          trigger: '#thesis',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.8,
        }
      });
    }

    // ── 4. animated counter tickers ────────────
    // matches: .metric-big, .scale-big, .market-big, .market-mid, .ask-big
    document.querySelectorAll('.metric-big, .scale-big, .market-big, .market-mid, .ask-big').forEach((el) => {
      // pull number out, preserving unit child
      const unit = el.querySelector('.unit');
      const txt = el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild.nodeValue.trim() : el.textContent.trim();
      const m = txt.match(/^(\$?)(-?\+?\d+(?:\.\d+)?)/);
      if (!m) return;
      const prefix = m[1] || (txt.startsWith('+') ? '+' : '');
      const target = parseFloat(m[2]);
      if (!isFinite(target)) return;
      const decimals = (m[2].split('.')[1] || '').length;
      // build a span to animate
      const numSpan = document.createElement('span');
      numSpan.className = 'cin-num';
      numSpan.textContent = prefix + '0';
      // remove existing text node(s), keep unit
      const kids = Array.from(el.childNodes);
      kids.forEach((n) => { if (n.nodeType === 3) el.removeChild(n); });
      el.insertBefore(numSpan, el.firstChild);

      const obj = { v: 0 };
      ScrollTrigger.create({
        trigger: el,
        start: 'top 96%',
        once: true,
        onEnter: () => {
          gsap.to(obj, {
            v: target,
            duration: 1.6,
            ease: 'power2.out',
            onUpdate: () => {
              numSpan.textContent = prefix + obj.v.toFixed(decimals);
            }
          });
        }
      });
    });

    ScrollTrigger.refresh();
  }

  // ── 5. Gentle auto-advance flow ──────────────
  // Glides to the next section every few seconds. Manual scrolling always
  // works: user input just pauses the flow, which resumes from wherever the
  // user is after a few seconds of inactivity.
  (function autoFlow() {
    const sections = Array.from(document.querySelectorAll('section[id]'));
    if (sections.length < 2) return;

    const HOLD_MS = 7000;     // time on each section before advancing
    const RESUME_MS = 9000;   // idle time after user input before resuming
    const NAV_OFFSET = 64;    // fixed header height
    let timer = null;
    let autoScrolling = false;

    function currentIndex() {
      const y = window.scrollY + NAV_OFFSET + 10;
      let i = 0;
      for (let s = 0; s < sections.length; s++) {
        if (sections[s].offsetTop <= y) i = s;
      }
      return i;
    }

    function schedule(delay) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(advance, delay);
    }

    function advance() {
      const idx = currentIndex() + 1;
      if (idx >= sections.length) return; // reached the end — stay put
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      const target = Math.min(sections[idx].offsetTop - NAV_OFFSET, maxY);
      autoScrolling = true;
      window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      setTimeout(() => { autoScrolling = false; schedule(HOLD_MS); }, 1600);
    }

    // user input pauses the flow; it resumes after a longer idle period
    function pause() {
      schedule(RESUME_MS);
    }
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((evt) => {
      window.addEventListener(evt, pause, { passive: true });
    });
    window.addEventListener('scroll', () => { if (!autoScrolling) pause(); }, { passive: true });

    // don't advance while the tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (timer) clearTimeout(timer); }
      else schedule(HOLD_MS);
    });

    schedule(HOLD_MS);
  })();
})();
