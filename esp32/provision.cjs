'use strict';
// Development-only build input. Never reads production ESPHome secrets.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const publisher = require('../publisher.cjs');
const ROOT = path.resolve(__dirname, '..');
function generate(config, enrollment, wifi, enabled) {
  publisher.credentials(config);
  const subscription = publisher.validate(enrollment, config.publicKey);
  if (subscription.expirationTime !== null && (!Number.isSafeInteger(subscription.expirationTime) ||
      subscription.expirationTime > 4102444800000)) throw Error('Unsupported expiration');
  const url = new URL(subscription.endpoint);
  const clean = value => typeof value === 'string' && /^[\x21-\x7e]+$/.test(value) && !/["\\]/.test(value);
  if (!clean(config.subject) || config.subject.length > 160 || url.origin.length > 128 ||
      url.href !== subscription.endpoint || !url.pathname.startsWith('/') ||
      /[^\x21-\x7e]/.test(subscription.endpoint) || /["\\]/.test(subscription.endpoint)) throw Error('Unsupported input');
  // Reject bytes that a C string or a Wi-Fi API could silently truncate.
  for (const [name, max, min] of [['ssid', 32, 1], ['password', 63, 8]]) {
    if (typeof wifi[name] !== 'string' || /[\x00-\x1f\x7f]/.test(wifi[name]) ||
        Buffer.byteLength(wifi[name]) < min || Buffer.byteLength(wifi[name]) > max) throw Error('Invalid Wi-Fi input');
  }
  const string = value => '"' + [...Buffer.from(value)].map(x => '\\' + x.toString(8).padStart(3, '0')).join('') + '"';
  const array = (name, value) => `static const uint8_t ${name}[] = {${[...Buffer.from(value, 'base64url')].join(',')}};\n`;
  return '#pragma once\n#include <stdint.h>\n' +
    `static const bool POC_SEND_ENABLED = ${enabled};\n` +
    ['ssid', 'password'].map(n => `static const char POC_WIFI_${n.toUpperCase()}[] = ${string(wifi[n])};\n`).join('') +
    `static const char POC_ENDPOINT[] = ${string(subscription.endpoint)};\n` +
    `static const char POC_ORIGIN[] = ${string(url.origin)};\n` +
    `static const char POC_SUBJECT[] = ${string(config.subject)};\n` +
    `static const char POC_LOCALE[] = ${string(enrollment.locale)};\n` +
    `static const int64_t POC_EXPIRATION_MS = ${Math.ceil(subscription.expirationTime || 0)}LL;\n` +
    array('POC_VAPID_PRIVATE', config.privateKey) + array('POC_VAPID_PUBLIC', config.publicKey) +
    array('POC_RECEIVER', subscription.keys.p256dh) + array('POC_AUTH', subscription.keys.auth);
}
function main(args) {
  let config, enrollment, wifi, enabled;
  if (args.length === 1 && args[0] === '--synthetic') {
    const vapid = crypto.createECDH('prime256v1'); vapid.generateKeys();
    const receiver = crypto.createECDH('prime256v1'); receiver.generateKeys();
    config = { publicKey: vapid.getPublicKey().toString('base64url'), privateKey: vapid.getPrivateKey().toString('base64url'), subject: 'https://github.com/mkopal/smart-smoker-push-test' };
    enrollment = { version: 1, publicKey: config.publicKey, locale: 'en', subscription: {
      endpoint: 'https://web.push.apple.com/synthetic-never-send', expirationTime: null,
      keys: { p256dh: receiver.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } } };
    wifi = { ssid: 'push-ci-not-a-network', password: 'ci-only-never-deploy' };
    enabled = false;
  } else if (args.length === 3) {
    [config, enrollment, wifi] = args.map(p => publisher.readPrivate(p));
    enabled = true;
  } else throw Error('Usage');
  const output = generate(config, enrollment, wifi, enabled);
  const directory = path.join(ROOT, 'local/esp32-input');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.chmodSync(directory, 0o700);
  fs.writeFileSync(path.join(directory, 'poc_config.h'), output, { flag: 'wx', mode: 0o600 });
  console.log('Private development header created. It is compiled into firmware; keep all build artifacts private.');
}
module.exports = { generate };
if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (_) {
    console.error('Provisioning refused. Check arguments, private permissions and inputs; output must not exist. Values suppressed.');
    process.exitCode = 1;
  }
}
