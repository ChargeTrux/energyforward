/* ─────────────────────────────────────────────
   v6 cinematic enhancements
   Lenis smooth scroll + GSAP scroll-triggers
   + animated counter tickers
   layered ON TOP of existing app.js
   ───────────────────────────────────────────── */
(function () {
  'use strict';

  // ── 1. Lenis smooth scroll ───────────────────
  // ── Lenis smooth scroll (re-enabled) ─────────
  const LenisCtor = window.Lenis && (window.Lenis.default || window.Lenis);
  let lenis = null;
  if (LenisCtor) {
    try {
      lenis = new LenisCtor({
        duration: 0.9,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        smoothTouch: false,
        wheelMultiplier: 1.1,
        touchMultiplier: 1.5,
      });
      function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
      requestAnimationFrame(raf);

      if (window.gsap && window.ScrollTrigger) {
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => { lenis.raf(time * 1000); });
        gsap.ticker.lagSmoothing(0);
      }

      // anchor links → smooth scroll via Lenis
      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener('click', (e) => {
          const id = a.getAttribute('href');
          if (id && id.length > 1) {
            const t = document.querySelector(id);
            if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -40, duration: 1.2 }); }
          }
        });
      });
    } catch (err) {
      console.warn('Lenis init failed, falling back to native scroll', err);
      lenis = null;
    }
  }

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

    // hero video gentle scale + fade out as you scroll past
    if (heroVid) {
      gsap.to(heroVid, {
        scale: 1.08,
        y: 80,
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

  // ── 5. Section-by-section navigation ─────────
  // Each wheel/swipe/key advances exactly one section; an auto-advance
  // timer cycles forward while the user is idle so the deck plays itself.
  (function sectionNav() {
    const sections = Array.from(document.querySelectorAll('section'));
    if (sections.length < 2) return;

    let current = 0;
    let locked = false;
    const AUTO_MS = 6000;       // dwell time per section
    const LOCK_MS = 900;        // animation duration / cooldown
    let autoTimer = null;

    const sectionTop = (i) => sections[i].getBoundingClientRect().top + window.scrollY;

    const goTo = (i) => {
      i = Math.max(0, Math.min(sections.length - 1, i));
      current = i;
      locked = true;
      const y = sectionTop(i);
      if (lenis && typeof lenis.scrollTo === 'function') {
        lenis.scrollTo(y, { duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 3) });
      } else {
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
      setTimeout(() => { locked = false; }, LOCK_MS);
      scheduleAuto();
    };

    const findCurrent = () => {
      const y = window.scrollY + window.innerHeight * 0.4;
      let idx = 0;
      for (let i = 0; i < sections.length; i++) {
        if (sectionTop(i) <= y) idx = i;
      }
      return idx;
    };

    const scheduleAuto = () => {
      if (autoTimer) clearTimeout(autoTimer);
      autoTimer = setTimeout(() => {
        if (document.hidden) { scheduleAuto(); return; }
        const next = current + 1;
        if (next < sections.length) goTo(next);
      }, AUTO_MS);
    };

    // Wheel → discrete advance
    window.addEventListener('wheel', (e) => {
      if (locked) { e.preventDefault && e.preventDefault(); return; }
      const dir = e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0);
      if (!dir) return;
      current = findCurrent();
      goTo(current + dir);
    }, { passive: false });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (locked) return;
      if (['ArrowDown', 'PageDown', 'Space'].includes(e.code)) { e.preventDefault(); current = findCurrent(); goTo(current + 1); }
      else if (['ArrowUp', 'PageUp'].includes(e.code)) { e.preventDefault(); current = findCurrent(); goTo(current - 1); }
      else if (e.code === 'Home') { e.preventDefault(); goTo(0); }
      else if (e.code === 'End')  { e.preventDefault(); goTo(sections.length - 1); }
    });

    // Touch swipe
    let touchY = 0;
    window.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
    window.addEventListener('touchend', (e) => {
      if (locked) return;
      const dy = touchY - (e.changedTouches[0]?.clientY ?? touchY);
      if (Math.abs(dy) < 40) return;
      current = findCurrent();
      goTo(current + (dy > 0 ? 1 : -1));
    }, { passive: true });

    // Recompute on resize
    window.addEventListener('resize', () => { current = findCurrent(); });

    // Kick off auto-advance after first paint
    setTimeout(() => { current = findCurrent(); scheduleAuto(); }, 600);
  })();
})();
