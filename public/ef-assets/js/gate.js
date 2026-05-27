/* energyforward access gate
   v2: real Supabase auth per email + role-based routing.
   - admin       → top-level /admin
   - investor    → unlocks /investor portal (or redirects from /customer)
   - customer    → unlocks /customer portal (or redirects from /investor)
*/
(function () {
  'use strict';

  const SUPABASE_URL = 'https://scyqmmakqmnzpnhrrnlx.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjeXFtbWFrcW1uenBuaHJybmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5OTY2NTMsImV4cCI6MjA3NDU3MjY1M30.pzSqpFJNrJVAn9wx-zSdTN7wibphuN24R2tIQMi85SA';

  // ── role inferred from script tag ──────────────
  const script = document.currentScript;
  const role = (script && script.dataset.role) || 'investor';

  // Lazy-load supabase client from CDN
  let _sbPromise = null;
  function getSupabase() {
    if (_sbPromise) return _sbPromise;
    _sbPromise = import('https://esm.sh/@supabase/supabase-js@2.45.0').then((m) =>
      m.createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: { storage: window.localStorage, persistSession: true, autoRefreshToken: true },
      }),
    );
    return _sbPromise;
  }

  async function fetchRoles(sb, userId) {
    const { data } = await sb.from('user_roles').select('role').eq('user_id', userId);
    return new Set((data || []).map((r) => r.role));
  }

  function routeForRoles(roles, opts) {
    const fromLogin = !!(opts && opts.fromLogin);
    // admin: on fresh login send to /admin, but on revisit just unlock (admins can browse any portal)
    if (roles.has('admin')) {
      return fromLogin ? { kind: 'redirect', to: '/admin' } : { kind: 'unlock' };
    }
    // matches current portal → unlock in place
    if (roles.has(role)) return { kind: 'unlock' };
    // has the other portal → send them there
    if (role === 'customer' && roles.has('investor')) return { kind: 'redirect', to: '/investor' };
    if (role === 'investor' && roles.has('customer')) return { kind: 'redirect', to: '/customer' };
    return { kind: 'deny', msg: 'this account has no portal access' };
  }

  function applyRoute(decision) {
    if (decision.kind === 'unlock') return unlock();
    if (decision.kind === 'redirect') {
      try { window.top.location.replace(decision.to); }
      catch { window.location.replace(decision.to); }
    }
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
        <div class="ef-gate__foot" style="margin-top:8px">
          <a href="#" class="ef-gate__forgot" style="color:#E8B14A;text-decoration:none">forgot password?</a>
        </div>
        <div class="ef-gate__foot">
          <span>don't have access?</span>
          <a href="/contact" target="_top">request credentials</a>
        </div>
        <a class="ef-gate__back" href="/">← back to public site</a>
      </div>
    `;
    document.body.appendChild(gate);

    const form = gate.querySelector('.ef-gate__form');
    const msg = gate.querySelector('.ef-gate__msg');
    const btn = gate.querySelector('.ef-gate__cta');
    const forgot = gate.querySelector('.ef-gate__forgot');

    forgot.addEventListener('click', async (e) => {
      e.preventDefault();
      msg.classList.remove('is-err');
      const emailInput = form.querySelector('input[name=email]');
      const email = String(emailInput.value || '').trim().toLowerCase();
      if (!email) {
        msg.textContent = 'enter your email above, then click forgot password';
        msg.classList.add('is-err');
        emailInput.focus();
        return;
      }
      msg.textContent = 'checking account…';
      try {
        const sb = await getSupabase();
        const { data: check, error: checkErr } = await sb.functions.invoke('send-investor-email', {
          body: { type: 'check_account', email },
        });
        if (checkErr) throw new Error(checkErr.message || 'request failed');
        if (!check?.exists) {
          msg.textContent = 'your account does not exist';
          msg.classList.add('is-err');
          return;
        }
        const { error: resetErr } = await sb.functions.invoke('send-investor-email', {
          body: { type: 'reset', email },
        });
        if (resetErr) throw new Error(resetErr.message || 'request failed');
        msg.textContent = 'reset link sent — check your email';
      } catch (err) {
        msg.textContent = (err && err.message) ? err.message.toLowerCase() : 'something went wrong';
        msg.classList.add('is-err');
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.textContent = '';
      msg.classList.remove('is-err');
      btn.disabled = true;
      btn.querySelector('span').textContent = 'verifying';
      const fd = new FormData(form);
      try {
        const sb = await getSupabase();
        const { data, error } = await sb.auth.signInWithPassword({
          email: String(fd.get('email') || '').trim(),
          password: String(fd.get('password') || ''),
        });
        if (error || !data?.user) {
          throw new Error(error?.message || 'invalid credentials');
        }
        const roles = await fetchRoles(sb, data.user.id);
        const decision = routeForRoles(roles, { fromLogin: true });
        if (decision.kind === 'deny') {
          await sb.auth.signOut();
          throw new Error(decision.msg);
        }
        msg.textContent = 'access granted';
        setTimeout(() => applyRoute(decision), 220);
      } catch (err) {
        btn.disabled = false;
        btn.querySelector('span').textContent = 'enter';
        msg.textContent = (err && err.message) ? err.message.toLowerCase() : 'invalid credentials';
        msg.classList.add('is-err');
      }
    });

    // focus first field
    setTimeout(() => gate.querySelector('input[name=email]')?.focus(), 60);
  }

  // ── bootstrap ──────────────────────────────────
  document.documentElement.classList.add('ef-locked');
  (async () => {
    try {
      const sb = await getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        const roles = await fetchRoles(sb, session.user.id);
        const decision = routeForRoles(roles, { fromLogin: false });
        if (decision.kind !== 'deny') {
          applyRoute(decision);
          return;
        }
      }
    } catch (_) { /* fall through to gate */ }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountGate);
    else mountGate();
  })();
})();
