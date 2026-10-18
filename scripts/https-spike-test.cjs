'use strict';
// Deterministic browser API mocks; no network, permission request or subscription.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const i18n = require('../web/i18n.js');
const source = fs.readFileSync('https_spike/ui/app.js', 'utf8');
const catalogs = Object.fromEntries(fs.readdirSync('https_spike/ui/locales').map(file =>
  [file.replace('.json', ''), JSON.parse(fs.readFileSync('https_spike/ui/locales/' + file))]));
const nonce = 'a'.repeat(32);
async function scenario(failAt = -1, secure = true, shell = 'ready') {
  const elements = new Map();
  function node() { return { textContent: '', disabled: false, value: '', dataset: {}, handlers: {},
    addEventListener(event, handler) { this.handlers[event] = handler; }, appendChild() {} }; }
  for (const id of ['language', 'run', 'status', 'mode', 'endpoint', 'offline']) elements.set(id, node());
  const calls = [], saved = {}, events = {};
  const replies = [[200, 'challenge'], [401, 'unauthorized'], [400, 'malformed_body'],
    [200, 'synthetic_enrolled'], [409, 'replay']];
  const document = { documentElement: {}, hidden: false, getElementById: id => elements.get(id),
    createElement: node, querySelectorAll: () => [], addEventListener: (name, fn) => { events[name] = fn; } };
  const worker = { scriptURL: 'https://app.example.test/https-spike/sw.js',
    postMessage(message, ports) { ports[0].postMessage({ ready: shell !== 'incomplete', version: shell === 'obsolete' ? 'v1-old' : 'v1-test' }); } };
  const context = { document, navigator: { languages: ['cs-CZ'], standalone: true,
    serviceWorker: { controller: shell === 'root' ? { ...worker, scriptURL: 'https://app.example.test/sw.js' } : worker, addEventListener() {}, register: async () => ({ active: worker }) } },
    location: { href: 'https://app.example.test/https-spike/' }, URL, MessageChannel,
    SPIKE_SHELL_VERSION: 'v1-test',
    SmokerI18n: i18n, PUSH_CATALOGS: catalogs, SPIKE_ORIGIN: 'https://device.example.test:8443',
    localStorage: { getItem: () => null, setItem: (key, value) => { saved[key] = value; } },
    matchMedia: () => ({ matches: true }), isSecureContext: secure,
    addEventListener: (name, fn) => { events[name] = fn; }, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      const index = calls.length;
      calls.push({ url, options });
      if (index === failAt) throw new TypeError('Synthetic network or TLS failure');
      const [status, code] = replies[index];
      return { status, json: async () => ({ version: 1, synthetic: true, code,
        challenge: nonce, deviceId: 'synthetic-smoker' }) };
    }
  };
  vm.runInNewContext(source, context);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(document.documentElement.lang, 'cs');
  assert.equal(elements.get('run').disabled, !secure || shell !== 'ready');
  if (secure && shell === 'ready') {
    const pending = elements.get('run').handlers.click();
    await elements.get('run').handlers.click(); // Double tap cannot send a parallel sequence.
    await pending;
    assert.equal(elements.get('status').textContent, catalogs.cs.status[failAt < 0 ? 'passed' : 'failed']);
    assert.equal(calls.length, failAt < 0 ? 5 : failAt + 1);
    for (const call of calls) {
      assert(call.url.startsWith(context.SPIKE_ORIGIN + '/spike/v1/'));
      assert.equal(call.options.credentials, 'omit');
      assert.equal(call.options.redirect, 'error');
      assert.equal(call.options.cache, 'no-store');
      assert.equal(call.options.mode, 'cors');
    }
    if (failAt < 0) {
      assert.equal(calls[1].options.headers['X-Spike-Authorization'], undefined);
      assert.equal(calls[3].options.body, calls[4].options.body);
      assert.deepEqual(JSON.parse(calls[3].options.body), {
        challenge: nonce, deviceId: 'synthetic-smoker', recipient: 'synthetic-recipient' });
    }
  } else {
    await elements.get('run').handlers.click();
    assert.equal(calls.length, 0);
  }
  assert.deepEqual(saved, {});
  elements.get('language').value = 'en'; elements.get('language').handlers.change();
  assert.equal(document.documentElement.lang, 'en');
  assert.deepEqual(saved, { 'smart-smoker-language': 'en' });
}
(async () => {
  await scenario();
  for (let index = 0; index < 5; index++) await scenario(index);
  await scenario(-1, false);
  for (const shell of ['incomplete', 'obsolete', 'root']) await scenario(-1, true, shell);
  console.log('PASS: synthetic browser sequence, CS/EN, replay, authorization, double tap, fail closed and storage boundary');
})().catch(error => { console.error(error); process.exitCode = 1; });
