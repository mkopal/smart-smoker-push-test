'use strict';
// Real desktop Chromium offline-shell simulation; never phone acceptance or a device request online.
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
  let workerVariant = '', rejectShellAssets = false, shellAssetRequests = 0;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'spike-offline-browser-'));
  try {
    let target;
    if (!target) {
      server = http.createServer((req, res) => {
        const pathname = req.url;
        const name = pathname === base ? 'index.html' : pathname === base + 'https-spike/' ? 'https-spike/index.html'
          : pathname.startsWith(base) ? pathname.slice(base.length) : '';
        if (!/^(https-spike\/)?[a-zA-Z0-9_.-]+$/.test(name) || !fs.existsSync(path.join(root, 'dist', name))) { res.writeHead(404); res.end(); return; }
        if (name.startsWith('https-spike/') && name !== 'https-spike/sw.js') {
          shellAssetRequests++;
          if (rejectShellAssets) { res.writeHead(503); res.end(); return; }
        }
        const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
          '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' }[path.extname(name)];
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        let content = fs.readFileSync(path.join(root, 'dist', name));
        if (name === 'https-spike/sw.js') {
          const source = content.toString();
          content = workerVariant === 'replacement'
            ? source.replace(/v1-[a-f0-9]{64}/g, 'v1-browser-failed-replacement')
            : source + workerVariant;
        }
        res.end(content);
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
    async function evaluate(expression) {
      const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description);
      return result.result.value;
    }
    async function until(expression) {
      for (let count = 0; count < 150; count++) {
        const result = await evaluate(expression);
        if (result) return result;
        await sleep(100);
      }
      throw new Error('Readiness timeout');
    }
    // Install the original root worker first, then the more specific spike worker.
    await cdp('Page.navigate', { url: target });
    await until("!!document.getElementById('subscribe') && !document.getElementById('subscribe').disabled");
    const spike = target + 'https-spike/';
    await cdp('Page.navigate', { url: spike });
    await until("!!window.SPIKE_SHELL_VERSION && !!window.PUSH_CATALOGS && !!document.getElementById('offline') && document.getElementById('offline').textContent === PUSH_CATALOGS[document.documentElement.lang].offline.ready");
    const report = await evaluate(`(async () => ({
      scope: (await navigator.serviceWorker.getRegistration(location.href)).scope,
      controller: navigator.serviceWorker.controller.scriptURL,
      registrations: (await navigator.serviceWorker.getRegistrations()).map(r => r.scope).sort(),
      caches: await caches.keys(), local: Object.keys(localStorage),
      version: SPIKE_SHELL_VERSION,
      manifest: await (await fetch('./manifest.webmanifest')).json()
    }))()`);
    assert.equal(report.scope, spike);
    assert.equal(report.controller, spike + 'sw.js');
    assert.deepEqual(report.registrations, [target, spike].sort());
    assert.equal(report.manifest.start_url, './');
    assert.equal(report.caches.length, 1);
    assert.equal(report.local.length, 0);
    // Force actual install with identical RELEASE by changing only a loopback fixture comment.
    // All asset requests would now fail: reinstall must reuse the existing verified cache.
    workerVariant = '\n// same-release reinstall regression fixture\n';
    rejectShellAssets = true;
    const beforeReinstallRequests = shellAssetRequests;
    await evaluate(`(async () => {
      window.lifecycleRegistration = await navigator.serviceWorker.getRegistration(location.href);
      await lifecycleRegistration.update();
    })()`);
    await until("!!lifecycleRegistration.waiting && lifecycleRegistration.waiting.state === 'installed'");
    assert.equal(shellAssetRequests, beforeReinstallRequests, 'Same-release installation must not fetch healthy assets');
    assert.equal(await evaluate(`(async () => {
      const channel = new MessageChannel();
      const status = new Promise(resolve => { channel.port1.onmessage = event => { channel.port1.close(); resolve(event.data); }; });
      lifecycleRegistration.waiting.postMessage('offline-shell-status', [channel.port2]);
      const result = await status;
      return result.ready && result.version === SPIKE_SHELL_VERSION;
    })()`), true);
    assert.equal(await evaluate("(async () => (await fetch('./index.html')).status)()"), 200);
    // A genuinely different release must fail with unavailable assets and leave the active shell usable.
    workerVariant = 'replacement';
    await evaluate(`(async () => {
      lifecycleRegistration.addEventListener('updatefound', () => {
        window.failedInstaller = lifecycleRegistration.installing;
      }, { once: true });
      await lifecycleRegistration.update();
    })()`);
    await until("!!window.failedInstaller && failedInstaller.state === 'redundant'");
    assert.equal(await evaluate("(async () => (await fetch('./index.html')).status)()"), 200);
    assert.equal(await evaluate("(async () => (await caches.keys()).includes(" + JSON.stringify(report.caches[0]) + "))()"), true);
    rejectShellAssets = false;
    workerVariant = '';
    await cdp('Network.enable');
    await cdp('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    // Fresh document after leaving the app: no warm JS state or HTTP disk cache.
    await cdp('Page.navigate', { url: 'about:blank' });
    const offline = await cdp('Page.navigate', { url: spike });
    assert(!offline.errorText, offline.errorText);
    await until("!!window.SPIKE_SHELL_VERSION && !!document.getElementById('run') && !document.getElementById('run').disabled");
    assert.equal(await evaluate('SPIKE_SHELL_VERSION'), report.version);
    for (const locale of ['cs', 'en']) {
      await evaluate(`document.getElementById('language').value = '${locale}'; document.getElementById('language').dispatchEvent(new Event('change'))`);
      assert.equal(await evaluate('document.documentElement.lang'), locale);
      assert.equal(await evaluate("document.getElementById('offline').textContent === PUSH_CATALOGS[document.documentElement.lang].offline.ready"), true);
      await evaluate("document.getElementById('run').click()");
      await until("document.getElementById('status').textContent === PUSH_CATALOGS[document.documentElement.lang].status.failed");
    }
    // A reload must discard prior result and still render the verified shell.
    await cdp('Page.reload', { ignoreCache: true });
    await until("!!window.SPIKE_SHELL_VERSION && !!document.getElementById('run') && !document.getElementById('run').disabled");
    assert.equal(await evaluate("document.getElementById('status').textContent === PUSH_CATALOGS[document.documentElement.lang].status.ready"), true);
    assert.equal(await evaluate(`(async () => {
      try { await fetch(SPIKE_ORIGIN + '/spike/v1/challenge', { cache: 'no-store', credentials: 'omit' }); return false; }
      catch (_) { return true; }
    })()`), true);
    const entries = await evaluate(`(async () => (await (await caches.open((await caches.keys()).find(name => name.endsWith(SPIKE_SHELL_VERSION)))).keys()).map(r => r.url).sort())()`);
    assert.equal(entries.length, 9);
    assert(entries.every(url => url.startsWith(spike) && !url.includes('/spike/v1/')));
    // Storage eviction/incomplete shell must fail closed, rather than render partial success.
    await evaluate(`(async () => { const cache = await caches.open((await caches.keys()).find(name => name.endsWith(SPIKE_SHELL_VERSION))); await cache.delete(new URL('catalogs.js', location.href).href); })()`);
    const incomplete = await cdp('Page.navigate', { url: spike });
    assert(incomplete.errorText, 'Incomplete offline shell must fail navigation');
    const rootOffline = await cdp('Page.navigate', { url: target });
    assert(rootOffline.errorText, 'Original root PWA must retain offline navigation failure');
    console.log('PASS: desktop Chromium simulation: root/spike scopes, native same-release reinstall and failed replacement preserve shell, verified shell, fresh-document offline launch/reload, EN/CS, unreachable API failure, exact cache, missing-asset failure and unchanged root offline behavior. Physical phones NOT TESTED.');
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
})().catch(error => { console.error(error); process.exitCode = 1; });
