"""Review public Git inputs and the deploy artifact; never scan or print private local data."""
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = {
    '.gitignore', '.nvmrc', '.github/workflows/pages.yml', 'README.md', 'NOTICE.md',
    'SECURITY.md', 'VALIDATION.md', 'PUBLIC_FILES.txt', 'build.py', 'package.json',
    'package-lock.json', 'publisher.cjs', 'library-test.js', 'tests.js',
    'scripts/catalogs.py', 'scripts/audit_public.py', 'scripts/browser-test.cjs',
    'tests/test_esp32.py', 'tests/test_https_spike.py', 'scripts/https-spike-test.cjs',
    'https_spike/server.py', 'https_spike/build.py', 'https_spike/README.md',
    'https_spike/ui/index.html', 'https_spike/ui/app.js', 'https_spike/ui/style.css',
    'https_spike/ui/manifest.webmanifest', 'https_spike/ui/sw.js',
    'esp32/CMakeLists.txt', 'esp32/README.md', 'esp32/FEASIBILITY.md',
    'esp32/build.py', 'esp32/provision.cjs', 'esp32/sdkconfig.defaults',
    'esp32/partitions.csv', 'esp32/main/CMakeLists.txt',
    'esp32/main/main.cpp', 'esp32/main/push_crypto.cpp', 'esp32/main/push_crypto.h',
    'esp32/main/policy.cpp', 'esp32/main/policy.h',
    'esp32/tests/CMakeLists.txt', 'esp32/tests/driver.cpp', 'esp32/tests/test.cjs',
    'esp32/tests/serial.cpp', 'esp32/tests/stubs/sdk.h',
    'tests/test_site.py', 'web/app.js', 'web/i18n.js', 'web/index.html',
    'web/manifest.webmanifest', 'web/style.css', 'web/sw.js',
}
SENSITIVE = re.compile(rb'-----BEGIN [A-Z ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|'
                       rb'"(?:privateKey|endpoint|p256dh|auth)"\s*:\s*"[A-Za-z0-9_:/.-]{30,}"|'
                       rb'192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+')


def audit(root=ROOT):
    expected = PUBLIC_FILES | {p.relative_to(root).as_posix() for p in (root / 'web/locales').glob('*.json')}
    expected |= {p.relative_to(root).as_posix() for p in (root / 'https_spike/ui/locales').glob('*.json')}
    manifest = (root / 'PUBLIC_FILES.txt').read_text().splitlines()
    if manifest != sorted(expected):
        raise ValueError('Public file inventory mismatch')
    entries = subprocess.check_output(['git', 'ls-files', '--stage', '-z'], cwd=root).split(b'\0')
    tracked = set()
    for entry in filter(None, entries):
        metadata, raw = entry.split(b'\t', 1)
        mode, oid, stage = metadata.split()
        name = raw.decode()
        tracked.add(name)
        if name not in expected or mode not in (b'100644', b'100755') or stage != b'0':
            raise ValueError('Unexpected public Git entry')
        path = root / name
        if path.is_symlink() or not path.is_file():
            raise ValueError('Redirected public file')
        staged = subprocess.check_output(['git', 'cat-file', 'blob', oid.decode()], cwd=root)
        if any(SENSITIVE.search(content) for content in (staged, path.read_bytes())):
            raise ValueError('Sensitive-looking public content; values suppressed')
    if tracked != expected:
        raise ValueError('Stage the exact reviewed public inventory before auditing')
    from build import validate_site
    validate_site(root / 'dist')
    for path in (root / 'dist').iterdir():
        if path.suffix != '.png' and SENSITIVE.search(path.read_bytes()):
            raise ValueError('Sensitive-looking static artifact; values suppressed')
    print('PASS: exact public Git inventory, index/worktree secret heuristics and static artifact boundary')


if __name__ == '__main__':
    sys.path.insert(0, str(ROOT))
    try:
        audit()
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print('FAIL: public audit rejected inputs; inspect inventory privately', file=sys.stderr)
        raise SystemExit(1) from None
