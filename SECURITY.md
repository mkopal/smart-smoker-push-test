# Experimental security boundary

The GitHub Pages site is static. It has no registration upload API, database, backend
handler or connection to an ESP32. The owner-run Linux CLI sends notifications;
the isolated [ESP32 bench publisher](esp32/README.md) can do so only after separately
authorized private provisioning and hardware deployment. It has no configuration
HTTP server. Its private firmware images embed development keys/subscriptions/Wi-Fi
credentials; do not distribute them. Production secure pairing/storage is unresolved.
Never put a VAPID private key in the browser, a URL, Git, GitHub Secrets, Actions logs,
an issue or a screenshot. Only the public VAPID key is entered in the page.

The export contains sensitive endpoint/auth registration information. It remains in
the visible textarea until removal/reload; the page does not persist it in localStorage,
IndexedDB or a cache. The browser necessarily owns its Push API subscription. Only
the explicit language preference is stored by application code. Clear sensitive
clipboard/terminal history as appropriate and transfer exports using an owner-controlled
encrypted channel. No real subscription is part of automated testing.

Keep local files in ignored `local/private/`, parent mode 0700, files mode 0600. The
CLI refuses unsafe modes, direct symlinks, oversized files, malformed/expired exports,
key mismatches and endpoints outside the reviewed provider hostname set. Hostname
checks are not a complete defense against a compromised local machine/DNS. TLS remains
verified; never set NODE_TLS_REJECT_UNAUTHORIZED=0. There is no automatic retry queue.

`scripts/audit_public.py` enforces an exact public file list, inspects staged and working
text for common secret patterns and reviews the static artifact. It is a heuristic,
not proof of absence of all secrets. Review the staged diff manually too. Never
force-add `local/`, `dist/`, npm dependencies or private exports.

GitHub Pages does not provide application-defined HTTP response headers. HTML uses
a CSP meta policy and no-referrer meta; no inline scripts, external CDN or analytics
are needed. HTTP-only CSP directives such as frame-ancestors cannot be enforced by
that meta tag. Hosting headers/caching are controlled by GitHub, not a fake `_headers`
file. Do not claim full isolation from other projects on the same github.io origin:
localStorage is origin-wide, and a malicious same-origin project can be a threat.
Use a dedicated origin for any later production design.

The worker has no fetch handler or offline app-shell cache. Enrollment/reloading needs
network access. Browser-managed worker installation is distinct from offline page
availability. The OS/browser can wake the worker for visible push without an open
document; actual locked-phone delivery, sound and power/Focus behavior require real
phone testing. No critical-alert, guaranteed latency or outage-monitoring promise.

Permission may be revoked, subscriptions may expire/change, and `expirationTime:null`
does not mean permanent validity. Reopen enrollment, export again and replace the
private local file. VAPID key rotation requires unsubscribe/re-enrollment. Removing
an app or clearing browser data can invalidate its registration. The publisher cannot
detect its own host's outage or guarantee message delivery.

Do not report vulnerabilities with keys/subscriptions in public issues. Contact the
repository owner privately without including sensitive values in the first message.

## Isolated HTTPS transport emulator

The optional `https_spike/` tool serves only a fixed synthetic API on an explicitly
selected loopback/LAN address. Its public fixture token is not ownership proof.
It never accepts real subscriptions/credentials or sends push. A separate ignored
static artifact has exact-device CSP. The combined Pages builder includes only its
ten static files under `dist/https-spike/`, preserving the original root PWA bytes.
The device origin is exactly `https://smoker-test.navodio.cz:8443`; the permitted
app origin remains `https://mkopal.github.io`. No CORS policy is changed by building.
The exact 21-file inventory is `PAGES_FILES.txt`; artifact auditing recursively scans
both app directories and rejects unknown entries and symlinks. Keep TLS
material and ACME data in ignored `local/https-spike/`; no issuance, LAN listener,
DNS/router/firewall changes or public hosting are authorized by building/testing.
The [runbook](https_spike/README.md) documents limits, CA trust, physical acceptance,
cleanup and why host PASS cannot close P0 or authorize ESPHome integration.

## P0 — Device Provisioning, Configuration & Recovery

Architecture specification, 2026-10-18. **PROPOSED / UNVERIFIED; overall NO-GO.**
This extends P0 to the complete device lifecycle. The existing experimental
security boundaries above remain in force. Nothing below is an implemented API,
firmware behavior, accepted hardware addition or authorization for a live test.
The [offline recovery assessment](OFFLINE_RECOVERY.md) is preserved verbatim,
including the expired-leaf/no-usable-Wi-Fi blocker. The
[prior LAN HTTPS results](VALIDATION.md#owner-observed-iphone-https-transport--2026-10-18)
remain qualified PASS; they do not establish provisioning or recovery.

### Product contract and evidence levels

One Smart Smoker PWA with English (`en`) and Czech (`cs`) must support an independent
new owner using either iPhone or Android. No customer computer/USB, developer tools,
native companion, mandatory HA, pairing backend, paid provisioning service or
disabled security check. Phone Settings may be needed for an explicit manual Wi-Fi
switch; automatic network joining is not assumed. Static app hosting, public DNS,
public CA and later browser push infrastructure are dependencies, not a hidden
pairing backend. Their ownership, recurring cost and lifetime support must be explicit.

| Evidence level | What is established | What is not established |
|---|---|---|
| Prior real-phone observation | Safari and Home Screen PWA to Linux LAN HTTPS on the owner's reported iPhone 14 / iOS 27.0.1 configuration | Factory setup, AP/offline, negative certificates, Android, device ownership or ESP32 HTTPS |
| Prior separate real-ESP32 observation | Direct outbound Web Push PoC and restoration, within its recorded scope | Secure enrollment, local HTTPS server, provisioning or integrated product |
| Host tests | Existing synthetic transport policy, static artifact and EN/CS regressions | Browser networking, durable flash, real Wi-Fi or physical possession |
| Proposed but unverified | All lifecycle/migration behavior below | No implementation or device result may be inferred |
| Known blocked path | Ordinary HTTPS management with only an expired leaf; combined Wi-Fi loss prevents autonomous renewal | No safe recovery is supplied by a stored application key, AP password or simulated trust state |

The **current existing PWA cannot perform this complete flow as shipped**: neither
worker supplies an offline app shell, and no real owner/Wi-Fi API exists. A future
extension of the same product app, with a reviewed offline release/cache strategy,
is a prerequisite; a second provisioning portal/install would not satisfy the
requirement. No frontend, simulator, catalog or hosting changes are made here.

### Conditional provisioning architecture

The next experiment candidate is an API-only, protected device SoftAP with local
DNS for a unique public FQDN, a valid per-device public-CA certificate, independently
pinned signing identity and sealed possession/recovery material. The same PWA
performs configuration over HTTPS. Existing local HTTP monitoring remains read-only;
it cannot become an unauthenticated setup channel. ESPHome remains the sole owner
of Wi-Fi and preferences; a future adapter must not create a competing Wi-Fi stack.

Required provisioning before sale: unique FQDN, independently generated TLS/signing/
ACME keys, initial public leaf and full chain, narrowly scoped DNS authority, unique
AP WPA credential, one-use claim verifier and separate recovery authority. The
protected per-unit card binds device identity/FQDN, official app origin and separate
secrets. No fleet TLS/AP/claim/DNS secret. Public labels identify a unit only; they
cannot authorize enrollment. No such manufacturing process exists for this unit.

A protected card is a possession factor, not proof that the phone is touching the
actual device. Stronger confirmation requires a qualified local button/display or
other reviewed physical mechanism. No suitable button/display is established in
the hardware inventory. A power cycle may enable bounded AP reachability, but never
resets ownership or grants mutation authority. Copied unused card material remains
a residual ownership risk; do not describe a card-only design as theft-resistant.

Proposed first-use sequence:

1. Install/open the official app online, select EN/CS and verify its offline shell
   is ready. Generate an origin-scoped owner key; do not assume Safari tab and
   installed-app storage are shared. Scan the protected card inside that app.
   Camera scanning and a private manual-entry alternative must both work; no secret
   in an external QR navigation URL, query, fragment or history entry.
2. Initiate the unit's bounded physical setup mode; manually join its unique
   protected AP in Settings and return to the same app. No captive-browser app,
   second install, browser security override or assumed cellular route.
3. Resolve the card's exact FQDN through AP DNS and establish browser-accepted TLS.
   Verify a fresh device-signed challenge against the independent card identity.
   Only then send a claim proof bound to the new owner's public key and transcript.
4. Atomically consume the first-claim authority and store that owner key. Return a
   signed durable receipt. This precedes Wi-Fi mutation so a LAN client cannot win
   the first-owner race. Failed Wi-Fi does not unclaim the device; the same phone
   retains authority and separate recovery handles loss of that phone.
5. Enter home SSID/password in the app. Stage and apply the authorized network
   transaction below, switch the phone to the home network, rediscover the same
   identity and confirm only after authenticated reachability and service readiness.
6. Create any new push subscription only once online and in a supported installed
   context after explicit user action. Push enrollment is separate from network
   commit; absence of internet must not force loss of a working local configuration.

Each mutation binds protocol version, device identity, operation ID, operation type,
expected durable generation, owner key/role, canonical payload digest, app origin,
boot nonce and one-use challenge. Challenges expire after 120 s monotonic time;
request deadlines are 15 s. Exact Host/Origin/CORS and omitted ambient credentials
complement cryptographic proof; OPTIONS never mutates. Serialize configuration,
owner and certificate-changing operations; stale-generation requests conflict.
Use reviewed cryptographic libraries/transcripts, not a bespoke protocol inferred
from the emulator's public fixture token. Protocol/security review remains pending.

### Configuration and owner lifecycle

| Operation | Required authority and transaction | Failure / recovery behavior |
|---|---|---|
| Identify factory unit | Public identity locator plus protected card; valid TLS and independent device challenge | Unknown/mismatched device cannot receive secrets; AP proximity is insufficient |
| First owner | One-use claim, intended owner key and qualified physical confirmation policy; atomic owner/claim generation | At most one winner; lost receipt queries same operation; retries never reconsume claim |
| Read/edit settings | Appropriate owner role, fresh proof, schema/version and expected generation; validate before atomic write | Invalid/out-of-range/stale input produces no change. Secrets are write-only; return presence/status, never stored values |
| Wi-Fi change while reachable | Admin or narrowly scoped network-management grant; explicit confirmation, staged candidate | Follow migration table; never overwrite the last-known-good slot at staging |
| Router replacement / unreachable unit | Physical recovery entry, valid TLS, existing owner proof or separate recovery authority | AP permits the transaction with old network absent. If leaf expired too, remain BLOCKED |
| Add phone | Same app on new phone; its new key verified, existing admin approves key/role/digest in one-use local grant | No copied JSON/subscription or implicit admin role. Four recipients maximum; fifth refused |
| Revoke phone | Surviving admin or recovery authority; durable revocation generation and cancel queued work before receipt | Accepted push cannot be recalled. Revoked keys cannot confirm a pending migration |
| Lost sole phone | Same app and separate recovery authority through valid trusted local channel; rotate/revoke lost authority | Browser storage/cloud restore is not a recovery guarantee; absent all factors fails closed |
| Ownership transfer | Existing admin/recovery authorization plus explicit handoff to new owner's key; revoke old roles/grants/recipients and rotate recovery/rescue/VAPID material | Do not declare complete until previous owner's Wi-Fi and separately managed API/OTA access are rotated/revoked. Interrupted transfer must not revive old authority |
| Factory reset | Authenticated reviewed reset mode and physical policy; preserve unique identity/renewal anchors and consumed-claim tombstone | Clear selected network/owner data atomically and require fresh recovery/transfer authority. Never restore the manufacturing claim. Full erase/identity loss needs service recovery |
| Leaf renewal | Device's scoped ACME/DNS authority and authenticated outbound internet/time, independently of inbound leaf | Validate full replacement then atomically activate; invalid/incomplete replacement leaves management closed |

Device settings cover monitoring, localization/preferences and separately authorized
notification settings only. This design adds no heating start, actuator enable or
restart behavior. Native API/OTA credentials and monitoring/safety functions retain
their separate security boundaries. HA remains optional. UI must distinguish local
configuration success from notification-provider availability or phone delivery.

EN/CS must cover every setup step, permission explanation, network switch,
unconfirmed/rollback/blocked state and recovery instruction, with equal validation
semantics and accessible private credential inputs. Reuse discovered catalogs and
English fallback; no new dependency or hardcoded translated logic is selected now.

### Transactional Wi-Fi migration

Definitions: `active` is the durable last-confirmed network generation, `candidate`
is a separate staged credential slot, and `operationId` identifies one attempt.
Retain `active` unchanged until candidate validation and authorized confirmation
complete. Factory-new devices have no `active`; an absent old router is distinct
from corrupted settings. Never report association, DHCP, internet access or a
host-side simulated transition alone as successful migration.

All bounds below are proposed acceptance limits, not measured platform timings:
staging expires after 120 s; candidate association/DHCP gets 45 s; new-network
rediscovery/confirmation gets 180 s after candidate connectivity; total trial is
bounded by 300 s from apply, whichever applicable deadline occurs first. A stale
challenge requires a fresh challenge without extending the trial. The PWA may
sleep or disappear; the device owns deadlines and rollback. Only one unconfirmed
trial is allowed; confirmation/cancellation is authenticated and generation-bound.

| State | Transition, authorization and durable action | Failure / next state |
|---|---|---|
| `ACTIVE` or `UNCONFIGURED` | Authorized admin stages candidate after validation; persist operation metadata and protected candidate without changing `active` -> `STAGED` | Validation/store failure leaves original state intact |
| `STAGED` | Return signed staged receipt including deadlines; separate fresh authorized apply for same ID/digest -> `TRYING` | Cancel/expiry discards candidate; no network change. Lost receipt uses authenticated status |
| `TRYING` | Durably mark trial started before disconnecting; try candidate association and DHCP, at most one trial per operation -> `VERIFYING` | Wrong credentials, no lease or 45 s bound -> `ROLLING_BACK`; no automatic retry loop |
| `VERIFYING` | Check required service readiness, update/resolve device FQDN through scoped mechanism, await fresh authenticated owner request over candidate STA interface | Failed service, DNS/reachability, TLS or trial deadline -> `ROLLING_BACK`; an AP request cannot confirm the new LAN |
| `CONFIRMING` | Owner on intended new network verifies same pinned identity and fresh candidate nonce/status, then signs confirm bound to ID/digest/generation | Missing/revoked owner, stale challenge or candidate-interface mismatch rejects without commit; cancellation -> rollback |
| `COMMITTING` | Verify all guards still hold; atomically activate candidate generation plus committed receipt; retain prior slot until new commit integrity is established -> `ACTIVE` | Power failure yields old-or-new generation; ambiguous store -> `RECOVERY_REQUIRED`, never guess |
| `ROLLING_BACK` | Invalidate uncommitted candidate, persist aborted receipt, allow 30 s for previous confirmed network and 15 s more for recovery AP readiness | Old network works -> `ACTIVE` with failed-attempt status; absent/unusable old network -> `RECOVERY_REQUIRED` within 45 s total |
| `RECOVERY_REQUIRED` | Bounded protected AP on physical/unconfigured recovery policy; valid TLS plus owner/recovery proof can stage a fresh transaction | No factory reset, erased old settings, automatic unclaim or HTTP fallback. Expired TLS -> `BLOCKED_IDENTITY` |
| `BLOCKED_IDENTITY` | Separately qualified outbound rescue network may renew leaf before reopening HTTPS | No internet/trust bootstrap -> remain blocked; possession alone cannot advance state |

Success requires all of these, recorded in a signed receipt/status:

- Candidate Wi-Fi association and valid address/routing, with no stale old-interface
  response accepted as new-network validation.
- A fresh request from the owner's same PWA reaches HTTPS on the candidate STA
  interface at the authenticated FQDN; browser TLS and independent signing identity
  both pass. The phone confirms intended network through Settings and explicit UI;
  the PWA cannot reliably read its current SSID or prove the physical router identity.
- Device-side readiness checks show configuration store integrity, responsive
  local monitoring, and initialized preserved encrypted API/OTA services. This is
  a signed self-report, not proof that a native HA/API client reconnected; those
  actual services need later independent integration tests. No HA host is required.
- The authorized confirm commits a new durable generation and the phone retrieves
  its receipt. A lost response is `outcome unknown` until authenticated status
  resolves it; it never causes another apply. Cloud/push health is separately shown.

Do not embed SSID/password in public digests/receipts: use an opaque random candidate
handle and an authenticated transaction commitment with a fresh private salt, under
the reviewed protocol. Never disclose a password-verification oracle to unauthenticated
clients. Credentials travel only in authenticated HTTPS request bodies and protected
device storage. Keep them out of URLs, browser history, localStorage/cache, logs,
traces, telemetry, push payloads, screenshots and public artifacts. Clear app form
references after staging; JavaScript cannot promise physical memory erasure.

Durability requirements: A/B records with authenticated integrity, transaction ID,
generation, consumed-authority/revocation state and atomic commit marker. Preserve
last-known-good settings across all pre-commit writes. Redundant slots alone do
not prevent malicious rollback; production storage/anti-rollback must be reviewed.
On reboot, a durably committed generation is authoritative; an uncommitted trial
is aborted and old settings attempted, then AP recovery. Never restart a timed trial
with a fresh timer after reboot. An interrupted cleanup cannot undo a commit or
restore a consumed claim. If commit durability cannot be established, block writes.
Storage protection and power-cut behavior are requirements, not existing capabilities.
Native ESPHome/SDK credential auto-save, reconnect and reboot policies must respect
this transaction; a default persistence callback must not commit a candidate early.
Qualify that integration before implementing network mutations.

| Required scenario | Expected outcome |
|---|---|
| Original network still works | Stage while reachable, try candidate, confirm through new network; failed trial returns to old settings |
| Router replaced with new SSID/password | Enter protected AP using existing owner/recovery authority while leaf valid; same transaction, no assumed rollback connectivity |
| Incorrect credentials | Candidate fails within bound; original settings remain durable; old network or AP permits correction |
| Power loss at any phase | Old-or-new confirmed record only; unconfirmed candidate never silently promoted; status shows committed/aborted/blocked outcome |
| New DHCP address | Rediscover by stable FQDN, verify identity/transaction afresh; stale DNS cannot cause success or a certificate bypass |
| Old network absent after failure | Retain its settings but enter authenticated AP recovery; do not loop forever or auto-reset owners |
| Phone lock, wrong network or confirmation lost | Device deadline still applies; rollback unless commit already durable; query outcome on reconnect |

No AP+STA concurrency or dual-radio operation is required by this specification:
the device may stop its setup AP for candidate testing and restore it on rollback.
Actual radio, timeout, monitoring and API/OTA coexistence require spare-board tests.

### Discovery, DNS and certificate lifecycle

Use a stable per-device public FQDN whose SAN matches the certificate in all modes.
On AP, DHCP/local DNS maps that exact name to the device. On LAN, a directly updated
public record containing the private address is a conditional candidate, not proven
discovery. DNS rebinding filters, stale caches, encrypted DNS, VPN, client isolation
and no-internet routing may break it. An IP literal/`.local` name is not a substitute
for that certificate identity. QR/manual locator entry discovers public identity,
not authority. The PWA must not scan subnets or assume an arbitrary Bonjour browser
API, DNS-cache flush API, router changes or native network configuration access.

Device-driven DNS-01 renewal needs public TXT authorization, an owned domain,
per-unit name/type-scoped update permission, trusted time and outbound internet.
No provider with that full operational contract has been selected. Never install
a long-lived broad Cloudflare token or shared fleet key in firmware. Manufacturing,
domain renewal, CA/root changes, key rotation and revocation are lifetime support
obligations. Verify actual issued validity, renew early with bounded jitter/backoff
and preserve ACME order state; certificate shelf life can expire before first sale.
See [DNS-01](https://letsencrypt.org/docs/challenge-types/) and
[announced validity reductions](https://letsencrypt.org/2025/12/02/from-90-to-45.html).

If known Wi-Fi still works, an expired inbound leaf need not prevent outbound renewal.
If Wi-Fi is absent and the only leaf expired, both factory setup and recovery are
blocked under the present HTTPS contract. Neither local DNS nor application pinning
repairs it. A pre-provisioned per-unit rescue SSID/PSK plus a supported phone hotspot
could provide temporary outbound internet before renewal; it grants no owner rights
and requires manual setup/carrier compatibility. It is unverified and cannot serve
a fully offline user. No simultaneous hotspot/AP assumption or guaranteed free
tethering. Service/computer recovery, private roots, native helpers or a different
transport remain explicit product compromises, not selected fallbacks.

### Cross-platform capability matrix

`P` = prior observed PASS in its recorded scope; `U` = proposed/unverified;
`B` = blocked for the named path; `D` = documented API/platform behavior only.
Installed and browser contexts require independent trials; documentation is not
phone evidence and installing an app does not grant extra TLS/Wi-Fi privileges.

| Capability / option | iOS Safari | Installed iOS PWA | Android Chrome | Installed Android PWA |
|---|---|---|---|---|
| Public app -> ordinary LAN public-CA HTTPS | P: reported Linux transport only | P: same qualified scope | U: no phone result | U: no phone result |
| Same app -> protected AP, valid per-unit leaf, physical/card proof | U: DNS/offline and storage | U: offline cold launch and proof | U: AP routing, permission and proof | U: cache/storage plus same networking |
| Pre-provisioned FQDN/leaf and direct DNS strategy | U: resolver/rebinding behavior | U: same + standalone | U: resolver/LNA behavior | U: same + standalone |
| Manual Wi-Fi switch | U for complete UX; Settings required | U: return to same app | U: Settings/no-internet behavior | U: return to same app |
| HTTP + application proof | B for proposed trusted-HTTPS-only contract | B: same | D: some LNA-gated local HTTP exceptions; not authenticated TLS | D: same, no cross-platform solution |
| Stored signing key + expired HTTPS | B: Fetch cannot override TLS | B: same | B: same | B: same |
| Web Bluetooth provisioning | B for supported Safari design | B: installation adds no API | D: available on supported Chrome/Android, needs user selection | D: exact installed context untested |
| WebRTC / WebTransport alternate transport | U: complete authenticated bootstrap missing | U: exact shipping version/context | U: complete bootstrap missing | U: exact shipping version/context |
| Rescue hotspot -> outbound renewal -> trusted AP | U: same phone sequence/carrier | U: same + app return | U: hotspot compatibility | U: same + app return |

Chrome documents Local Network Access permission and limited mixed-content exemptions;
do not generalize the earlier HTTP rejection to all modern Chrome requests. A
permission makes some transport reachable, not authenticated or acceptable for
Wi-Fi secrets, and does not fix iOS or the expired-HTTPS path. Test normal allow,
deny and reallow without flags/enterprise overrides. Sources:
[Chrome LNA](https://developer.chrome.com/blog/local-network-access/),
[Android site permissions](https://support.google.com/chrome/answer/114662?co=GENIE.Platform%3DAndroid&hl=en).
Native permission configuration is not a web workaround; Apple's TN3179 reference
did not render fully through the research tool, so no new claim about current
Safari/standalone prompts is inferred from it. Record actual permission behavior.

### Approach comparison across lifecycle and operating costs

| Option | Factory / later configuration / combined expiry failure | Internet, identity lifecycle and manufacturing | UX, security and scale |
|---|---|---|---|
| Protected SoftAP + physical/card factor alone | Network reachable, but no trusted channel without another TLS identity; later configuration needs one too; expiry still blocked | Unique AP/card provisioning and qualified physical input; no CA supplied by WPA | Manual switch; reusable/stolen code and rogue AP risks; insufficient alone |
| SoftAP + manufactured public-CA leaf + identity/card | Conditional factory setup while valid; subsequent changes use transactions; combined failure blocked | Initial app download/issuance online; local valid-leaf AP may work offline; per-unit CA/keys/renewal required | Best next browser experiment; per-unit provisioning/custody cost and shelf-expiry gap |
| Public DNS / split DNS / direct scoped updates | Locator for preceding option, not its own trust or pairing mechanism; absent internet can prevent LAN rediscovery; expiry blocked | Public domain and DNS lifecycle/provider scope; AP local DNS must work independently | No manual IP expected; filters/cache/metadata leakage and fleet update capacity need tests |
| Browser local mechanisms: BLE, mDNS, QR | QR supplies locator and protected factor; no generic assumed mDNS enumeration or Wi-Fi-join API. BLE does not provide common Safari support | QR/card manufacturing; camera/manual input; independent TLS remains needed | No second app; QR cannot silently navigate with secrets; Android-only BLE cannot satisfy both platforms |
| WebRTC / WebTransport | Potential separate local channel, but authenticated signaling/hash/time bootstrap and embedded stack not specified; no claimed factory/recovery success | Device identity provisioning still needed; WebTransport custom certificate rules differ from Fetch and require fresh valid leaf/hash | Technically credible separate study; API availability alone is insufficient, resource/security effort unknown |
| Rescue network + autonomous DNS-01 | Supplements valid-leaf architecture for expired factory/recovery unit if preloaded network is available; later normal transactions unchanged | Temporary outbound internet, scoped DNS/CA authority, per-unit rescue PSK provisioning and transfer rotation | Same phone hotspot may work, carrier/OS/manual steps unqualified; not fully offline or guaranteed free |
| Device-hosted second portal/private root/native/service recovery | Could supply different bootstrap under different requirements | Extra origin/app, manual trust or external assistance | Conflicts with accepted single-PWA/security/phone-only requirements; owner decision required |

[Web Bluetooth on supported Chrome](https://developer.chrome.com/docs/capabilities/bluetooth)
does not establish Safari availability. For alternatives see the
[WebRTC specification](https://www.w3.org/TR/webrtc/) and
[WebTransport certificate-hash requirements](https://www.w3.org/TR/webtransport/#dom-webtransportoptions-servercertificatehashes).
WebTransport's standards-defined custom authentication is not a Fetch override:
the hash must be securely provisioned and the certificate currently valid with
at most two weeks' validity. A fixed old hash is not a complete renewal bootstrap.
An alternative design may be studied, but must not silently relax the present
HTTPS-only mutation contract or pretend that all browser transports are impossible.

### Lifecycle threat model

Assets: Wi-Fi credentials, owner/recovery authority, TLS/signing/ACME/DNS/VAPID keys,
subscriptions and durable generations. Boundaries: delivered app/origin/storage,
untrusted radio/LAN/DNS/time, browser TLS, device parser/policy/storage and external
CA/DNS/push infrastructure. Public CA/DNS and authentic app delivery remain trusted;
an application signing pin does not protect plaintext from a compromised trusted CA.

| Threat / failure | Required control / rejection |
|---|---|
| LAN race, CSRF, forged Origin | One-use claim/owner proof and expected generation; exact Host/Origin, authenticated non-simple JSON; no first-client-wins or cookie authority |
| Copied card, stolen phone or rogue AP | Separate claim/recovery/AP material, qualified physical confirmation, fresh device identity, revocation and custody; copied unused sole bearer factor is residual risk |
| Replay, brute force, reboot | Signed transcript, 120 s challenge, consumed durable IDs/generations; proposed five failed proofs -> 60 s cooldown and ten/hour, durable anti-reset accounting |
| Candidate substitution / concurrent edits | Bind intended candidate privately to operation and owner; single writer, stale generation conflict, interface-bound confirmation |
| False migration success / DNS rebinding | Fresh browser-authenticated request on candidate interface; matching pinned device/generation; failed DNS never permits raw-IP/TLS bypass |
| Credential leakage | No request-body logging, reflected passwords, URLs/history/cache/push/analytics; bounded input, no retained PWA credential store; protected device slots |
| Power cut / full or corrupt store | Atomic old-or-new records and receipts; no automatic candidate promotion, reset-to-unclaimed or revival of revoked owners |
| Phone removed/lost during migration | Device-owned deadlines and rollback; lost receipt resolved by status; separate recovery if sole key lost |
| Transfer/reset abuse | Existing authority plus explicit reviewed physical policy, revoke/rotate before completion; factory claim tombstone survives reset |
| Expiry / hostile time / no internet | Correct browser clock, validated outbound TLS/time; no grace bypass or offline ACME assumption; named blocked state |
| Physical flash extraction / app-origin compromise | Production hardening and controlled dedicated-origin releases must be qualified; no assumed secure element or hardware-protected browser keys |

### Smallest physical experiments and measurable acceptance

**NOT RUN. This is a plan only.** No current authority to change a network, DNS,
certificate, emulator, app deployment or firmware. A later lab authorization must
provide an isolated endpoint/AP, valid and expired certificate fixtures, and a
cache-capable extension of the same PWA. A lab host stands in for the device; it
is not a pairing backend or a customer computer requirement. Preserve the running
HTTPS experiment and existing push subscriptions. Missing prerequisite -> NOT RUN,
not a workaround through another app, HTTP or disabled security.

1. **E1: browser bootstrap, first priority.** On an actual iPhone and Android phone,
   install the same reviewed EN/CS app release online. Manually join an isolated
   protected no-internet AP, disable cellular for this row, and cold-launch/restart
   the same app. Resolve the per-device FQDN and perform real HTTPS/CORS exchange,
   pinned device challenge and synthetic claim proof; send credential-shaped canary
   SSID/password only to the lab endpoint's volatile sink. Never join a real router
   with this canary or use the public fixture token as owner authentication.
   Require a fresh private receipt bound to the intended identity/operation; no
   credential content in logs, URLs, cache or artifacts. Local physical confirmation
   is modeled at the lab endpoint and cannot pass the actual hardware-possession gate.
2. **E1 negatives.** In both browser and installed contexts on each OS, reject wrong
   claim/signature/identity, replay/expired challenge, denied LAN permission, rogue
   DNS/AP and genuine expired/wrong-SAN/untrusted TLS. Use correct phone clock and
   fresh TLS sessions. Wrong-proof tests run behind valid TLS to reach authorization;
   certificate negatives must fail earlier. Zero accepted mutations for every negative.
   Correlate controlled fixtures and sanitized endpoint observations; a generic
   fetch error alone does not prove the reason. Interrupted/locked trials require
   fresh challenge and cannot report success from cached UI.
3. **E2: real migration, only after E1 and separately authorized spare-board work.**
   Use two isolated lab networks and synthetic credentials. Exercise every row of
   the migration scenario table on each installed phone, with old network present
   and absent, wrong password, changed DHCP address/stale DNS, permission denial,
   lost confirm response, phone sleep and power cut in each durable phase. Observe
   actual radio/service readiness, fresh owner reconnection on candidate interface
   and durable commit/rollback receipts. No production unit, HA or real subscriptions.
4. **E3: expiry escape, separate conditional experiment.** If the owner accepts
   temporary internet and pre-provisioned rescue credentials, qualify the same
   phone's hotspot -> device outbound renewal -> return to protected AP -> trusted
   same-PWA request. First test connectivity without DNS/CA mutations; later scope
   must authorize actual automated issuance/activation. Manually replacing a leaf
   is a control, never phone-only recovery evidence. Fully offline case stays blocked.

E1 quick screening requires three consecutive runs per OS/context. Advancing the
browser gate requires the architecture reference's stronger **10/10** phone-only
runs per claimed path on both current and candidate minimum supported versions;
do not derive support floor from iOS Web Push's 16.4 introduction. Failure detection
must be <=30 s (individual requests <=15 s); configuration trial/rollback must obey
the device bounds above. Observe >=4/5 nontechnical users completing first-use UX
within five minutes excluding initial app download, without expert intervention;
cover both EN/CS and both phone families. These are targets, not measured results.

For E2, zero unauthorized changes; each pre-commit failure preserves old confirmed
settings, each interrupted commit yields old-or-new state, and old-network absence
offers protected AP recovery within the trial plus rollback bounds (<=345 s from
apply). A signed service self-report alone cannot close real API/OTA/monitoring
coexistence; measure those independently on the spare board. No association-only PASS.

Record test ID/time/timezone, source SHA/release, OS/browser/model, tab/installed,
locale, cold/warm launch, permission decision, routing/cellular/DNS mode, public
certificate metadata, operation/generation and deadline timings, observed outcome
and accepted-mutation count. Keep raw network/credential traces private; redact
before any record is shared. Host tests and diagrams never replace these trials.

### Updated GO / NO-GO decision matrix

| Gate | Current evidence/status | Closure required |
|---|---|---|
| Ordinary iPhone LAN HTTPS transport | Prior qualified PASS, preserved | No widening beyond recorded Linux/phone configuration |
| Factory identification/possession/first owner | PROPOSED; NO-GO | E1 transport plus actual per-unit provisioning, physical factor and protocol review |
| Same-PWA AP/offline cross-platform bootstrap | NOT RUN; NO-GO | E1 in all four browser/installed contexts, both locales, current/minimum supported versions |
| Transactional Wi-Fi/configuration lifecycle | Specification only; NO-GO | E2 real association, authenticated rediscovery, services, rollback and power-cut trials |
| Add/revoke/lost phone/transfer/reset | PROPOSED; NO-GO | Atomic authority/storage negatives, real phone persistence and reviewed handoff/reset |
| Expired identity with working internet route | PROPOSED; NO-GO | Scoped DNS/ACME/time/key lifecycle and atomic renewal proven |
| Combined Wi-Fi loss + expired identity | Known blocked current path; NO-GO | Qualified allowed independent bootstrap such as conditional E3, or owner-approved product compromise |
| Host-side policy tests / simulation | Existing fixture PASS only; no lifecycle simulator | Later bounded tests may verify policy after browser bootstrap, never promote TLS trust by assignment |
| ESP32 resource/service coexistence | NOT RUN; NO-GO | Spare-board measurements, native Wi-Fi ownership, storage/hardening, preserved API/OTA/monitoring |
| Independent security review | NOT RUN | Protocol, custody, DNS scope, storage and physical-risk review |
| Production integration | NO-GO | All lifecycle/P0 and publisher P1–P7 gates plus explicit integration authorization |

**Recommendation:** prioritize E1's protected SoftAP + valid per-device public-CA
identity + independently verified possession exchange in the same PWA on real
iPhone and Android. It isolates the first unresolved common-platform requirement
without an embedded implementation or large simulator. Its success would justify
further lifecycle experiments, not close shelf-expiry/combined-failure recovery.
No approach currently proves the complete mandatory product contract.
