#include <cstdio>
#include <cstring>
#include <ctime>
#include <inttypes.h>
#include "lwip/sockets.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/task.h"
#include "esp_event.h"
#include "esp_wifi.h"
#include "esp_netif.h"
#include "esp_sntp.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "esp_heap_caps.h"
#include "esp_http_client.h"
#include "esp_crt_bundle.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "mbedtls/platform_util.h"
#include "push_crypto.h"
#include "policy.h"
#include "poc_config.h"

static EventGroupHandle_t network;
static bool retired = false;
// Volatile keeps the complete publisher linked even in synthetic, non-sending builds.
static volatile bool send_enabled = POC_SEND_ENABLED;
static const char *minimum_scope = "boot";
static constexpr int64_t BUDGET_US = 20000000;
static int random_bytes(void *, unsigned char *out, size_t size) {
  // Wi-Fi remains enabled: ESP-IDF hardware RNG has an active RF entropy source.
  esp_fill_random(out, size);
  return 0;
}
static void network_event(void *, esp_event_base_t base, int32_t id, void *) {
  if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) xEventGroupSetBits(network, 1);
  if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) xEventGroupClearBits(network, 1);
}
static void heap_report(const char *stage) {
  printf("heap stage=%s free=%u largest=%u minimum=%u stack_free=%u minimum_scope=%s\n", stage,
    static_cast<unsigned>(heap_caps_get_free_size(MALLOC_CAP_8BIT)),
    static_cast<unsigned>(heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)),
    static_cast<unsigned>(heap_caps_get_minimum_free_size(MALLOC_CAP_8BIT)),
    static_cast<unsigned>(uxTaskGetStackHighWaterMark(nullptr)), minimum_scope);
}
static esp_err_t http_event(esp_http_client_event_t *event) {
  auto *state = static_cast<Exchange *>(event->user_data);
  if (event->event_id == HTTP_EVENT_ON_CONNECTED) heap_report("tls_connected");
  uint32_t body_bytes = event->event_id == HTTP_EVENT_ON_DATA ? event->data_len : 0;
  uint32_t header_bytes = event->event_id == HTTP_EVENT_ON_HEADER ?
    strlen(event->header_key) + strlen(event->header_value) : 0;
  if (!exchange_observe(*state, esp_timer_get_time(), body_bytes, header_bytes)) {
    // IDF 5.5.5 ignores event callback return values. Interrupt I/O without
    // freeing the client or closing its owned descriptor from inside the parser.
    state->aborted = true;
    int socket = esp_http_client_get_socket(event->client);
    if (socket >= 0) shutdown(socket, SHUT_RDWR);
  }
  return ESP_OK;
}
static void publish() {
  const int64_t now = time(nullptr);
  if (!(xEventGroupGetBits(network) & 1) ||
      !publish_allowed(now, POC_EXPIRATION_MS, send_enabled, retired)) {
    puts("Publish refused: check network, clock, subscription validity and build mode.");
    return;
  }
  if (heap_caps_monitor_local_minimum_free_size_start()!=ESP_OK) {
    puts("Heap monitoring unavailable; publish refused."); return;
  }
  minimum_scope="crypto";
  heap_report("before_crypto");
  int64_t started = esp_timer_get_time();
  uint8_t id[12]; char hex[25];
  random_bytes(nullptr, id, sizeof(id));
  for (size_t i=0;i<sizeof(id);++i) snprintf(hex+2*i,3,"%02x",id[i]);
  char payload[WP_PAYLOAD_MAX+1];
  snprintf(payload,sizeof(payload),"{\"event\":\"test\",\"id\":\"%s\",\"sentAt\":%lld,\"locale\":\"%s\"}",
           hex, static_cast<long long>(now*1000), POC_LOCALE);
  uint8_t body[WP_BODY_MAX]; size_t body_length=0;
  char authorization[WP_AUTH_MAX];
  int result = wp_encrypt(POC_RECEIVER,POC_AUTH,reinterpret_cast<uint8_t *>(payload),
                         strlen(payload),random_bytes,nullptr,body,&body_length);
  if (!result) result = wp_vapid(POC_VAPID_PRIVATE,POC_VAPID_PUBLIC,POC_ORIGIN,
                                POC_SUBJECT,now,random_bytes,nullptr,authorization);
  mbedtls_platform_zeroize(payload,sizeof(payload));
  if (result) {
    mbedtls_platform_zeroize(authorization,sizeof(authorization));
    heap_report("crypto_failure");
    heap_caps_monitor_local_minimum_free_size_stop(); minimum_scope="boot";
    puts("Crypto failed; values suppressed."); return;
  }
  heap_report("after_crypto");
  heap_caps_monitor_local_minimum_free_size_stop(); minimum_scope="boot";
  if (heap_caps_monitor_local_minimum_free_size_start()!=ESP_OK) {
    mbedtls_platform_zeroize(authorization,sizeof(authorization));
    mbedtls_platform_zeroize(body,sizeof(body));
    puts("HTTPS heap monitoring unavailable; publish refused."); return;
  }
  minimum_scope="https";
  int64_t encrypted = esp_timer_get_time();
  Exchange state{encrypted + BUDGET_US};
  esp_http_client_config_t config{};
  config.url=POC_ENDPOINT;
  config.method=HTTP_METHOD_POST;
  config.timeout_ms=1000;
  config.is_async=true;
  config.disable_auto_redirect=true;
  config.max_authorization_retries=-1;
  config.crt_bundle_attach=esp_crt_bundle_attach;
  config.skip_cert_common_name_check=false;
  config.buffer_size=1024;
  config.buffer_size_tx=1024;
  config.event_handler=http_event;
  config.user_data=&state;
  heap_report("before_tls");
  esp_http_client_handle_t client = esp_http_client_init(&config);
  int status=0;
  if (client) {
    esp_err_t error=esp_http_client_set_header(client,"Authorization",authorization);
    if (error==ESP_OK) error=esp_http_client_set_header(client,"Content-Encoding","aes128gcm");
    if (error==ESP_OK) error=esp_http_client_set_header(client,"Content-Type","application/octet-stream");
    if (error==ESP_OK) error=esp_http_client_set_header(client,"TTL","60");
    if (error==ESP_OK) error=esp_http_client_set_header(client,"Urgency","high");
    if (error==ESP_OK) error=esp_http_client_set_post_field(client,reinterpret_cast<char *>(body),body_length);
    if (error==ESP_OK) {
      do {
        error=esp_http_client_perform(client);
        if (error!=ESP_ERR_HTTP_EAGAIN || esp_timer_get_time()>=state.deadline) break;
        vTaskDelay(pdMS_TO_TICKS(10));
      } while (true);
      if (error==ESP_OK && !state.aborted && esp_timer_get_time()<state.deadline)
        status=esp_http_client_get_status_code(client);
    }
    esp_http_client_cleanup(client);
  }
  mbedtls_platform_zeroize(authorization,sizeof(authorization));
  mbedtls_platform_zeroize(body,sizeof(body));
  switch(classify_status(status)) {
    case Result::accepted: puts("Provider accepted (201); phone delivery NOT confirmed."); break;
    case Result::expired: retired=true; puts("Subscription retired (404/410); re-enroll and rebuild."); break;
    case Result::authentication: puts("Authentication rejected; check clock/key. No retry."); break;
    case Result::temporary: puts("Temporary failure; no replay. Wait at least 60 s and review provider Retry-After privately before another manual trial."); break;
    default: puts("Network/TLS/deadline/provider failure; values suppressed. No retry.");
  }
  printf("timing crypto_wall_us=%" PRId64 " network_wall_us=%" PRId64 "\n",
         encrypted-started,esp_timer_get_time()-encrypted);
  heap_report("after_cleanup");
  heap_caps_monitor_local_minimum_free_size_stop(); minimum_scope="boot";
}
extern "C" void app_main() {
  // Suppress SDK diagnostics: HTTP/TLS/Wi-Fi error paths can include private values.
  esp_log_level_set("*", ESP_LOG_NONE);
  puts("Isolated Web Push bench PoC. No GPIO, HTTP server, API or OTA. No automatic send.");
  if (!send_enabled) { puts("Synthetic build: network and publishing disabled."); return; }
  if (nvs_flash_init()!=ESP_OK || esp_netif_init()!=ESP_OK ||
      esp_event_loop_create_default()!=ESP_OK) { puts("Initialization failed."); return; }
  network=xEventGroupCreate();
  if (!network || !esp_netif_create_default_wifi_sta()) { puts("Network allocation failed."); return; }
  wifi_init_config_t init=WIFI_INIT_CONFIG_DEFAULT();
  if (esp_wifi_init(&init)!=ESP_OK || esp_wifi_set_storage(WIFI_STORAGE_RAM)!=ESP_OK ||
      esp_event_handler_register(WIFI_EVENT,WIFI_EVENT_STA_DISCONNECTED,network_event,nullptr)!=ESP_OK ||
      esp_event_handler_register(IP_EVENT,IP_EVENT_STA_GOT_IP,network_event,nullptr)!=ESP_OK ||
      esp_wifi_set_mode(WIFI_MODE_STA)!=ESP_OK) { puts("Wi-Fi initialization failed."); return; }
  wifi_config_t wifi{};
  memcpy(wifi.sta.ssid,POC_WIFI_SSID,strlen(POC_WIFI_SSID));
  memcpy(wifi.sta.password,POC_WIFI_PASSWORD,strlen(POC_WIFI_PASSWORD));
  esp_err_t configured=esp_wifi_set_config(WIFI_IF_STA,&wifi);
  mbedtls_platform_zeroize(&wifi,sizeof(wifi));
  if (configured!=ESP_OK || esp_wifi_start()!=ESP_OK) { puts("Wi-Fi configuration failed."); return; }
  esp_sntp_setoperatingmode(SNTP_OPMODE_POLL);
  esp_sntp_setservername(0,"pool.ntp.org");
  esp_sntp_init();
  esp_wifi_connect();
  xEventGroupWaitBits(network,1,pdFALSE,pdTRUE,pdMS_TO_TICKS(30000));
  puts("Commands: SEND (one test), CONNECT (one Wi-Fi reconnect), HEAP. Clock sync may take time.");
  char line[16]; size_t count=0; bool overflow=false;
  int64_t last_attempt=-60000000;
  for (;;) {
    int c=getchar();
    if (c==EOF) { clearerr(stdin); vTaskDelay(pdMS_TO_TICKS(20)); continue; }
    if (c=='\r' || c=='\n') {
      line[count]=0;
      if (!overflow && !strcmp(line,"SEND")) {
        int64_t current=esp_timer_get_time();
        if (current-last_attempt>=60000000) { last_attempt=current; publish(); }
        else puts("Rate limited; wait 60 seconds between attempts.");
      } else if (!overflow && !strcmp(line,"CONNECT")) esp_wifi_connect();
      else if (!overflow && !strcmp(line,"HEAP")) heap_report("manual");
      count=0; overflow=false;
    } else if (count<sizeof(line)-1) line[count++]=static_cast<char>(c);
    else overflow=true;
    vTaskDelay(pdMS_TO_TICKS(1));
  }
}
