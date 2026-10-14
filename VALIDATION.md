# Validation evidence

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
Reviewing and publishing this evidence does not turn any physical phone result into PASS.

## Physical phone results

| Platform | Foreground | Background | Locked | Sound | Tap | Mobile data |
|---|---|---|---|---|---|---|
| iPhone / iOS / Safari Home Screen PWA | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Android / compatible browser | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |

No successful push delivery is claimed. Follow the README matrix, record versions,
conditions, timestamps and actual results, and publish sanitized evidence only.
Desktop Chromium/service-worker and offline crypto checks never substitute for this.
