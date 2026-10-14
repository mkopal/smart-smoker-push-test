'use strict';
const fs = require('fs');
const crypto = require('crypto');

function key(value, bytes) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) ||
      Buffer.from(value, 'base64url').length !== bytes ||
      Buffer.from(value, 'base64url').toString('base64url') !== value) throw new Error('Invalid key');
  return value;
}
function publicKey(value) {
  key(value, 65);
  if (Buffer.from(value, 'base64url')[0] !== 4) throw new Error('Uncompressed public key required');
  crypto.ECDH.convertKey(Buffer.from(value, 'base64url'), 'prime256v1');
  return value;
}
function validate(enrollment, expectedKey, now = Date.now()) {
  if (!enrollment || enrollment.version !== 1 || enrollment.publicKey !== expectedKey) throw new Error('Key mismatch');
  publicKey(expectedKey);
  if (typeof enrollment.locale !== 'string' || !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(enrollment.locale)) throw new Error('Invalid locale');
  const sub = enrollment.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || sub.endpoint.length > 2048) throw new Error('Invalid endpoint');
  const url = new URL(sub.endpoint);
  const host = url.hostname;
  const allowed = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' ||
    host === 'web.push.apple.com' || host.endsWith('.push.apple.com');
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !allowed) throw new Error('Unsupported endpoint');
  if (sub.expirationTime !== null && sub.expirationTime !== undefined &&
      (!Number.isFinite(sub.expirationTime) || sub.expirationTime <= now)) throw new Error('Expired subscription');
  if (!sub.keys) throw new Error('Missing encryption keys');
  publicKey(sub.keys.p256dh);
  key(sub.keys.auth, 16);
  return { endpoint: sub.endpoint, expirationTime: sub.expirationTime || null,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } };
}
function readPrivate(path) {
  const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > 16384 || (stat.mode & 0o077)) throw new Error('Private file requires mode 0600');
    return JSON.parse(fs.readFileSync(fd, 'utf8'));
  } finally { fs.closeSync(fd); }
}
function writePrivate(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
function credentials(value) {
  publicKey(value.publicKey);
  key(value.privateKey, 32);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(value.privateKey, 'base64url'));
  if (ecdh.getPublicKey().toString('base64url') !== value.publicKey) throw new Error('Invalid key pair');
  const contact = new URL(value.subject);
  if (!['mailto:', 'https:'].includes(contact.protocol) || !contact.pathname ||
      (contact.protocol === 'https:' && (contact.hostname === 'localhost' || contact.username || contact.password))) throw new Error('Invalid contact');
  return value;
}
function classify(status) {
  if (status === 404 || status === 410) return { code: 3, message: 'Subscription invalid: remove private export and enroll again.' };
  if (status === 429 || status >= 500 && status <= 599) return { code: 4, message: 'Temporary failure: inspect Retry-After privately; retry manually within event lifetime.' };
  if (status === 401 || status === 403) return { code: 5, message: 'Authentication rejected: check VAPID key, contact and system clock.' };
  return { code: 1, message: 'Send failed; private endpoint and response body suppressed.' };
}
async function send(api, enrollment, config, now = Date.now()) {
  credentials(config);
  const subscription = validate(enrollment, config.publicKey, now);
  const payload = JSON.stringify({ event: 'test', id: crypto.randomBytes(12).toString('hex'),
    sentAt: now, locale: enrollment.locale });
  try {
    const result = await api.sendNotification(subscription, payload, {
      vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
      contentEncoding: 'aes128gcm', TTL: 60, urgency: 'high', timeout: 10000
    });
    if (result.statusCode !== 201) return classify(result.statusCode);
    return { code: 0, message: 'Push service accepted (201). Phone delivery is NOT confirmed.' };
  } catch (error) { return classify(error.statusCode); }
}
async function main(args) {
  const [command, path, argument] = args;
  if (command === 'init' && args.length === 3) {
    const api = await import('web-push');
    const config = credentials({ ...api.default.generateVAPIDKeys(), subject: argument });
    writePrivate(path, config);
    console.log('Development credentials saved privately. Export only the public key.');
    return 0;
  }
  if (command === 'public' && args.length === 2) {
    console.log(credentials(readPrivate(path)).publicKey);
    return 0;
  }
  if (command === 'send' && args.length === 3) {
    const config = credentials(readPrivate(path));
    const enrollment = readPrivate(argument);
    validate(enrollment, config.publicKey);
    const api = await import('web-push');
    const result = await send(api.default, enrollment, config);
    console.log(result.message);
    return result.code;
  }
  throw new Error('Invalid arguments');
}
module.exports = { key, publicKey, validate, readPrivate, writePrivate, credentials, classify, send, main };
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(() => {
  console.error('Publisher failed. Check README, private file permissions, arguments and development dependencies. Values suppressed.');
  process.exitCode = 1;
});
