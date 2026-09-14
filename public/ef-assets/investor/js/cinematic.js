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
    const RESUME_MS = 14000;  // idle time after user input before resuming
    let timer = null;
    let autoScrolling = false;
    let settleTimer = null;

    // Visible previous/next controls make the deck usable without relying on
    // trackpad gesture strength or the automatic timer.
    const chapterNav = document.createElement('nav');
    chapterNav.className = 'chapter-nav';
    chapterNav.setAttribute('aria-label', 'Investor presentation chapters');
    chapterNav.innerHTML = '<button type="button" class="chapter-prev" aria-label="Previous section" title="Previous section">↑</button><span class="chapter-nav-count" aria-live="polite"></span><button type="button" class="chapter-next" aria-label="Next section" title="Next section">↓</button>';
    document.body.appendChild(chapterNav);
    const previousButton = chapterNav.querySelector('.chapter-prev');
    const nextButton = chapterNav.querySelector('.chapter-next');
    const chapterCount = chapterNav.querySelector('.chapter-nav-count');

    function currentIndex() {
      const viewportCenter = window.scrollY + (window.innerHeight / 2);
      let closest = 0;
      let distance = Infinity;
      sections.forEach((section, index) => {
        const center = section.offsetTop + (section.offsetHeight / 2);
        const nextDistance = Math.abs(center - viewportCenter);
        if (nextDistance < distance) {
          closest = index;
          distance = nextDistance;
        }
      });
      return closest;
    }

    function updateChapterNav() {
      const idx = currentIndex();
      chapterCount.textContent = (idx + 1) + ' / ' + sections.length;
      previousButton.disabled = idx === 0;
      nextButton.disabled = idx === sections.length - 1;
    }

    function schedule(delay) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(advance, delay);
    }

    function advance() {
      const idx = currentIndex() + 1;
      if (idx >= sections.length) return; // reached the end — stay put
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      const target = Math.min(sections[idx].offsetTop, maxY);
      const content = sections[idx].querySelector('.section-inner, .thesis-inner');
      if (content) content.scrollTop = 0;
      autoScrolling = true;
      window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      // wait until the smooth scroll actually settles before re-arming
      let lastY = -1;
      let stable = 0;
      if (settleTimer) clearInterval(settleTimer);
      settleTimer = setInterval(() => {
        if (!autoScrolling) { clearInterval(settleTimer); settleTimer = null; return; }
        if (Math.abs(window.scrollY - lastY) < 2) stable++;
        else stable = 0;
        lastY = window.scrollY;
        if (stable >= 3) {
          clearInterval(settleTimer); settleTimer = null;
          autoScrolling = false;
          schedule(HOLD_MS);
        }
      }, 200);
    }

    // jump to a neighboring section immediately (for swipe / wheel flicks)
    function jump(dir) {
      const idx = Math.max(0, Math.min(sections.length - 1, currentIndex() + dir));
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      const target = Math.min(sections[idx].offsetTop, maxY);
      const content = sections[idx].querySelector('.section-inner, .thesis-inner');
      if (content) content.scrollTop = 0;
      if (timer) clearTimeout(timer);
      autoScrolling = true;
      window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      let lastY = -1, stable = 0;
      if (settleTimer) clearInterval(settleTimer);
      settleTimer = setInterval(() => {
        if (Math.abs(window.scrollY - lastY) < 2) stable++; else stable = 0;
        lastY = window.scrollY;
        if (stable >= 3) {
          clearInterval(settleTimer); settleTimer = null;
          autoScrolling = false;
          schedule(RESUME_MS);
        }
      }, 200);
    }

    previousButton.addEventListener('click', () => jump(-1));
    nextButton.addEventListener('click', () => jump(1));

    // user input pauses the flow; it resumes after a longer idle period
    function pause() {
      if (autoScrolling) {
        // hand control back instantly: cancel the in-flight smooth scroll
        autoScrolling = false;
        if (settleTimer) { clearInterval(settleTimer); settleTimer = null; }
        window.scrollTo({ top: window.scrollY, behavior: 'auto' });
      }
      schedule(RESUME_MS);
    }
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((evt) => {
      window.addEventListener(evt, pause, { passive: true });
    });
    window.addEventListener('scroll', () => {
      updateChapterNav();
      if (!autoScrolling) pause();
    }, { passive: true });

    // ── swipe / wheel flick = snap to next section immediately ──
    let touchStartY = null;
    let touchStartT = 0;
    window.addEventListener('touchstart', (e) => {
      if (!e.touches || !e.touches[0]) return;
      touchStartY = e.touches[0].clientY;
      touchStartT = Date.now();
    }, { passive: true });
    window.addEventListener('touchend', (e) => {
      if (touchStartY == null) return;
      const endY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : touchStartY;
      const dy = touchStartY - endY;
      const dt = Date.now() - touchStartT;
      touchStartY = null;
      // quick flick (short time, decent distance) → snap to neighbor section
      if (dt < 500 && Math.abs(dy) > 60) {
        jump(dy > 0 ? 1 : -1);
      }
    }, { passive: true });

    let wheelCooldown = 0;
    window.addEventListener('wheel', (e) => {
      const section = sections[currentIndex()];
      const content = section && section.querySelector('.section-inner, .thesis-inner');
      if (content && content.scrollHeight > content.clientHeight + 2) {
        const canScrollDown = e.deltaY > 0 && content.scrollTop + content.clientHeight < content.scrollHeight - 2;
        const canScrollUp = e.deltaY < 0 && content.scrollTop > 2;
        if (canScrollDown || canScrollUp) {
          schedule(RESUME_MS);
          return;
        }
      }
      const now = Date.now();
      if (now < wheelCooldown) return;
      if (Math.abs(e.deltaY) < 40) return;
      wheelCooldown = now + 900;
      jump(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });

    // don't advance while the tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (timer) clearTimeout(timer); }
      else schedule(HOLD_MS);
    });

    updateChapterNav();
    schedule(HOLD_MS);
  })();
})();

