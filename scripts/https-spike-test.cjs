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
async function scenario(failAt = -1, secure = true, shell = 'ready', exercise, registerFails = false) {
  const elements = new Map();
  function node() { return { textContent: '', disabled: false, value: '', dataset: {}, handlers: {},
    addEventListener(event, handler) { this.handlers[event] = handler; }, appendChild() {} }; }
  for (const id of ['language', 'run', 'status', 'mode', 'endpoint', 'offline', 'diagnostics', 'recheck']) elements.set(id, node());
  const calls = [], saved = {}, events = {};
  const replies = [[200, 'challenge'], [401, 'unauthorized'], [400, 'malformed_body'],
    [200, 'synthetic_enrolled'], [409, 'replay']];
  const document = { documentElement: {}, hidden: false, getElementById: id => elements.get(id),
    createElement: node, querySelectorAll: () => [], addEventListener: (name, fn) => { events[name] = fn; } };
  const workerEvents = {}, registrationEvents = {};
  const version = 'v1-' + 'a'.repeat(64);
  const worker = { state: 'activated', addEventListener: (name, fn) => { workerEvents[name] = fn; }, scriptURL: 'https://app.example.test/https-spike/sw.js',
    postMessage(message, ports) { ports[0].postMessage({ ready: shell !== 'incomplete', version: shell === 'obsolete' ? 'v1-old' : version }); } };
  const registration = { scope: 'https://app.example.test/https-spike/', active: worker,
    addEventListener: (name, fn) => { registrationEvents[name] = fn; } };
  const context = { document, navigator: { languages: ['cs-CZ'], standalone: true,
    serviceWorker: { controller: shell === 'root' ? { ...worker, scriptURL: 'https://app.example.test/sw.js' } : worker, addEventListener: (name, fn) => { events[name] = fn; }, getRegistration: async () => registration,
      register: async () => { if (registerFails) throw new Error('Offline'); return registration; } } },
    location: { href: 'https://app.example.test/https-spike/' }, URL, MessageChannel,
    SPIKE_SHELL_VERSION: version,
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
  const diagnostics = () => JSON.parse(elements.get('diagnostics').textContent);
  assert.deepEqual(Object.keys(diagnostics()).sort(), ['context', 'controller', 'controllerState', 'active',
    'waiting', 'installing', 'expectedVersion', 'registration', 'reason', 'workerVersion', 'cache'].sort());
  if (exercise) await exercise({ elements, context, worker, workerEvents, registration, registrationEvents, events, diagnostics, version });
}
(async () => {
  await scenario();
  for (let index = 0; index < 5; index++) await scenario(index);
  await scenario(-1, false);
  for (const shell of ['incomplete', 'obsolete', 'root']) await scenario(-1, true, shell);
  const settle = () => new Promise(resolve => setTimeout(resolve, 30));
  await scenario(-1, true, 'ready', async ({ elements, context, worker, registration, registrationEvents, events, diagnostics, version }) => {
    // Temporary missing controller is distinct from corrupt storage; takeover recovers.
    context.navigator.serviceWorker.controller = null;
    await events.controllerchange();
    assert.equal(diagnostics().reason, 'controller_missing');
    assert.equal(diagnostics().cache, 'unknown');
    assert.equal(elements.get('run').disabled, true);
    context.navigator.serviceWorker.controller = worker;
    await events.controllerchange();
    assert.equal(diagnostics().reason, 'verified');
    // Waiting and a failed replacement must not poison a healthy controller.
    registration.waiting = { state: 'installed', addEventListener() {} };
    registrationEvents.updatefound(); await settle();
    assert.equal(diagnostics().waiting, 'installed');
    assert.equal(diagnostics().reason, 'verified');
    const candidateEvents = {};
    const candidate = { state: 'installing', addEventListener: (name, fn) => { candidateEvents[name] = fn; } };
    registration.installing = candidate;
    registrationEvents.updatefound(); await settle();
    candidate.state = 'redundant'; registration.installing = null;
    candidateEvents.statechange(); await settle();
    assert.equal(elements.get('run').disabled, false);
    // Out-of-order verification: the stale failure arrives after the fresh success.
    const pending = [];
    worker.postMessage = (_, ports) => pending.push(ports[0]);
    elements.get('recheck').handlers.click();
    const newer = events.controllerchange();
    pending[1].postMessage({ ready: true, version }); await newer;
    pending[0].postMessage({ ready: false, version, reason: 'cache_missing' }); await settle();
    assert.equal(diagnostics().reason, 'verified');
    assert.equal(elements.get('run').disabled, false);
    // A matching complete cache is insufficient if the app expects another release.
    worker.postMessage = (_, ports) => ports[0].postMessage({ ready: true, version: 'v1-' + 'b'.repeat(64) });
    await events.controllerchange();
    assert.equal(diagnostics().reason, 'release_mismatch');
    assert.equal(diagnostics().cache, 'complete');
    assert.equal(elements.get('run').disabled, true);
    // Error text and arbitrary fields are never reflected in diagnostics.
    worker.postMessage = (_, ports) => ports[0].postMessage({ ready: false, version: 'private-marker', reason: 'private-marker', secret: 'private-marker' });
    await events.controllerchange();
    assert(!elements.get('diagnostics').textContent.includes('private-marker'));
    worker.postMessage = () => { throw new Error('private-marker'); };
    await events.controllerchange();
    assert.equal(diagnostics().reason, 'worker_message_failed');
    worker.postMessage = (_, ports) => ports[0].postMessage({ ready: false, version, reason: 'asset_invalid' });
    await events.controllerchange();
    assert.equal(diagnostics().reason, 'asset_invalid');
    // A stopped/unresponsive worker is not diagnosed as cache corruption.
    context.setTimeout = (fn, ms) => setTimeout(fn, ms === 5000 ? 10 : ms);
    worker.postMessage = () => {};
    await events.controllerchange();
    assert.equal(diagnostics().reason, 'worker_timeout');
    assert.equal(diagnostics().cache, 'unknown');
  });
  await scenario(-1, true, 'ready', async ({ diagnostics, elements }) => {
    assert.equal(diagnostics().registration, 'failed');
    assert.equal(diagnostics().reason, 'verified');
    assert.equal(elements.get('run').disabled, false);
  }, true);
  console.log('PASS: synthetic lifecycle takeover/waiting/failed registration, stale reply, timeout, sanitized diagnostics, browser sequence, CS/EN, replay, authorization, double tap, fail closed and storage boundary');
})().catch(error => { console.error(error); process.exitCode = 1; });
