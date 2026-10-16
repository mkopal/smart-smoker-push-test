#include "policy.h"
Result classify_status(int status) {
  if (status == 201) return Result::accepted;
  if (status == 404 || status == 410) return Result::expired;
  if (status == 401 || status == 403) return Result::authentication;
  if (status == 429 || (status >= 500 && status <= 599)) return Result::temporary;
  return Result::failed;
}
bool publish_allowed(int64_t now_seconds, int64_t expiration_ms, bool enabled, bool retired) {
  return enabled && !retired && now_seconds >= 1760000000LL && now_seconds <= 4102444800LL &&
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
