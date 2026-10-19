'use strict';
// Execute the generated worker with real Response and SHA-256; deterministic Cache API mock.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const site = process.argv[2];
const base = 'https://app.example.test/smart-smoker-push-test/https-spike/';
const code = fs.readFileSync(path.join(site, 'sw.js'), 'utf8');
const release = JSON.parse(code.match(/const RELEASE = (.*);/)[1]);
const stores = new Map();
const caches = {
  has: async name => stores.has(name),
  keys: async () => [...stores.keys()],
  delete: async name => { deletions.push(name); return stores.delete(name); },
  open: async name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const data = stores.get(name);
    return { put: async (key, value) => {
        if (failPut) throw new Error('Simulated quota failure');
        writes.push({ cache: name, key: String(key) });
        data.set(String(key), value.clone());
      },
      match: async key => data.get(String(key))?.clone(),
      keys: async () => [...data.keys()].map(url => ({ url })) };
  }
};
let offline = false, broken = '', requests = [], claimed = 0;
let pausedAsset = '', pausedReached = false, failClaim = false, failPut = false;
const writes = [], deletions = [];
function worker(source = code, scope = base) {
  const handlers = {};
  vm.runInNewContext(source, { URL, Response, crypto: webcrypto, caches,
    self: { location: { href: scope + 'sw.js' }, clients: { claim: async () => { if (failClaim) throw new Error('Claim failed'); claimed++; } },
      addEventListener: (name, fn) => { handlers[name] = fn; } },
    fetch: async (url, options) => {
      requests.push({ url, options });
      assert(url.startsWith(scope));
      if (offline) throw new TypeError('Offline');
      const name = url.slice(scope.length);
      if (pausedAsset === name) {
        pausedReached = true;
        await new Promise(() => {}); // Simulate termination: this installer never resumes.
      }
      if (broken === name) return new Response('wrong release');
      if (broken === '404:' + name) return new Response('', { status: 404 });
      if (broken === 'redirect:' + name) {
        const response = new Response(fs.readFileSync(path.join(site, name)));
        Object.defineProperty(response, 'redirected', { value: true });
        return response;
      }
      return new Response(fs.readFileSync(path.join(site, name)));
    }
  });
  return {
    async lifecycle(name) { let pending; handlers[name]({ waitUntil: promise => { pending = promise; } }); await pending; },
    async request(url, method = 'GET', mode = 'cors') {
      let response, waits = 0;
      handlers.fetch({ request: { url, method, mode }, respondWith: promise => { response = promise; },
        waitUntil: () => { waits++; } });
      return { intercepted: !!response, response: await response, waits };
    },
    async status() { let result, pending;
      handlers.message({ data: 'offline-shell-status', ports: [{ postMessage: data => { result = data; } }],
        waitUntil: promise => { pending = promise; } });
      await pending; return result;
    }
  };
}
(async () => {
  const active = worker();
  assert.match(release.version, /^v1-[a-f0-9]{64}$/);
  const expected = ['app.js', 'catalogs.js', 'config.js', 'i18n.js', 'icon-192.png',
    'icon-512.png', 'index.html', 'manifest.webmanifest', 'style.css'];
  assert.deepEqual(release.assets.map(asset => asset.path), expected);
  await caches.open('root-push-test');
  await caches.open('https-spike-shell:https://app.example.test/other/:v1-old');
  await active.lifecycle('install');
  await active.lifecycle('activate');
  assert.equal(claimed, 1);
  assert.equal(requests.length, 9);
  assert(requests.every(({ options }) => options.cache === 'no-store' && options.credentials === 'omit'
    && options.redirect === 'error'));
  const current = [...stores.keys()].find(key => key.endsWith(release.version));
  assert.equal((await active.status()).ready, true);
  assert.deepEqual(Object.keys(await active.status()).sort(), ['ready', 'reason', 'version']);
  assert.equal((await active.status()).reason, 'verified');
  offline = true; requests = [];
  for (const name of expected) {
    const result = await active.request(base + name);
    assert(result.intercepted);
    assert.deepEqual(Buffer.from(await result.response.arrayBuffer()), fs.readFileSync(path.join(site, name)));
  }
  assert.equal((await active.request(base, 'GET', 'navigate')).response.status, 200);
  // API stays on the browser network stack, even after a previously successful sequence.
  for (const method of ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE']) {
    for (const url of ['https://smoker-test.navodio.cz:8443/spike/v1/challenge',
      'https://smoker-test.navodio.cz:8443/spike/v1/enroll', base + 'spike/v1/challenge',
      base + 'spike/v1/enroll', base + 'unknown', base + 'app.js?secret=synthetic',
      base.replace('https-spike/', '') + 'app.js', 'https://foreign.example.test/app.js']) {
      const result = await active.request(url, method);
      assert.equal(result.intercepted, false, method + ' ' + url);
      assert.equal(result.waits, 0);
    }
  }
  assert.equal((await active.request(base + 'app.js', 'POST')).intercepted, false);
  assert.equal(requests.length, 0);
  // Missing, corrupt and extra assets invalidate the whole shell, including navigation.
  const data = stores.get(current);
  const original = data.get(base + 'catalogs.js');
  for (const fault of ['missing', 'corrupt', 'extra']) {
    if (fault === 'missing') data.delete(base + 'catalogs.js');
    if (fault === 'corrupt') data.set(base + 'catalogs.js', new Response('obsolete'));
    if (fault === 'extra') data.set(base + 'private-state', new Response('synthetic'));
    assert.equal((await active.status()).ready, false);
    assert.equal((await active.status()).version, release.version);
    assert.equal((await active.status()).reason, fault === 'corrupt' ? 'asset_invalid' : 'entry_count_mismatch');
    assert.equal((await active.request(base, 'GET', 'navigate')).response.type, 'error');
    data.set(base + 'catalogs.js', original);
    data.delete(base + 'private-state');
  }
  // Same count with an unexpected key still identifies a missing allowlisted asset.
  data.delete(base + 'catalogs.js'); data.set(base + 'unexpected', new Response('synthetic'));
  assert.equal((await active.status()).reason, 'asset_missing');
  data.delete(base + 'unexpected'); data.set(base + 'catalogs.js', original);
  const originalHas = caches.has;
  caches.has = async () => { throw new Error('private-marker'); };
  assert.equal((await active.status()).reason, 'verification_error');
  assert(!JSON.stringify(await active.status()).includes('private-marker'));
  caches.has = originalHas;
  // Same-release reinstall must work without network and without touching healthy entries.
  const cacheIdentity = stores.get(current);
  const originalResponses = new Map(cacheIdentity);
  const writesBefore = writes.length, deletionsBefore = deletions.length;
  const sameRelease = worker();
  await sameRelease.lifecycle('install');
  assert.equal(requests.length, 0);
  assert.equal(writes.length, writesBefore);
  assert.equal(deletions.length, deletionsBefore);
  assert.equal(stores.get(current), cacheIdentity);
  for (const [url, response] of originalResponses) assert.equal(cacheIdentity.get(url), response);
  assert.equal((await active.request(base, 'GET', 'navigate')).response.status, 200);

  // Terminate a replacement after one write: no catch/finally cleanup runs.
  const interruptedVersion = 'v1-interrupted';
  const interruptedCode = code.replaceAll(release.version, interruptedVersion);
  offline = false; pausedAsset = 'catalogs.js';
  const interrupted = worker(interruptedCode);
  void interrupted.lifecycle('install');
  while (!pausedReached) await new Promise(resolve => setImmediate(resolve));
  const interruptedCache = [...stores.keys()].find(key => key.endsWith(interruptedVersion));
  assert.equal(stores.get(interruptedCache).size, 1);
  assert.equal((await interrupted.status()).ready, false);
  assert.equal((await interrupted.request(base, 'GET', 'navigate')).response.type, 'error');
  assert.equal((await active.status()).ready, true);
  assert.equal((await active.request(base, 'GET', 'navigate')).response.status, 200);
  await assert.rejects(interrupted.lifecycle('activate'));
  assert(stores.has(current), 'Incomplete activation must preserve the last usable cache');
  // A fresh worker retries the same interrupted release, reusing the verified first entry.
  pausedAsset = ''; requests = [];
  const resumed = worker(interruptedCode);
  await resumed.lifecycle('install');
  assert.equal(requests.length, 8);
  assert.equal((await resumed.status()).ready, true);
  assert(stores.has(current), 'Verified install must not remove the active release');
  // Even a failure to claim clients leaves the previous complete cache intact.
  failClaim = true;
  await assert.rejects(resumed.lifecycle('activate'));
  failClaim = false;
  assert(stores.has(current));
  assert.equal((await active.status()).ready, true);

  // New explicit release: old remains until activation; only our own old cache is removed.
  const upgraded = worker(code.replaceAll(release.version, 'v1-' + 'f'.repeat(64)));
  offline = false;
  await upgraded.lifecycle('install');
  assert(stores.has(current));
  await upgraded.lifecycle('activate');
  assert(!stores.has(current));
  assert(stores.has('root-push-test'));
  assert(stores.has('https-spike-shell:https://app.example.test/other/:v1-old'));
  offline = true;
  assert.equal((await upgraded.request(base, 'GET', 'navigate')).response.status, 200);
  assert.equal((await active.request(base, 'GET', 'navigate')).response.type, 'error');
  assert(!stores.has(current), 'Obsolete worker must not recreate its deleted cache');
  assert.equal((await active.status()).reason, 'cache_missing');
  // Failed replacements may retain partial verified entries, but never serve them.
  for (const fault of ['catalogs.js', '404:config.js', 'redirect:index.html', 'offline', 'quota']) {
    offline = fault === 'offline'; broken = fault; failPut = fault === 'quota';
    const version = 'v1-' + Buffer.from(fault).toString('hex');
    const candidate = worker(code.replaceAll(release.version, version));
    await assert.rejects(candidate.lifecycle('install'));
    assert.equal((await candidate.status()).ready, false);
    assert.equal((await candidate.request(base, 'GET', 'navigate')).response.type, 'error');
    await assert.rejects(candidate.lifecycle('activate'));
    assert.equal((await upgraded.request(base, 'GET', 'navigate')).response.status, 200);
    assert.equal((await upgraded.status()).ready, true);
  }
  failPut = false;
  console.log('PASS: same-release reuse without writes/deletes/network, interrupted install/resume, failed replacement/activation/quota preserves last usable cache; exact precache, offline navigation/assets, integrity/completeness, failed install, upgrade/obsolete release, root/sibling isolation and API non-interception (VM simulation)');
})().catch(error => { console.error(error); process.exitCode = 1; });
