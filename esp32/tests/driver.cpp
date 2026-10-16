// Host-only public fixture interface; never use with real subscription material.
#include <cstdio>
#include <cstring>
#include <string>
#include <iostream>
#include "mbedtls/entropy.h"
#include "mbedtls/ctr_drbg.h"
#include "push_crypto.h"
#include "policy.h"
static bool decode(const std::string &s, uint8_t *out, size_t size) {
  if (s.size()!=size*2) return false;
  for (size_t i=0; i<size; ++i) {
    unsigned x;
    if (sscanf(s.substr(i*2,2).c_str(),"%2x",&x)!=1) return false;
    out[i]=x;
  }
  return true;
}
static int fail_random(void *, unsigned char *, size_t) { return -1; }
static void hex(const uint8_t *in, size_t size) {
  for(size_t i=0;i<size;++i) printf("%02x",in[i]);
  puts("");
}
int main(int argc, char **argv) {
  if (argc==2 && !strcmp(argv[1],"policy")) {
    if (classify_status(201)!=Result::accepted || classify_status(200)!=Result::failed ||
        classify_status(404)!=Result::expired || classify_status(410)!=Result::expired ||
        classify_status(401)!=Result::authentication || classify_status(403)!=Result::authentication ||
        classify_status(429)!=Result::temporary || classify_status(500)!=Result::temporary ||
        classify_status(599)!=Result::temporary || classify_status(600)!=Result::failed ||
        classify_status(302)!=Result::failed || classify_status(0)!=Result::failed ||
        !publish_allowed(1800000000,0,true,false) ||
        !publish_allowed(1800000000,1800000000001LL,true,false) ||
        publish_allowed(1800000000,1800000000000LL,true,false) ||
        publish_allowed(1800000000,1799999999999LL,true,false) ||
        publish_allowed(0,0,true,false) || publish_allowed(4102444801LL,0,true,false) ||
        publish_allowed(1800000000,0,false,false) || publish_allowed(1800000000,0,true,true)) return 1;
    Exchange state{100};
    if (!exchange_observe(state, 99, 2048, 4096) ||
        exchange_observe(state, 99, 1, 0) || !state.aborted ||
        exchange_observe(state, 99, 0, 0)) return 1;
    Exchange headers{100};
    if (exchange_observe(headers, 99, 0, 4097)) return 1;
    Exchange deadline{100};
    if (exchange_observe(deadline, 100, 0, 0)) return 1;
    Exchange overflow{100};
    if (exchange_observe(overflow, 99, UINT32_MAX, 0)) return 1;
    puts("PASS: status and send gates"); return 0;
  }
  uint8_t receiver[65], auth[16], priv[32], pub[65], salt[16], ephemeral[32];
  std::string fields[10];
  for(auto &field:fields) if(!std::getline(std::cin,field)) return 2;
  if (!decode(fields[0],receiver,65) || !decode(fields[1],auth,16) ||
      !decode(fields[2],priv,32) || !decode(fields[3],pub,65) ||
      !decode(fields[8],salt,16) || !decode(fields[9],ephemeral,32)) return 2;
  mbedtls_entropy_context entropy; mbedtls_ctr_drbg_context rng;
  mbedtls_entropy_init(&entropy); mbedtls_ctr_drbg_init(&rng);
  int error=mbedtls_ctr_drbg_seed(&rng,mbedtls_entropy_func,&entropy,nullptr,0);
  uint8_t body[WP_BODY_MAX]; size_t length=0; char authorization[WP_AUTH_MAX];
  wp_rng encrypt_rng = argc==2 && !strcmp(argv[1],"rngfail") ? fail_random : mbedtls_ctr_drbg_random;
  wp_rng sign_rng = argc==2 && !strcmp(argv[1],"signfail") ? fail_random : mbedtls_ctr_drbg_random;
  if(!error) {
    if(argc==2 && !strcmp(argv[1],"fixture"))
      error=wp_encrypt_fixture(receiver,auth,ephemeral,salt,
          reinterpret_cast<const uint8_t *>(fields[4].data()), fields[4].size(),
          encrypt_rng,&rng,body,&length);
    else error=wp_encrypt(receiver,auth,reinterpret_cast<const uint8_t *>(fields[4].data()),
          fields[4].size(),encrypt_rng,&rng,body,&length);
  }
  if(!error) error=wp_vapid(priv,pub,fields[5].c_str(),fields[6].c_str(),
                           std::stoll(fields[7]),sign_rng,&rng,authorization);
  if(!error) { hex(body,length); puts(authorization); }
  mbedtls_ctr_drbg_free(&rng); mbedtls_entropy_free(&entropy);
  return error ? 1 : 0;
}
