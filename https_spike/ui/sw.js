/* Static HTTPS spike shell only. Never handle device/API requests. */
'use strict';
const RELEASE = null /* OFFLINE_RELEASE */;
const BASE = new URL('./', self.location.href);
const PREFIX = 'https-spike-shell:' + BASE.href + ':';
const CACHE = PREFIX + RELEASE.version;
const ASSETS = new Map(RELEASE.assets.map(asset => [new URL(asset.path, BASE).href, asset.sha256]));

async function valid(response, digest) {
  if (!response || response.status !== 200 || response.redirected || response.type === 'opaque') return false;
  const bytes = await response.clone().arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('') === digest;
}
async function complete() {
  if (!await caches.has(CACHE)) throw new Error('cache_missing');
  const cache = await caches.open(CACHE);
  const entries = await cache.keys();
  if (entries.length !== ASSETS.size) throw new Error('entry_count_mismatch');
  for (const [url, digest] of ASSETS) {
    const response = await cache.match(url);
    if (!response) throw new Error('asset_missing');
    if (!await valid(response, digest)) throw new Error('asset_invalid');
  }
  return cache;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // CacheStorage outlives registrations. Never delete or rewrite a verified
    // same-release entry: an older worker may still be serving it.
    const cache = await caches.open(CACHE);
    for (const [url, digest] of ASSETS) {
      if (await valid(await cache.match(url), digest)) continue;
      const response = await fetch(url, { cache: 'no-store', credentials: 'omit', redirect: 'error' });
      if (!await valid(response, digest)) throw new Error('Invalid shell asset');
      await cache.put(url, response);
    }
    // Failed/interrupted installs may leave verified entries for a later retry.
    // No reader serves this release unless the entire exact shell validates.
    await complete();
    // Normal waiting lifecycle avoids replacing a release underneath open clients.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await complete();
    await self.clients.claim();
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
  })());
});
self.addEventListener('message', event => {
  if (event.data !== 'offline-shell-status' || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      await complete();
      event.ports[0].postMessage({ version: RELEASE.version, ready: true, reason: 'verified' });
    } catch (error) {
      const reason = ['cache_missing', 'entry_count_mismatch', 'asset_missing', 'asset_invalid'].includes(error.message)
        ? error.message : 'verification_error';
      event.ports[0].postMessage({ version: RELEASE.version, ready: false, reason });
    }
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Do not call respondWith/waitUntil/fetch for any API, foreign origin,
  // mutation, query string, sibling/root path or unknown static resource.
  if (request.method !== 'GET' || url.origin !== BASE.origin || url.search || url.hash) return;
  const key = url.href === BASE.href && request.mode === 'navigate'
    ? new URL('index.html', BASE).href : url.href;
  if (!ASSETS.has(key)) return;
  event.respondWith((async () => {
    try { return await (await complete()).match(key); }
    catch (_) { return Response.error(); }
  })());
});
