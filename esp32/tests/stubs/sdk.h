#pragma once
// Public host-only stand-ins. No device/network APIs are linked in this target.
#include <cstdint>
#include <cstddef>
#include <sys/time.h>
#include <sys/socket.h>
using esp_err_t = int;
using EventBits_t = unsigned;
using EventGroupHandle_t = unsigned *;
using esp_event_base_t = const char *;
constexpr esp_err_t ESP_OK=0, ESP_FAIL=-1, ESP_ERR_HTTP_EAGAIN=0x7007;
constexpr int pdFALSE=0, pdTRUE=1, WIFI_STORAGE_RAM=0, WIFI_MODE_STA=1, WIFI_IF_STA=0;
constexpr int SNTP_OPMODE_POLL=0, ESP_LOG_NONE=0, MALLOC_CAP_8BIT=1, HTTP_METHOD_POST=2;
constexpr int ESP_EVENT_ANY_ID=-1;
inline const char *WIFI_EVENT="wifi", *IP_EVENT="ip";
enum { WIFI_EVENT_STA_START, WIFI_EVENT_STA_CONNECTED, WIFI_EVENT_STA_DISCONNECTED, WIFI_EVENT_STA_STOP };
enum { IP_EVENT_STA_GOT_IP, IP_EVENT_STA_LOST_IP };
enum { HTTP_EVENT_ON_CONNECTED, HTTP_EVENT_ON_DATA, HTTP_EVENT_ON_HEADER };
struct wifi_event_sta_disconnected_t { char ssid[32]; uint8_t bssid[6]; uint8_t reason; };
struct ip_event_got_ip_t { struct { struct { uint32_t addr; } ip; } ip_info; };
struct wifi_config_t { struct { uint8_t ssid[32], password[64]; } sta; };
struct wifi_init_config_t {};
#define WIFI_INIT_CONFIG_DEFAULT() wifi_init_config_t{}
#define pdMS_TO_TICKS(x) (x)
inline unsigned mock_bits=0, mock_connect_calls=0, mock_sntp_calls=0, mock_http_calls=0, mock_init_calls=0;
inline esp_err_t mock_connect_result=ESP_OK, mock_nvs_result=ESP_OK;
inline void (*mock_sync_callback)(timeval *)=nullptr;
inline EventGroupHandle_t xEventGroupCreate() { mock_bits=0; return &mock_bits; }
inline unsigned xEventGroupGetBits(EventGroupHandle_t group) { return *group; }
inline unsigned xEventGroupSetBits(EventGroupHandle_t group, unsigned bits) { return *group |= bits; }
inline unsigned xEventGroupClearBits(EventGroupHandle_t group, unsigned bits) { unsigned old=*group; *group &= ~bits; return old; }
inline unsigned xEventGroupWaitBits(EventGroupHandle_t group, unsigned, int, int, unsigned) { return *group; }
inline void vTaskDelay(unsigned) {}
inline unsigned uxTaskGetStackHighWaterMark(void *) { return 4096; }
inline int64_t esp_timer_get_time() { return 120000000; }
inline void esp_fill_random(void *out, size_t n) { auto *p=static_cast<uint8_t *>(out); while(n--) *p++=0; }
inline unsigned heap_caps_get_free_size(int) { return 200000; }
inline unsigned heap_caps_get_largest_free_block(int) { return 100000; }
inline unsigned heap_caps_get_minimum_free_size(int) { return 180000; }
inline int heap_caps_monitor_local_minimum_free_size_start() { return ESP_OK; }
inline int heap_caps_monitor_local_minimum_free_size_stop() { return ESP_OK; }
inline int nvs_flash_init() { ++mock_init_calls; return mock_nvs_result; }
inline int esp_netif_init() { return ESP_OK; }
inline int esp_event_loop_create_default() { return ESP_OK; }
inline void *esp_netif_create_default_wifi_sta() { return &mock_bits; }
inline int esp_wifi_init(wifi_init_config_t *) { ++mock_init_calls; return ESP_OK; }
inline int esp_wifi_set_storage(int) { return ESP_OK; }
inline int esp_event_handler_register(esp_event_base_t, int32_t, void (*)(void *,esp_event_base_t,int32_t,void *), void *) { return ESP_OK; }
inline int esp_wifi_set_mode(int) { return ESP_OK; }
inline int esp_wifi_set_config(int, wifi_config_t *) { return ESP_OK; }
inline int esp_wifi_start() { return ESP_OK; }
inline int esp_wifi_connect() { ++mock_connect_calls; return mock_connect_result; }
inline void esp_sntp_setoperatingmode(int) {}
inline void esp_sntp_setservername(int, const char *) {}
inline void esp_sntp_set_time_sync_notification_cb(void (*callback)(timeval *)) { mock_sync_callback=callback; }
inline void esp_sntp_init() { ++mock_sntp_calls; }
inline void esp_log_level_set(const char *, int) {}
using esp_http_client_handle_t=void *;
struct esp_http_client_event_t { void *user_data; int event_id, data_len; char *header_key, *header_value; void *client; };
struct esp_http_client_config_t {
  const char *url; int method,timeout_ms; bool is_async,disable_auto_redirect; int max_authorization_retries;
  int (*crt_bundle_attach)(void *); bool skip_cert_common_name_check; int buffer_size,buffer_size_tx;
  int (*event_handler)(esp_http_client_event_t *); void *user_data;
};
inline int esp_crt_bundle_attach(void *) { return ESP_OK; }
inline int esp_http_client_get_socket(void *) { return -1; }
inline void *esp_http_client_init(esp_http_client_config_t *) { ++mock_http_calls; return nullptr; }
inline int esp_http_client_set_header(void *, const char *, const char *) { return ESP_OK; }
inline int esp_http_client_set_post_field(void *, const char *, int) { return ESP_OK; }
inline int esp_http_client_perform(void *) { ++mock_http_calls; return ESP_FAIL; }
inline int esp_http_client_get_status_code(void *) { return 0; }
inline void esp_http_client_cleanup(void *) {}
// Deliberately recognizable public canaries, never a real configuration.
static const bool POC_SEND_ENABLED=true;
static const char POC_WIFI_SSID[]="PRIVATE_SSID_CANARY", POC_WIFI_PASSWORD[]="PRIVATE_PASSWORD_CANARY";
static const char POC_ENDPOINT[]="PRIVATE_ENDPOINT_CANARY", POC_ORIGIN[]="PRIVATE_ORIGIN_CANARY";
static const char POC_SUBJECT[]="PRIVATE_SUBJECT_CANARY", POC_LOCALE[]="en";
static const int64_t POC_EXPIRATION_MS=0;
static const uint8_t POC_VAPID_PRIVATE[32]={}, POC_VAPID_PUBLIC[65]={}, POC_RECEIVER[65]={}, POC_AUTH[16]={};
