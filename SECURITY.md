# Experimental security boundary

The GitHub Pages site is static. It has no registration upload API, database, backend
handler or connection to an ESP32. Only the owner-run local CLI sends notifications.
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
