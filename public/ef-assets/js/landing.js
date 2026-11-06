(function () {
  'use strict';

  // hero video fade-in
  const v = document.querySelector('.bg-video');
  if (v) {
    const ready = () => v.classList.add('is-ready');
    if (v.readyState >= 2) ready();
    else v.addEventListener('loadeddata', ready, { once: true });
    const tryPlay = () => v.play().catch(() => {});
    tryPlay();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tryPlay(); });
  }

  // reveal on scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.essay-inner, .close-inner, .access-inner').forEach((el) => io.observe(el));

  // Keep the public section tabs in sync with the current scroll position.
  const tabs = Array.from(document.querySelectorAll('.section-nav a'));
  const sections = tabs.map((tab) => document.querySelector(tab.getAttribute('href'))).filter(Boolean);
  let pending = false;
  const updateTab = () => {
    const header = document.querySelector('.nav');
    const offset = (header ? header.getBoundingClientRect().height : 0) + 40;
    let active = sections[0];
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= offset) active = section;
    });
    tabs.forEach((tab) => {
      if (active && tab.getAttribute('href') === '#' + active.id) tab.setAttribute('aria-current', 'location');
      else tab.removeAttribute('aria-current');
    });
    pending = false;
  };
  window.addEventListener('scroll', () => {
    if (!pending) { pending = true; requestAnimationFrame(updateTab); }
  }, { passive: true });
  window.addEventListener('resize', updateTab);
  updateTab();
})();
