"""Compose the two isolated static PWAs; never read local emulator inputs."""
import json
from pathlib import Path
import re
import shutil
import tempfile

from build import ROOT, SITE_FILES, build as build_root, validate_site
from https_spike.build import FILES as SPIKE_FILES, build as build_spike, validate_shell

DEVICE_ORIGIN = 'https://smoker-test.navodio.cz:8443'
APP_ORIGIN = 'https://mkopal.github.io'
PAGES_FILES = SITE_FILES | {'https-spike/' + name for name in SPIKE_FILES}
CSP = ("default-src 'self'; script-src 'self'; connect-src 'self'{device}; "
       "worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'")


def check_entries(output, complete=True):
    if output.is_symlink() or not output.is_dir():
        raise ValueError('Redirected Pages output')
    found = set()
    for path in output.rglob('*'):
        name = path.relative_to(output).as_posix()
        if path.is_symlink():
            raise ValueError('Redirected Pages entry')
        if name == 'https-spike' and path.is_dir():
            continue
        if name not in PAGES_FILES or not path.is_file():
            raise ValueError('Unexpected Pages entry')
        found.add(name)
    if complete and found != PAGES_FILES:
        raise ValueError('Incomplete Pages artifact')


def validate_pages(output, inventory=ROOT / 'PAGES_FILES.txt'):
    check_entries(output)
    inventory = inventory.read_text().splitlines()
    if inventory != sorted(PAGES_FILES):
        raise ValueError('Pages file inventory mismatch')
    # Reuse the original strict root validator without relaxing its flat boundary.
    with tempfile.TemporaryDirectory(prefix='pages-root-check-') as directory:
        flat = Path(directory)
        for name in SITE_FILES:
            shutil.copyfile(output / name, flat / name)
        validate_site(flat)
    for subpath, device in (('', ''), ('https-spike', ' ' + DEVICE_ORIGIN)):
        app = output / subpath
        manifest = json.loads((app / 'manifest.webmanifest').read_text())
        if (any(manifest[key] != './' for key in ('id', 'start_url', 'scope'))
                or manifest['display'] != 'standalone'):
            raise ValueError('PWA manifest escaped its subpath')
        html = (app / 'index.html').read_text()
        policies = re.findall(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)">', html)
        if policies != [CSP.format(device=device)]:
            raise ValueError('Unexpected PWA CSP')
    validate_shell(output / 'https-spike')
    config_origin = (output / 'https-spike/config.js').read_text().splitlines()[0]
    if config_origin != 'self.SPIKE_ORIGIN = ' + json.dumps(DEVICE_ORIGIN) + ';':
        raise ValueError('Unexpected device origin')


def build(output=None):
    output = output if output is not None else ROOT / 'dist'
    if output.exists() or output.is_symlink():
        check_entries(output, complete=False)
    with tempfile.TemporaryDirectory(prefix='pages-build-') as directory:
        staged = build_root(output=Path(directory))
        build_spike(DEVICE_ORIGIN, staged / 'https-spike')
        validate_pages(staged)
        output.mkdir(parents=True, exist_ok=True)
        (output / 'https-spike').mkdir(exist_ok=True)
        for name in sorted(PAGES_FILES):
            shutil.copyfile(staged / name, output / name)
    validate_pages(output)
    print('PASS: Pages artifact contains exactly 11 root files and 10 isolated spike files')
    return output


if __name__ == '__main__':
    build()
