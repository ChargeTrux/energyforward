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
        duration: 1.0,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        smoothTouch: false,
        wheelMultiplier: 1.0,
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
})();
