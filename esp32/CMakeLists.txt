cmake_minimum_required(VERSION 3.16)
include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(push_poc)
if(NOT "$ENV{IDF_VERSION}" STREQUAL "5.5.5")
  message(FATAL_ERROR "This experiment requires ESP-IDF 5.5.5")
endif()
# Bound parser allocation even before a complete header reaches our callback.
idf_component_get_property(parser_lib http_parser COMPONENT_LIB)
target_compile_definitions(${parser_lib} PRIVATE HTTP_MAX_HEADER_SIZE=4096)
