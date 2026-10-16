#include "push_crypto.h"
#include <cstdio>
#include <cstring>
#include "mbedtls/base64.h"
#include "mbedtls/ecdh.h"
#include "mbedtls/ecdsa.h"
#include "mbedtls/gcm.h"
#include "mbedtls/hkdf.h"
#include "mbedtls/platform_util.h"
#include "mbedtls/sha256.h"

namespace {
struct EC {
  mbedtls_ecp_group group;
  mbedtls_ecp_point peer, pub;
  mbedtls_mpi secret, shared, r, s;
  EC() {
    mbedtls_ecp_group_init(&group); mbedtls_ecp_point_init(&peer);
    mbedtls_ecp_point_init(&pub); mbedtls_mpi_init(&secret);
    mbedtls_mpi_init(&shared); mbedtls_mpi_init(&r); mbedtls_mpi_init(&s);
  }
  ~EC() {
    mbedtls_mpi_free(&s); mbedtls_mpi_free(&r); mbedtls_mpi_free(&shared);
    mbedtls_mpi_free(&secret); mbedtls_ecp_point_free(&pub);
    mbedtls_ecp_point_free(&peer); mbedtls_ecp_group_free(&group);
  }
};
struct Secrets {
  uint8_t shared[32]{}, ikm[32]{}, key[16]{}, nonce[12]{}, plain[WP_PAYLOAD_MAX+1]{};
  ~Secrets() { mbedtls_platform_zeroize(this, sizeof(*this)); }
};
int b64(const uint8_t *value, size_t length, char *out, size_t capacity) {
  size_t n = 0;
  if (mbedtls_base64_encode(reinterpret_cast<unsigned char *>(out), capacity, &n, value, length)) return -1;
  while (n && out[n-1] == '=') --n;
  out[n] = 0;
  for (size_t i = 0; i < n; ++i) {
    if (out[i] == '+') out[i] = '-';
    if (out[i] == '/') out[i] = '_';
  }
  return 0;
}
int encrypt(const uint8_t receiver[65], const uint8_t auth[16],
            const uint8_t *fixed_private, const uint8_t *fixed_salt,
            const uint8_t *payload, size_t length, wp_rng rng, void *ctx,
            uint8_t *body, size_t *body_length) {
  *body_length = 0;
  if (!length || length > WP_PAYLOAD_MAX || receiver[0] != 4 || !rng) return -1;
  EC ec;
  Secrets work;
  const auto *md = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (!md || mbedtls_ecp_group_load(&ec.group, MBEDTLS_ECP_DP_SECP256R1) ||
      mbedtls_ecp_point_read_binary(&ec.group, &ec.peer, receiver, 65) ||
      mbedtls_ecp_check_pubkey(&ec.group, &ec.peer)) return -1;
  if (fixed_private) {
    if (mbedtls_mpi_read_binary(&ec.secret, fixed_private, 32) ||
        mbedtls_ecp_check_privkey(&ec.group, &ec.secret) ||
        mbedtls_ecp_mul(&ec.group, &ec.pub, &ec.secret, &ec.group.G, rng, ctx)) return -1;
  } else if (mbedtls_ecp_gen_keypair(&ec.group, &ec.secret, &ec.pub, rng, ctx)) return -1;
  if (fixed_salt) memcpy(body, fixed_salt, 16);
  else if (rng(ctx, body, 16)) return -1;
  /* RFC 8188: salt, network-order rs=4096, idlen=65, sender public key. */
  body[16]=0; body[17]=0; body[18]=16; body[19]=0; body[20]=65;
  size_t written = 0;
  if (mbedtls_ecp_point_write_binary(&ec.group, &ec.pub, MBEDTLS_ECP_PF_UNCOMPRESSED,
                                    &written, body+21, 65) || written != 65 ||
      mbedtls_ecdh_compute_shared(&ec.group, &ec.shared, &ec.peer, &ec.secret, rng, ctx) ||
      mbedtls_mpi_write_binary(&ec.shared, work.shared, 32)) return -1;
  uint8_t info[144];
  memcpy(info, "WebPush: info", 14); // Includes the required zero byte.
  memcpy(info+14, receiver, 65); memcpy(info+79, body+21, 65);
  if (mbedtls_hkdf(md, auth, 16, work.shared, 32, info, sizeof(info), work.ikm, 32) ||
      mbedtls_hkdf(md, body, 16, work.ikm, 32,
                   reinterpret_cast<const uint8_t *>("Content-Encoding: aes128gcm"),
                   sizeof("Content-Encoding: aes128gcm"), work.key, 16) ||
      mbedtls_hkdf(md, body, 16, work.ikm, 32,
                   reinterpret_cast<const uint8_t *>("Content-Encoding: nonce"),
                   sizeof("Content-Encoding: nonce"), work.nonce, 12)) return -1;
  memcpy(work.plain, payload, length); work.plain[length] = 2;
  mbedtls_gcm_context gcm;
  mbedtls_gcm_init(&gcm);
  int result = mbedtls_gcm_setkey(&gcm, MBEDTLS_CIPHER_ID_AES, work.key, 128);
  if (!result) result = mbedtls_gcm_crypt_and_tag(&gcm, MBEDTLS_GCM_ENCRYPT, length+1,
      work.nonce, 12, nullptr, 0, work.plain, body+86, 16, body+87+length);
  mbedtls_gcm_free(&gcm);
  if (result) return -1;
  *body_length = 86+length+17;
  return 0;
}
bool safe_json(const char *s, size_t limit) {
  size_t n = strlen(s);
  if (!n || n > limit) return false;
  for (size_t i=0; i<n; ++i) if (static_cast<unsigned char>(s[i]) < 0x21 ||
      static_cast<unsigned char>(s[i]) > 0x7e || s[i]=='"' || s[i]=='\\') return false;
  return true;
}
}
int wp_encrypt(const uint8_t receiver[65], const uint8_t auth[16],
               const uint8_t *payload, size_t length, wp_rng rng, void *ctx,
               uint8_t body[WP_BODY_MAX], size_t *body_length) {
  return encrypt(receiver, auth, nullptr, nullptr, payload, length, rng, ctx, body, body_length);
}
#ifdef WP_TEST
int wp_encrypt_fixture(const uint8_t receiver[65], const uint8_t auth[16],
                       const uint8_t sender_private[32], const uint8_t salt[16],
                       const uint8_t *payload, size_t length, wp_rng rng, void *ctx,
                       uint8_t body[WP_BODY_MAX], size_t *body_length) {
  return encrypt(receiver, auth, sender_private, salt, payload, length, rng, ctx, body, body_length);
}
#endif
int wp_vapid(const uint8_t private_key[32], const uint8_t public_key[65],
             const char *origin, const char *subject, int64_t now,
             wp_rng rng, void *ctx, char authorization[WP_AUTH_MAX]) {
  authorization[0]=0;
  if (!rng || now < 1760000000LL || now > 4102444800LL ||
      !safe_json(origin, 128) || strncmp(origin,"https://",8) ||
      !safe_json(subject, 160) || (strncmp(subject,"mailto:",7) && strncmp(subject,"https://",8))) return -1;
  EC ec;
  uint8_t derived[65], hash[32], signature[64];
  size_t written=0;
  if (mbedtls_ecp_group_load(&ec.group, MBEDTLS_ECP_DP_SECP256R1) ||
      mbedtls_mpi_read_binary(&ec.secret, private_key, 32) ||
      mbedtls_ecp_check_privkey(&ec.group, &ec.secret) ||
      mbedtls_ecp_mul(&ec.group, &ec.pub, &ec.secret, &ec.group.G, rng, ctx) ||
      mbedtls_ecp_point_write_binary(&ec.group, &ec.pub, MBEDTLS_ECP_PF_UNCOMPRESSED,
                                    &written, derived, sizeof(derived)) ||
      written != 65 || memcmp(derived, public_key, 65)) return -1;
  char claims[400], encoded[540], signing[600], sig[90], pub[90];
  int n=snprintf(claims,sizeof(claims),"{\"aud\":\"%s\",\"exp\":%lld,\"sub\":\"%s\"}",
                 origin, static_cast<long long>(now+3600), subject);
  if (n<0 || static_cast<size_t>(n)>=sizeof(claims) ||
      b64(reinterpret_cast<uint8_t *>(claims), n, encoded, sizeof(encoded))) return -1;
  n=snprintf(signing,sizeof(signing),"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.%s",encoded);
  if (n<0 || static_cast<size_t>(n)>=sizeof(signing) ||
      mbedtls_sha256(reinterpret_cast<uint8_t *>(signing), n, hash, 0) ||
      mbedtls_ecdsa_sign(&ec.group,&ec.r,&ec.s,&ec.secret,hash,32,rng,ctx) ||
      mbedtls_mpi_write_binary(&ec.r,signature,32) ||
      mbedtls_mpi_write_binary(&ec.s,signature+32,32) ||
      b64(signature,64,sig,sizeof(sig)) || b64(public_key,65,pub,sizeof(pub))) return -1;
  n=snprintf(authorization,WP_AUTH_MAX,"vapid t=%s.%s, k=%s",signing,sig,pub);
  return n>0 && n<WP_AUTH_MAX ? 0 : -1;
}
