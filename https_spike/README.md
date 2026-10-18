# P0 local HTTPS transport spike

Status: **Owner-observed ordinary Linux LAN HTTPS transport PASS** on iPhone 14 /
iOS 27.0.1, Safari tab and installed Home Screen PWA (2026-10-18). See the
[qualified record and limits](../VALIDATION.md#owner-observed-iphone-https-transport--2026-10-18).
Owner reports normal system trust and the synthetic-check success message in both
modes, supported by screenshots; this documentation task did not independently
instrument or repeat those runs. P0, real-device HTTPS integration and production
remain **NO-GO**: ownership, offline/AP, TLS negatives/recovery, Android, certificate
lifecycle and ESP32 resources are still unverified. Direct Web Push is a separate PoC.

This Linux-only test tool follows the main repository's
[P0 enrollment architecture](../../smart-smoker/docs/WEB_PUSH_ENROLLMENT.md) and
[ADR-008](../../smart-smoker/docs/DECISIONS.md#adr-008-single-pwa-backend-free-local-https-enrollment--2026-10-18).
For readers on GitHub, use the [architecture](https://github.com/mkopal/smart-smoker/blob/main/docs/WEB_PUSH_ENROLLMENT.md)
and [decisions](https://github.com/mkopal/smart-smoker/blob/main/docs/DECISIONS.md).
It emulates only the shape of enrollment transport. It is not the proposed
production architecture, a rendezvous service or an enrollment security protocol.

## Isolation and contract

`server.py` uses Python's standard `ssl` / OpenSSL and `http.server`; no new
package, custom cryptography, HTTP fallback, forwarding, static-file service,
subscription handling, disk state or request logging. Use Python 3.10+ and Node
22+ for tests/build checks; OpenSSL CLI is needed only for temporary test fixtures.
The ordinary `web/` implementation, root CSP, manifest and worker stay unchanged.
The Pages workflow uses `build_pages.py` to stage both independent PWAs in one
artifact; the root-only builder remains available for a clean output directory.

The separate builder emits exactly ten files into ignored `local/https-spike/site`.
For Pages, `python3 build_pages.py` invokes that same isolated builder in a
temporary directory and stages only its ten approved files under `dist/https-spike/`.
The root retains its original eleven files. [PAGES_FILES.txt](../PAGES_FILES.txt)
lists all 21 deployed paths; the audit rejects extras, missing files and symlinks.
Repeated combined builds produce the same bytes at the same source revision.

Target app URL: `https://mkopal.github.io/smart-smoker-push-test/https-spike/`.
The Pages builder fixes device origin B to `https://smoker-test.navodio.cz:8443`;
the emulator must continue permitting exactly app origin A `https://mkopal.github.io`.
It does not configure or restart the emulator. Root worker scope remains
`/smart-smoker-push-test/`; the spike registers its own worker with scope
`/smart-smoker-push-test/https-spike/`. The root worker has no fetch handler;
the more specific spike registration is independent. Both manifest IDs/start URLs/
scopes remain relative `./`. This is path separation, not a new browser origin.
No certificates, keys, Cloudflare credentials, device secrets or local state are read
by the Pages build. All remain outside Git and the artifact.

Its discovered EN/CS catalogs reuse the approved Intl adapter and catalog validator.
Its manifest/worker scope and start URL are `./`; host it in its own approved path
or dedicated public origin, never replace the currently deployed push experiment.
There is no worker fetch handler/offline shell. This spike does not qualify offline
AP onboarding or shared storage with the existing installed push experiment.

The browser loads the shell from a **public HTTPS app origin A**, while API requests
go to **separate HTTPS device origin B** resolving to the Linux LAN interface.
CSP `connect-src` contains only self and the exact B selected at build time; no
arbitrary URL field or wildcard is accepted. The server allows exactly A in CORS
and exactly B's authority (hostname plus non-default port) in Host. Paths are not
origins: for example an app installed below `/https-spike/` still sends its scheme,
host and port as Origin. Other projects on the same origin are not isolated by CORS.
Prefer a dedicated test origin. No same-origin proxy or TLS terminator is assumed.

All JSON responses contain `version: 1`, `synthetic: true` and a stable `code`.
Only these exact paths are served; query strings and other versions are refused:

| Request | Body / response | Authorization and state |
|---|---|---|
| `GET /spike/v1/challenge` | Returns `challenge` (32 lowercase hex characters), `expiresIn: 120`, `deviceId: synthetic-smoker` | Allowed app Origin and Host; volatile challenge only |
| `POST /spike/v1/enroll` | Exactly `challenge`, `deviceId: synthetic-smoker`, `recipient: synthetic-recipient` | `Content-Type: application/json`, `X-Spike-Authorization: synthetic-spike-only`; unexpired one-use challenge |
| `OPTIONS` on either route | Validates exact requested method and only `content-type, x-spike-authorization` headers | No authorization token needed, no session mutation |

**The fixed public token is a test fixture, not a secret or proof of ownership.**
Anyone can reproduce it. Never connect this API to Wi-Fi writes, real recipients,
owner credentials, subscriptions, signing keys, push sending or production stores.
The API rejects additional fields and arbitrary recipient/device values. It does
not reflect submitted data. A rejected request still traverses TLS/server memory;
never send real data to this tool. Only random synthetic challenges persist in RAM.

Expected failures: unauthorized `401`, invalid Origin `403` (no CORS allow header),
invalid Host `421`, malformed JSON/schema `400`, unknown/replayed/expired challenge
`409`, wrong content type `415`, body over 1024 bytes `413`, absent POST length
`411`, wrong method `405`, route `404`, excessive headers `431`, limits `429`.
Duplicate security/framing headers and chunked encoding fail closed. CORS headers
are supplied after host/origin checks so the app can verify 401/400/409. No cookies,
credentialed CORS, wildcard origin, response caching or redirects. Browser fetch
uses omitted credentials, no-store, no-referrer and redirect error.

Limits: 16 live/consumed challenge entries, 120 requests per rolling minute globally,
120 s monotonic challenge validity, 3 s socket inactivity/handshake timeout, 10 s
post-handshake connection lifetime, one serial client and backlog four. Python's
HTTP parser also applies finite line/header-count limits before the 8 KiB aggregate
header check. These are lab bounds, not production DoS resistance. A slow or noisy
LAN peer can deny availability; restrict the host firewall to the test phone/LAN.
Legacy Private Network Access preflight requests are explicitly rejected rather
than blindly granting LAN access. New browser LNA permission is separate from CORS;
record exact browser restrictions, never disable them to obtain acceptance.
Restart discards all sessions/limits and old challenges fail closed. No durable
replay, ownership, recovery or lockout guarantee is implemented.

## Phase A: reproducible local validation

From the experimental checkout, using an existing Node 22+ installation:

```bash
cd /home/mkopal/Projects/git/smart-smoker-push-test
node --version
python3 --version
openssl version
npm test
npm run test:library
python3 -m unittest discover -s tests -v
python3 build_pages.py
python3 scripts/audit_public.py
git diff --check
```

The new unittest suite runs actual loopback TLS with a temporary self-signed
localhost fixture, plus deterministic clock/state and mocked browser checks. The
fixture is trusted **only by the isolated host-test client**, is never installed on
iPhone and is deleted after testing. It is not evidence for public CA trust. Tests
open no LAN/internet listener, contact no devices and send no push. The audit
requires the reviewed public inventory to be staged when adding new public files.
See [VALIDATION](../VALIDATION.md#p0-local-https-emulator--2026-10-18) for actual results.

## Phase B: owner-authorized certificate, DNS and network preparation

The baseline setup was subsequently owner-run and its qualified results are recorded
in VALIDATION. The following is the retained setup/reproduction runbook, not authority
to repeat or change live infrastructure. For any new operation obtain separate authorization
for certificate issuance, DNS/router/firewall changes, LAN server start and public
static hosting before performing them. Do not publish or upload anything as part
of Phase A. An existing valid lab certificate/name can avoid issuance, but still
needs verified scope, private-key custody, complete chain and trusted phone behavior.

1. Select a disposable hostname below a domain the owner controls; `.test`,
   `example.com` and `.local` examples are not issuable owner names. Pick a separate
   approved public app origin and hosting path. Confirm static hosting authority,
   valid public TLS and any provider constraints. Do not use production names/keys.
2. Obtain a publicly trusted certificate by ACME DNS-01. The owner must control the
   public `_acme-challenge.<hostname>` TXT record (or explicitly delegated challenge
   zone), authorize CA terms/account/email, and allow public propagation before
   challenge validation. DNS-01 needs no inbound HTTP/TLS port. Scope DNS API rights
   to the test challenge; never embed provider/account credentials in this harness.
   Manual DNS issuance is reproducible for the lab but is not autonomous renewal.
3. Select one exact LAN IPv4 address for the server and port 8443. Set a local
   resolver/split-horizon A record for the publicly certified hostname pointing to
   that address, with short documented TTL. Leave public application hosting intact.
   Public DNS may instead return a private A address if explicitly approved, but
   this exposes addressing metadata and can trigger DNS-rebinding filters.
   Ensure no stale/unreachable AAAA record wins over IPv4; this server is IPv4-only.
4. Verify the actual iPhone resolver/path, not just Linux `/etc/hosts`. Desktop
   hosts overrides and curl `--resolve` do not configure iPhone. Check router
   rebinding filters, encrypted DNS profiles, VPN/Private Relay, guest/client
   isolation, captive portals and cellular fallback. Use a narrow per-name exception
   only if separately approved; never disable rebinding protection globally.
   Record every required exception as a product feasibility limitation.
5. Permit inbound only from the lab phone/LAN on the chosen interface/8443, under
   separately approved host firewall rules. No wildcard bind, NAT/port forwarding,
   UPnP, tunnel, public reverse proxy or internet ingress. Publicly trusted names
   do not require public ingress. The harness's bind check alone is not a firewall.
6. Inspect SAN, chain and actual validity interval. Serve leaf plus intermediates
   in fullchain order; the key must match. Confirm iOS trusts the chain with normal
   system time and no manually installed root or certificate-warning bypass. Record
   leaf SHA-256 fingerprint, issuer, SAN and notBefore/notAfter; never key contents.
   Do not assume a fixed certificate lifetime. Plan renewal before actual expiry;
   stop the server to replace cert/key atomically and restart. Expired trust fails
   closed, and no phone-only recovery is established by this lab procedure.

After issuance authorization, an **already installed** Certbot can perform manual
DNS-01 without changing the host's global configuration. Enter owner-controlled
values; the command pauses for the owner's approved TXT update and propagation:

```bash
cd /home/mkopal/Projects/git/smart-smoker-push-test
umask 077
mkdir -p local/https-spike/acme/{config,work,logs}
chmod 700 local/https-spike
read -r -p 'Approved device FQDN: ' SPIKE_FQDN
read -r -p 'Approved ACME account email: ' SPIKE_EMAIL
certbot certonly --manual --preferred-challenges dns \
  --config-dir "$PWD/local/https-spike/acme/config" \
  --work-dir "$PWD/local/https-spike/acme/work" \
  --logs-dir "$PWD/local/https-spike/acme/logs" \
  --domain "$SPIKE_FQDN" --email "$SPIKE_EMAIL"
```

Do not proceed with a CA staging certificate: its chain is not publicly trusted.
Do not install a new client/dependency without the applicable owner authorization.
For an existing certificate, copy only the approved lab material into ignored files:

```bash
umask 077
mkdir -p local/https-spike/tls
read -r -p 'Approved fullchain PEM source path: ' SPIKE_CERT_SOURCE
read -r -p 'Approved test key PEM source path: ' SPIKE_KEY_SOURCE
install -m 600 "$SPIKE_CERT_SOURCE" local/https-spike/tls/fullchain.pem
install -m 600 "$SPIKE_KEY_SOURCE" local/https-spike/tls/key.pem
openssl x509 -in local/https-spike/tls/fullchain.pem -noout \
  -issuer -subject -dates -ext subjectAltName -fingerprint -sha256
```

Prepare the artifact locally (does not start a listener or publish it), then hand
the exact ten generated files to the separately authorized static-host operator.
The operator must serve JS/manifest with correct MIME types under one unchanged
path, without rewriting API requests or broadening the generated CSP. Hosting
is supported through the combined Pages artifact above; publication still requires
explicit approval. PRs validate without uploading or deploying; configuration,
upload and deployment are gated to non-PR events on `refs/heads/main`.

```bash
read -r -p 'Approved device FQDN: ' SPIKE_FQDN
SPIKE_DEVICE_ORIGIN="https://${SPIKE_FQDN}:8443"
python3 https_spike/build.py --device-origin "$SPIKE_DEVICE_ORIGIN"
```

After explicit network/server authorization, start in a foreground terminal; use
the public app **origin without path or trailing slash**, exactly as Safari sends it:

```bash
read -r -p 'Approved Linux LAN IPv4 address: ' SPIKE_LAN_IP
read -r -p 'Approved public app origin: ' SPIKE_APP_ORIGIN
python3 https_spike/server.py --bind "$SPIKE_LAN_IP" --port 8443 \
  --device-origin "$SPIKE_DEVICE_ORIGIN" --app-origin "$SPIKE_APP_ORIGIN" \
  --cert local/https-spike/tls/fullchain.pem --key local/https-spike/tls/key.pem
```

In a second terminal, re-enter the same approved values. Verify trust/name without
`-k`, then verify preflight and explicit origin/auth rejection. curl supplies Origin
manually and is not evidence that Safari actually sends or permits the same request:

```bash
read -r -p 'Approved device FQDN: ' SPIKE_FQDN
read -r -p 'Approved public app origin: ' SPIKE_APP_ORIGIN
SPIKE_DEVICE_ORIGIN="https://${SPIKE_FQDN}:8443"
curl --fail-with-body --max-time 10 -i \
  -H "Origin: $SPIKE_APP_ORIGIN" "$SPIKE_DEVICE_ORIGIN/spike/v1/challenge"
curl --max-time 10 -i -X OPTIONS \
  -H "Origin: $SPIKE_APP_ORIGIN" -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,x-spike-authorization' \
  "$SPIKE_DEVICE_ORIGIN/spike/v1/enroll"
curl --max-time 10 -i -H 'Origin: https://invalid.example.test' \
  "$SPIKE_DEVICE_ORIGIN/spike/v1/challenge"
curl --max-time 10 -i -H "Origin: $SPIKE_APP_ORIGIN" \
  -H 'Content-Type: application/json' --data '{}' \
  "$SPIKE_DEVICE_ORIGIN/spike/v1/enroll"
```

Expected: 200 challenge, 200 preflight, 403 without allow-origin, 401 respectively.
Direct Safari navigation to the API without Origin is also rejected, intentionally.

Apple's TN3179 describes Safari/WKWebView local-network privacy exceptions; do not
assume all installed Home Screen versions behave identically. Record prompts or
absence, app/browser Settings, deny/reallow behavior and exact OS/build. Native
Info.plist settings and Chrome PNA response headers are not a Safari workaround.
A secure public shell does not make untrusted TLS acceptable, and CORS does not
provide owner authentication. Browser JS often reports only a generic fetch error
for TLS, DNS, CORS or permission failures; do not classify the cause from UI alone.

## Phase C: actual owner-run iPhone checklist

Initially all rows were NOT RUN. The owner has since confirmed ordinary trusted
transport and the synthetic success message in both modes; see VALIDATION. These
observations do not complete every row below. TLS negative controls, browser foreign
Origin, offline/AP, interruption/recovery, prompts and repetitions remain NOT RUN
unless separately evidenced. Record Safari and Home Screen results separately.

| Check | Exact procedure / expected result |
|---|---|
| Metadata and first use | Record iPhone model, iOS version/build, Safari version (OS-bundled where no separate version is shown), date/time/zone, source commit, app URL, device origin, cert fingerprint/validity, resolver and network arrangement. Open the approved public spike URL in Safari, Add to Home Screen, then launch its icon. UI must identify Home Screen mode |
| Trusted transport | On the same local Wi-Fi as Linux, tap Run. Confirm a valid publicly trusted chain, correct SAN and no warnings/private-root installation. UI must complete GET, unauthorized 401, malformed 400, authorized 200, replay 409. Record actual outcomes; UI success alone does not certify all checklist rows |
| Negative Origin | Execute the curl check above; confirm 403/no allow-origin. For a browser-level check, separately authorize a second static copy on a foreign origin, with the same fixed B CSP, and run it: fetch must fail, server must reject Origin. JS cannot override the forbidden Origin header. Do not claim this negative browser check from a spoofed curl request |
| Unauthorized operation | Main UI sends a no-token POST before success; verify 401 is visible through CORS and does not consume the challenge. Never use real owner credentials |
| Wrong hostname | Separately approve an alias resolving to the same Linux server that is absent from the leaf SAN. Rebuild the isolated UI with this alias as B, authorize its Host for this negative run, and restart. Normal fetch must fail at TLS before API success. Restore correct B afterward. A CORS/CSP/Host rejection alone is not hostname validation evidence |
| Expired certificate | Use an owner-controlled archived expired **public-CA** certificate/key for the matching lab hostname, or wait for the lab certificate to expire. Restart with that leaf/fullchain and rebuild nothing else. Fetch must fail, with no insecure fallback. Record validity and actual device time; do not alter phone time, trust roots or bypass warnings. If material is unavailable, keep this row NOT RUN |
| Wi-Fi disconnect/reconnect | Start a request, disconnect Wi-Fi, observe timeout/failure; reconnect, allow DNS to settle, tap Run for a fresh challenge. No queued/background retry or replay mutation. Repeat after screen lock/wake and interruption |
| Wi-Fi to mobile data | Switch to cellular away from LAN: local API must be unreachable; reconnect to local Wi-Fi and retry successfully. A still-loaded shell is not proof of local reachability; no internet tunnel is allowed |
| Subsequent use | Close/reopen from Home Screen and repeat; test repeated taps and server restart (old challenge rejected). Capture prompts/absence and permission recovery. Switch EN/CS; language is the only application-persisted preference |
| First install and shell network loss | Record whether shell loads. Worker has no offline cache, so an uncached/offline reload can fail. This is an explicit spike limitation, not acceptance of offline AP onboarding |
| Browser restrictions | Record DNS filters, VPN/Private Relay, guest isolation, LNA prompts/Settings and any error diagnostics. Keep screenshots free of credentials; summarize observations rather than publishing raw network captures |

Any denied/unavailable trust or transport must fail closed. Retain FAIL/NOT RUN;
never relabel a self-signed root test, desktop pass or TLS-warning bypass as PASS.
Physical Safari/Home Screen transport was subsequently owner-confirmed; the original
implementation session had no such result. Preserve that historical distinction.

## Result template and integration decision

Copy the table into a private owner-controlled run record; publish only sanitized
results, with no email/account details, private keys or subscriptions. This public
experimental repository also excludes private LAN addresses under its existing audit;
use the main canonical record for the owner-approved lab address:

```text
Run date/time/timezone:
Source commit / artifact identity:
Operator confirmation / evidence reference:
iPhone model / iOS version+build / Safari version:
Mode (installed Home Screen / Safari tab):
App origin+path / synthetic device hostname:
Certificate public issuer/SAN/fingerprint/notBefore/notAfter:
Trust source (must be ordinary system trust):
Network/resolver method (sanitized) / TTL / relevant restrictions:
First-use prompts / subsequent-use prompts / deny+reallow observations:

Check                          Result (PASS/FAIL/NOT RUN)   Observation/evidence
Installed PWA + trusted HTTPS   NOT RUN
Authorized response            NOT RUN
Unauthorized rejection         NOT RUN
Invalid origin server/browser  NOT RUN / NOT RUN
Malformed + replay rejection   NOT RUN
Hostname mismatch fails closed NOT RUN
Expired leaf fails closed      NOT RUN
Disconnect/reconnect           NOT RUN
Cellular failure / LAN recovery NOT RUN
First/subsequent use + EN/CS    NOT RUN
Lock/wake + interruption       NOT RUN
Cleanup and restored baseline  NOT RUN

Failures and unresolved restrictions:
Owner-confirmed transport-gate decision / date:
```

Advance to **planning a separately authorized real-device HTTPS integration gate**
only after the required actual installed-iPhone trusted transport and negative /
recovery rows are owner-confirmed PASS, restrictions reviewed, and the main P0
security/resource prerequisites reviewed. Until then: **NO-GO**. Even a complete
transport PASS does not close P0, approve firmware integration or authorize deployment.

Separate unresolved work: physical ownership proof; independent manufacturing,
claim/recovery/signing credentials; protocol review and durable replay/storage;
expired certificate plus unavailable Wi-Fi recovery; autonomous renewal without
pairing backend; actual DNS provider scope; cached AP discovery; single-install
multiple smokers; Android; ESPHome integration; ESP32 RAM/flash, HA/UI/OTA/push
concurrency and reliability. Host/Origin checks do not solve those issues.

## Cleanup

Stop the foreground server with Ctrl-C; this closes its listener and discards volatile
sessions. Confirm its PID has exited and no listener remains (`ss -ltnp 'sport = :8443'`).
Stop only this process, never unrelated listeners. Remove only the dedicated spike
Home Screen icon/test browser data, preserving the existing push experiment and
subscriptions. Have the authorized operator remove the approved spike static path,
restore only the recorded DNS/firewall exceptions, remove the challenge TXT record,
and apply the owner's lab certificate/key/account retention or revocation policy.
Review/delete ignored `local/https-spike/` privately when no longer needed; never
force-add it or include key material in cleanup logs. No automatic destructive cleanup
command is provided, because certificate/account custody may need retention.

## Primary references checked 2026-10-18

- [Let's Encrypt DNS-01](https://letsencrypt.org/docs/challenge-types/#dns-01-challenge):
  public TXT ownership validation and private-server issuance; not LAN discovery.
- [WHATWG Fetch](https://fetch.spec.whatwg.org/#http-cors-protocol): cross-origin
  permission, preflight and omitted credentials; separate from TLS and LAN policy.
- [Apple TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy):
  platform local-network privacy reference, not physical Home Screen test evidence.
- [Chrome Local Network Access](https://developer.chrome.com/blog/local-network-access/):
  evolving browser LAN permission; not evidence of Safari support.
