idf_component_register(SRCS "main.cpp" "push_crypto.cpp" "policy.cpp"
  INCLUDE_DIRS "." "../../local/esp32-input"
  REQUIRES esp_wifi esp_netif esp_event nvs_flash esp_http_client mbedtls esp_timer lwip)
