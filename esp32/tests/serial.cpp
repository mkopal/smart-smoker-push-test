#include <cassert>
#include <ctime>
#include <cstring>
#include "sdk.h"
static time_t diagnostic_test_time(time_t *) { return 1800000000; }
#define time diagnostic_test_time
#include "../main/main.cpp"
#undef time

int main() {
  Readiness ready{true,true,true,false,true,false,1800000000,0};
  assert(publish_blocker(ready)==PublishBlocker::ready); // SNTP observation is diagnostic, not a new send gate.
  assert(!clock_valid(1759999999) && clock_valid(1760000000));
  assert(clock_valid(4102444800LL) && !clock_valid(4102444801LL));
  struct Case { Readiness value; PublishBlocker expected; const char *expiration; };
  Readiness value=ready;
  Case cases[9];
  value.enabled=false; cases[0]={value,PublishBlocker::disabled,"not_provided"};
  value=ready; value.retired=true; cases[1]={value,PublishBlocker::retired,"not_provided"};
  value=ready; value.wifi_started=false; cases[2]={value,PublishBlocker::wifi_not_started,"not_provided"};
  value=ready; value.wifi_connected=false; cases[3]={value,PublishBlocker::wifi_disconnected,"not_provided"};
  value=ready; value.ip_ready=false; cases[4]={value,PublishBlocker::ip_not_ready,"not_provided"};
  value=ready; value.now_seconds=0; value.expiration_ms=1; cases[5]={value,PublishBlocker::clock_invalid,"unknown_until_clock"};
  value=ready; value.expiration_ms=-1; cases[6]={value,PublishBlocker::subscription_invalid,"invalid"};
  value=ready; value.expiration_ms=1800000000000LL; cases[7]={value,PublishBlocker::subscription_expired,"expired"};
  value=ready; value.expiration_ms=1800000000001LL; cases[8]={value,PublishBlocker::ready,"valid"};
  for(const auto &item:cases) {
    assert(publish_blocker(item.value)==item.expected);
    assert(!strcmp(expiration_state(item.value),item.expiration));
    assert(strlen(publish_blocker_message(item.expected))>0);
    char output[384]; assert(format_status(item.value,output,sizeof(output)));
    assert(strstr(output,publish_blocker_code(item.expected)));
    puts(output);
  }
  assert(!strcmp(publish_blocker_code(static_cast<PublishBlocker>(999)),"unknown"));
  assert(strstr(publish_blocker_message(static_cast<PublishBlocker>(999)),"refused"));
  char tiny[2]={'x','x'};
  assert(!format_status(ready,tiny,0) && tiny[0]=='x');
  assert(!format_status(ready,tiny,sizeof(tiny)) && tiny[0]==0);

  network=xEventGroupCreate();
  dispatch_command("STATUS");
  assert(!mock_connect_calls && !mock_sntp_calls && !mock_http_calls && !mock_init_calls);
  dispatch_command("SEND"); // No Wi-Fi: must refuse before crypto/TLS.
  assert(!mock_http_calls);
  network_event(nullptr,WIFI_EVENT,WIFI_EVENT_STA_START,nullptr);
  dispatch_command("CONNECT"); assert(mock_connect_calls==1 && !mock_http_calls);
  mock_connect_result=0x3001;
  dispatch_command("CONNECT"); assert(mock_connect_calls==2 && !mock_http_calls);
  network_event(nullptr,WIFI_EVENT,WIFI_EVENT_STA_CONNECTED,nullptr);
  assert(publish_blocker(readiness())==PublishBlocker::ip_not_ready);
  ip_event_got_ip_t ip{};
  network_event(nullptr,IP_EVENT,IP_EVENT_STA_GOT_IP,&ip);
  assert(!readiness().ip_ready);
  ip.ip_info.ip.addr=1;
  network_event(nullptr,IP_EVENT,IP_EVENT_STA_GOT_IP,&ip);
  assert(publish_blocker(readiness())==PublishBlocker::ready);
  network_event(nullptr,IP_EVENT,IP_EVENT_STA_GOT_IP,nullptr);
  assert(!readiness().ip_ready);
  network_event(nullptr,IP_EVENT,IP_EVENT_STA_GOT_IP,&ip);
  time_sync_event(nullptr); assert(readiness().sntp_sync_seen);
  dispatch_command("STATUS"); assert(mock_connect_calls==2 && !mock_sntp_calls && !mock_http_calls);
  assert(readiness().sntp_sync_seen); // STATUS must not consume the synchronization observation.
  network_event(nullptr,IP_EVENT,IP_EVENT_STA_LOST_IP,nullptr);
  assert(readiness().wifi_connected && !readiness().ip_ready);
  network_event(nullptr,IP_EVENT,IP_EVENT_STA_GOT_IP,&ip);
  wifi_event_sta_disconnected_t disconnected{};
  strcpy(disconnected.ssid,"PRIVATE_EVENT_SSID_CANARY"); disconnected.reason=202;
  network_event(nullptr,WIFI_EVENT,WIFI_EVENT_STA_DISCONNECTED,&disconnected);
  assert(!readiness().wifi_connected && !readiness().ip_ready && mock_connect_calls==2);
  network_event(nullptr,WIFI_EVENT,WIFI_EVENT_STA_DISCONNECTED,nullptr);
  network_event(nullptr,WIFI_EVENT,WIFI_EVENT_STA_STOP,nullptr);
  assert(!readiness().wifi_started && !readiness().ip_ready);
  dispatch_command("STATUS"); assert(mock_connect_calls==2 && !mock_http_calls);

  send_enabled=false; network=nullptr;
  unsigned initializations=mock_init_calls;
  initialize_network(); dispatch_command("STATUS"); dispatch_command("CONNECT");
  assert(mock_init_calls==initializations && mock_connect_calls==2 && !mock_http_calls);
  send_enabled=true; mock_nvs_result=0x110d;
  initialize_network(); dispatch_command("STATUS");
  assert(!network && mock_connect_calls==2 && !mock_http_calls);
  mock_nvs_result=ESP_OK;
  initialize_network();
  assert(mock_connect_calls==3 && mock_sntp_calls==1 && mock_sync_callback==time_sync_event);
  assert(!mock_http_calls);
  puts("PASS: actual serial dispatch, event adapter, refusal policy, safe formatting and single connect attempts (host stubs only)");
}
