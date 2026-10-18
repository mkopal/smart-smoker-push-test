/* Synthetic HTTPS transport only. No Push API, owner keys or production input. */
(function () {
  'use strict';
  const element = id => document.getElementById(id);
  let storage;
  try { storage = localStorage; } catch (_) { storage = {}; }
  const i18n = SmokerI18n.create(PUSH_CATALOGS, storage, navigator.languages);
  const language = element('language');
  for (const locale of Object.keys(PUSH_CATALOGS)) {
    const option = document.createElement('option');
    option.value = locale;
    try { option.textContent = new Intl.DisplayNames([locale], { type: 'language' }).of(locale); }
    catch (_) { option.textContent = locale; }
    language.appendChild(option);
  }
  let status = 'ready', controller;
  let shellStatus = 'caching', shellReady = false;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function render() {
    document.documentElement.lang = i18n.locale;
    document.title = i18n.t('app.title');
    document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = i18n.t(node.dataset.i18n); });
    language.value = i18n.locale;
    element('offline').textContent = i18n.t('offline.' + shellStatus);
    element('status').textContent = i18n.t('status.' + status);
    element('mode').textContent = i18n.t(standalone ? 'app.standalone' : 'app.tab');
  }
  language.addEventListener('change', () => { i18n.change(language.value); render(); });
  element('endpoint').textContent = SPIKE_ORIGIN;
  async function request(path, options = {}) {
    const response = await fetch(SPIKE_ORIGIN + '/spike/v1/' + path, {
      ...options, mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'error',
      referrerPolicy: 'no-referrer', signal: controller.signal
    });
    const body = await response.json();
    if (body.version !== 1 || body.synthetic !== true) throw new Error('Unexpected protocol');
    return { status: response.status, body };
  }
  element('run').addEventListener('click', async () => {
    if (controller || !shellReady) return;
    controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    element('run').disabled = true;
    status = 'running'; render();
    try {
      const challenge = await request('challenge');
      if (challenge.status !== 200 || challenge.body.code !== 'challenge'
          || !/^[a-f0-9]{32}$/.test(challenge.body.challenge)
          || challenge.body.deviceId !== 'synthetic-smoker') throw new Error('Invalid challenge');
      const options = { method: 'POST', headers: { 'Content-Type': 'application/json',
        'X-Spike-Authorization': 'synthetic-spike-only' }, body: JSON.stringify({
        challenge: challenge.body.challenge, deviceId: 'synthetic-smoker', recipient: 'synthetic-recipient' }) };
      const unauthorized = await request('enroll', { ...options, headers: { 'Content-Type': 'application/json' } });
      if (unauthorized.status !== 401 || unauthorized.body.code !== 'unauthorized') throw new Error('Authorization failure');
      const malformed = await request('enroll', { ...options, body: '{}' });
      if (malformed.status !== 400 || malformed.body.code !== 'malformed_body') throw new Error('Schema failure');
      const enrolled = await request('enroll', options);
      if (enrolled.status !== 200 || enrolled.body.code !== 'synthetic_enrolled') throw new Error('Enrollment failed');
      const replay = await request('enroll', options);
      if (replay.status !== 409 || replay.body.code !== 'replay') throw new Error('Replay failure');
      status = 'passed';
    } catch (_) {
      status = 'failed'; // TLS, DNS, CORS and permissions are intentionally not guessed.
    } finally {
      clearTimeout(timer); controller = null;
      element('run').disabled = !isSecureContext || !shellReady || !!controller;
      render();
    }
  });
  addEventListener('pagehide', () => { if (controller) controller.abort(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && controller) controller.abort(); });
  if (!isSecureContext) status = 'unavailable';
  element('run').disabled = !isSecureContext || !shellReady || !!controller;
  async function checkShell() {
    shellReady = false;
    shellStatus = 'caching';
    element('run').disabled = true;
    try {
      const worker = navigator.serviceWorker.controller;
      if (!worker || worker.scriptURL !== new URL('./sw.js', location.href).href) {
        shellStatus = 'reload';
      } else {
        const result = await new Promise((resolve, reject) => {
          const channel = new MessageChannel();
          const timeout = setTimeout(() => { channel.port1.close(); reject(new Error('Worker timeout')); }, 5000);
          channel.port1.onmessage = event => {
            clearTimeout(timeout); channel.port1.close(); resolve(event.data);
          };
          worker.postMessage('offline-shell-status', [channel.port2]);
        });
        shellReady = navigator.serviceWorker.controller === worker
          && result.ready === true && result.version === SPIKE_SHELL_VERSION;
        shellStatus = shellReady ? 'ready' : 'unavailable';
      }
    } catch (_) { shellStatus = 'unavailable'; }
    element('run').disabled = !isSecureContext || !shellReady || !!controller;
    render();
  }
  addEventListener('pageshow', () => {
    status = isSecureContext ? 'ready' : 'unavailable';
    if (isSecureContext && 'serviceWorker' in navigator) checkShell();
    render();
  });
  if (isSecureContext && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', checkShell);
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
      .then(async registration => {
        // Offline update failures must not hide a healthy already installed release.
        if (registration.active) await checkShell();
        else {
          const worker = registration.installing || registration.waiting;
          if (worker) worker.addEventListener('statechange', () => {
            if (worker.state === 'redundant') {
              shellStatus = 'unavailable'; render();
            }
          });
        }
      }).catch(() => {
        if (navigator.serviceWorker.controller) checkShell();
        else { shellStatus = 'unavailable'; element('run').disabled = true; render(); }
      });
    if (navigator.serviceWorker.controller) checkShell();
  } else shellStatus = 'unavailable';
  render();
})();
