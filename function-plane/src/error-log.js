// Function Plane — client error reports (window.FP_ERRORS)
//
// Crash reporting without a crash-reporting provider: a report is one row in
// the project's own Supabase, so the only thing that changes about the app's
// privacy story is that it now admits crash reports exist. No third processor,
// no vendored SDK, nothing new for the Data safety form to disclose beyond the
// reports themselves.
//
// Reports are anonymous on purpose. No account id, no device identifier, no
// user agent: a stack trace is worth having and knowing whose stack it was is
// not, and "not linked to your identity" is only an honest answer if the row
// genuinely is not. `native` is which build of our own app, not which device.
//
// Loaded before everything it might have to catch, which is why it reads its
// config off the window rather than asking any module for it.
(() => {
  const URL_  = window.SUPABASE_URL || '';
  const KEY   = window.SUPABASE_ANON_KEY || '';
  const READY = !!URL_ && !URL_.includes('YOUR-PROJECT') && !!KEY && !KEY.includes('YOUR-ANON');

  // A render loop can throw the same error sixty times a second, and a broken
  // release should cost one row per player per fault, not a table. Identical
  // reports are dropped for the session and the session is capped outright.
  const MAX_PER_SESSION = 5;
  const seen = new Set();
  let sent = 0;
  let route = null;

  const clip = (v, n) => (typeof v === 'string' && v ? v.slice(0, n) : null);

  function report(kind, message, stack) {
    if (!READY || sent >= MAX_PER_SESSION) return;
    const msg = clip(String(message ?? ''), 500);
    if (!msg) return;
    const sig = kind + '|' + msg;
    if (seen.has(sig)) return;
    seen.add(sig);
    sent++;

    // Fire and forget, but still bounded: nothing waits on this, and a request
    // the network never answers should not hold a connection open for the rest
    // of the session. keepalive so a crash on the way out still gets sent.
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    if (ctl) setTimeout(() => ctl.abort(), 8000);
    try {
      fetch(URL_ + '/rest/v1/client_errors', {
        method: 'POST',
        keepalive: true,
        signal: ctl ? ctl.signal : undefined,
        headers: {
          apikey: KEY,
          Authorization: 'Bearer ' + KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          kind,
          message: msg,
          stack: clip(stack, 4000),
          route: clip(route, 120),
          build: window.FP_BUILD ?? null,
          native: !!window.FP_NATIVE,
        }),
      }).catch(() => {});
    } catch {}
  }

  // A failed <img> or <script> fires this too, with no Error attached. Those
  // are not faults worth a row.
  window.addEventListener('error', e => {
    if (!e || !e.error) return;
    report('error', e.error.message || e.message, e.error.stack);
  });

  window.addEventListener('unhandledrejection', e => {
    const r = e && e.reason;
    report('unhandledrejection', r && r.message ? r.message : String(r), r && r.stack);
  });

  // Which screen it happened on, set by the router. React 18 rethrows an
  // uncaught render error, so the listener above sees those as well and there
  // is no error boundary to keep in step with this.
  window.FP_ERRORS = { report, setRoute: r => { route = r; } };
})();
