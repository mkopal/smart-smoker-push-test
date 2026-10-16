# Validation evidence

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
