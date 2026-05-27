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
})();
