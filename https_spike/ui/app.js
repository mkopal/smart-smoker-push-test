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
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function render() {
    document.documentElement.lang = i18n.locale;
    document.title = i18n.t('app.title');
    document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = i18n.t(node.dataset.i18n); });
    language.value = i18n.locale;
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
    if (controller) return;
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
      element('run').disabled = !isSecureContext;
      render();
    }
  });
  addEventListener('pagehide', () => { if (controller) controller.abort(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && controller) controller.abort(); });
  if (!isSecureContext) status = 'unavailable';
  element('run').disabled = !isSecureContext;
  if (isSecureContext && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      status = 'unavailable'; element('run').disabled = true; render();
    });
  }
  render();
})();
