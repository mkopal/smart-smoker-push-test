# Direct ESP32 Web Push feasibility and resource report

Date: 2026-10-16. Baselines: experiment `d8ac39d`, main firmware `579cc59`.
Both checkouts were initially clean; origin was fetched before edits. No production
firmware/configuration/assets changed. No physical device was contacted.

**GO for a separately authorized isolated USB bench trial after private provisioning,
backup and image review. NO-GO for production integration.** Software crypto tests
and an actual Xtensa build pass; provider acceptance of this ESP32 HTTP/1.1 client,
locked-phone delivery, sound, runtime heap, timeouts and recovery remain untested.
The previous owner-reported Linux-to-iPhone result is not ESP32 evidence.

## Implementation selection and source evidence

Use the already installed IDF 5.5.5 and its **mbedTLS 3.6.6** primitives, with no new
third-party embedded publisher, Arduino framework or custom cryptographic algorithm.
Small project-owned protocol assembly is still security-sensitive and needs review.

| Requirement | Selected implementation / limit | Evidence and remaining gate |
|---|---|---|
| HTTPS POST | IDF `esp_http_client`, one async client, one recipient | Built with full publisher retained; actual Apple endpoint NOT RUN |
| Chain, hostname, SNI | `esp_crt_bundle_attach`, full SDK CA bundle, hostname verification enabled; URL hostname supplies SNI through ESP-TLS | Source/config review; invalid/expired CA and provider TLS tests NOT RUN |
| VAPID | P-256 `mbedtls_ecdsa_sign`, SHA-256, JWT ES256 fixed 32-byte r + 32-byte s; aud is endpoint origin, exp now+1 h, public contact | Independent Node signature/claims verification PASS; no DER signature on wire |
| Payload encryption | P-256 key generation/ECDH, `mbedtls_hkdf` SHA-256, `mbedtls_gcm_crypt_and_tag` AES-128-GCM | RFC 8291 known-answer vector and independent Node decryption PASS |
| Framing | `aes128gcm`, 16-byte salt, rs=4096, 65-byte ephemeral public key, one final record with delimiter 0x02 and 16-byte tag | Deterministic full-body comparison, 1/256 B bounds, tamper/wrong-auth tests PASS |
| Headers | Authorization VAPID t/k, Content-Encoding aes128gcm, Content-Type application/octet-stream, TTL 60, Urgency high; SDK content length | Built; no redirect or authentication retry; actual transport capture NOT RUN |
| Time and entropy | Wi-Fi-active ESP RNG, fresh salt and sender key per send, separate VAPID identity; SNTP, plausible epoch gate | Host uses CTR-DRBG seeded by OS; device entropy/clock failure tests NOT RUN |
| Timeouts/retries | 1 s client I/O timeout, 20 s cooperative transaction deadline; yield 10 ms between EAGAIN; no automatic retries; SEND rate limit 60 s | State/deadline boundaries host-tested; device timing NOT RUN; caveat below |
| Subscription lifecycle | Provision rejects expired export/key mismatch/off-curve point; runtime expiration gate; 404/410 retires in RAM, 401/403 auth, 429/5xx temporary | Classification and expiration boundaries PASS; provider/reboot/persistence tests open |
| Cleanup/limits | RAII frees EC/MPI; GCM context freed on failure/success; shared secrets/IKM/CEK/nonce/plaintext zeroized; HTTP cleanup on all created-client paths | Compiled/tested primitives; device repeated-publish heap recovery NOT RUN |

Reviewed exact installed sources under `<IDF_PATH>/components/`: `esp_http_client/`
(header/source), `esp-tls/esp_tls_mbedtls.c`, `mbedtls/Kconfig`, bundled mbedTLS
headers/library, `lwip/lwip/src/core/dns.c`, `http_parser/http_parser.h` and generated
sdkconfig/compile commands. Version checked from IDF version.txt and mbedTLS CMake.
Primary references:

- [RFC 8291](https://www.rfc-editor.org/rfc/rfc8291), including section 5/Appendix A.
- [RFC 8292](https://www.rfc-editor.org/rfc/rfc8292), VAPID/ES256.
- [RFC 8030](https://www.rfc-editor.org/rfc/rfc8030), Web Push transport.
- [Pinned HTTP client interface](https://github.com/espressif/esp-idf/blob/v5.5.5/components/esp_http_client/include/esp_http_client.h)
  and [implementation](https://github.com/espressif/esp-idf/blob/v5.5.5/components/esp_http_client/esp_http_client.c).
- [Pinned mbedTLS configuration](https://github.com/espressif/esp-idf/blob/v5.5.5/components/mbedtls/Kconfig).
- [HTTP client guide](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_http_client.html)
  and [CA bundle guide](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/protocols/esp_crt_bundle.html).
  The web `stable` alias currently resolves to a newer release; exact API decisions
  above use the installed 5.5.5 sources, not that moving alias. The versioned web
  guide was unavailable during research.

### Transport and timing limitations

The Node experiment uses HTTP/1.1 successfully according to prior owner evidence.
RFC 8030 specifies HTTP/2 as baseline; IDF `esp_http_client` here speaks HTTP/1.1.
Do not advertise `h2` ALPN on an HTTP/1.1 implementation. The exact Apple Web Push
endpoint must accept this client or the bench result is NO-GO. Do not substitute the
native APNs API, disable TLS verification or add an external relay to make it pass.

IDF 5.5.5 discards callback return values at header/body dispatch. The callback
therefore marks an over-budget exchange and uses `shutdown(SHUT_RDWR)` on the owned
socket to interrupt subsequent I/O; it never destroys the client during parsing.
Normal cleanup runs afterward; aborted responses cannot be accepted as 201.
Header parser allocation is independently capped at **4096 B** through a compile
definition on the IDF http_parser target (default is 80 KiB); response body observed
limit is **2048 B**. No response material is retained or logged. Confirm this abort
path on a controlled TLS test service before integrating into production.

The 20 s deadline is **cooperative, not a hard real-time upper bound**. IDF async
connection establishment still calls synchronous DNS, and a single SDK call can
exceed the loop's budget. lwIP DNS has finite retries (default 4 per server, 1 s timer
with retry backoff); DNS, scheduler and TLS crypto time are additional contributors.
Client I/O timeout is 1 s per operation, not a total deadline. Observe actual worst-case
elapsed failure time on hardware; production needs a separately reviewed resolver/
scheduler strategy if this cannot meet the 30 s failure gate below. Do not terminate
a task while it owns TLS allocations. No infinite application retry loop exists.

SDK logs are compiled at maximum level 0 and also disabled at startup because HTTP,
TLS and Wi-Fi error logs can include endpoints/credentials. Project diagnostics show
only stage, numeric resources/timing and sanitized outcome. Crash dumps and private
build artifacts still require confidential handling. HTTP-library allocations are
freed, without claiming every internal buffer is securely erased. In-memory 404/410
retirement is lost at reboot; persistent lifecycle is a production gate.

## Actual build evidence versus unmeasured resources

Reference build: ESP32, IDF 5.5.5, Xtensa esp-14.2.0_20260121, mbedTLS 3.6.6,
Node 22.20.0 on Linux; synthetic inputs with runtime network/send disabled. Full
publisher linkage verified by a volatile build gate and generated ELF symbols.
No PSRAM configured. Credentials/endpoint lengths will alter real-input image size.

| Resource | Result | Evidence level |
|---|---|---|
| Application `.bin` | **904,672 B** | Actual local cross-build, not device measurement |
| IDF size total (before image padding) | **904,549 B** | Linker size report |
| Each application slot | **1,835,008 B**, `0x1c0000` | Generated partition binary/build check |
| Application slot headroom | **930,336 B (50.7%)** | Arithmetic from actual binary/partition |
| Flash code / data | **637,022 / 153,860 B** | IDF linker report |
| Static DRAM | **35,180 B** = .bss 18,816 + .data 16,364 | Linker allocation, NOT free runtime heap |
| IRAM | **97,271 B / 131,072 B**; 33,801 B remaining | Linker report; future integration may also hit IRAM constraints |
| RTC slow | **56 B** | Linker report |
| Main task stack | **12,288 B configured** | Configuration; runtime watermark NOT MEASURED |
| HTTP buffers | RX 1024, TX 1024 B; parser cap 4096 B | Config/source bounds; SDK can allocate additional TLS/parser objects |
| TLS records | RX 16,384, TX 4096 B configured | Buffer lengths, not full TLS heap cost |
| Free heap before/after TLS | **NOT MEASURED** | Firmware prints before_tls, tls_connected, after_cleanup |
| Minimum heap during HTTPS | **NOT MEASURED** | Separate local-minimum monitor windows for crypto and HTTPS, printed with scope |
| Heap recovery, fragmentation, stacks | **NOT MEASURED** | Capture free/largest/minimum and stack watermark across repeated sends |
| Crypto/network wall time | **NOT MEASURED** | Instrumented separately in microseconds; includes scheduling and diagnostics overhead |
| CPU execution/utilization | **NOT MEASURED** | Wall clock is not CPU time; use FreeRTOS runtime stats/system trace in a later reviewed measurement build |

Production historical baseline: raw 830,343 B, padded OTA 830,464 B, static DRAM
44,920 B, same application slot capacity (main VALIDATION). This isolated image
**replaces**, rather than coexists with, API/OTA/web. Do not subtract these images to
infer integration overhead or add their sizes: many SDK objects are shared. Its
partition offsets differ from production, so this is **not an OTA-compatible image**.
No production build or known-good firmware artifact was regenerated in this task.

Planning estimate only: reserve **50–100 KiB transient heap** for crypto/TLS/worker
until actual measurements exist. This is not a measured ceiling or free capacity.
Full CA bundle and crypto add flash; TLS cert-chain parsing and ECP workspace add
transient RAM. Stacks, API clients, OTA, SSE/web clients and planned 48-hour history
compete for the same no-PSRAM heap/IRAM. Need an integrated synthetic build and
concurrent measurements before choosing an ESPHome worker/component configuration.
The standalone project's main task is not a safe drop-in to ESPHome's main loop.

## Credentials and future product security

Development inputs are regular private files; generated header and all compiled
images contain credentials. Current PoC has no provisioning server and does not
change the read-only production HTTP boundary. Retain manual encrypted subscription
transfer and host-side provisioning. Never give API/OTA credentials to the PWA.

Production requires per-device VAPID identities, authenticated encrypted pairing,
protected atomic subscription/key storage, recipient caps, revocation and deletion,
ownership transfer and secure update/CA maintenance. Review flash encryption, secure
boot and NVS encryption together with physical extraction and recovery; no eFuses
are burned here. Key rotation requires re-enrolling phones against the new public
key, with bounded old-key migration and explicit removal. Losing/revoking a phone
must disable and delete its recipient record independently of transient failures.
SNTP is unauthenticated: plausible time is not authenticated time. Clock rollback,
reboot without time, stale sync, CA/key rotation and entropy availability need review.
Push remains a best-effort notification, independent of physical thermal protections.

## Explicit acceptance gates

Bench trial is conditional GO only after the owner authorizes the exact backup,
USB operation and restoration procedure in [README](README.md). Require actual
valid-TLS provider acceptance, locked iPhone presentation and sound, successful
fresh send after network recovery, and a restorable known-good full-flash backup.
If HTTP/TLS/provider compatibility or safe recovery fails, stop at NO-GO.

Production remains NO-GO until **all** these gates pass:

1. Integrated ESPHome 2026.9.1/IDF 5.5.5 build preserves encrypted API, OTA and
   read-only web UI, includes no outputs, fits both real OTA slots with **>=20%**
   headroom, and fits DRAM/IRAM. Test the integrated image; isolated size is insufficient.
2. Exact-board measurements with native API + two web clients and optional HA absent
   as well as present: minimum internal free heap **>=30 KiB**, largest internal
   free block **>=20 KiB**, stack free **>=2 KiB** for publisher task. For the classic
   no-PSRAM ESP32 build these 8-bit heap measurements are internal; use explicit
   internal-capability counters if a future target/config introduces external RAM.
3. After warm-up, **100** publishes/failure cycles, no monotonic heap loss; quiescent
   heap recovers within **2 KiB** of warm baseline, no reset/watchdog/sample starvation.
   Preserve 10 s diagnostic cadence, with no gap **>15 s** attributable to publishing.
   Run a **24 h** soak and check web/API/OTA availability/recovery (OTA itself only
   after separate authorization). Measure CPU statistics as well as wall time.
4. Controlled DNS/TCP/TLS/stalled/oversized-response/network failures finish and clean
   up within **30 s** of SEND, with no old-event replay. Verify invalid/expired certs,
   wrong hostname, missing/untrusted time and entropy failure fail closed. Refactor
   synchronous DNS if necessary; do not silently increase budgets or weaken TLS.
5. Real iPhone and Android acceptance, EN/CS, background/locked/mobile data, revocation,
   subscription expiry and key rotation. At least three ordinary locked trials per
   supported phone observed within **60 s** each, including audible behavior recorded
   separately. Provider 201 alone does not satisfy delivery.
6. Reviewed production pairing/storage/recipient/removal/time/rotation design, bounded
   queue/backoff/Retry-After/ambiguous-timeout handling, independent security review.
   There is no queue or persistent lifecycle in this bench PoC.

All runtime/phone/failure gates are **NOT RUN** here. Boot/restart/network/probe/output
safety tests for production are not replaced by the host tests. Actuator/probe
behavior is N/A to the isolated publisher because it has none.
