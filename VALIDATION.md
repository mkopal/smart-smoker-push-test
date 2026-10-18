# Validation evidence

## P0 provisioning, configuration and recovery architecture — 2026-10-18

**Architecture specified; lifecycle/browser/device/security acceptance NO-GO.**
See [lifecycle specification](SECURITY.md#p0--device-provisioning-configuration--recovery).
This iteration changes documentation only. `OFFLINE_RECOVERY.md` and all prior
evidence entries are unchanged. Existing findings were first reviewed, revalidated
and committed locally as `3659939` (`docs: record offline recovery browser bootstrap blocker`)
on `experiment/offline-recovery-feasibility`; no push, merge or deployment.

The extension covers factory identity, physical possession, first owner, Wi-Fi and
configuration writes, transactional network migration/rediscovery/service checks,
phone grants/revocation, transfer/reset and certificate lifecycle. It distinguishes
all four browser/installed contexts, manufacturing/DNS/offline dependencies and
source-backed platform rules from real-phone evidence. The next proposed experiment
is the same-PWA protected-AP exchange with a valid per-unit public-CA identity on
actual iPhone and Android; credential-shaped canary only at the first browser gate.
No simulator, live protocol endpoint or firmware was implemented. No compromise
for combined Wi-Fi loss and certificate expiry was accepted.

Official Fetch/W3C, Chrome, WebKit and CA sources were inspected and linked in the
specification. Chrome's documented LNA-gated HTTP exceptions are explicitly qualified
instead of claiming universal modern HTTP blocking. Apple TN3179's rendered content
was unavailable to the research tool; no new Safari permission conclusion depends
on it. These source checks are not device tests.

Before the first commit, reran all commands in the previous assessment's table:
`npm test`, both targeted Python suites (7 + 6 tests), local Pages build, public
audit, audit-script syntax and staged/worktree whitespace checks: all PASS with
Node 22.20.0. The five-file staged diff contained only the intended assessment,
documentation links, validation and exact inventory entry. No unrelated changes.

Architecture-step validation, from this repository with
`export PATH="/home/mkopal/.nvm/versions/node/v22.20.0/bin:$PATH"`:

| Command / check | Actual result |
|---|---|
| `npm test` | PASS: existing offline publisher/enrollment/localization/worker behavior |
| `python3 -m unittest discover -s tests -p 'test_site.py' -v` | PASS: 7 static/localization/inventory/security-boundary tests |
| `python3 -m unittest discover -s tests -p 'test_pages.py' -v` | PASS: 6 artifact, original-source preservation and deployment-isolation tests |
| `python3 build_pages.py`, `python3 scripts/audit_public.py` | PASS: local 21-file artifact, exact Git inventory and staged/worktree secret heuristics; no hosting action |
| `python3 /tmp/check_p0_lifecycle_docs.py` | PASS: three Markdown files only, local links/anchors/fences, offline findings byte-for-byte unchanged, original security boundary and historical validation preserved |
| `git diff --check`, `git diff --cached --check` and final diff review | PASS: focused append-only specification/validation and README link; no code, inventory or public artifact contract changes |
| E1 actual iPhone/Android, E2 spare-board migration, E3 rescue/renewal | NOT RUN; future test prerequisites and measurable acceptance documented |
| New lifecycle simulator / independent security review | NOT RUN; deliberately no simulator, no security certification claimed |
| Production firmware/build/flash, network/DNS/CA/credentials, emulator/Pages, push/merge/deploy | NOT RUN: prohibited in this iteration; no dependencies installed |

Host checks cover unchanged artifact/security boundaries and documentation hygiene,
not the proposed lifecycle behavior. No Wi-Fi listener or real network change is
needed. Full TLS/ESP32 suites and firmware builds are not applicable to this
documentation-only extension. First-use/expired identity, true possession, actual
DNS scope, protected storage, clock/bootstrap, services/resources, phone permissions
and usability remain explicit unverified or blocked gates.

## Offline recovery feasibility-first assessment — 2026-10-18

**NO-GO for expired-leaf / no-usable-Wi-Fi recovery through the current HTTPS
design.** See [assessment, state contract, threats and minimal phone protocol](OFFLINE_RECOVERY.md).
This is a source-backed architectural conclusion, not a new observed phone result.
The prior ordinary LAN HTTPS PASS below is preserved without widening its scope.

Inspected clean baseline `a4d9670` on `esp32-direct-web-push-poc`, existing tests,
HTTPS server/UI/build/security boundaries and workers, plus the main repository's
instructions, ADR-008/009, architecture/enrollment, plan and validation records.
Created local branch `experiment/offline-recovery-feasibility`. No simulator was
implemented because its assumed trust transition would not test browser bootstrap.
Documented conditional hotspot/ACME ordering without accepting a product compromise.
WebTransport/WebRTC are explicitly distinguished from ordinary Fetch; neither is
claimed to be a qualified replacement. Official Fetch/W3C, WebKit, Apple and CA
sources are linked in the assessment. No live infrastructure was contacted for
device tests or modified; public documentation research only.

Changed files: `OFFLINE_RECOVERY.md`, `README.md`, this record, `PUBLIC_FILES.txt`
and `scripts/audit_public.py`. The last two add only the new documentation path to
the exact repository allowlist; the Pages artifact inventory remains unchanged.

Commands below run from this repository with
`export PATH="/home/mkopal/.nvm/versions/node/v22.20.0/bin:$PATH"` (Node 22.20.0):

| Command / check | Actual result |
|---|---|
| `npm test` | PASS: existing offline publisher/enrollment/localization/worker fixtures; no browser or recovery feasibility claim |
| `python3 -m unittest discover -s tests -p 'test_site.py' -v` | PASS: 7 tests, including exact documentation inventory and audit negative cases in a temporary Git fixture |
| `python3 -m unittest discover -s tests -p 'test_pages.py' -v` | PASS: 6 tests, unchanged original PWA bytes, exact 21-file artifact and deployment isolation |
| `python3 build_pages.py` | PASS: local build only, 11 root and 10 isolated spike files |
| `python3 -m py_compile scripts/audit_public.py` | PASS |
| `python3 scripts/audit_public.py` | PASS: exact reviewed Git inventory, staged/worktree secret heuristics and unchanged static artifact boundary |
| `git diff --check`, `git diff --cached --check`, final diff/source-scope review | PASS: five focused files, documentation plus its exact allowlist entry; existing transport/UI/firmware/workflow unchanged |
| New recovery simulation, real iPhone/AP/expiry/hotspot/ACME/ESP32/security review | NOT RUN; simulator intentionally deferred and physical protocol supplied, no acceptance gate closed |
| Firmware compile/flash, live emulator restart, DNS/token/certificate operations, hosting, push/merge/deploy | NOT RUN: outside authorized scope; no dependencies installed |

Full TLS/ESP32 host suites were not rerun: changes affect documentation and its
exact allowlist only. Relevant static/audit/build regressions above ran without
starting a network listener or accessing private inputs. Host checks do not prove
Safari trust, ESP32 resource fit, durable authorization or production readiness.

## Owner-observed iPhone HTTPS transport — 2026-10-18

**PASS for the reported synthetic LAN transport only; P0/enrollment/production NO-GO.**
Owner confirmation supplied 2026-10-18, supported by screenshots according to the
owner; this task did not inspect screenshots, instrument phone requests, repeat
live tests or verify remote CI. Earlier NOT RUN records remain historical.

| Metadata | Owner-supplied value |
|---|---|
| Phone / OS / network | Apple iPhone 14 / iOS 27.0.1 / owner's local Wi-Fi/LAN |
| App origin / application | `https://mkopal.github.io` / `https://mkopal.github.io/smart-smoker-push-test/https-spike/` |
| Linux HTTPS origin | `https://smoker-test.navodio.cz:8443` |
| Certificate | Let's Encrypt YR1; subject/SAN `smoker-test.navodio.cz`; Cloudflare DNS-01 |
| Validity (UTC) | 2026-10-18 15:39:20 through 2027-01-16 15:39:19 |
| Trust | No custom root or certificate-warning bypass, owner-reported |
| Renewal dependency | Temporary Cloudflare API token expires 2026-11-17 before leaf expiry; replacement/autonomous lifecycle unsolved |

| Observation | Reported result |
|---|---|
| Linux normal trusted TLS, no disabled validation | PASS |
| GET `/spike/v1/challenge` / CORS preflight | PASS: 200 / 200 with expected headers |
| Disallowed Origin / unauthorized POST | PASS: 403 without allow-origin / 401 |
| Existing push PWA root / spike below `/https-spike/` | PASS: preserved / deployed |
| PR CI / main CI | PASS: checks without deployment / build and deployment succeeded |
| Safari tab | PASS: loaded, detected tab mode, tap on `Run synthetic HTTPS checks` produced `Checks passed in this session` |
| Installed Home Screen PWA | PASS: installed/launched, detected Home Screen mode, same action and success message |

Inspected local UI `4f8b3f9` requires challenge 200, missing-token 401, malformed 400,
synthetic commit 200 and replay 409 for the success message. This is a source-level
interpretation of owner-observed UI, not independent per-request iPhone evidence.
Deployed SHA, screenshot IDs, exact run time, Safari build, certificate fingerprint,
resolver details, prompts/denials and repeated runs were not supplied. No personal
phone identifiers or private certificate/token material are recorded.

Exact owner-supplied lab IPv4 is retained only in the main project's
[canonical record](../smart-smoker/docs/VALIDATION.md#owner-observed-iphone-https-transport--2026-10-18);
it is intentionally omitted here to preserve this repository's existing public
private-address audit, without changing/weakening the audit. GitHub readers can use
[main validation](https://github.com/mkopal/smart-smoker/blob/esp32-direct-web-push-poc/docs/VALIDATION.md).

These passes promote ordinary Linux LAN transport on this configuration only.
The public fixed token is no ownership proof. Offline AP/DNS, phone-side expired/
wrong-hostname rejection, recovery/permissions, Android, manufacturing/owner protocol,
durable storage, autonomous renewal, actual ESP32 server and concurrent fit remain
unverified. Prior direct ESP32 locked-iPhone push/sound is independent and unintegrated.
The two lab PWAs do not change the one-PWA product requirement.

See the main [bootstrap options/threat model and next offline P0](../smart-smoker/docs/WEB_PUSH_ENROLLMENT.md#bootstrap-options-and-constraint-conflict).
No live change, new CI run, push or deployment occurred in this documentation task.
Both initial trees were clean: main `0b2e39a`, experiment `4f8b3f9`, branch
`esp32-direct-web-push-poc`. Cached remote-tracking refs/history inspected but not
refreshed; cached origin/main predates reported merge, so no deployed SHA is inferred.

| Local command/check executed for this documentation update | Result |
|---|---|
| Main: `export PATH="$PWD/local/task-install:/home/mkopal/.nvm/versions/node/v22.20.0/bin:$PATH"; task --list; task test` | PASS: pinned existing go-task, 90 Python tests, repository/dashboard/generated-web and behavioral host checks; no hardware |
| Experiment: `export PATH="/home/mkopal/.nvm/versions/node/v22.20.0/bin:$PATH"; npm test` | PASS: offline publisher/enrollment/localization/worker behavior |
| Experiment: `npm run test:library` with the same Node PATH | PASS on authorized offline rerun outside sandbox; first run failed because sandbox blocked Node subprocess with EPERM. Actual encryption/decryption, wrong-auth rejection, ES256 and CLI lifecycle; no push |
| Experiment: `python3 -m unittest discover -s tests -v` with the same Node PATH | PASS: 31 tests on authorized rerun, temporary loopback TLS only. First sandbox run could not open loopback listener (EPERM); not a product failure or real-phone test |
| Experiment: `python3 build_pages.py`; `python3 scripts/audit_public.py` | PASS: 11 root files plus 10 isolated spike files, exact public inventory/index/worktree secret heuristics and artifact boundary; local build only |
| `python3 /tmp/check_smoker_enrollment_docs.py` | PASS: nine Markdown-only changed files, added local links/anchors, balanced fences, seven P0 blockers and unchanged historical enrollment proposal body. Initial check caught two incorrect relative links, corrected before final PASS |
| Both: `git diff --check`; final diff/file-scope review | PASS: focused documentation-only changes, no code/UI/catalog/configuration/private artifacts changed; existing EN/CS behavior preserved |
| Firmware compile/validation, new protocol model, independent security audit, real phone/device/live infrastructure checks | N/A for firmware build (no code/config changes); NOT RUN for new experiment/security/hardware/live checks. They remain explicit future gates |

Logs and documentation helper are temporary `/tmp` files, not repository artifacts.
No dependency installed. Secret/artifact heuristics and manual diff review are not
an exhaustive security audit. Source research rechecked official DNS-01, Fetch,
WebKit Home Screen and Apple hotspot documentation. Pinned IDF 5.5.5 rendered/raw
retrieval was unavailable; moving stable resolved to 6.1 and does not qualify pinned
interfaces or resource usage. No independent security certification is claimed.

## Successful isolated ESP32 PoC and full restoration — 2026-10-16

Documentation finalization on `esp32-direct-web-push-poc`; clean initial baselines:
main `880a80a`, experiment `3a87c84`. Both origins fetched successfully after retry
outside sandbox DNS restrictions, with no remote divergence. Evidence comes from
the owner's supplied sanitized firmware/build/restore results and explicit phone/UI
observations, not new hardware execution or private-artifact inspection by this task.
Earlier preparation/software-only NOT RUN entries below retain their original scope.

| Verification | Actual result / evidence boundary |
|---|---|
| Wi-Fi / IPv4 / SNTP and publish readiness | PASS after manual CONNECT; initial reason 203 association failure blocked publishing; root cause unknown; no automatic reconnect tested |
| Real ESP32 Web Push encryption / VAPID / HTTPS | PASS for one send using diagnostic implementation `3a87c84`, IDF 5.5.5, HW-395 / ESP-WROOM-32D, ESP32-D0WD-V3 revision 3.1, 4 MB, no PSRAM |
| Provider acceptance | **PASS: HTTP 201**, instrumented firmware result |
| Locked iPhone delivery | **PASS: explicitly owner-confirmed**, independently of provider acceptance |
| Audible iPhone notification | **PASS: explicitly owner-confirmed**, no general iOS sound guarantee |
| Isolated heap/stack/wall time and real-input build | Recorded in the [authoritative measurement report](esp32/FEASIBILITY.md); wall time is not CPU utilization and static memory is not runtime heap |
| Production full raw flash restore | **Verified PASS**, esptool 5.3.1 full 4 MB write/verify/readback/cmp/SHA-256; [canonical backup/restoration record](https://github.com/mkopal/smart-smoker/blob/esp32-direct-web-push-poc/docs/ESP32_BACKUP_RESTORE.md) |
| Original HTTP UI returned | **Verified PASS (owner-confirmed)** |
| HA native API reconnect / entity updates / OTA availability / authenticated OTA transfer | **NOT VERIFIED** in this test record |
| Extended reliability / automatic recovery / Android / multiple phones / secure production pairing-storage / integrated ESPHome resources | **NOT VERIFIED**; production integration remains **NO-GO** |
| New device, serial, flash, reset, OTA, push or live infrastructure operation in this documentation task | **NOT RUN: prohibited**; board was USB-only without control hardware during the reported experiment |

The isolated PoC is successful. It does not complete production integration or
provide delivery/safety guarantees. Next engineering work is bounded Wi-Fi reconnect
and SNTP readiness, followed by the report's prioritized roadmap. Production source,
build configuration, partitions, private credentials and firmware artifacts remain
unchanged. Existing EN/CS UI behavior is preserved.

Checks used the existing Node 22.20.0 via
`export PATH="$HOME/.nvm/versions/node/v22.20.0/bin:$PATH"`; no dependency installation.

| Experiment check | Actual result |
|---|---|
| `npm test` | PASS: publisher, enrollment, localization and worker behavior offline |
| `npm run test:library` | PASS: real encryption/decryption, wrong-auth rejection, ES256 signature and private CLI lifecycle offline; sandbox initially blocked Node subprocess with EPERM, approved rerun outside sandbox passed; no push sent |
| `python3 -m unittest discover -s tests -v` | PASS: all 11 methods, including private provisioning and public artifact guards |
| `python3 build.py` | PASS: exactly 11 approved static public artifact files; local build only, no deployment |
| `python3 scripts/audit_public.py` | PASS: exact public Git inventory, index/worktree secret heuristics and static artifact boundary |

| Documentation check | Actual result |
|---|---|
| `python3 /tmp/check-push-docs.py` (temporary host-only review helper) | PASS: 10 Markdown-only changed files, 72 local/cross-repository links including anchors, balanced fences, 25 Bash blocks syntax checked without executing their commands |
| `git diff --check` and `git diff --cached --check` | PASS: no whitespace errors; final worktree/staged documentation-only scope reviewed |
| Security / artifact review | PASS: repository index/worktree heuristics and changed content reviewed; no private credentials, network address, backup paths, generated firmware or runtime configuration staged. Heuristics are not an exhaustive secret audit |
| Firmware compile / device tests | N/A for this documentation-only change; no new firmware build, device operation, remote CI or deployment result claimed |


## Safe ESP32 serial diagnostics — 2026-10-16

Baseline `725231b`, clean `esp32-direct-web-push-poc`; origin fetched before edits
(after sandbox DNS retry). No main-repository or production configuration changes.
Owner reports physical PoC flash/boot and HEAP around 218 KB, with generic SEND
refusal and silent CONNECT. This is owner-reported prior-image evidence with
unrecorded exact image/phase/units; no physical validation is repeated by this task.

Added read-only STATUS and distinct publish blockers, station/IP-loss tracking,
SNTP sync observation, numeric single-connect results and fixed startup-operation
errors. SDK logs remain suppressed. No automatic reconnect/send or new network
configuration is introduced; synthetic builds keep network disabled but expose the
console. Clock plausibility and observed synchronization are deliberately separate.

| Executed check | Actual result |
|---|---|
| Public-only isolated source snapshot / synthetic provisioning | PASS: under local/diagnostics-validation; no original input regeneration, private build overwrite or private credential output |
| `python3 local/diagnostics-validation/esp32/build.py host` with Node 22.20.0 | PASS: RFC 8291 vector, independent decryption/ES256 checks and existing negative/boundary cases; actual serial dispatcher and event adapter against host-only SDK stand-ins; every blocker/expiry/time boundary, tiny-buffer rejection, read-only repeated STATUS, single CONNECT success/failure, no reconnect/send on events, zero/missing IP, IP loss/disconnection/stop, synthetic mode and NVS-startup failure; public secret canaries absent from output |
| `npm test` | PASS: existing publisher/enrollment/localization/worker offline suite |
| `npm run test:library` | PASS: existing real web-push crypto and private CLI lifecycle tests; approved offline execution outside sandbox for known Node subprocess restriction; no notification sent |
| `python3 -m unittest discover -s tests -v` with Node 22.20.0 | PASS: 11 Python tests including public artifact/private provisioning guards |
| Isolated `python3 esp32/build.py firmware` and `size` | PASS: exact IDF 5.5.5 Xtensa build, .bin 907,904 B, linker total 907,781 B, static DRAM 35,196 B, IRAM 97,271 B; both 1,835,008 B slots fit, headroom 927,104 B / 50.52% |
| Protected-file fingerprints before/after checks | PASS: original experiment local/private, local/esp32-input, local/esp32-build and main local/device file membership/content/size/permissions unchanged; values suppressed |
| `python3 scripts/audit_public.py`, final diff/whitespace review | PASS: exact public Git inventory and staged/worktree secret heuristics; static artifact boundary, Markdown links/fences/Bash syntax; final reviewed source/config matches the isolated cross-build |
| Physical serial/Wi-Fi/SNTP, flash/reset/OTA, live config, actual push | NOT RUN: explicitly prohibited. Host stand-ins do not establish runtime networking, actual refusal cause or delivery |

New generated inputs/builds use synthetic disabled sending. The existing private
configuration, backups and previous device images remain untouched. No production
readiness, hardware acceptance, key rotation or new deployment is claimed. Prior
security/recovery follow-ups below remain applicable; future device work requires
separate explicit authorization. Production integration remains NO-GO.

## Single-device recovery preparation — 2026-10-16

Documentation-only follow-up, baseline `d9c7ae3`, initially clean working branch;
fetched origin matches after sandbox DNS retry. The abbreviated backup/restore
examples in esp32/README.md are superseded by the main project's
[canonical single-device procedure](https://github.com/mkopal/smart-smoker/blob/esp32-direct-web-push-poc/docs/ESP32_BACKUP_RESTORE.md).
No publisher, provisioning/build tool, partition layout, deployment workflow or
static PWA source changed. No experimental private inputs or physical flash were
read; the production generated-source exposure is recorded below.

Local partition decode confirms matching app slots but incompatible NVS/OTA/PHY
layout: experiment OTA metadata overwrites the beginning of production NVS. Require
same-device full-flash restoration, not an app/factory-image substitution. The new
procedure specifies private duplicate dumps, security/capacity checks, table and
SHA-256 validation, independent encrypted copy, explicit restore/boot authorization,
full readback comparison before boot, and actual original Wi-Fi/API/OTA/web checks.

Current USB port is not exposed to this execution environment; current physical
capacity/eFuses and actual ROM recovery remain NOT VERIFIED. Hardware backup,
reset/flash/OTA/readback, push send, live HA and restored operation are NOT RUN.
Physical trial is NO-GO until prerequisites and explicit authorization; production
integration remains NO-GO. The canonical notes record a session-exposed shared
production API/OTA credential and separate rotation follow-up, without reproducing
its value or changing live keys. No experiment credential was accessed.

Checks: canonical Bash syntax/offline synthetic backup checker (9 cases) PASS;
local documentation links/fences PASS. `python3 -m unittest discover -s tests -v`
with Node 22.20.0 PASS (11 methods); `python3 scripts/audit_public.py` PASS (exact
public Git inventory, staged/worktree secret heuristics and static artifact boundary);
`git diff --check` / `git diff --cached --check` PASS. Main `task test` PASS (90 methods).
No new firmware build is needed for this documentation-only update; earlier compile
evidence is unchanged. No new remote CI or deployment result is claimed.

## ESP32 publisher continuation — 2026-10-16

Status: **HARDWARE_VALIDATION_PENDING**, conditional GO for an explicitly authorized
isolated bench test; NO-GO for production integration. Initial experiment checkout
`d8ac39d` was clean; fetched origin matched. Production repository baseline `579cc59`
was clean. Sources and exact future device procedure: [ESP32 README](esp32/README.md).
Measured build resources, limitations and gates: [report](esp32/FEASIBILITY.md).
Only synthetic development keys/subscription were used; no real private inputs were read.

| Executed command/check | Actual result |
|---|---|
| `node esp32/provision.cjs --synthetic` | PASS: owner-only ignored header, sending/network disabled; overwrite refusal tested |
| `python3 esp32/build.py host` with Node 22.20.0 | PASS: bundled mbedTLS host build, RFC 8291 section 5 exact vector, independently decrypted Node fixtures and ES256 signature verification, fresh sender key/salt, tamper/wrong-auth/off-curve/mismatched/zero key rejection, payload bounds, time/expiration/status/response-budget and RNG failure gates, provisioning rejection cases |
| `python3 esp32/build.py firmware` | PASS: actual ESP32 Xtensa build on IDF 5.5.5, no upload; full publisher linked despite disabled synthetic send flag |
| `python3 esp32/build.py size`, application binary stat, generated partition decode | PASS: .bin 904,672 B; linker total 904,549 B; DRAM 35,180 B; IRAM 97,271 B; both slots 1,835,008 B, headroom 930,336 B / 50.7% |
| Generated sdkconfig/compiler flags and ELF symbol inspection | PASS: 4 MB/no PSRAM, certificate validation enabled, HKDF/GCM/P-256 available, maximum SDK log level 0, parser cap 4096, retained crypto/HTTP symbols |
| `npm test` | PASS: existing offline publisher/enrollment/worker/localization suite |
| `npm run test:library` | PASS after an approved sandbox retry; initial Node child spawn hit EPERM. Actual web-push crypto/CLI lifecycle tests stayed offline |
| `python3 -m unittest discover -s tests -v` | PASS: 11 Python unittest methods, including private provisioning, overwrite refusal, artifact ignore rules and public audit regressions |
| `python3 build.py`, `python3 scripts/audit_public.py`, `git diff --check` | PASS: 11-file static artifact, exact staged/worktree public inventory, secret heuristics and final whitespace check |
| Main repository `task test` with pinned task/Node in PATH | PASS: 90 unittest methods and repository/dashboard/web/experiment gates; system `/usr/bin/task` is a different utility and was replaced in PATH with the existing pinned go-task |
| Production ESPHome validation/build | N/A: no production configuration/component/assets changes; preserved existing artifacts |
| Hardware, serial, USB readback/flash, OTA, live HA, real subscription send | NOT RUN: explicitly prohibited |
| Actual heap/minimum/largest block/recovery, CPU/network timing, ESP32-to-locked-iPhone delivery/sound | NOT RUN: software and linker results cannot establish these |

Initial build attempts corrected an absolute build-directory path and the IDF version
check to use IDF's exported version, and set the cached ROM ELF directory. A first
synthetic build optimized out the disabled publisher; the volatile gate fixes that,
and final resource evidence above is for the full linked publisher. Initial Python
inventory failure occurred before adding the new explicit public source inventory;
final rerun passed without relaxing the audit. No tests were weakened.

The working branch avoids triggering the existing Pages deployment on main; static
site sources and deployment workflow remain unchanged. No remote CI or physical
acceptance is claimed. The pre-existing owner-reported iPhone result below remains
Linux-publisher evidence only. Boot/output/probe safety testing is N/A to this isolated
implementation, which has no actuator or sensor; production acceptance gates remain.

---

## Original experiment — 2026-10-15

Date: 2026-10-15. Independent repository extracted from the isolated experiment only.
Source Smart Smoker repository, production configuration, HA and Git history are
preserved. No real subscription or signing key is published or needed for automated
tests. Public file review is recorded in PUBLIC_FILES.txt; build uploads only dist/.

## Local and hosted checks

| Command / check | Actual result |
|---|---|
| Exact extraction/file inventory | PASS: independently initialized history; only experiment code, shared localization adapter/validator and public tooling/docs; no production files or brand reference image |
| `npm ci --ignore-scripts --no-audit --no-fund --offline --cache /tmp/smart-smoker-npm-cache` with Node 22/npm 10 | PASS: 17 development packages reconstructed using the integrity lock; no new production dependency |
| `node tests.js` / `npm test` | PASS: reused publisher, enrollment, EN/CS worker, private file/endpoint/key/lifecycle fixtures without network access |
| `node library-test.js` / `npm run test:library` | PASS: actual locked library encryption/decryption, wrong-auth rejection, ES256 JWT and private CLI lifecycle; approved unsandboxed test for Node subprocess capture; no real network send |
| `python3 -m unittest discover -s tests -v` | PASS: 7 Python methods, including exact static artifact, subpath links, PNG dimensions, JS syntax, catalog discovery/failures, private ignore rules, workflow boundaries, staged private-file/secret regressions and dependency isolation |
| `python3 build.py`, `python3 scripts/audit_public.py` | PASS: exactly 11 static files and exact reviewed public Git inventory; staged/worktree heuristic scans; publisher/private data excluded from artifact |
| `node scripts/browser-test.cjs` (Chromium, temporary profile) | PASS after approved unsandboxed rerun: real project-subpath enrollment readiness, manifest/active worker scope, secure context, CS rendering, mobile width, no permission request/subscription, only locale in localStorage, empty export; expected offline navigation failure with cache disabled |
| Syntax checks, `git diff --cached --check`, staged diff/public inventory review | PASS before initial commit |
| Public GitHub repository, Actions/Pages and live HTTPS verification | PASS: initial deployment and public browser checks recorded below |

The initial sandbox browser attempt could not run the loopback/browser environment;
the approved retry passed. Headless Chromium uses a disposable profile and disabled
browser sandbox solely for this smoke test. Node 22.21.0, Python standard library and
system Chromium were used locally. Browser tests do not grant notification permission,
create subscriptions, send push or emulate a real phone's lock/Focus/sound behavior.

## Verified initial publication

- Repository: https://github.com/mkopal/smart-smoker-push-test, `isPrivate:false`,
  default branch `main`; new independent root commit, no imported Git history.
- Deployed source: `b640bfc9e0caf873faeca36646533f138a3c91ee`.
- [Test and deploy Pages run 38656271689](https://github.com/mkopal/smart-smoker-push-test/actions/runs/38656271689):
  **SUCCESS**, exact source SHA verified through run metadata. Build completed in
  18 seconds and deploy in 10 seconds. Dependency install, Node fixture and actual
  library tests, seven Python tests, build, public audit and artifact publication all
  passed. No required validation gate was skipped or suppressed.
- Pages: https://mkopal.github.io/smart-smoker-push-test/;
  API confirms `build_type:workflow` and `https_enforced:true`.
- Public `build-info.json` returned HTTP 200 and the exact deployed SHA above.
  All 11 static asset URLs returned HTTPS 200 with expected MIME types, including
  JavaScript worker and `application/manifest+json`. Live `publisher.cjs`,
  `package.json`, `local/private/vapid.json` and `.git/config` returned **404**.
- `node scripts/browser-test.cjs https://mkopal.github.io/smart-smoker-push-test/`:
  **PASS** on actual hosted HTTPS, including ready service worker at exactly the
  project scope, relative manifest/asset paths, CS UI at mobile width, only locale
  preference stored and expected offline navigation failure with cache disabled.
  No browser subscription or push send occurred.
- Pages headers are host-controlled; observed JSON response used a 600-second cache
  lifetime. CSP/referrer policy are HTML meta policies, not custom server headers.
  Revalidate/reload before testing a future update; changing origin/scope needs a
  separate subscription migration procedure.
- Actions emitted non-fatal Node 20 deprecation annotations for upstream Pages actions
  forced to run on Node 24. All steps succeeded. Pins correspond to official action
  releases checked at preparation time; revisit upstream runtime maintenance later.
- Source Smart Smoker remained clean at `368e77e`; firmware, HA, router and device
  operations were not performed. No real signing key/subscription was collected.

This documentation-only evidence follow-up uses `[skip ci]`: it does not redeploy
the already tested application. The live build identity remains the source SHA above.
Those publication checks alone did not constitute physical phone evidence. The later
owner-reported phone test below is a separate evidence source.

## Physical phone results

Session status, 2026-10-15: **PAUSED pending next-session work**. Existing Pages stays
enabled at `b640bfc9e0caf873faeca36646533f138a3c91ee`; no new application deployment
is part of this documentation update.

| Platform | Foreground | Background | Locked | Sound | Tap | Mobile data |
|---|---|---|---|---|---|---|
| iPhone / iOS / Home Screen PWA (owner report) | NOT RUN | NOT RUN | PASS | PASS, silencing disabled | NOT RUN | NOT RUN |
| Android / compatible browser | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |

The owner explicitly reports a real test on 2026-10-15 using the Linux Node.js
publisher, installed iPhone PWA, valid subscription and browser/vendor push
infrastructure, without HA, paid push service or a user-operated application backend.
The CLI still fulfills the Web Push application-server/publisher protocol role.
HTTP 201, actual Lock Screen notification and audible sound with silencing disabled
are **PASS (owner-reported)**; the assistant did not independently repeat the test.

The initial JSON export-format issue was corrected manually. Its precise cause and
transformation were not supplied; no software fix is claimed. iOS Focus/Sleep settings
initially prevented normal audible/visible presentation. No bypass or guaranteed
critical-alarm behavior is proved by the later sound/display success.

Exact phone/OS/browser versions, timestamps, latency, trial count and network conditions
were not supplied. NOT RUN cells above mean no separate observation was supplied;
they do not negate the locked-screen PASS. Android is NOT TESTED; direct ESP32
publishing and secure simple pairing are NOT IMPLEMENTED OR TESTED. Reliable repeated
alerts until acknowledgement are NOT TESTED. No secret or actual subscription data
is included. Desktop fixtures and HTTP 201 alone never substitute for actual delivery.

## Next-session continuation

1. Review the iPhone observation and limits, including JSON handling and Focus/Sleep.
2. Investigate an isolated ESP32 Web Push publisher PoC outside production firmware.
3. Assess HTTPS/TLS, CA/time trust, VAPID, payload encryption, flash/RAM/CPU and security.
4. Prove real ESP32 publishing before production integration; device operations require
   separate authorization, not this documentation/pause record.
5. Test Android and the remaining physical phone/reliability matrix.
6. Design secure simple phone enrollment without manual JSON; no unauthenticated pairing.
7. Preserve optional Home Assistant integration and standalone behavior.

No production firmware, flash/OTA, running HA, router, new service or server deployment
is changed by this session. Documentation-only commits use `[skip ci]`, leaving the
existing Pages application enabled. Delivery checks for this documentation-only update:

- PASS: `git fetch origin` after approved network access; baseline `ba48e51`, clean
  `main` with 0/0 divergence. Initial sandbox DNS failure was not an authentication failure.
- PASS: `python3 scripts/audit_public.py`, exact public Git inventory and staged/worktree
  secret heuristics/static artifact boundary; private local files were not inspected.
- PASS: `python3 /tmp/check-push-session-docs.py` across both checkouts: exactly two
  experiment/seven main Markdown files, 47 relative links/anchors and balanced fences.
- PASS before commit: final/staged `git diff --check`, scope and secret review. Only
  README and this validation document change in this repository.
- NOT RUN: new application tests, browser/phone sends or deployment; runtime code,
  workflow and deployed PWA remain unchanged. Main Smart Smoker's separate mandatory
  `task test` gate passed all 90 methods; it is not a new physical phone test.

## P0 local HTTPS emulator — 2026-10-18

**HARDWARE_VALIDATION_PENDING. NO-GO for advancing to real-device HTTPS integration;
P0 and production integration remain NO-GO.** The owner has not run or confirmed
any physical iPhone row. This implementation provides transport instrumentation
and an owner-run procedure, not a validated enrollment security architecture.

Baseline: clean `esp32-direct-web-push-poc` at `0410edc`, matching the locally
available remote-tracking head; no fetch/push/deployment was performed. Main
architecture reviewed at `745bd00`: ADR-008, active P0 enrollment design, PLAN,
VALIDATION, project skill, localization and security constraints. Main repository
and all ESP32/ESPHome/HA/OTA files remain unchanged.

Implemented: isolated Python standard-library HTTPS API with exact Host/Origin
allowlists, strict CORS, bounded bodies/headers/state/requests/timeouts, fixed
synthetic schema and one-use monotonic challenges; independent EN/CS PWA artifact
with fixed-endpoint CSP and no Push API, arbitrary data input or persistence other
than language. Public inventory audit covers new source/catalogs. Normal `dist`
remains the same eleven-file production-facing artifact. The spike's ten files
are built separately under ignored `local/https-spike/site` and were not published.

| Command / check | Actual result |
|---|---|
| `npm test` | PASS: existing offline publisher/enrollment/localization/worker regressions |
| `npm run test:library` | PASS after sandbox retry: existing offline real web-push encryption/authentication/signature and private CLI tests; no outbound send |
| `python3 -m unittest discover -s tests -v` | PASS: 25 methods, including 14 new spike methods and deterministic browser behavior invoked by unittest |
| New actual loopback TLS tests | PASS: valid synthetic request, allowed preflight, no-token/wrong-token authorization, replay, expired/unknown session and restart semantics, malformed/duplicate/extra data, rejected real-data-shaped fields, wrong media type, invalid/missing/foreign Origin, invalid Host, duplicate framing, body/header/session/rate bounds, incomplete-body timeout without mutation and subsequent recovery |
| New TLS negatives | PASS on Linux: isolated untrusted cert, wrong SAN hostname and expired temporary fixture fail certificate verification. These temporary self-signed fixtures are not public-CA/iPhone evidence |
| `node scripts/https-spike-test.cjs` | PASS: mocked browser authorized/unauthorized/malformed/replay sequence, EN/CS selection/persistence, omitted credentials/no-store/redirect rejection, double-tap exclusion, failure at each request and insecure-context refusal. This is not real Safari execution |
| `python3 build.py` | PASS: existing eleven-file Pages artifact; its CSP, app and worker unchanged |
| `python3 https_spike/build.py --device-origin https://device.example.test:8443` | PASS: ten-file isolated artifact, exact endpoint CSP, discovered EN/CS and JS syntax. Reserved hostname is synthetic and is not a deployed endpoint |
| `python3 scripts/audit_public.py` | PASS after staging exact reviewed inventory: staged/worktree secret heuristics and production artifact boundary; no private local files scanned |
| `git diff --check` and `git diff --cached --check` | PASS: final whitespace/scope and staged diff review, no secrets identified |
| Production firmware build / physical ESP32 / HA / OTA / outbound Web Push | NOT RUN: unchanged and outside scope |
| Public CA issuance / DNS/router/firewall / LAN listener / public static hosting | NOT RUN: separately authorized owner operations only |
| Actual Safari / installed iPhone / trusted-public-CA / Wi-Fi/cellular / permission / first-use / certificate negative acceptance | NOT RUN: use the [Phase B/C runbook and result template](https_spike/README.md) with the owner |

Environment: Python 3.10.6, OpenSSL 3.0.2 and available Node 22.20.0 (satisfies package Node >=22;
repository `.nvmrc` pins 22.21.0, not installed here). No dependency installed.
Initial loopback test was blocked by sandbox socket policy; authorized execution
outside the sandbox passed, listening only on loopback and cleaning temporary
certificates/server afterward. Existing library tests initially hit sandbox
`spawnSync EPERM`; the authorized offline retry passed. Initial browser test used
the shell's old Node 14 and failed on modern built-ins; rerun with Node 22.20.0
passed. These are tooling constraints, not iOS observations.

No genuine ownership proof, manufacturing identity, durable owner/recovery state,
autonomous DNS-01 renewal, expired-leaf/no-Wi-Fi recovery, offline AP setup or
ESP32 concurrent resource behavior is established. A trusted installed-iPhone
transport PASS is still required before reviewing advancement; it never alone
closes P0. Cleanup instructions preserve the deployed push experiment and leave
certificate/DNS/account removal to the authorized owner.
