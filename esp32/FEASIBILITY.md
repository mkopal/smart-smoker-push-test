# Direct ESP32 Web Push feasibility and resource report

Test date: **2026-10-16**. Experimental branch: `esp32-direct-web-push-poc`.
Diagnostic implementation: **`3a87c84`**. This is the authoritative detailed PoC
measurement record; the main project owns the full-flash restoration record.

**Isolated direct Web Push PoC: SUCCESS (one end-to-end test).
Production ESPHome integration: NO-GO pending engineering and validation.**

## Successful real-device experiment — 2026-10-16

Evidence supplied by the owner: sanitized instrumented firmware diagnostics and
real-input build measurements below, plus explicit owner confirmation of locked
phone delivery and sound. Documentation finalization did not repeat device tests,
read private inputs or remeasure the firmware. Earlier software-only records below
are historical and are superseded by this section for this single successful run.

### Hardware, environment and separate verification results

ESP32 HW-395 / ESP-WROOM-32D; chip ESP32-D0WD-V3 revision 3.1; **4 MB flash,
no PSRAM**; ESP-IDF **5.5.5**. The device was physically connected only by USB:
no heater, smoke generator, relays, thermocouples or other control hardware attached.
The isolated publisher has no Home Assistant dependency.

| Verification | Actual result | Evidence / scope |
|---|---|---|
| Wi-Fi, IPv4 and clock readiness | PASS after manual CONNECT: Wi-Fi connected, IPv4 acquired, SNTP synchronized, all publishing preconditions passed | Firmware readiness diagnostics supplied by owner; initial association failure below |
| Web Push encryption, VAPID and HTTPS/TLS | PASS for the actual push provider | Successful encrypted publish and provider acceptance with diagnostic implementation `3a87c84` |
| Provider acceptance | **PASS: HTTP 201** | Instrumented ESP32 result; acceptance alone does not establish phone delivery |
| Locked iPhone notification | **PASS: delivered** | Explicitly confirmed by owner, separately from the provider log |
| Audible iPhone notification | **PASS: sound heard** | Explicitly confirmed by owner; no guarantee for other iOS settings or conditions |
| Isolated runtime resources | PASS for this send within the measured heap/stack resources | Diagnostics below; no integrated ESPHome or repeated-cycle resource result |
| Original production-image recovery | **PASS: full raw flash restored byte-for-byte; original HTTP UI returned** | [Canonical restoration record](https://github.com/mkopal/smart-smoker/blob/esp32-direct-web-push-poc/docs/ESP32_BACKUP_RESTORE.md); HA/API/entity/OTA checks remain unverified |

This demonstrates direct ESP32 publishing is technically feasible on this board,
including real encryption/authentication interoperability and locked-iPhone sound.
It establishes one successful end-to-end proof of concept, not reliable or guaranteed
delivery, production readiness, or a safety-critical alert channel.

### Wi-Fi association failure and manual recovery

The first connection attempt failed and publishing was correctly blocked:

```text
Wi-Fi disconnected reason=203; IPv4 readiness cleared. No retry.
publish_blocker=wifi_disconnected
```

In the [pinned ESP-IDF 5.5.5 reason definitions](https://github.com/espressif/esp-idf/blob/v5.5.5/components/esp_wifi/include/esp_wifi_types_generic.h),
203 is `WIFI_REASON_ASSOC_FAIL` (association failure). The underlying root cause
is unknown. A manual `CONNECT` subsequently connected Wi-Fi and obtained IPv4;
SNTP synchronization followed. Final readiness was:

```text
STATUS wifi_started=yes wifi_connected=yes ip_ready=yes sntp_sync_seen=yes clock_valid=yes publishing_enabled=yes recipient_retired=no subscription_expiration=not_provided publish_blocker=ready
```

No automatic reconnect exists. This manual recovery does not validate automatic
recovery, prolonged outages or reboot handling. Design and test bounded exponential
backoff, readiness transitions and sanitized observability before integration.

### Actual SEND diagnostics and interpretation

```text
heap stage=before_crypto free=217920 largest=110592 minimum=217920 stack_free=10124 minimum_scope=crypto
heap stage=after_crypto free=217744 largest=110592 minimum=214296 stack_free=7020 minimum_scope=crypto
heap stage=before_tls free=217744 largest=110592 minimum=217744 stack_free=7020 minimum_scope=https
heap stage=tls_connected free=183452 largest=110592 minimum=175792 stack_free=7020 minimum_scope=https
Provider accepted (201); phone delivery NOT confirmed.
timing crypto_wall_us=899340 network_wall_us=3352191
heap stage=after_cleanup free=217076 largest=110592 minimum=175792 stack_free=7020 minimum_scope=https
```

| Runtime measurement | Observed value | Interpretation |
|---|---|---|
| Minimum free heap during HTTPS | **175,792 B** | Observed HTTPS-window minimum, not an integrated-production capacity guarantee |
| Largest reported free block | **110,592 B** | At reported stages; not a continuously measured minimum largest block |
| Stack free watermark during operation | **7,020 B** | Reported task watermark |
| Free heap before crypto / after cleanup | **217,920 / 217,076 B** | One send; insufficient evidence for leak, fragmentation or long-term recovery conclusions |
| Crypto wall time | **899,340 microseconds (~0.90 s)** | Elapsed time, not CPU execution/utilization |
| Network wall time | **3,352,191 microseconds (~3.35 s)** | Elapsed network phase, not phone-delivery latency |
| Combined measured phases | **4,251,531 microseconds (~4.25 s)** | Sum of the two measured phases, not whole-session or end-to-end delivery time |

The serial wording `phone delivery NOT confirmed` intentionally describes what the
publisher can verify. Actual iPhone delivery and sound were separately confirmed by
the owner. These measurements belong to the isolated PoC, **not ESPHome integration**.
CPU utilization remains unmeasured.

### Real-input diagnostic build used in the successful test

| Build measurement | Result |
|---|---|
| Application binary | **908,032 B** |
| Application SHA-256 | `4cda3809450c092ab46c41409eefe1d6de964e5269dab5b5a9d3ec837ff72a6b` |
| Static DRAM | **35,196 B** |
| Static IRAM | **97,271 B** |
| Smallest application partition / free space | **1,835,008 B / 926,976 B (~50.5%)** |

Static memory is a linker/build allocation, not free runtime heap. These real-input
values supersede earlier synthetic image sizes for the tested image only; credential
lengths and build metadata can change size. No binary or private input is published.

### Still unverified

- Reliability over long periods and many notifications; leak/fragmentation trends.
- Device reboot, prolonged Wi-Fi outages, automatic reconnect and recovery.
- Retry/backoff, ambiguous timeouts and real-world HTTP 429/5xx behavior.
- Subscription expiry, rotation and invalidation, persistent recipient lifecycle.
- Multiple enrolled phones and Android delivery.
- Production credential storage and secure device-to-phone enrollment.
- Safe ESPHome integration alongside API, OTA, web UI, sensors and planned
  temperature monitoring; concurrent resources and scheduling.
- Delivery guarantees and audible presentation under all iOS conditions.

Web Push remains a non-safety-critical, best-effort notification mechanism. Heater
and smoke safety require independent controls and physical protections.

## Prioritized next engineering phase (proposal only)

1. Robust Wi-Fi reconnect with bounded exponential backoff, SNTP readiness handling
   and observable failure/recovery states; test these before production integration.
2. Credential protection, secure device-to-phone enrollment, subscription lifecycle
   and multiple-recipient support.
3. Safe asynchronous publishing that does not block temperature control or other
   important ESP32 tasks; review cooperative DNS/TLS deadline limits below.
4. ESPHome integration architecture preserving existing API/OTA/read-only web UI,
   standalone operation and optional HA.
5. Runtime heap, largest block, stack, timing and CPU measurements with all production
   features running, including sensors and planned temperature monitoring.
6. Repeated delivery, failure injection, reboot, network outage, Android and long-term
   stability tests against the acceptance gates below.
7. Temperature alert semantics, deduplication and application-level acknowledgements.
8. Document Web Push delivery limits, iOS Focus/silent behavior and non-guaranteed sound;
   preserve English/Czech onboarding and notifications.

This roadmap is not implemented. No mandatory HA dependency, paid push provider or
owner-operated backend is justified by this successful direct-publishing test.

## Serial diagnostics update — 2026-10-16

Historical software-only evidence, before the successful device test above.

Current software adds read-only STATUS, specific publish refusal reasons, sanitized
Wi-Fi/IP/SNTP events and numeric results for a single CONNECT request; see
[diagnostic contract and isolated build recipe](README.md#safe-serial-diagnostics).
SDK logs stay disabled; no network identity, key or subscription values are printed.
Existing crypto, TLS verification, retries/deadlines, partition table and private
inputs are unchanged. The console remains available after failed initialization or
in the disabled synthetic build. Station/IP readiness is cleared on loss/stop.

New isolated synthetic cross-build: **907,904 B** .bin, linker total **907,781 B**,
static DRAM **35,196 B**, IRAM **97,271 B**. Two 1,835,008 B slots give **927,104 B
(50.52%)** headroom. These supersede the historical image-size table below for the
new source, without replacing any private known-good image. Real credential lengths
and build metadata can change image size. Runtime heap/stack/concurrency are not
measured by a linker report.

The owner now reports successful physical flash/boot and HEAP output near **218 KB**
free heap, but SEND was refused by the old generic precondition check; CONNECT was
silent and Wi-Fi/SNTP readiness was not visible. This is limited **owner-reported**
evidence for a prior image, not an instrumented observation by this task or proof of
actual push acceptance/delivery. Exact firmware identity, heap units/phase and time
were not supplied. Root cause is not inferred from this report. New diagnostic
runtime, HTTPS/phone delivery and recovery remain pending separate authorization.
The historical NOT RUN entries below retain their original date/scope.

## Implementation selection and source evidence

Use the already installed IDF 5.5.5 and its **mbedTLS 3.6.6** primitives, with no new
third-party embedded publisher, Arduino framework or custom cryptographic algorithm.
Small project-owned protocol assembly is still security-sensitive and needs review.

| Requirement | Selected implementation / limit | Evidence and remaining gate |
|---|---|---|
| HTTPS POST | IDF `esp_http_client`, one async client, one recipient | Built with full publisher retained; actual provider accepted HTTP 201 in the successful test above |
| Chain, hostname, SNI | `esp_crt_bundle_attach`, full SDK CA bundle, hostname verification enabled; URL hostname supplies SNI through ESP-TLS | Actual provider TLS succeeded above; invalid/expired CA failure tests NOT RUN |
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
Do not advertise `h2` ALPN on an HTTP/1.1 implementation. The actual Web Push
provider accepted this client in the single successful test above; other providers
and future compatibility remain unverified. Do not substitute the
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

Historical synthetic-build evidence, before the successful device test above.

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

The single isolated trial above passed provider acceptance, locked-iPhone delivery
and sound, manual connection recovery and full-flash restoration. Automatic recovery
and the broader failure matrix remain unverified. Any new device trial still needs
separate authorization under the procedure in [README](README.md).

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

The single isolated send does not close these production gates: integrated runtime,
repeated-phone and failure-matrix validation remain **NOT RUN**. Boot/restart/network/probe/output
safety tests for production are not replaced by the host tests. Actuator/probe
behavior is N/A to the isolated publisher because it has none.
