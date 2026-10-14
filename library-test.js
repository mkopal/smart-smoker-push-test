'use strict';
// Offline protocol test of the actual pinned library, never a phone-delivery claim.
const assert = require('assert');
const crypto = require('crypto');
const ece = require('http_ece');
const publisher = require('./publisher.cjs');
const fs = require('fs');
const os = require('os');
const path = require('path');
const child = require('child_process');
(async () => {
  const { default: webpush } = await import('web-push');
  const keys = webpush.generateVAPIDKeys();
  const receiver = crypto.createECDH('prime256v1'); receiver.generateKeys();
  const auth = crypto.randomBytes(16);
  const sub = { endpoint: 'https://web.push.apple.com/synthetic-offline-only', keys: {
    p256dh: receiver.getPublicKey().toString('base64url'), auth: auth.toString('base64url')
  } };
  const payload = JSON.stringify({ event: 'test', id: 'a'.repeat(24), locale: 'cs', sentAt: 1000 });
  const details = webpush.generateRequestDetails(sub, payload, {
    vapidDetails: { ...keys, subject: 'mailto:test@example.com' }, contentEncoding: 'aes128gcm', TTL: 60
  });
  assert.strictEqual(details.method, 'POST');
  assert.strictEqual(details.headers['Content-Encoding'], 'aes128gcm');
  assert.strictEqual(String(details.headers.TTL), '60');
  assert.strictEqual(details.endpoint, sub.endpoint);
  const decrypted = ece.decrypt(details.body, { version: 'aes128gcm', privateKey: receiver, authSecret: auth });
  assert.strictEqual(decrypted.toString(), payload);
  const token = details.headers.Authorization.match(/t=([^,\s]+)/)[1];
  const [header, claims, signature] = token.split('.');
  assert.strictEqual(JSON.parse(Buffer.from(header, 'base64url')).alg, 'ES256');
  const decoded = JSON.parse(Buffer.from(claims, 'base64url'));
  assert.strictEqual(decoded.aud, 'https://web.push.apple.com');
  assert.strictEqual(decoded.sub, 'mailto:test@example.com');
  assert(decoded.exp > Date.now() / 1000 && decoded.exp <= Date.now() / 1000 + 86400);
  const point = Buffer.from(keys.publicKey, 'base64url');
  const publicKey = crypto.createPublicKey({ format: 'jwk', key: {
    kty: 'EC', crv: 'P-256', x: point.subarray(1, 33).toString('base64url'), y: point.subarray(33).toString('base64url')
  } });
  assert(crypto.verify('sha256', Buffer.from(header + '.' + claims), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')));
  assert.throws(() => ece.decrypt(details.body, { version: 'aes128gcm', privateKey: receiver, authSecret: crypto.randomBytes(16) }));
  publisher.credentials({ ...keys, subject: 'mailto:test@example.com' });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smoker-push-cli-'));
  try {
    const keyPath = path.join(directory, 'vapid.json');
    const cli = (...args) => {
      const result = child.spawnSync(process.execPath, [path.join(__dirname, 'publisher.cjs'), ...args], { encoding: 'utf8' });
      assert.ifError(result.error);
      return result;
    };
    const init = cli('init', keyPath, 'mailto:test@example.com');
    assert.strictEqual(init.status, 0, init.stderr);
    const stored = publisher.readPrivate(keyPath);
    assert(!init.stdout.includes(stored.privateKey));
    assert.strictEqual(cli('public', keyPath).stdout.trim(), stored.publicKey);
    assert.strictEqual(cli('init', keyPath, 'mailto:test@example.com').status, 1);
    const file = path.join(directory, 'phone.json');
    publisher.writePrivate(file, { version: 1, publicKey: 'invalid' });
    const invalid = cli('send', keyPath, file);
    assert.strictEqual(invalid.status, 1);
    assert(!invalid.stdout.includes(stored.privateKey) && !invalid.stderr.includes(stored.privateKey));
  } finally { fs.rmSync(directory, { recursive: true }); }
  console.log('PASS: actual web-push encryption/decryption, payload authentication rejection, ES256 signature and private CLI lifecycle (offline only)');
})().catch(error => { console.error(error); process.exitCode = 1; });
