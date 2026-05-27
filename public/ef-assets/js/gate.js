/* energyforward access gate
   stage 1 (now):  shared SHA-256-hashed password per audience
   stage 2 (next): swap verify() for a fetch() to a real auth backend
                   (Cloudflare Access, Auth0, Supabase, or a small FastAPI)
                   that issues a signed token for per-email accounts.
   the gate ui never changes — only verify() changes.
*/
(function () {
  'use strict';

  // ── config ─────────────────────────────────────
  // SHA-256 hashes of the shared passwords (NOT the passwords themselves)
  // generated with:  echo -n "PASSWORD" | shasum -a 256
  const ROLE_HASHES = {
    customer: 'b44f1fcff555ae5cb51849e87dccf4386204cd570ee770e0acf1e869cfd9dc1f',
    investor: 'b44f1fcff555ae5cb51849e87dccf4386204cd570ee770e0acf1e869cfd9dc1f',
  };
  const SESSION_KEY = 'ef_access_token';
  const SESSION_TTL_HOURS = 12;

  // ── role inferred from script tag ──────────────
  const script = document.currentScript;
  const role = (script && script.dataset.role) || 'investor';

  // ── helpers ────────────────────────────────────
  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const t = JSON.parse(raw);
      if (!t || t.role !== role) return null;
      if (Date.now() > t.expires) { sessionStorage.removeItem(SESSION_KEY); return null; }
      return t;
    } catch { return null; }
  }

  function writeSession(email) {
    const t = {
      role,
      email: email || null,
      expires: Date.now() + SESSION_TTL_HOURS * 3600 * 1000,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(t));
  }

  // verify() — swap this for a real backend call later
  async function verify(email, password) {
    const expected = ROLE_HASHES[role];
    if (!expected) return { ok: false, msg: 'unknown role' };
    const hash = await sha256(password);
    if (hash === expected) return { ok: true, email };
    return { ok: false, msg: 'invalid password' };
  }

  // ── ui ─────────────────────────────────────────
  function unlock() {
    const gate = document.getElementById('ef-gate');
    if (gate) gate.remove();
    document.documentElement.classList.add('ef-unlocked');
    document.body.style.overflow = '';
  }

  function mountGate() {
    document.body.style.overflow = 'hidden';
    const gate = document.createElement('div');
    gate.id = 'ef-gate';
    gate.innerHTML = `
      <div class="ef-gate__bg"></div>
      <div class="ef-gate__veil"></div>
      <div class="ef-gate__panel" role="dialog" aria-label="energyforward access">
        <a class="ef-gate__brand" href="/">energyforward<span class="ef-gate__dot">.</span></a>
        <div class="ef-gate__kicker">${role} access</div>
        <h2 class="ef-gate__head">${role === 'investor' ? 'investor portal' : 'customer portal'}<span class="ef-gate__dot">.</span></h2>
        <p class="ef-gate__sub">energyforward is currently in stealth. enter your access credentials to continue.</p>
        <form class="ef-gate__form" autocomplete="off">
          <label class="ef-gate__field">
            <span>email</span>
            <input type="email" name="email" required placeholder="you@company.com" autocomplete="email">
          </label>
          <label class="ef-gate__field">
            <span>password</span>
            <input type="password" name="password" required placeholder="••••••••" autocomplete="current-password">
          </label>
          <button type="submit" class="ef-gate__cta">
            <span>enter</span><span class="ef-gate__arrow">→</span>
          </button>
          <div class="ef-gate__msg" aria-live="polite"></div>
        </form>
        <div class="ef-gate__foot">
          <span>don't have access?</span>
          <a href="mailto:hello@energyforward.com?subject=${role}%20access%20request">request credentials</a>
        </div>
        <a class="ef-gate__back" href="/">← back to public site</a>
      </div>
    `;
    document.body.appendChild(gate);

    const form = gate.querySelector('.ef-gate__form');
    const msg = gate.querySelector('.ef-gate__msg');
    const btn = gate.querySelector('.ef-gate__cta');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.textContent = '';
      msg.classList.remove('is-err');
      btn.disabled = true;
      btn.querySelector('span').textContent = 'verifying';
      const fd = new FormData(form);
      const r = await verify(fd.get('email'), fd.get('password'));
      btn.disabled = false;
      btn.querySelector('span').textContent = 'enter';
      if (r.ok) {
        writeSession(r.email);
        msg.textContent = 'access granted';
        msg.classList.remove('is-err');
        setTimeout(unlock, 240);
      } else {
        msg.textContent = r.msg || 'invalid credentials';
        msg.classList.add('is-err');
      }
    });

    // focus first field
    setTimeout(() => gate.querySelector('input[name=email]')?.focus(), 60);
  }

  // ── bootstrap ──────────────────────────────────
  document.documentElement.classList.add('ef-locked');
  if (readSession()) {
    unlock();
  } else {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountGate);
    else mountGate();
  }
})();
