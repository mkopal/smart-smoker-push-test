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
| Public GitHub repository, Actions/Pages and live HTTPS verification | NOT RUN at this pre-publication record; results recorded separately after deployment |

The initial sandbox browser attempt could not run the loopback/browser environment;
the approved retry passed. Headless Chromium uses a disposable profile and disabled
browser sandbox solely for this smoke test. Node 22.21.0, Python standard library and
system Chromium were used locally. Browser tests do not grant notification permission,
create subscriptions, send push or emulate a real phone's lock/Focus/sound behavior.

## Physical phone results

| Platform | Foreground | Background | Locked | Sound | Tap | Mobile data |
|---|---|---|---|---|---|---|
| iPhone / iOS / Safari Home Screen PWA | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Android / compatible browser | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |

No successful push delivery is claimed. Follow the README matrix, record versions,
conditions, timestamps and actual results, and publish sanitized evidence only.
Desktop Chromium/service-worker and offline crypto checks never substitute for this.
