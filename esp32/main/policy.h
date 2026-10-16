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

// Only readiness flags/time are accepted here, never credential-bearing objects.
struct Readiness {
  bool wifi_started, wifi_connected, ip_ready, sntp_sync_seen;
  bool enabled, retired;
  int64_t now_seconds, expiration_ms;
};
enum class PublishBlocker {
  ready, disabled, retired, wifi_not_started, wifi_disconnected, ip_not_ready,
  clock_invalid, subscription_invalid, subscription_expired
};
bool clock_valid(int64_t now_seconds);
const char *expiration_state(const Readiness &state);
PublishBlocker publish_blocker(const Readiness &state);
const char *publish_blocker_code(PublishBlocker blocker);
const char *publish_blocker_message(PublishBlocker blocker);
// Returns false rather than emitting a truncated diagnostic.
bool format_status(const Readiness &state, char *output, unsigned capacity);
