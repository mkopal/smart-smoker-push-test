#pragma once
#include <stdint.h>
enum class Result { accepted, expired, authentication, temporary, failed };
Result classify_status(int status);
bool publish_allowed(int64_t now_seconds, int64_t expiration_ms, bool enabled, bool retired);
struct Exchange {
  int64_t deadline;
  uint32_t received = 0, headers = 0;
  bool aborted = false;
};
// Limits are checked before addition to avoid wrapping hostile byte counts.
bool exchange_observe(Exchange &state, int64_t now, uint32_t body_bytes, uint32_t header_bytes);
