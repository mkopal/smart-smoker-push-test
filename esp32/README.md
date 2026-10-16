# ESP32 direct Web Push bench publisher

Status: **HARDWARE_VALIDATION_PENDING**. Standalone ESP-IDF **5.5.5**, ESP32-WROOM-32D,
4 MB flash, no PSRAM. This is separate from ESPHome **2026.9.1** production firmware.
[Feasibility, resources and acceptance gates](FEASIBILITY.md) distinguish build facts
from estimates and unperformed device tests. No real send, serial access or upload
was performed during development. Existing static enrollment and Linux publishing
remain unchanged.

## Build and offline tests

Prerequisites: the existing IDF 5.5.5 framework, Python environment and Xtensa
esp-14.2.0_20260121 toolchain installed by the main project's pinned ESPHome; CMake,
Ninja, a host C++ compiler, Python 3 and Node.js 22+. No new production dependency.
`build.py` defaults to `$HOME/.cache/esphome/idf`; exported `IDF_PATH`,
`IDF_TOOLS_PATH`, `IDF_PYTHON_ENV_PATH` and `ESP_ROM_ELF_DIR` override paths for a
separately installed IDF. It does not install tools or accept flash/monitor commands.
Use a private terminal; IDF logs may contain build inputs and paths.

From the experiment repository root on this reference workstation:

```bash
cd /home/mkopal/Projects/git/smart-smoker-push-test
export PATH="$HOME/.nvm/versions/node/v22.20.0/bin:$PATH"
umask 077
node --version
# Existing development dependency setup; first installation can require network.
npm ci --ignore-scripts --no-audit --no-fund
node esp32/provision.cjs --synthetic
python3 esp32/build.py host
python3 esp32/build.py firmware
python3 esp32/build.py size
npm test
npm run test:library
python3 -m unittest discover -s tests -v
python3 build.py
python3 scripts/audit_public.py
```

Provisioning intentionally refuses overwrite. If a header already exists, first
move its directory to a new private backup name, for example (run only once):

```bash
mv local/esp32-input local/esp32-input.previous
node esp32/provision.cjs --synthetic
```

Synthetic firmware includes the full publisher but **does not start Wi-Fi or send**.
The volatile runtime gate prevents dead-code elimination of the publisher from its
size measurement. Generated header, sdkconfig, ELF, map, binaries and logs remain in
ignored `local/`. Treat all later real-input builds as secret-bearing. Never upload
these artifacts to Pages/CI/Git. Host tests use generated public fixtures and the
RFC 8291 section 5 known-answer example; the `WP_TEST` fixed-key path exists only in
the host target. Host tests do not open a network connection. The firmware target
has no fixed ephemeral-key or salt override.

## Development credentials for a later authorized trial

Reuse **development-only** VAPID credentials and the actual version-1 enrollment
export used by the Linux publisher. Do not use production API/OTA keys. Provisioning
uses the existing CLI's strict public/private key validation, key-pair match,
endpoint provider allowlist and private-file reader (regular file, no symlink,
0600 permissions, 16 KiB cap). It additionally bounds C inputs and rejects control
characters, noncanonical endpoints and unsupported expiration values. The locale
is copied from enrollment; the PWA service worker renders its discovered EN/CS
catalogs with English fallback. No notification text or fake temperature is embedded.

Create `local/private/esp32-wifi.json` privately with this shape, replacing placeholders
in a private editor, never a command argument, shell history or chat:

```json
{"ssid":"DEVELOPMENT_NETWORK_NAME","password":"DEVELOPMENT_NETWORK_PASSWORD"}
```

```bash
umask 077
mkdir -p local/private
chmod 700 local/private
# After privately creating the file:
chmod 600 local/private/esp32-wifi.json
# Preserve an existing synthetic header first as described above.
node esp32/provision.cjs local/private/vapid.json local/private/iphone.json local/private/esp32-wifi.json
python3 esp32/build.py firmware
python3 esp32/build.py size
```

These commands compile only. They do not contact a device or send a push. Keep the
private input folder and firmware under owner-only access. The PoC embeds secrets
in flash and uses Wi-Fi RAM storage; it does not implement encrypted provisioning,
flash encryption, secure boot, protected NVS, factory key custody or production
pairing. A party able to read the flash/image can recover the development keys.
Do not distribute this firmware.

## Exact future bench procedure — separate explicit authorization required

**Do not execute device commands in this software task.** Use USB bench power,
with all heater/smoke/mains control connections physically disconnected. This image
contains no project GPIO, sensor, heater or smoke driver; it has no HTTP server,
ESPHome API or OTA. It replaces the normal monitoring application during the trial.
Do not upload it through production OTA: the standalone partition layout is different.

1. Record owner-confirmed board/4 MB flash, current production commit, known-good
   running firmware evidence, existing partition table, private configuration and
   checksums of known-good factory/OTA binaries. Preserve the main checkout and its
   existing private artifacts. A host HEAD is not proof of running firmware identity.
2. Obtain explicit owner authorization for **USB reset/readback, outage, experimental
   flash and restoration**, naming the port, image and return-to-production plan.
   The commands below are a proposed procedure, not authorization.
3. After that authorization, back up the **entire** flash to an owner-only file. This
   includes NVS and production credentials; never publish it. Stop if readback fails,
   or if security eFuses/encryption make this restoration method inappropriate.

```bash
cd /home/mkopal/Projects/git/smart-smoker
umask 077
mkdir -p local/device/push-backup
chmod 700 local/device/push-backup
.venv/bin/python -m esptool --chip esp32 --port /dev/serial/by-id/usb-Silicon_Labs_CP2102_USB_to_UART_Bridge_Controller_0001-if00-port0 read-flash 0 0x400000 local/device/push-backup/known-good-4mb.bin
sha256sum local/device/push-backup/known-good-4mb.bin > local/device/push-backup/SHA256SUMS
```

4. With real development inputs provisioned, repeat the build/tests above. Confirm
   binary size fits both `0x1c0000` slots, flash is 4 MB, no PSRAM is enabled and no
   project hardware-control call is present. Read `local/esp32-build/flash_args`
   privately and verify **only** PoC artifacts/offsets. Record their hashes privately.
   Reconfirm explicit authorization for these exact files before using the IDF
   flash command printed by the successful build. On this workstation, after
   authorization, the equivalent complete command is:

```bash
cd /home/mkopal/Projects/git/smart-smoker-push-test/local/esp32-build
/home/mkopal/.cache/esphome/idf/penvs/5.5.5/bin/python -m esptool --chip esp32 --port /dev/serial/by-id/usb-Silicon_Labs_CP2102_USB_to_UART_Bridge_Controller_0001-if00-port0 --baud 115200 write_flash @flash_args
```

5. Use a private serial terminal at 115200 baud after the authorized flash. Terminal
   opening can reset this board; record any reset. Wait for the command prompt and
   network/time readiness. No notification is sent at boot. Enter `HEAP` and record
   the sanitized baseline. Lock the installed enrolled iPhone, wait five minutes,
   record Focus/silent/notification settings and phone network. Enter **`SEND` once**.
6. Record provider result separately from actual locked-screen display and audible
   sound. HTTP 201 alone is not phone delivery. Record local time/timezone, event
   observation, latency and tap behavior without copying private subscription data.
   Check `before_crypto`, `before_tls`, `tls_connected` and `after_cleanup`: free
   8-bit heap, largest block, separate crypto/HTTPS minimum windows and main-task stack watermark.
   Wall times printed are not CPU utilization measurements.
7. Only within the authorized trial scope, wait at least 60 seconds and perform
   repeated manual sends (target 20) to check heap recovery. No automatic replay,
   retry or recurring notification exists. Every SEND creates a new dummy test ID.
   For 429/5xx, stop and honor provider backoff; do not use the device to probe rate
   limits. 404/410 retires the subscription in RAM until restart; re-enroll/rebuild
   rather than restarting to bypass retirement. 401/403 requires clock/key review.
8. In an authorized controlled **development** network, disconnect the AP before
   SEND: refusal is expected. Test loss during a send: bounded failure and cleanup
   are expected. Restore AP, enter `CONNECT` once, wait for time/connectivity and
   send a fresh test. Never replay an old event. Record actual elapsed timeout,
   heap recovery, watchdog/reset behavior and successful fresh delivery. Invalid
   TLS certificates must fail; never bypass certificate checks to complete a test.
9. Restore the exact full-flash backup with the authorized command below. Verify
   backup hash first. A full image restores the partition table and NVS as well as
   firmware, so confirm device identity again. No erase-all operation is needed.

```bash
cd /home/mkopal/Projects/git/smart-smoker
sha256sum --check local/device/push-backup/SHA256SUMS
.venv/bin/python -m esptool --chip esp32 --port /dev/serial/by-id/usb-Silicon_Labs_CP2102_USB_to_UART_Bridge_Controller_0001-if00-port0 write-flash 0 local/device/push-backup/known-good-4mb.bin
```

10. Verify known-good monitoring, encrypted API, OTA availability and standalone UI
    on the restored firmware. Do not change live HA. Record image identity and the
    outage/recovery results. Revoke development subscriptions using the PWA when
    finished; remove secret-bearing local artifacts through normal owner management.
    Production integration remains a different milestone even if this bench test passes.
