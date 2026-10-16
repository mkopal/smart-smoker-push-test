#pragma once
#include <stddef.h>
#include <stdint.h>

#define WP_PAYLOAD_MAX 256
#define WP_BODY_MAX (86 + WP_PAYLOAD_MAX + 17)
#define WP_AUTH_MAX 1024

typedef int (*wp_rng)(void *, unsigned char *, size_t);
/* Returns 0 on success, -1 on any invalid input or primitive failure. */
int wp_encrypt(const uint8_t receiver[65], const uint8_t auth[16],
               const uint8_t *payload, size_t length, wp_rng rng, void *ctx,
               uint8_t body[WP_BODY_MAX], size_t *body_length);
int wp_vapid(const uint8_t private_key[32], const uint8_t public_key[65],
             const char *origin, const char *subject, int64_t now,
             wp_rng rng, void *ctx, char authorization[WP_AUTH_MAX]);
#ifdef WP_TEST
int wp_encrypt_fixture(const uint8_t receiver[65], const uint8_t auth[16],
                       const uint8_t sender_private[32], const uint8_t salt[16],
                       const uint8_t *payload, size_t length, wp_rng rng, void *ctx,
                       uint8_t body[WP_BODY_MAX], size_t *body_length);
#endif
