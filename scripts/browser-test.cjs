'use strict';
// Optional real Chromium smoke test. Never asks permission or creates a subscription.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const child = require('child_process');
const root = path.resolve(__dirname, '..');
const base = '/smart-smoker-push-test/';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  let server, browser, socket;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'push-browser-'));
  try {
    let target = process.argv[2];
    if (!target) {
      server = http.createServer((req, res) => {
        const name = req.url === base ? 'index.html' : req.url.startsWith(base) ? req.url.slice(base.length) : '';
        if (!/^[a-zA-Z0-9_.-]+$/.test(name) || !fs.existsSync(path.join(root, 'dist', name))) { res.writeHead(404); res.end(); return; }
        const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
          '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' }[path.extname(name)];
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        res.end(fs.readFileSync(path.join(root, 'dist', name)));
      });
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      target = `http://localhost:${server.address().port}${base}`;
    }
    const url = new URL(target);
    assert.strictEqual(url.pathname, base);
    assert(url.protocol === 'https:' || url.hostname === 'localhost');
    let launchError;
    browser = child.spawn(process.env.CHROMIUM || 'chromium', [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--no-first-run',
      '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'
    ], { stdio: 'ignore' });
    browser.on('error', error => { launchError = error; });
    const activePort = path.join(profile, 'DevToolsActivePort');
    for (let count = 0; !fs.existsSync(activePort); count++) {
      if (launchError) throw launchError;
      if (count > 150 || browser.exitCode !== null) throw new Error('Chromium failed to start');
      await sleep(100);
    }
    const port = fs.readFileSync(activePort, 'utf8').split('\n')[0];
    const page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let next = 0;
    const requests = new Map();
    socket.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (requests.has(data.id)) { requests.get(data.id)(data); requests.delete(data.id); }
    });
    async function cdp(method, params = {}) {
      const id = ++next;
      const response = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { requests.delete(id); reject(new Error('CDP timeout')); }, 20000);
        requests.set(id, value => { clearTimeout(timer); resolve(value); });
      });
      socket.send(JSON.stringify({ id, method, params }));
      const result = await response;
      if (result.error) throw new Error('CDP command rejected');
      return result.result;
    }
    await cdp('Page.enable');
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const navigation = await cdp('Page.navigate', { url: target });
    assert(!navigation.errorText, navigation.errorText);
    let report;
    for (let count = 0; count < 100; count++) {
      const evaluated = await cdp('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
        if (!window.PUSH_CATALOGS || !document.getElementById('subscribe') || document.getElementById('subscribe').disabled) return null;
        const registration = await navigator.serviceWorker.ready;
        const manifest = await (await fetch('./manifest.webmanifest')).json();
        const language = document.getElementById('language');
        language.value = 'cs'; language.dispatchEvent(new Event('change'));
        return { secure: isSecureContext, scope: registration.scope, script: registration.active.scriptURL,
          manifest, locale: document.documentElement.lang, status: document.getElementById('status').textContent,
          expected: PUSH_CATALOGS.cs.status.ready, exportEmpty: document.getElementById('output').value === '',
          noSubscription: (await registration.pushManager.getSubscription()) === null,
          storage: Object.keys(localStorage), permission: Notification.permission,
          noOverflow: document.documentElement.scrollWidth <= innerWidth,
          csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]').content };
      })()` });
      if (evaluated.exceptionDetails) throw new Error('Browser evaluation failed');
      report = evaluated.result.value;
      if (report) break;
      await sleep(100);
    }
    assert(report, 'Enrollment did not become ready');
    assert(report.secure && report.noSubscription && report.exportEmpty && report.noOverflow);
    assert.strictEqual(report.scope, target);
    assert.strictEqual(report.script, new URL('sw.js', target).href);
    assert.strictEqual(report.manifest.scope, './'); assert.strictEqual(report.manifest.start_url, './');
    assert.strictEqual(report.locale, 'cs'); assert.strictEqual(report.status, report.expected);
    assert.strictEqual(report.permission, 'default');
    assert.deepStrictEqual(report.storage, ['smart-smoker-language']);
    assert(report.csp.includes("connect-src 'self'"));
    await cdp('Network.enable');
    await cdp('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    const offline = await cdp('Page.navigate', { url: target });
    assert(offline.errorText, 'No offline app-shell cache is expected');
    console.log('PASS: real Chromium project-subpath enrollment readiness, worker/manifest scope, secure context, CS UI, mobile layout, private-storage boundary and expected offline navigation failure. No subscription or push send.');
  } finally {
    if (socket) socket.close();
    if (browser && browser.exitCode === null) {
      const exit = new Promise(resolve => browser.once('exit', resolve));
      browser.kill('SIGTERM');
      await Promise.race([exit, sleep(3000)]);
    }
    if (server) await new Promise(resolve => server.close(resolve));
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(() => { console.error('FAIL: browser smoke test; no private values captured. Check Chromium, networking and static deployment.'); process.exitCode = 1; });
