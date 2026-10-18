# P0 offline recovery: browser feasibility before simulation

Date: 2026-10-18. **Decision: NO-GO for the proposed HTTPS recovery path in
the combined expired-certificate / no-usable-Wi-Fi condition.** No simulator was
implemented: it could test policy ordering but could not validate this blocking
browser assumption. This follows the owner's feasibility-first instruction over
the original request for simulator deliverables. No product compromise is selected.

## Scope and evidence

Baseline: `a4d9670`, clean `esp32-direct-web-push-poc`; work is isolated on
`experiment/offline-recovery-feasibility`. The architecture reference is
`../smart-smoker`, especially ADR-008, ADR-009, WEB_PUSH_ENROLLMENT and
WEB_PUSH_ARCHITECTURE. Its accepted requirements include one PWA, no native helper,
computer/USB recovery, pairing backend, private-root installation, HTTP writes or
browser/TLS bypass. A physical button, recovery card, rescue network and secure
manufacturing identity are proposals, not established features of the current unit.

The [existing validation record](VALIDATION.md#owner-observed-iphone-https-transport--2026-10-18)
remains **PASS for the previously reported ordinary LAN HTTPS configuration**.
It is owner-observed Linux-emulator transport on iPhone 14 / reported iOS 27.0.1,
not ESP32 hosting, offline AP recovery or ownership verification. No phone test was
performed for this assessment. Primary sources below support platform rules;
the deadlock conclusion is an architectural inference from those rules and the
accepted constraints, not an observed Safari failure in this session.

The current `web/sw.js` and `https_spike/ui/sw.js` have no fetch/cache handler.
Neither app guarantees a cold offline launch. `https_spike/server.py` has synthetic
volatile challenges and a public fixture token, not owner authentication, Wi-Fi
configuration, renewal or recovery. Its CORS/Host checks cannot establish ownership.
The public artifact fixes its target origin and CSP. No running emulator, source
transport, deployed PWA, firmware or infrastructure was changed.

## Exact blocking constraint

The proposed path requires all of these, in order:

1. A trusted installed app can actually start, including after an offline restart.
2. The phone reaches the device FQDN over an available network with correct DNS.
3. Safari accepts the server's chain, hostname and certificate validity.
4. The PWA receives an HTTPS response, passes CORS and verifies the independent
   device identity and fresh owner/recovery proof.
5. Only then can an authorized transaction replace Wi-Fi settings or owner state.

In the combined failure, step 3 rejects the only available expired leaf, even if
a protected AP makes step 2 possible. A stored signing public key, old successful
session, QR code or possession secret cannot alter certificate validation for
ordinary Fetch. TLS failure prevents the challenge exchange. Fetch does not expose
a certificate-override option to this application. CORS, `no-cors`, service-worker
caching and application encryption do not repair this failure. See
[Fetch connection establishment](https://fetch.spec.whatwg.org/#concept-connection-obtain).

Renewal needs outbound connectivity to CA and DNS infrastructure. The device cannot
receive new home-network credentials through the refused management channel; it
cannot renew through a network it cannot join. That is **B-EXPIRY**, with separate
offline-shell **B-IOS** and resolver **B-DNS** prerequisites. Joining Wi-Fi solves
reachability only. The phone's cellular connection is not automatically shared with
the device. No internet anywhere means no ACME renewal, even with a recovery code.

## Alternatives and minimum compromises for owner review

| Approach | Can establish the required initial channel? | Conclusion |
|---|---|---|
| A: pinned application identity / recovery card | Only after ordinary HTTPS succeeds; the pin cannot replace browser PKI validation | Useful identity and owner factors, insufficient bootstrap |
| A: separate pre-provisioned public-CA recovery certificate | Conditional while independently valid, matching its name and reachable; its own expiry still applies | No guarantee after arbitrary shelf/offline duration; no such identity is established |
| B: physical button, possession code, protected temporary AP and split DNS | Can open a bounded window and route packets, but expired HTTPS still fails | Physical gating is necessary only for some designs and is never sufficient TLS trust |
| B: HTTP portal, redirect, WebSocket or BLE | HTTP Fetch is mixed content from the HTTPS app; `ws:` does not repair trust; `wss:` inherits TLS. Top-level HTTP navigation is possible but does not provide the authenticated single-PWA channel. Safari Web Bluetooth cannot be assumed | Rejected for this HTTPS design; WPA access alone is not end-to-end device authentication |
| C: direct device ACME DNS-01 with usable internet | Can replace an expired inbound leaf independently of that leaf | Viable ordering only if network, trusted time, DNS authority and client lifecycle already work; none implemented here |
| C: pre-provisioned per-unit rescue SSID/PSK and same iPhone's hotspot | Could give the device outbound internet before management becomes available, then renew and return phone/device to setup AP | Conditional experiment candidate; requires temporary internet, supported carrier, compatible hotspot and pre-provisioned rescue credentials. Not a fully offline solution |
| D: exceptional service/computer recovery | Could securely restore trust through an independently authenticated service workflow | Explicit relaxation of phone-only recovery; owner approval required before selection or implementation |
| D: manually installed private root or native helper | Changes browser trust provisioning or supplies another authenticated transport | Outside accepted constraints; not selected |

DNS-01 requires domain control and public TXT authorization; it does not require
inbound access to the device. Use unique ACME/TLS keys and proven per-unit,
name/type-scoped DNS authority, never a long-lived Cloudflare zone credential in
firmware. Domains, DNS hosting, provisioning and credential rotation still have an
operational owner even without a pairing backend. Renewal must verify chain, key,
name and validity before atomic activation. Failed renewal retains the old state
and keeps management blocked. See [CA challenge guidance](https://letsencrypt.org/docs/challenge-types/).

Use the actual certificate validity and renewal guidance, not an assumed permanent
90-day lifetime: Let's Encrypt has announced shorter profiles and a staged default
lifetime reduction. Repeated reset/recovery must not repeatedly order certificates;
persist order state, use bounded backoff and account for fleet issuance and failed
authorization limits. See [lifetime schedule](https://letsencrypt.org/2025/12/02/from-90-to-45.html)
and [rate limits](https://letsencrypt.org/docs/rate-limits/).

Apple documents hotspot sharing to other devices and carrier/plan dependencies;
network name/password configuration and compatibility must be tested with the same
phone. Do not require concurrent hotspot/AP operation: renew as a station first,
then stop tethering and manually join the device AP. A copied rescue PSK permits
network access/DoS, never ownership. See [hotspot setup](https://support.apple.com/en-us/111785)
and [hotspot compatibility](https://support.apple.com/en-us/119837).

### Avoid an overbroad platform impossibility claim

This conclusion applies to the specified HTTPS bootstrap, not every possible web
transport. [Safari 26.4 introduced WebTransport](https://webkit.org/blog/17862/webkit-features-for-safari-26-4/).
The standard's optional certificate-hash mechanism is distinct from Fetch pinning:
it still requires a currently valid, short-lived certificate and authenticated hash
distribution. An old hash/card does not automatically authenticate a newly generated
certificate. Exact shipping iOS support, AP reachability, rotation/time bootstrap,
QUIC implementation and ESP32 resources need qualification; API detection alone
is insufficient. [WebTransport certificate requirements](https://www.w3.org/TR/webtransport/#dom-webtransportoptions-servercertificatehashes).

[WebRTC data channels exist in WebKit](https://webkit.org/blog/7763/a-closer-look-into-webrtc/),
but require a concrete authenticated signaling/fingerprint and ICE bootstrap.
No such mechanism is specified in the proposed recovery path. Neither transport is
declared impossible or accepted here. An owner-approved alternative transport study
would need to supply the entire bootstrap, rather than silently replace the
ADR's trusted-HTTPS-only mutation contract or add an unauthenticated signal server.

## State machine contract (design only)

Wi-Fi availability, leaf validity, internet reachability and browser acceptance are
independent facts. A boolean `trusted = true` assigned by a simulator is not browser
evidence. Proposed bounds below inherit the enrollment design and are not measured
or implemented. No Wi-Fi/owner/recipient mutation is permitted before all trust and
authorization checks pass. AP availability alone never advances trust.

| State | Entry and allowed next transition | Guard / failure |
|---|---|---|
| Normal operation | Connectivity loss -> Wi-Fi unavailable; validity loss -> TLS certificate expired | Preserve independent protections and read-only monitoring |
| Wi-Fi unavailable | Certificate expiry -> both failures; owner action -> owner-initiated recovery | No automatic owner reset or first-client-wins claim |
| TLS certificate expired | Network loss -> both failures; successful autonomous online renewal -> normal | Reject inbound management until valid certificate activation |
| Wi-Fi unavailable and TLS certificate expired | Owner action -> owner-initiated recovery | Named BLOCKED condition; no presumed successful Wi-Fi write |
| Owner-initiated recovery | Explicit local initiation -> physical possession verification | Proposed 120 s monotonic window; no actual button is established |
| Physical possession verification | Local card/factor presented and physical recovery mode enabled -> recovery network available | Opens no mutation authority; device-side proof verification waits for trusted transport. Button/AP proximity alone cannot authenticate an owner; missing factor or expiry -> failed safely |
| Recovery network available | Reachable name and browser-accepted TLS -> trust re-establishment | Expired leaf -> BLOCKED/failed safely; optional separately approved rescue network may renew outbound first |
| Trust re-establishment | Verify device identity, fresh owner proof and complete transaction -> restored normal operation | Bind operation, device, origin, owner key, payload digest, challenge, boot nonce and durable generation; consume once |
| Restored normal operation | Valid committed credentials plus successful real reconnect -> normal | Recovery proof does not itself prove network reconnection or browser trust |
| Recovery failed safely | Cancel, timeout, replay, interruption, wrong authority or invalid TLS -> prior durable state | Discard session/staged changes; require new initiation; no downgrade |

On browser suspension, network loss, timeout or reboot abort uncommitted work.
Interrupted durable commit must yield old-or-new state, with a signed receipt for
authenticated retry of the same operation/digest; ambiguity blocks mutations.
Reboot must not restore consumed claims, proofs or revoked authority. Proposed
failure limits: five bad proofs trigger 60 s cooldown; ten/hour maximum with durable
anti-reset accounting. Secrets are at least 256 random bits; rate limits complement
entropy. Wrong proof, expired challenge, replay, cancellation and unauthorized
transfer produce zero authorization-state change. Ownership transfer requires
separate existing-admin/recovery authorization and explicit confirmation; it is not
a side effect of connectivity recovery. These are requirements, not test results.

## Threat model and fail-closed boundaries

Trust boundaries: authenticated static app delivery and browser storage; untrusted
LAN/AP/DNS/time; browser TLS; device identity and owner authority; durable device
storage; external CA/DNS. Public TLS hostname trust does not establish owner identity.
Physical flash resistance is unqualified on this board.

| Threat / failure | Required behavior and residual risk |
|---|---|
| Unauthorized LAN enrollment | Exact Host/Origin, bounded JSON and cryptographic owner proof. Origin is spoofable by raw clients; CORS is not authentication |
| Stolen/reused recovery code | Separate protected recovery authority, scoped fresh proof, atomic consumption and rotation. Theft of an unused sole bearer factor can defeat ownership; stronger physical factor requires hardware review |
| Replay / brute force | Bind transcript and generation, durable one-use decisions, bounded attempts/cooldown; reboot cannot reset authority or attempt accounting |
| Device impersonation / substituted certificate | Valid chain/name/date plus independently pinned signing identity; even a valid public leaf with wrong device identity must fail |
| Expired certificate | No owner/Wi-Fi write, no warning bypass, phone clock change or remembered exception |
| DNS rebinding / rogue AP | TLS identity, exact authority/origin and signed challenge; hostile DNS/AP can deny service. Rescue network never confers owner authority; outbound CA checks stay enabled |
| Lost phone | Surviving admin or independent recovery authority revokes lost keys; phone-only availability is not promised without either factor |
| Ownership transfer | Separately authorized atomic revoke/rekey, including rescue and recovery material; no implicit transfer after network loss |
| Factory reset | Preserve unique identity, renewal authority and consumed-claim tombstone according to reviewed reset policy. Never reinstate first-claim authority. Full erase is service repair, not proven customer recovery |
| Interrupted recovery | Old-or-new durable state, fresh session after restart, no partially installed trust or credential set; ambiguous storage fails closed |
| No internet | Existing valid local TLS may work after offline-shell/DNS qualification. Combined expiry case remains blocked; no CA renewal or fresh push subscription |

## Minimal real-device feasibility experiment (NOT RUN)

This is a future test protocol, not permission to execute live changes. Use a
dedicated isolated lab endpoint/AP and synthetic marker only. Preserve the running
HTTPS emulator, its credentials/port, existing subscriptions and production network.
A lab computer may stand in for the device for browser feasibility; it is not an
end-user recovery prerequisite. No ESP32 flashing is needed for this first gate.
No physical trial is authorized or executed by this document.

1. **Offline-shell precondition:** on the actual iPhone, open the existing installed
   PWA online, then join an isolated no-internet AP with cellular disabled. Close and
   cold-launch the app, then repeat after phone restart. Record render/network
   behavior. The current worker promises no offline shell: failure is a separate
   blocker, not a TLS result. A future cache-capable test release must use the same
   installation and requires separate hosting authorization; do not substitute a
   second app and call the one-PWA gate passed.
2. **Controlled valid TLS baseline:** with a loaded trusted app, use the exact allowed
   FQDN/port/Origin and existing synthetic challenge/enrollment contract on the isolated
   endpoint. First measure normal LAN, then the no-internet AP using local DNS for
   that same FQDN. Use a legitimately valid public chain supplied by the authorized
   lab operator. Require an observed fresh request/response in Safari and separately
   the installed PWA. A cached result, open page, screenshot alone or `isSecureContext`
   is insufficient. No ownership or real Wi-Fi write is tested.
3. **Certificate negative:** on that isolated endpoint only, substitute a genuinely
   expired public-CA leaf with matching SAN/key and otherwise valid chain. Keep the
   phone clock correct; use a fresh TLS connection to exclude session reuse. If no
   suitable expired fixture exists, mark NOT RUN and wait/procure it under separate
   lab authorization; self-signed/wrong-SAN rejection is not equivalent evidence.
   In both browser modes require request failure, no readable challenge and
   zero accepted application mutations. Generic fetch error alone cannot identify
   expiry: correlate controlled certificate metadata, baseline and sanitized endpoint
   observations. No navigation exception, root install or security flag is permitted.
4. **Recovery falsification:** keeping the expired leaf, AP and offline condition,
   retry with a synthetic stored device pin and possession code. Expected: still
   no channel. A successful model state is irrelevant. Reinstalling a valid fixture
   on the lab endpoint may establish a control result, but must be labeled operator
   intervention, not phone-only recovery.
5. **Conditional hotspot test, only after owner accepts its prerequisites:** a lab
   station with pre-provisioned synthetic per-unit rescue SSID/PSK must join the
   same iPhone's Personal Hotspot with home Wi-Fi absent. Measure association,
   DNS, outbound validated TLS and public TXT/CA reachability without issuing or
   updating anything in this first test. Then stop hotspot, join isolated setup AP
   and repeat the valid-TLS marker test. No simultaneous hotspot/AP behavior assumed.
   This is only a necessary connectivity test. Actual automatic DNS-01 renewal,
   atomic activation and subsequent browser connection require a later separately
   authorized lab test; manual leaf replacement does not pass this gate.

Repeat applicable rows three times per Safari/installed context, with current and
minimum supported iOS versions recorded. Use a 15 s request deadline and 120 s
session limit; report timeouts as failures, never inferred success. Restore the
phone's test settings afterward; do not reset its networking or delete existing
apps/data. Keep lab keys and raw traces private and outside Git.

Record: test ID/time/timezone, source SHA, phone model, exact OS/browser build,
tab/standalone, warm/cold launch, app/endpoint origins, certificate SAN/fingerprint/
validity/chain, network route, DNS resolver, cellular/hotspot state, permissions,
fresh request marker, endpoint receipt, phone result, latency and accepted-mutation
count. Do not record passwords, private keys, real owner proofs or subscriptions.

| Trial | Expected / measurable gate | Actual |
|---|---|---|
| Offline cold launch | Same installed app renders trusted cached release after restart | NOT RUN; current implementation has no offline-shell contract |
| Valid public leaf, LAN | Fresh synthetic response in both browser contexts | Prior qualified PASS only; new controlled trial NOT RUN |
| Valid public leaf, offline AP | Three fresh responses per context, correct local DNS, cellular off | NOT RUN |
| Expired leaf, same AP | Refused in both contexts, zero accepted mutations | NOT RUN |
| Expired leaf + code/pin | Still refused; no downgrade or owner-state change | NOT RUN |
| Wrong SAN / untrusted chain | Independently refused with zero accepted mutations | NOT RUN |
| Interrupted request / reconnect | Abort within bound; fresh session required | NOT RUN |
| Rescue hotspot necessary connectivity | Same phone gives station usable validated outbound internet | NOT RUN; conditional prerequisites unaccepted |
| Autonomous renewal then AP HTTPS | Device renews without management over expired TLS or operator certificate replacement | NOT RUN; separate scope required |

## GO / NO-GO gates and next action

| Gate | Current result | Evidence needed to advance |
|---|---|---|
| Host simulation PASS | NOT RUN / intentionally deferred | Only useful after a concrete bootstrap is qualified; then test policy, replay, timeout, rollback and authorization, never browser trust |
| Browser feasibility PASS | NO-GO for combined failure on current path; future trials NOT RUN | Actual same-PWA offline AP positive/negative tests and a complete allowed way to recover a valid channel |
| Real ESP32 feasibility PASS | NOT RUN | Separately authorized spare-board implementation/resources, real Wi-Fi/renewal/time/storage and preserved existing services |
| Security review PASS | NOT RUN | Independent protocol, physical proof, provisioning, credential scope, replay/reset/transfer and interrupted-store review |
| Production integration GO | NO-GO | All above plus ADR P0 and publisher P1–P7 acceptance; explicit integration authorization |

Next action is the minimal phone experiment above, subject to separately authorized
isolated lab setup. If temporary internet and pre-provisioned rescue Wi-Fi cannot
be accepted/qualified, ask the owner to choose a concrete product compromise or
authorize an alternative transport study. Keep recovery blocked meanwhile. Do not
implement a simulator with an assumed successful trust transition.

Additional primary references checked 2026-10-18:

- [W3C Mixed Content](https://www.w3.org/TR/mixed-content/): insecure resource requests
  from secure contexts do not supply this recovery channel.
- [WebKit Web Bluetooth position](https://bugs.webkit.org/show_bug.cgi?id=238049)
  and [current unavailable API list](https://webkit.org/tracking-prevention/).
- [Apple manual certificate trust](https://support.apple.com/en-us/102390): manual
  private-root installation is an explicit trust-provisioning change, outside scope.
