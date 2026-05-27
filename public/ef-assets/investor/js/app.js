/* energyforward · investor portal · interactions */
(function(){
  'use strict';

  // ─── gate disabled for v3.1 snapshot ───
  // (access already controlled by Perplexity asset URL)
  const STORED = 'ef_portal_unlocked';
  try { sessionStorage.setItem(STORED, '1'); } catch(e){}
  const gate = null;

  // ─── nav scroll state ───
  const nav = document.querySelector('.nav');
  const progress = document.getElementById('progress');
  const darkSections = ['cover','thesis','traction','ask'];

  function onScroll(){
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 24);
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (Math.min(1, y / docH) * 100) + '%';

    // dark-aware nav
    let inDark = false;
    for (const id of darkSections){
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.top < 60 && r.bottom > 60){ inDark = true; break; }
    }
    nav.classList.toggle('is-dark', inDark);
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  // ─── mobile nav toggle ───
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if (navToggle && navLinks){
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      navLinks.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded','false');
    }));
  }

  // ─── fade in on view (with safety net) ───
  const fadeEls = document.querySelectorAll('.section, .hero-content, .three-up .card, .entity-card, .team-card, .scale-stat, .market-cell, .fade-in');
  fadeEls.forEach(el => el.classList.add('fade-in'));
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting){
        en.target.classList.add('is-visible');
        io.unobserve(en.target);
      }
    });
  }, {threshold:0.05, rootMargin:'0px 0px -40px 0px'});
  fadeEls.forEach(el => io.observe(el));
  // safety net: reveal anything still hidden after 2.5s
  setTimeout(() => document.querySelectorAll('.fade-in:not(.is-visible)').forEach(el => el.classList.add('is-visible')), 2500);

  // ─── DIVE PANEL ───
  const dive = document.getElementById('dive');
  const diveBody = document.getElementById('dive-body');
  const diveClose = document.getElementById('dive-close');
  const diveReturn = document.getElementById('dive-return');
  const diveScrim = dive.querySelector('.dive-scrim');
  const diveProgressBar = document.getElementById('dive-progress-bar');
  let savedScrollY = 0;

  // ── journey rendering ────────────────────────────────────────
  const DEST_LIST = [
    {key:'rideshare',   tag:'01', name:'autonomous & ride-share fleet'},
    {key:'drayage',     tag:'02', name:'port & drayage yard'},
    {key:'warehouse',   tag:'03', name:'off-grid flagship building'},
    {key:'datacenter',  tag:'04', name:'hyperscaler bridge load'},
    {key:'chargehub',   tag:'05', name:'chargehub stationary site'}
  ];

  function renderScene(s){
    return `
      <div class="journey-scene">
        <img class="scene-bg" src="${s.img}" alt="" loading="lazy">
        <div class="scene-veil"></div>
        <div class="scene-content">
          <div class="scene-step"><span class="dot"></span>${s.tag}</div>
          <p class="scene-claim">${s.claim}</p>
          ${s.sub ? `<p class="scene-sub">${s.sub}</p>` : ''}
          ${s.receipt ? renderReceipt(s.receipt) : ''}
        </div>
      </div>
    `;
  }
  function renderReceipt(cells){
    return `<div class="scene-receipt">` + cells.map(c =>
      `<div><div class="rcpt-num">${c.n}${c.u ? `<span class="unit">${c.u}</span>` : ''}</div><div class="rcpt-label">${c.l}</div></div>`
    ).join('') + `</div>`;
  }
  function renderDestinations(currentDestKey, currentDiveKey){
    const others = DEST_LIST.filter(d => d.key !== currentDestKey);
    return `
      <div class="journey-destinations">
        <div class="journey-destinations-tag">other destinations along the highway</div>
        <div class="journey-destinations-grid">
          ${others.map(d => {
            // map a dest key to a representative dive key
            const target = ({
              rideshare: 'mkt-fleets',
              drayage: 'mkt-ports',
              warehouse: 'mkt-flagship',
              datacenter: 'mkt-datacenter',
              chargehub: 'chargehubs'
            })[d.key];
            return `<button type="button" data-dive="${target}"><div class="dest-tag">${d.tag} · journey</div><div class="dest-name">${d.name}</div></button>`;
          }).join('')}
        </div>
      </div>
    `;
  }
  function renderJourney(data){
    const dest = (window.DIVE_DEST && window.DIVE_DEST[data.dest]) || null;
    const scene3 = dest ? {
      tag: dest.tag, img: dest.img, claim: dest.claim, sub: dest.sub, receipt: dest.receipt
    } : null;
    return `
      <div class="kicker">${data.kicker}</div>
      <h2>${data.title}</h2>
      <div class="journey">
        ${renderScene(data.scenes[0])}
        ${renderScene(data.scenes[1])}
        ${scene3 ? renderScene(scene3) : ''}
      </div>
      <div class="journey-context">${data.context || ''}</div>
      ${data.body || ''}
      ${renderDestinations(data.dest, '')}
    `;
  }

  function openDive(key){
    const data = window.DIVES && window.DIVES[key];
    if (!data){ console.warn('No dive content for', key); return; }
    savedScrollY = window.scrollY;
    if (data.journey){
      diveBody.innerHTML = renderJourney(data);
    } else {
      diveBody.innerHTML = `
        <div class="kicker">${data.kicker}</div>
        <h2>${data.title}</h2>
        ${data.body}
      `;
    }
    diveBody.scrollTop = 0;
    dive.classList.add('is-open');
    dive.setAttribute('aria-hidden','false');
    document.body.classList.add('dive-open');
    history.pushState({dive:key}, '', '#dive-'+key);
  }

  function closeDive(returnToOrigin){
    dive.classList.remove('is-open');
    dive.setAttribute('aria-hidden','true');
    document.body.classList.remove('dive-open');
    if (history.state && history.state.dive){ history.back(); }
    // restore scroll
    if (returnToOrigin){
      window.scrollTo({top:savedScrollY, behavior:'smooth'});
    }
  }

  // hotspot click delegation
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-dive]');
    if (trigger){
      e.preventDefault();
      openDive(trigger.getAttribute('data-dive'));
    }
  });

  diveClose.addEventListener('click', () => closeDive(true));
  diveReturn.addEventListener('click', () => closeDive(true));
  diveScrim.addEventListener('click', () => closeDive(true));

  // esc to close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dive.classList.contains('is-open')){
      closeDive(true);
    }
  });

  // dive-body scroll progress
  diveBody.addEventListener('scroll', () => {
    const h = diveBody.scrollHeight - diveBody.clientHeight;
    if (h <= 0){ diveProgressBar.style.width = '0%'; return; }
    diveProgressBar.style.width = (Math.min(1, diveBody.scrollTop / h) * 100) + '%';
  }, {passive:true});

  // back button closes dive
  window.addEventListener('popstate', e => {
    if (dive.classList.contains('is-open') && !(e.state && e.state.dive)){
      dive.classList.remove('is-open');
      dive.setAttribute('aria-hidden','true');
      document.body.classList.remove('dive-open');
    }
  });

  // open dive from hash on load (e.g. /#dive-uber)
  const h = location.hash.match(/^#dive-(.+)$/);
  if (h && window.DIVES[h[1]]){
    setTimeout(() => openDive(h[1]), 200);
  }
})();
