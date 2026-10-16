'use strict';
const assert = require('assert/strict');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { generate } = require('../provision.cjs');
const executable = process.argv[2];
assert(executable, 'Pass the compiled push_driver path');
const ecdh = () => { const key = crypto.createECDH('prime256v1'); key.generateKeys(); return key; };
const receiver = ecdh(), vapid = ecdh(), sender = ecdh();
const auth = crypto.randomBytes(16), salt = crypto.randomBytes(16);
const payload = JSON.stringify({ event: 'test', id: '0123456789abcdef01234567', sentAt: 1800000000000, locale: 'cs' });
const input = [receiver.getPublicKey().toString('hex'), auth.toString('hex'), vapid.getPrivateKey().toString('hex'),
  vapid.getPublicKey().toString('hex'), payload, 'https://web.push.apple.com',
  'https://github.com/mkopal/smart-smoker-push-test', '1800000000', salt.toString('hex'), sender.getPrivateKey().toString('hex')];
function run(fields = input, mode) {
  return spawnSync(executable, mode ? [mode] : [], { input: fields.join('\n') + '\n', encoding: 'utf8' });
}
const hkdf = (key, saltValue, info, size) => Buffer.from(crypto.hkdfSync('sha256', key, saltValue, info, size));
function decrypt(body, secret = auth) {
  assert.equal(body.readUInt32BE(16), 4096); assert.equal(body[20], 65);
  const pub = body.subarray(21, 86);
  const ikm = hkdf(receiver.computeSecret(pub), secret,
    Buffer.concat([Buffer.from('WebPush: info\0'), receiver.getPublicKey(), pub]), 32);
  const key = hkdf(ikm, body.subarray(0, 16), Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(ikm, body.subarray(0, 16), Buffer.from('Content-Encoding: nonce\0'), 12);
  const cipher = crypto.createDecipheriv('aes-128-gcm', key, nonce);
  cipher.setAuthTag(body.subarray(-16));
  const plain = Buffer.concat([cipher.update(body.subarray(86, -16)), cipher.final()]);
  assert.equal(plain.at(-1), 2);
  return plain.subarray(0, -1).toString();
}
for (const size of [1, payload.length, 256]) {
  const fields = input.slice(); fields[4] = size === payload.length ? payload : 'x'.repeat(size);
  const result = run(fields); assert.equal(result.status, 0, result.stderr);
  const [encodedBody, authorization] = result.stdout.trim().split('\n');
  const body = Buffer.from(encodedBody, 'hex');
  assert.equal(body.length, 86 + size + 17); assert.equal(decrypt(body), fields[4]);
  assert.throws(() => decrypt(body, crypto.randomBytes(16)));
  const damaged = Buffer.from(body); damaged[90] ^= 1; assert.throws(() => decrypt(damaged));
  const match = /^vapid t=([^,]+), k=([A-Za-z0-9_-]+)$/.exec(authorization); assert(match);
  const [header, claims, signature] = match[1].split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { typ: 'JWT', alg: 'ES256' });
  assert.deepEqual(JSON.parse(Buffer.from(claims, 'base64url')), { aud: fields[5], exp: 1800003600, sub: fields[6] });
  assert.equal(match[2], vapid.getPublicKey().toString('base64url'));
  const pub = vapid.getPublicKey();
  const publicKey = crypto.createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') } });
  assert(crypto.verify('sha256', Buffer.from(header + '.' + claims), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')));
}
assert.notEqual(run().stdout.split('\n')[0], run().stdout.split('\n')[0], 'Fresh salt and ephemeral key');
for (const [index, value] of [[0, '04' + '00'.repeat(64)], [0, '00'.repeat(65)], [2, '00'.repeat(32)],
  [3, receiver.getPublicKey().toString('hex')], [4, ''], [4, 'x'.repeat(257)], [5, 'http://example.com'],
  [6, 'https://bad"value'], [6, 'x'.repeat(161)], [7, '0'], [7, '4102444801']]) {
  const fields = input.slice(); fields[index] = value; assert.equal(run(fields).status, 1);
}
assert.equal(spawnSync(executable, ['policy']).status, 0);
assert.equal(run(input, 'rngfail').status, 1);
assert.equal(run(input, 'signfail').status, 1);
// Deterministic framing/encryption independently computed using Node primitives.
const fixture = run(input, 'fixture'); assert.equal(fixture.status, 0);
const actual = Buffer.from(fixture.stdout.split('\n')[0], 'hex');
const ikm = hkdf(sender.computeSecret(receiver.getPublicKey()), auth,
  Buffer.concat([Buffer.from('WebPush: info\0'), receiver.getPublicKey(), sender.getPublicKey()]), 32);
const key = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
const cipher = crypto.createCipheriv('aes-128-gcm', key, nonce);
const record = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
assert.deepEqual(actual, Buffer.concat([salt, Buffer.from([0, 0, 16, 0, 65]), sender.getPublicKey(), record]));
// RFC 8291 section 5 / Appendix A public known-answer example.
const rfc = input.slice();
const from64 = s => Buffer.from(s, 'base64url').toString('hex');
rfc[0] = from64('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4');
rfc[1] = from64('BTBZMqHH6r4Tts7J_aSIgg');
rfc[4] = 'When I grow up, I want to be a watermelon';
rfc[8] = from64('DGv6ra1nlYgDCS1FRnbzlw');
rfc[9] = from64('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw');
const known = run(rfc, 'fixture'); assert.equal(known.status, 0);
assert.equal(Buffer.from(known.stdout.split('\n')[0], 'hex').toString('base64url'),
  'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml' +
  'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT' +
  'pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
const config = { publicKey: vapid.getPublicKey().toString('base64url'), privateKey: vapid.getPrivateKey().toString('base64url'), subject: input[6] };
const enrollment = { version: 1, publicKey: config.publicKey, locale: 'cs', subscription: {
  endpoint: 'https://web.push.apple.com/public-fixture', expirationTime: null,
  keys: { p256dh: receiver.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } };
const wifi = { ssid: 'public-fixture', password: 'public-fixture-password' };
assert(generate(config, enrollment, wifi, false).includes('POC_SEND_ENABLED = false'));
assert(generate(config, enrollment, wifi, true).includes('POC_SEND_ENABLED = true'));
for (const invalid of [{ ssid: '', password: wifi.password }, { ssid: 'x'.repeat(33), password: wifi.password },
  { ssid: 'x\0y', password: wifi.password }, { ssid: 'ok', password: 'short' }]) assert.throws(() => generate(config, enrollment, invalid, true));
for (const endpoint of ['http://web.push.apple.com/a', 'https://evil.example/a', 'https://web.push.apple.com:8443/a',
  'https://user@web.push.apple.com/a', 'https://web.push.apple.com/a#b', 'https://web.push.apple.com/a\r\nx']) {
  assert.throws(() => generate(config, { ...enrollment, subscription: { ...enrollment.subscription, endpoint } }, wifi, true));
}
assert.throws(() => generate(config, { ...enrollment, subscription: { ...enrollment.subscription, expirationTime: 1 } }, wifi, true));
console.log('PASS: embedded crypto cross-decryption, ES256 verification, deterministic framing, tamper/invalid/boundary cases, provisioning and status/expiration gates (offline)');
