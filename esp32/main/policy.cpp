#include "policy.h"
#include <cstdio>
Result classify_status(int status) {
  if (status == 201) return Result::accepted;
  if (status == 404 || status == 410) return Result::expired;
  if (status == 401 || status == 403) return Result::authentication;
  if (status == 429 || (status >= 500 && status <= 599)) return Result::temporary;
  return Result::failed;
}
bool publish_allowed(int64_t now_seconds, int64_t expiration_ms, bool enabled, bool retired) {
  return enabled && !retired && clock_valid(now_seconds) &&
    (expiration_ms == 0 || expiration_ms > now_seconds * 1000);
}
bool exchange_observe(Exchange &state, int64_t now, uint32_t body_bytes, uint32_t header_bytes) {
  if (state.aborted || now >= state.deadline || body_bytes > 2048-state.received ||
      header_bytes > 4096-state.headers) {
    state.aborted = true;
    return false;
  }
  state.received += body_bytes;
  state.headers += header_bytes;
  return true;
}

bool clock_valid(int64_t now_seconds) {
  return now_seconds >= 1760000000LL && now_seconds <= 4102444800LL;
}
const char *expiration_state(const Readiness &state) {
  if (state.expiration_ms < 0) return "invalid";
  if (state.expiration_ms == 0) return "not_provided";
  if (!clock_valid(state.now_seconds)) return "unknown_until_clock";
  return state.expiration_ms > state.now_seconds * 1000 ? "valid" : "expired";
}
PublishBlocker publish_blocker(const Readiness &state) {
  if (!state.enabled) return PublishBlocker::disabled;
  if (state.retired) return PublishBlocker::retired;
  if (!state.wifi_started) return PublishBlocker::wifi_not_started;
  if (!state.wifi_connected) return PublishBlocker::wifi_disconnected;
  if (!state.ip_ready) return PublishBlocker::ip_not_ready;
  if (!clock_valid(state.now_seconds)) return PublishBlocker::clock_invalid;
  if (state.expiration_ms < 0) return PublishBlocker::subscription_invalid;
  if (!publish_allowed(state.now_seconds, state.expiration_ms, state.enabled, state.retired))
    return PublishBlocker::subscription_expired;
  return PublishBlocker::ready;
}
const char *publish_blocker_code(PublishBlocker blocker) {
  switch (blocker) {
    case PublishBlocker::ready: return "ready";
    case PublishBlocker::disabled: return "publishing_disabled";
    case PublishBlocker::retired: return "recipient_retired";
    case PublishBlocker::wifi_not_started: return "wifi_not_started";
    case PublishBlocker::wifi_disconnected: return "wifi_disconnected";
    case PublishBlocker::ip_not_ready: return "ip_not_ready";
    case PublishBlocker::clock_invalid: return "clock_invalid";
    case PublishBlocker::subscription_invalid: return "subscription_invalid";
    case PublishBlocker::subscription_expired: return "subscription_expired";
  }
  return "unknown";
}
const char *publish_blocker_message(PublishBlocker blocker) {
  switch (blocker) {
    case PublishBlocker::ready: return "Publishing preconditions ready; nothing sent.";
    case PublishBlocker::disabled: return "Publish refused: publishing disabled by build configuration.";
    case PublishBlocker::retired: return "Publish refused: recipient retired after 404/410; re-enroll and rebuild.";
    case PublishBlocker::wifi_not_started: return "Publish refused: Wi-Fi station is not started; inspect startup diagnostics.";
    case PublishBlocker::wifi_disconnected: return "Publish refused: Wi-Fi station is not connected.";
    case PublishBlocker::ip_not_ready: return "Publish refused: IPv4 address not ready; association alone is insufficient.";
    case PublishBlocker::clock_invalid: return "Publish refused: system clock outside valid range; wait for SNTP synchronization.";
    case PublishBlocker::subscription_invalid: return "Publish refused: invalid subscription expiration metadata.";
    case PublishBlocker::subscription_expired: return "Publish refused: subscription expired; re-enroll and rebuild.";
  }
  return "Publish refused: unknown readiness state.";
}
bool format_status(const Readiness &state, char *output, unsigned capacity) {
  if (!capacity) return false;
  const auto yes = [](bool value) { return value ? "yes" : "no"; };
  int n = snprintf(output, capacity,
    "STATUS wifi_started=%s wifi_connected=%s ip_ready=%s sntp_sync_seen=%s "
    "clock_valid=%s publishing_enabled=%s recipient_retired=%s "
    "subscription_expiration=%s publish_blocker=%s",
    yes(state.wifi_started), yes(state.wifi_connected), yes(state.ip_ready),
    yes(state.sntp_sync_seen), yes(clock_valid(state.now_seconds)), yes(state.enabled),
    yes(state.retired), expiration_state(state), publish_blocker_code(publish_blocker(state)));
  if (n < 0 || static_cast<unsigned>(n) >= capacity) { output[0] = 0; return false; }
  return true;
}
