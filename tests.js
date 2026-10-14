'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const publisher = require('./publisher.cjs');
const i18n = require('./web/i18n.js');
const catalogs = Object.fromEntries(fs.readdirSync(path.join(__dirname, 'web/locales')).filter(name => name.endsWith('.json'))
  .map(name => [name.slice(0, -5), JSON.parse(fs.readFileSync(path.join(__dirname, 'web/locales', name)))]));
const ec = crypto.createECDH('prime256v1'); ec.generateKeys();
const scalar = ec.getPrivateKey();
const config = { publicKey: ec.getPublicKey().toString('base64url'),
  privateKey: Buffer.concat([Buffer.alloc(32 - scalar.length), scalar]).toString('base64url'), subject: 'mailto:test@example.com' };
const enrollment = { version: 1, publicKey: config.publicKey, locale: 'cs', subscription: {
  endpoint: 'https://web.push.apple.com/synthetic-not-a-real-subscription', expirationTime: null,
  keys: { p256dh: ec.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') }
} };
const clone = value => JSON.parse(JSON.stringify(value));

async function publisherTests() {
  publisher.validate(enrollment, config.publicKey);
  for (const endpoint of ['http://web.push.apple.com/x', 'https://localhost/x', 'https://127.0.0.1/x',
    'https://web.push.apple.com.evil.example/x', 'https://user@web.push.apple.com/x',
    'https://web.push.apple.com:444/x', 'https://web.push.apple.com/x#fragment']) {
    const invalid = clone(enrollment); invalid.subscription.endpoint = endpoint;
    assert.throws(() => publisher.validate(invalid, config.publicKey));
  }
  for (const mutate of [x => { x.version = 2; }, x => { x.publicKey = 'bad'; },
    x => { x.subscription.keys.auth = 'bad'; }, x => { x.subscription.keys.p256dh = 'bad'; },
    x => { x.subscription.expirationTime = 1000; }, x => { x.subscription.endpoint = 'x'.repeat(2049); },
    x => { x.locale = '../../private'; }]) {
    const invalid = clone(enrollment); mutate(invalid);
    assert.throws(() => publisher.validate(invalid, config.publicKey, 1000));
  }
  for (const endpoint of ['https://fcm.googleapis.com/x', 'https://updates.push.services.mozilla.com/x']) {
    const valid = clone(enrollment); valid.subscription.endpoint = endpoint;
    publisher.validate(valid, config.publicKey);
  }
  let calls = 0;
  const result = await publisher.send({ sendNotification: async (sub, payload, options) => {
    calls++;
    assert.deepStrictEqual(sub, enrollment.subscription);
    const data = JSON.parse(payload);
    assert.strictEqual(data.locale, 'cs'); assert.strictEqual(data.sentAt, 1234);
    assert.match(data.id, /^[a-f0-9]{24}$/);
    assert.strictEqual(options.contentEncoding, 'aes128gcm'); assert.strictEqual(options.TTL, 60);
    assert.strictEqual(options.timeout, 10000); assert.strictEqual(options.urgency, 'high');
    assert.strictEqual(options.vapidDetails.privateKey, config.privateKey);
    return { statusCode: 201 };
  } }, enrollment, config, 1234);
  assert.strictEqual(result.code, 0); assert.match(result.message, /NOT confirmed/); assert.strictEqual(calls, 1);
  for (const [statusCode, code] of [[404, 3], [410, 3], [429, 4], [500, 4], [503, 4], [401, 5], [403, 5], [413, 1], [302, 1], [undefined, 1]]) {
    calls = 0;
    const outcome = await publisher.send({ sendNotification: async () => {
      calls++; throw { statusCode, body: config.privateKey, endpoint: enrollment.subscription.endpoint };
    } }, enrollment, config);
    assert.strictEqual(outcome.code, code); assert.strictEqual(calls, 1);
    assert(!outcome.message.includes(config.privateKey)); assert(!outcome.message.includes('synthetic-not'));
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smoker-push-'));
  try {
    const privatePath = path.join(directory, 'credentials.json');
    publisher.writePrivate(privatePath, config);
    assert.strictEqual(fs.statSync(privatePath).mode & 0o777, 0o600);
    assert.deepStrictEqual(publisher.readPrivate(privatePath), config);
    assert.throws(() => publisher.writePrivate(privatePath, config));
    fs.chmodSync(privatePath, 0o644); assert.throws(() => publisher.readPrivate(privatePath));
    fs.chmodSync(privatePath, 0o600);
    fs.symlinkSync(privatePath, path.join(directory, 'link')); assert.throws(() => publisher.readPrivate(path.join(directory, 'link')));
    publisher.writePrivate(path.join(directory, 'large'), 'x'.repeat(17000));
    assert.throws(() => publisher.readPrivate(path.join(directory, 'large')));
    publisher.writePrivate(path.join(directory, 'mismatch'), { ...config, publicKey: enrollment.subscription.keys.auth });
    assert.throws(() => publisher.credentials(publisher.readPrivate(path.join(directory, 'mismatch'))));
    assert.throws(() => publisher.credentials({ ...config, subject: 'http://example.com' }));
  } finally { fs.rmSync(directory, { recursive: true }); }
}
async function workerTests() {
  const handlers = {}, shown = [], opened = [];
  const scope = 'https://example.com/experiment/';
  const self = { addEventListener: (name, callback) => { handlers[name] = callback; },
    registration: { scope, showNotification: async (...args) => { shown.push(args); } },
    clients: { matchAll: async () => [], openWindow: async url => { opened.push(url); } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'web/sw.js'), 'utf8'), {
    self, importScripts() {}, SmokerI18n: i18n, PUSH_CATALOGS: catalogs, Intl
  });
  async function push(data) { let pending; handlers.push({ data, waitUntil: promise => { pending = promise; } }); await pending; return shown[shown.length - 1]; }
  for (const locale of Object.keys(catalogs)) {
    const notification = await push({ json: () => ({ event: 'test', id: 'a'.repeat(24), sentAt: 1000, locale }) });
    assert.strictEqual(notification[0], catalogs[locale].notification.title);
    assert(notification[1].body.includes('a'.repeat(24)));
  }
  for (const data of [null, { json: () => null }, { json: () => { throw new Error(); } },
    { json: () => ({ title: '<script>', url: 'https://evil.example/' }) },
    { json: () => ({ event: 'test', id: 'a'.repeat(24), sentAt: 1e100 }) }]) {
    const notification = await push(data);
    assert.strictEqual(notification[1].body, catalogs.en.notification.fallback);
  }
  let pending, closed = false;
  handlers.notificationclick({ notification: { close() { closed = true; } }, waitUntil: value => { pending = value; } });
  await pending; assert(closed); assert.deepStrictEqual(opened, [scope]);
  let focused = false;
  self.clients.matchAll = async () => [{ url: scope, focus: async () => { focused = true; } }];
  handlers.notificationclick({ notification: { close() {} }, waitUntil: value => { pending = value; } });
  await pending; assert(focused); assert.strictEqual(opened.length, 1);
}
async function appTests() {
  function fixture({ supported = true, permission = 'granted', existing = null, failure = false } = {}) {
    const nodes = Object.fromEntries(['language', 'key', 'status', 'output', 'subscribe', 'export', 'unsubscribe'].map(id => [id, {
      value: '', disabled: true, append() {}
    }]));
    let current = existing, requests = 0, subscriptions = 0;
    const registration = { pushManager: {
      getSubscription: async () => current,
      subscribe: async options => {
        subscriptions++;
        assert.strictEqual(options.userVisibleOnly, true);
        current = { options, toJSON: () => enrollment.subscription, unsubscribe: async () => { current = null; return true; } };
        return current;
      }
    } };
    const context = { SmokerI18n: i18n, PUSH_CATALOGS: catalogs, Uint8Array, Intl,
      isSecureContext: supported, window: { PushManager: {}, Notification: {} }, localStorage: null,
      navigator: { languages: ['cs-CZ'], serviceWorker: {
        register: async () => { if (failure) throw new Error(); }, ready: Promise.resolve(registration)
      } }, Notification: { requestPermission: async () => { requests++; return permission; } },
      document: { title: '', documentElement: {}, getElementById: id => nodes[id],
        querySelectorAll: () => [], createElement: () => ({}) },
      atob: value => Buffer.from(value, 'base64').toString('binary'),
      btoa: value => Buffer.from(value, 'binary').toString('base64') };
    const ready = vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'web/app.js'), 'utf8'), context);
    return { nodes, ready, requests: () => requests, subscriptions: () => subscriptions };
  }
  const app = fixture(); await app.ready;
  assert.strictEqual(app.requests(), 0); assert.strictEqual(app.nodes.subscribe.disabled, false);
  app.nodes.key.value = config.publicKey; await app.nodes.subscribe.onclick();
  assert.strictEqual(app.requests(), 1); assert.strictEqual(app.subscriptions(), 1);
  await app.nodes.export.onclick();
  const exported = JSON.parse(app.nodes.output.value);
  assert.strictEqual(exported.publicKey, config.publicKey); assert.strictEqual(exported.locale, 'cs');
  publisher.validate(exported, config.publicKey);
  app.nodes.language.value = 'en'; app.nodes.language.onchange(); assert.strictEqual(app.nodes.output.value, '');
  await app.nodes.export.onclick(); assert.strictEqual(JSON.parse(app.nodes.output.value).locale, 'en');
  await app.nodes.unsubscribe.onclick(); assert.strictEqual(app.nodes.export.disabled, true);
  assert.strictEqual(app.nodes.output.value, '');
  const denied = fixture({ permission: 'denied' }); await denied.ready;
  denied.nodes.key.value = config.publicKey; await denied.nodes.subscribe.onclick();
  assert.strictEqual(denied.subscriptions(), 0); assert.strictEqual(denied.nodes.subscribe.disabled, false);
  const invalid = fixture(); await invalid.ready; invalid.nodes.key.value = 'private-key'; await invalid.nodes.subscribe.onclick();
  assert.strictEqual(invalid.requests(), 0);
  for (const options of [{ supported: false }, { failure: true }]) {
    const broken = fixture(options); await broken.ready; assert.strictEqual(broken.nodes.subscribe.disabled, true);
  }
  const stored = fixture({ existing: { options: {} } }); await stored.ready;
  assert.strictEqual(stored.nodes.subscribe.disabled, true); assert.strictEqual(stored.nodes.export.disabled, false);
  const fallback = i18n.create({ ...catalogs, de: {} }, null, ['de']);
  assert.strictEqual(fallback.t('notification.title'), catalogs.en.notification.title);
}
(async () => { await publisherTests(); await workerTests(); await appTests(); console.log('PASS: publisher, enrollment, localization and service-worker behavior (no network)'); })()
  .catch(error => { console.error(error); process.exitCode = 1; });
