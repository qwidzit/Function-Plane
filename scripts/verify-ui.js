// Plays the equations panel in a real browser: the ⋯ settings, the two custom
// keyboards and the tutorial decks. Everything here is something a finger
// does, which is what `npm test` cannot reach — its screens are called once
// and never touched, and every bug this file was written after needed two
// taps in the wrong order.
//
//   npm run verify:ui
//
// Zero dependencies: it serves function-plane/ itself and drives a headless
// Chrome or Edge over the DevTools protocol, so it needs one installed
// (CHROME_PATH points at it if it is somewhere unusual) and Node 22+ for the
// built-in WebSocket. Supabase is blocked, so the app boots from the baked
// snapshot the way an offline phone does and nothing here touches live data.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', 'function-plane');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function findBrowser() {
  const env = process.env;
  const list = process.platform === 'win32' ? [
    [env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'],
    [env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'],
    [env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'],
    [env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'],
    [env.PROGRAMFILES, 'Microsoft/Edge/Application/msedge.exe'],
  ].filter(([dir]) => dir).map(p => path.join(...p)) : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ] : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
       '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  return [env.CHROME_PATH, ...list].find(p => p && fs.existsSync(p));
}

const TYPES = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json',
  png: 'image/png', svg: 'image/svg+xml', ico: 'image/x-icon', woff2: 'font/woff2' };

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).slice(1)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function launch(browser) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-ui-'));
  const proc = spawn(browser, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });
  // Port 0 lets the browser pick; it writes the one it picked here.
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await sleep(100);
  if (!fs.existsSync(portFile)) { proc.kill(); throw new Error('the browser did not start'); }
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
  const target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let seq = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push(d.exception?.description || d.text);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const close = async () => {
    try { ws.close(); } catch {}
    proc.kill();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  };
  return { send, errors, close };
}

// What the page-side finders are written in. B: a button by its text, label or
// title. BB: a button by a pattern over its text. F: the n-th equation field.
const HELPERS = `
  window.B = t => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t || b.getAttribute('aria-label') === t || b.title === t);
  window.BB = re => [...document.querySelectorAll('button')].find(b => re.test(b.textContent));
  window.ALL = t => [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === t || b.getAttribute('aria-label') === t || b.title === t);
  window.F = (n = 0) => document.querySelectorAll('input[aria-label="Equation"]')[n]?.parentElement;
  window.S = () => ({
    mathKb: !!B('functions'), numPad: !!B('CLR'), settings: !!B('+ Add segment'),
    dones: ALL('Done').length, fields: document.querySelectorAll('input[aria-label="Equation"]').length,
    caret: !!document.querySelector('.fp-caret'),
    x: B('move along x')?.textContent, y: B('move along y')?.textContent,
    deck: [...document.querySelectorAll('button[aria-label^="Page "]')].length || null,
  });
`;

(async () => {
  if (typeof WebSocket !== 'function') { console.error('verify:ui needs Node 22 or newer (built-in WebSocket).'); process.exit(2); }
  const browser = findBrowser();
  if (!browser) {
    console.error('verify:ui needs Chrome, Edge or Chromium. None found — set CHROME_PATH to one.');
    process.exit(2);
  }
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const page = await launch(browser);
  const { send } = page;

  const results = [];
  let group = '';
  const describe = name => { group = name; };
  const check = (name, got, want) => {
    const ok = Object.entries(want).every(([k, v]) => got[k] === v);
    results.push({ group, name, ok, got, want });
  };
  const ev = async body => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const S = () => ev('return S()');
  const until = async (cond, what, ms = 8000) => {
    for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (await ev(`return !!(${cond})`)) return;
    throw new Error(`timed out waiting for ${what}`);
  };
  const pos = async finder => {
    const p = await ev(`const el = ${finder}; if (!el) return null; el.scrollIntoView({ block: 'nearest' });
      const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
    if (!p) throw new Error(`nothing on screen matches ${finder}`);
    return p;
  };
  // A finger, not a click(): the panel listens for pointerdown, and the nudge
  // buttons care how long it stays down.
  const tap = async (finder, holdMs = 0) => {
    const { x, y } = await pos(finder);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    if (holdMs) await sleep(holdMs);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(180);
  };
  const type = async text => {
    for (const ch of text) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
    }
    await sleep(120);
  };
  const size = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });

  try {
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Network.setBlockedURLs', { urls: ['*supabase.co*', '*fonts.googleapis.com*', '*fonts.gstatic.com*'] });
    await send('Network.setBypassServiceWorker', { bypass: true });
    await size(375, 812);
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });
    // A headless page has no focus of its own, and without it no blur ever fires.
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await send('Page.navigate', { url: origin + '/' });
    await until(`document.querySelectorAll('button').length > 3`, 'the app to boot', 15000);
    await ev(HELPERS);

    await until(`BB(/Pack I/)`, 'the main screen');
    await tap(`BB(/Pack I/)`);
    await until(`BB(/Foundations/)`, 'the pack list');
    await tap(`BB(/Foundations/)`);
    await until(`BB(/Warm-up/)`, 'the level list');
    await tap(`BB(/Warm-up/)`);
    await until(`B('Add equation')`, 'level 1');

    describe('Tutorial decks');
    await until(`B('Next')`, 'the first deck');
    check('level 1 opens with a three-page deck', await S(), { deck: 3 });
    await tap(`B('Next')`); await tap(`B('Next')`);
    check('whose last page is the one that finishes', { last: await ev(`return !!B('Got it') && !B('Next')`) }, { last: true });
    await tap(`B('Got it')`);
    check('and closes', await S(), { deck: null });

    describe('The ⋯ settings and the two keyboards');
    await tap('F()');
    check('a field taking focus opens the math keyboard', await S(), { mathKb: true, numPad: false, caret: true });
    await type('y=-x');
    await tap(`B('Curve settings')`);
    check('opening settings puts the math keyboard away and offers Done', await S(),
      { mathKb: false, numPad: false, settings: true, dones: 1, fields: 0 });
    await tap(`B('move along x')`);
    check('a number opens the keypad', await S(), { mathKb: false, numPad: true, settings: true });
    await tap(`B('x plus')`); await tap(`B('x plus')`);
    check('a nudge with the keypad open keeps it up and showing the number', await S(), { numPad: true, x: '1' });
    await tap(`B('y plus')`);
    await tap(`B('CLR')`); await tap(`B('3')`);
    check('a number typed after nudging the other axis keeps the nudge', await S(), { x: '3', y: '0.5', numPad: true });

    await tap(`B('y plus')`, 900);
    const held = Number((await S()).y);
    check('a held nudge repeats', { repeated: held >= 2 }, { repeated: true });
    await sleep(350);
    check('and stops with the finger', { y: Number((await S()).y) }, { y: held });

    await tap(`B('Close curve settings')`); await sleep(200);
    check('Done closes the keypad and hands the field its keyboard back', await S(),
      { mathKb: true, numPad: false, settings: false, caret: true, fields: 1 });
    await tap(`ALL('Done')[0]`);
    check('the keyboard\'s own Done leaves no keyboard and no caret', await S(), { mathKb: false, caret: false, dones: 0 });

    await tap(`B('Curve settings')`);
    await tap(`B('move along y')`);
    await tap(`B('Close curve settings')`); await sleep(200);
    check('Done with nothing being typed closes the keypad and opens nothing', await S(),
      { mathKb: false, numPad: false, settings: false, caret: false });
    await tap('F()');
    check('and the math keyboard opens on the next tap', await S(), { mathKb: true, numPad: false, caret: true });

    await tap(`B('Add equation')`);
    await tap(`ALL('Curve settings')[1]`);
    check('an empty row says so in its settings', { text: await ev(`return B('Edit the equation').textContent`) }, { text: 'No equation yet' });
    await tap(`B('move along x')`);
    await tap('F()');
    check('a field taking focus closes another row\'s keypad', await S(), { numPad: false, mathKb: true });
    await tap(`B('Edit the equation')`); await sleep(200);
    check('the equation above the settings is a way back to it', await S(), { settings: false, mathKb: true, caret: true, fields: 2 });

    await tap(`ALL('Remove equation')[1]`);
    await tap('F()');
    await tap(`B('Remove equation')`); await sleep(200);
    check('removing the row being typed in takes the keyboard', await S(), { fields: 0, mathKb: false, numPad: false });

    await tap(`B('Add equation')`);
    await tap(`B('Curve settings')`);
    await tap(`B('+ Add segment')`);
    await tap(`BB(/^-5$/)`);
    check('a domain number opens the keypad', await S(), { numPad: true });
    await tap(`B('+ Add segment')`);
    check('adding a segment closes it', await S(), { numPad: false, settings: true });
    await tap(`BB(/^-5$/)`);
    await size(360, 640);
    check('at 360px the open row fits', await ev(`
      const W = document.documentElement.clientWidth;
      const done = B('Close curve settings').getBoundingClientRect();
      const seg = BB(/^×$/).getBoundingClientRect();
      return { clear: seg.right <= done.left, wide: document.documentElement.scrollWidth <= W };`), { clear: true, wide: true });
    await size(375, 812);
    await tap(`B('Remove equation')`); await sleep(200);
    check('removing a row takes its keypad', await S(), { fields: 0, numPad: false, mathKb: false });

    describe('Runs');
    await tap(`B('Add equation')`);
    await tap('F()'); await type('y=-x');
    await tap(`B('Curve settings')`);
    await tap(`B('move along x')`);
    await tap(`BB(/^Play/)`); await sleep(300);
    check('no keypad during a run', await S(), { numPad: false });
    await tap(`BB(/^Stop/)`); await sleep(300);
    check('and it is back when the run stops', await S(), { numPad: true, settings: true });
    await tap(`B('Hide panel')`);
    await tap(`B('Show equations')`);
    check('hiding the panel closes both keyboards', await S(), { numPad: false, mathKb: false });

    await tap(`B('Curve settings')`);
    await tap(`B('Close curve settings')`);
    await tap(`BB(/^Play/)`);
    await until(`BB(/Next level/)`, 'level 1 to be cleared by y=-x', 25000);
    // A second clear is the tall one: it adds a "previous best" line to each block.
    await tap(`BB(/Replay/)`); await sleep(300);
    await tap(`BB(/^Play/)`);
    await until(`BB(/Next level/)`, 'level 1 to be cleared again', 25000);
    await sleep(700);
    const popupFits = () => ev(`
      const list = [...document.querySelectorAll('.fp-scroll')].find(e => e.textContent.includes('Rating'));
      return { lines: (list.textContent.match(/Previous best/g) || []).length,
        fits: list.scrollHeight <= list.clientHeight,
        onScreen: BB(/Next level/).getBoundingClientRect().bottom <= document.documentElement.clientHeight };`);
    check('a repeat clear shows both previous bests without scrolling', await popupFits(), { lines: 2, fits: true, onScreen: true });
    await size(320, 568);
    check('and on a 320 by 568 screen too', await popupFits(), { lines: 2, fits: true, onScreen: true });
    await size(375, 812);
    await tap(`BB(/Replay/)`); await sleep(300);
    await tap(`B('Curve settings')`);
    await tap(`B('move along y')`);
    await tap(`BB(/History/)`);
    await until(`BB(/Load these equations/)`, 'the run history');
    await tap(`BB(/Load these equations/)`); await sleep(300);
    check('a loaded run arrives with no settings open and no keyboard', await S(),
      { numPad: false, settings: false, mathKb: false, fields: 1 });

    describe('The move deck');
    const enterLevel2 = async () => {
      await tap(`B('Back')`);
      await until(`BB(/First slope/)`, 'the level list');
      await tap(`BB(/First slope/)`);
      await until(`B('Add equation')`, 'level 2');
      await sleep(400);
    };
    const deckTitle = () => ev(`return document.body.innerText.includes('Move the curve')`);
    await enterLevel2();
    check('level 2 introduces the ⋯ button', { ...(await S()), title: await deckTitle() }, { deck: 3, title: true });
    await tap(`B('Close')`);
    await enterLevel2();
    check('once', await S(), { deck: null });
    // Admins proofread these, so for them a deck is never "seen".
    await ev(`window.FP_AUTH.isAdmin = () => true;`);
    await enterLevel2();
    check('an admin sees it on every visit', { ...(await S()), title: await deckTitle() }, { deck: 3, title: true });
    await tap(`B('Close')`);
    await enterLevel2();
    check('including the one after closing it', { ...(await S()), title: await deckTitle() }, { deck: 3, title: true });
    await tap(`B('Close')`);

    // styles.css keeps everything a 320px phone needs in one media query, and
    // the components carry only class names. Both halves are checked: that the
    // narrow rules do their job, and that a wider phone computes exactly the
    // values written inline.
    describe('Narrow phones');
    const styleOf = `(sel, prop) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[prop] : 'missing'; }`;
    const inline = () => ev(`const css = ${styleOf}; return {
      hud: css('.fp-hud', 'paddingLeft'), row: css('.fp-hud-row', 'columnGap'),
      chip: css('.fp-chip', 'paddingLeft'), label: css('.fp-chip-label', 'fontSize'),
      play: css('.fp-hud-play', 'paddingLeft'), seg: css('.fp-seg', 'columnGap'),
      num: css('.fp-seg .fp-num', 'width'), x: css('.fp-seg-x', 'whiteSpace') };`);
    const WIDE = { hud: '14px', row: '8px', chip: '10px', label: '9.5px', play: '16px', seg: '6px', num: '52px', x: 'normal' };
    await tap(`B('Curve settings')`);
    await tap(`B('+ Add segment')`);
    check('at 375px every value is the one written inline', await inline(), WIDE);
    await size(360, 640);
    check('and at 360px', await inline(), WIDE);
    await size(340, 640);
    // Not the boxes: a computed width is the laid-out one, and at 340px the
    // row is already a few pixels tight and flex takes them from the boxes.
    const { num, ...rules } = WIDE;
    check('and at 340px, the first width that is not narrow', await inline(), rules);

    await size(320, 568);
    const hud = () => ev(`
      const W = document.documentElement.clientWidth;
      return { playOnScreen: BB(/^(Play|Stop)/).getBoundingClientRect().right <= W, wide: document.documentElement.scrollWidth <= W };`);
    check('at 320px Play is on screen', await hud(), { playOnScreen: true, wide: true });
    check('a domain segment keeps "x ∈" on one line, clear of Done', await ev(`
      const x = document.querySelector('.fp-seg-x').getBoundingClientRect();
      return { oneLine: x.height < 20, clear: BB(/^×$/).getBoundingClientRect().right <= B('Close curve settings').getBoundingClientRect().left };`),
      { oneLine: true, clear: true });
    // The widest the three chips get: a three-digit score, Geometry's ten
    // stars, a run near the time limit. Written straight into the chips,
    // because no level reaches all three at once.
    await ev(`const vals = { SCORE: '185', STARS: '10/10', TIME: '27.9s' };
      for (const l of document.querySelectorAll('.fp-chip-label')) l.nextElementSibling.textContent = vals[l.textContent.trim().toUpperCase()];`);
    check('and still is with the widest numbers the chips can hold', await hud(), { playOnScreen: true, wide: true });
    await size(375, 812);

    await tap(`B('Back')`); await until(`BB(/First slope/)`, 'the level list');
    await tap(`B('Back')`); await until(`BB(/Foundations/)`, 'the pack list');
    await tap(`B('Back')`); await until(`BB(/Sandbox/)`, 'the main screen');
    await tap(`BB(/Sandbox/)`);
    await until(`B('Add equation')`, 'the sandbox');
    await tap(`B('Add equation')`);
    await tap('F()'); await type('y=sin(x)');
    await tap(`B('Curve settings')`);
    const sandbox = () => ev(`
      const t = [...document.querySelectorAll('.fp-studio-bar div')].find(d => d.textContent.trim() === 'Free play' && !d.children.length);
      return { icons: getComputedStyle(document.querySelector('.fp-mat-icon')).display !== 'none',
        title: t.scrollWidth <= t.clientWidth, bar: getComputedStyle(document.querySelector('.fp-studio-bar')).columnGap };`);
    check('the sandbox at 375px draws the bounce icons and its usual header', await sandbox(), { icons: true, title: true, bar: '10px' });
    await size(320, 568);
    check('at 320px the bounce buttons are words, and the title is whole', await sandbox(), { icons: false, title: true, bar: '6px' });
  } catch (e) {
    results.push({ group, name: e.message, ok: false, got: 'the scenario stopped here', want: 'to finish' });
  }

  await page.close();
  server.close();

  let last = '';
  for (const r of results) {
    if (r.group !== last) { last = r.group; console.log(`\n${last}`); }
    console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}`);
    if (!r.ok) console.log(`         got  ${JSON.stringify(r.got)}\n         want ${JSON.stringify(r.want)}`);
  }
  for (const e of page.errors) console.log(`\n  page error: ${e}`);
  const failed = results.filter(r => !r.ok).length + page.errors.length;
  console.log('\n' + '─'.repeat(60));
  console.log(failed ? `${failed} failed` : `${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
