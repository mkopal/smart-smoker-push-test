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

There is only one working HW-395. **Do not execute device commands in this software
preparation task.** The canonical [single-device backup/restoration procedure](https://github.com/mkopal/smart-smoker/blob/esp32-direct-web-push-poc/docs/ESP32_BACKUP_RESTORE.md)
supersedes the earlier abbreviated read/write examples here. Use the production
project's pinned esptool 5.3.1 for that procedure. Its backup, write, verify and reboot
phases must be covered by explicit owner authorization, with private logs and safe
bench power. One authorization can cover named phases; do not ask again if already granted.

1. Complete the canonical preflight and two matching full-flash readbacks, with live
   4 MB capacity/security/identity checks, private 0700/0600 storage, partition-table
   validation, immutable SHA-256 manifest and independent encrypted backup copy.
   A compiled factory/OTA image is **not** a device backup. Current environment has
   no exposed serial port; physical USB recovery is not proven by local tools.
2. Physically disconnect every heater/smoke/relay/mains control connection and use
   USB bench power only. This PoC has no project GPIO/sensor/output/control code,
   HTTP server, ESPHome API or OTA. ROM and UART still affect pins, so no unknown
   external wiring may remain. Preserve independent thermal protections.
3. With separately provisioned development inputs, rerun offline tests, firmware build
   and size checks. Privately review the exact `local/esp32-build/flash_args`, hashes
   and offsets. Both app slots must fit `0x1c0000`, flash is 4 MB, no PSRAM. The app
   slots match production but **NVS, PHY and OTA metadata offsets differ**: the
   experiment's OTA metadata at `0x390000` overlaps production NVS. Never use production
   OTA or assume flashing the app alone restores the original firmware state.
4. Obtain explicit authorization for the exact experimental USB image set, outage
   and full restoration. Follow the successful build's flash instructions only after
   all recovery gates pass. No upload is performed by `build.py`. Keep the verified
   backup unchanged and available even if Wi-Fi/API/OTA become unavailable.
5. After authorized deployment, use a private serial terminal at 115200 baud; opening
   it can reset this board. No boot send occurs. Wait for network/time readiness,
   enter HEAP, lock the enrolled iPhone for five minutes and enter SEND **once**.
   Record provider 201 separately from actual Lock Screen display, sound, tap,
   Focus/silent settings and latency. Do not publish subscription data.
6. Record before_crypto/after_crypto, before_tls/tls_connected/after_cleanup free heap,
   largest block, separate crypto/HTTPS minimum windows and task stack watermark.
   Printed microsecond times are wall time, not CPU utilization. No actual measurements
   exist yet. Repeated sends/network-failure/reconnect tests require inclusion in the
   owner's trial authorization; wait >=60 s between manual SENDs, never replay events.
   For 429/5xx stop and review backoff; 401/403 requires key/clock review; 404/410
   retires the recipient in RAM. Do not reboot to bypass retirement or disable TLS.
7. Restore **the entire verified raw snapshot at address 0** with the canonical
   procedure, explicit keep options, no automatic boot until full readback comparison
   and SHA-256 checks pass. Do not substitute the latest compiled production app,
   factory image or a new partition table. No erase-all, force, eFuse or live HA change.
8. Deliberately return to original boot only after verification and authorization.
   Confirm original Wi-Fi, existing encrypted HA/native API, standalone real updates
   and OTA availability using the canonical checklist. OTA transfer remains a separate
   authorization/test; a listening port is not proof of encrypted upload success.
   Record actual results; production integration stays NO-GO even if this trial passes.

The full-flash dump also contains credential versions. This preparation recorded a
session-exposed shared API/OTA credential in the canonical security notes; no value
is repeated here. Rotation is separate owner-authorized work, and restoring an old
dump after rotation can bring back the old key. No live rotation was performed.
